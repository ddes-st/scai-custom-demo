/**
 * Grouped translation cache v3 unit tests.
 * Run: node --test tools/shared/translate-cache.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isNonTranslatable,
  lookupPhrase,
  mintOpaqueEntryId,
  normalizeCacheDocument,
  normalizeCultureKeyForCache,
  resetTranslationCacheMemory,
  setForceTranslations,
  setTranslateWithOpenAiForTests,
  translateText,
  TRANSLATION_CACHE_PATH,
} from './translate-core.mjs';

process.env.BQ_TRANSLATE_CACHE_LOG = 'silent';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = TRANSLATION_CACHE_PATH || path.resolve(
  __dirname,
  '../../../.bq/definitions/cache/translations.json',
);

/** @type {string | null} */
let backup = null;

beforeEach(() => {
  resetTranslationCacheMemory();
  if (fs.existsSync(CACHE_PATH)) {
    backup = fs.readFileSync(CACHE_PATH, 'utf8');
  } else {
    backup = null;
  }
});

afterEach(() => {
  setTranslateWithOpenAiForTests(null);
  resetTranslationCacheMemory();
  if (backup != null) {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, backup, 'utf8');
  }
  setForceTranslations(false);
});

function isOpaqueGuid(id) {
  return /^[0-9a-f]{32}$/i.test(String(id || ''));
}

describe('isNonTranslatable + skip AI', () => {
  it('treats phones, spaced numbers, metrics, and emails as non-translatable', () => {
    assert.equal(isNonTranslatable('+ 3238291087'), true);
    assert.equal(isNonTranslatable('+32 3 829 10 87'), true);
    assert.equal(isNonTranslatable('120 000'), true);
    assert.equal(isNonTranslatable('1 200 000'), true);
    assert.equal(isNonTranslatable('€3,200'), true);
    assert.equal(isNonTranslatable('(03) 829-10-87'), true);
    assert.equal(isNonTranslatable('3%'), true);
    assert.equal(isNonTranslatable('info@axa.be'), true);
    assert.equal(isNonTranslatable('mailto:support@example.com'), true);
  });

  it('does not skip when letters are present (non-email)', () => {
    assert.equal(isNonTranslatable('120 000 klanten'), false);
    assert.equal(isNonTranslatable('+ info'), false);
    assert.equal(isNonTranslatable('Call us'), false);
    assert.equal(isNonTranslatable('email info@axa.be please'), false);
  });

  it('translateText skips AI for non-translatable numbers and emails', async () => {
    let aiCalls = 0;
    setTranslateWithOpenAiForTests(async () => {
      aiCalls += 1;
      return 'SHOULD_NOT_RUN';
    });
    assert.equal(await translateText('+ 3238291087', 'nl-BE', 'en'), '+ 3238291087');
    assert.equal(await translateText('120 000', 'fr-BE', 'en'), '120 000');
    assert.equal(await translateText('info@axa.be', 'nl-BE', 'en'), 'info@axa.be');
    assert.equal(aiCalls, 0);
  });

  it('translateText requires sourceCulture', async () => {
    await assert.rejects(
      () => translateText('Hello', 'nl-BE', ''),
      /sourceCulture is required/,
    );
    await assert.rejects(
      () => translateText('Hello', 'nl-BE', undefined),
      /sourceCulture is required/,
    );
  });
});

describe('mintOpaqueEntryId', () => {
  it('returns 32-hex and is not phrase-derived', () => {
    const a = mintOpaqueEntryId();
    const b = mintOpaqueEntryId();
    assert.ok(isOpaqueGuid(a));
    assert.ok(isOpaqueGuid(b));
    assert.notEqual(a, b);
  });
});

describe('normalizeCacheDocument', () => {
  it('passes through v3', () => {
    const id = mintOpaqueEntryId();
    const raw = {
      version: 3,
      entries: {
        [id]: {
          sourceCulture: 'en',
          translations: { en: 'Hi', 'nl-BE': 'Hoi' },
        },
      },
    };
    const { cache, migrated } = normalizeCacheDocument(raw);
    assert.equal(migrated, false);
    assert.equal(cache.version, 3);
    assert.equal(cache.entries[id].translations['nl-BE'], 'Hoi');
  });

  it('rejects v2 (no migration)', () => {
    const { cache, migrated } = normalizeCacheDocument({
      version: 2,
      entries: {
        'en|Hi': {
          sourceCulture: 'en',
          sourceText: 'Hi',
          translations: { en: 'Hi', 'nl-BE': 'Hoi' },
        },
      },
    });
    assert.equal(migrated, false);
    assert.equal(cache.version, 3);
    assert.equal(Object.keys(cache.entries).length, 0);
  });

  it('rejects flat v1 (no migration)', () => {
    const { cache, migrated } = normalizeCacheDocument({
      'en|nl-BE|XyzProbe': 'XyzNl',
    });
    assert.equal(migrated, false);
    assert.equal(cache.version, 3);
    assert.equal(Object.keys(cache.entries).length, 0);
  });
});

describe('culture heal + case fold + already-english', () => {
  it('heals bare be into nl-BE and merges with en group', () => {
    process.env.BQ_CULTURES = 'nl-BE,fr-BE';
    const en = 'BeHealProbeEn111';
    const nl = 'BeHealProbeNl111';
    const idBe = mintOpaqueEntryId();
    const idEn = mintOpaqueEntryId();
    const doc = {
      version: 3,
      entries: {
        [idBe]: {
          sourceCulture: 'be',
          translations: { be: en, 'fr-BE': 'BeHealFr111' },
        },
        [idEn]: {
          sourceCulture: 'en',
          translations: { en, 'nl-BE': nl },
        },
      },
    };
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, `${JSON.stringify(doc, null, 2)}\n`);
    resetTranslationCacheMemory();

    const { cache, healed, migrated } = normalizeCacheDocument(
      JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')),
    );
    assert.equal(migrated, false);
    assert.ok(healed >= 1);
    const ids = Object.keys(cache.entries);
    assert.equal(ids.length, 1);
    assert.ok(isOpaqueGuid(ids[0]));
    const entry = cache.entries[ids[0]];
    assert.ok(entry.translations['nl-BE'] || entry.translations.en);
    assert.ok(entry.translations['fr-BE']);
    assert.ok(!Object.keys(entry.translations).includes('be'));
  });

  it('case-insensitive Jobs/jobs hits same entry', async () => {
    const id = mintOpaqueEntryId();
    const doc = {
      version: 3,
      entries: {
        [id]: {
          sourceCulture: 'nl-BE',
          translations: { 'nl-BE': 'Jobs', en: 'Jobs', 'fr-BE': 'Emplois' },
        },
      },
    };
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, `${JSON.stringify(doc, null, 2)}\n`);
    resetTranslationCacheMemory();

    let aiCalls = 0;
    setTranslateWithOpenAiForTests(async () => {
      aiCalls += 1;
      return 'SHOULD_NOT_RUN';
    });

    assert.equal(await translateText('jobs', 'fr-BE', 'nl-BE'), 'Emplois');
    assert.equal(aiCalls, 0);
  });

  it('nl-BE→en does not already_english-skip; de-DE miss then hit', async () => {
    resetTranslationCacheMemory();
    if (fs.existsSync(CACHE_PATH)) fs.unlinkSync(CACHE_PATH);

    let aiCalls = 0;
    setTranslateWithOpenAiForTests(async (text, target) => {
      aiCalls += 1;
      if (target === 'en') return 'Jobs';
      if (target === 'de-DE') return 'Stellen';
      return `AI:${text}`;
    });

    const en = await translateText('Jobs', 'en', 'nl-BE');
    assert.equal(en, 'Jobs');
    assert.equal(aiCalls, 1);

    const de = await translateText('Jobs', 'de-DE', 'nl-BE');
    assert.equal(de, 'Stellen');
    assert.equal(aiCalls, 2);

    const de2 = await translateText('jobs', 'de-DE', 'nl-BE');
    assert.equal(de2, 'Stellen');
    assert.equal(aiCalls, 2);

    const onDisk = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    assert.equal(onDisk.version, 3);
    const ids = Object.keys(onDisk.entries);
    assert.equal(ids.length, 1);
    assert.ok(isOpaqueGuid(ids[0]));
  });

  it('nl-BE path slug beleggen → en does not return already_english skip', async () => {
    resetTranslationCacheMemory();
    if (fs.existsSync(CACHE_PATH)) fs.unlinkSync(CACHE_PATH);

    let aiCalls = 0;
    setTranslateWithOpenAiForTests(async (text, target) => {
      aiCalls += 1;
      assert.equal(target, 'en');
      assert.match(String(text), /beleggen/i);
      return 'investing';
    });

    const en = await translateText('beleggen', 'en', 'nl-BE');
    assert.equal(en, 'investing');
    assert.notEqual(en, 'beleggen');
    assert.equal(aiCalls, 1);

    const en2 = await translateText('beleggen', 'en', 'nl-BE');
    assert.equal(en2, 'investing');
    assert.equal(aiCalls, 1);
  });

  it('nl-BE→fr-FR miss also materializes en', async () => {
    resetTranslationCacheMemory();
    if (fs.existsSync(CACHE_PATH)) fs.unlinkSync(CACHE_PATH);

    let aiCalls = 0;
    setTranslateWithOpenAiForTests(async (text, target) => {
      aiCalls += 1;
      if (target === 'fr-FR' || target === 'fr-BE') return 'Chercher';
      if (target === 'en') return 'Search';
      return `AI:${target}`;
    });

    const fr = await translateText('zoeken', 'fr-BE', 'nl-BE');
    assert.equal(fr, 'Chercher');
    assert.ok(aiCalls >= 2, 'expected target + en AI calls');

    const onDisk = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    const ids = Object.keys(onDisk.entries);
    assert.equal(ids.length, 1);
    assert.ok(isOpaqueGuid(ids[0]));
    const entry = onDisk.entries[ids[0]];
    assert.equal(entry.translations['nl-BE'], 'zoeken');
    assert.equal(entry.translations['fr-BE'], 'Chercher');
    assert.equal(entry.translations.en, 'Search');
    assert.equal(entry.sourceText, undefined);

    // Second call reuses same GUID via index
    const fr2 = await translateText('zoeken', 'fr-BE', 'nl-BE');
    assert.equal(fr2, 'Chercher');
    const ids2 = Object.keys(JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')).entries);
    assert.deepEqual(ids2, ids);
  });

  it('link-page-path retries when AI echoes Dutch zoeken', async () => {
    resetTranslationCacheMemory();
    if (fs.existsSync(CACHE_PATH)) fs.unlinkSync(CACHE_PATH);

    let aiCalls = 0;
    setTranslateWithOpenAiForTests(async (text, target) => {
      aiCalls += 1;
      assert.equal(target, 'en');
      assert.match(String(text), /zoeken/i);
      return aiCalls === 1 ? 'zoeken' : 'search';
    });

    const en = await translateText('zoeken', 'en', 'nl-BE', {
      purpose: 'link-page-path',
    });
    assert.equal(en, 'search');
    assert.equal(aiCalls, 2);
  });

  it('short de normalizes to de-DE', () => {
    assert.equal(normalizeCultureKeyForCache('de'), 'de-DE');
    assert.equal(normalizeCultureKeyForCache('DE-de'), 'de-DE');
  });
});

describe('lookupPhrase + translateText cache hits', () => {
  it('lookupPhrase finds by any culture and returns all translations', () => {
    const en = 'GroupedLookupProbeEn999';
    const nl = 'GroupedLookupProbeNl999';
    const fr = 'GroupedLookupProbeFr999';
    const id = mintOpaqueEntryId();
    const doc = {
      version: 3,
      entries: {
        [id]: {
          sourceCulture: 'en',
          translations: { en, 'nl-BE': nl, 'fr-BE': fr },
        },
      },
    };
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, `${JSON.stringify(doc, null, 2)}\n`);
    resetTranslationCacheMemory();

    const fromNl = lookupPhrase('nl-BE', nl);
    assert.ok(fromNl);
    assert.equal(fromNl.sourceCulture, 'en');
    assert.equal(fromNl.sourceText, en);
    assert.equal(fromNl.translations['fr-BE'], fr);

    const fromFr = lookupPhrase('fr-BE', fr);
    assert.equal(fromFr?.translations['nl-BE'], nl);
  });

  it('translateText hits cache for missing-culture only after append (fixture has fr)', async () => {
    const en = 'MissingCultureProbeEn888';
    const nl = 'MissingCultureProbeNl888';
    const fr = 'MissingCultureProbeFr888';
    const id = mintOpaqueEntryId();
    const doc = {
      version: 3,
      entries: {
        [id]: {
          sourceCulture: 'en',
          translations: { en, 'nl-BE': nl, 'fr-BE': fr },
        },
      },
    };
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, `${JSON.stringify(doc, null, 2)}\n`);
    resetTranslationCacheMemory();

    assert.equal(await translateText(en, 'fr-BE', 'en'), fr);
    assert.equal(await translateText(nl, 'fr-BE', 'nl-BE'), fr);
  });

  it('missing target culture calls AI once and appends to the same entry', async () => {
    const en = 'AppendCultureProbeEn777';
    const nl = 'AppendCultureProbeNl777';
    const fr = 'AppendCultureProbeFr777';
    const id = mintOpaqueEntryId();
    const doc = {
      version: 3,
      entries: {
        [id]: {
          sourceCulture: 'en',
          translations: { en, 'nl-BE': nl },
        },
      },
    };
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, `${JSON.stringify(doc, null, 2)}\n`);
    resetTranslationCacheMemory();

    let aiCalls = 0;
    setTranslateWithOpenAiForTests(async (text, targetCulture, sourceCulture) => {
      aiCalls += 1;
      assert.equal(text, en);
      assert.equal(sourceCulture, 'en');
      assert.equal(targetCulture, 'fr-BE');
      return fr;
    });

    assert.equal(await translateText(nl, 'fr-BE', 'nl-BE'), fr);
    assert.equal(aiCalls, 1);

    assert.equal(await translateText(en, 'fr-BE', 'en'), fr);
    assert.equal(aiCalls, 1);

    const onDisk = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    assert.equal(Object.keys(onDisk.entries).length, 1);
    const entry = onDisk.entries[id];
    assert.ok(entry);
    assert.equal(entry.translations['nl-BE'], nl);
    assert.equal(entry.translations['fr-BE'], fr);
    assert.equal(entry.sourceText, undefined);

    const phrase = lookupPhrase('fr-BE', fr);
    assert.equal(phrase?.sourceText, en);
    assert.equal(phrase?.translations['nl-BE'], nl);
  });
});
