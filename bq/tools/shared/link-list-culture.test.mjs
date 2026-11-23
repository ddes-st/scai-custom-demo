/**
 * Run: node --import tsx --test tools/shared/link-list-culture.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildLinkListTitleLanguageBlocks,
  extractLinkTextFromXml,
  resolveEnglishTitleHint,
  translateFieldForEmitCulture,
  translateLinkXmlForEmitCulture,
} from './link-list-culture.ts';
import {
  mintOpaqueEntryId,
  resetTranslationCacheMemory,
  setTranslateWithOpenAiForTests,
  TRANSLATION_CACHE_PATH,
} from './translate.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_PATH =
  TRANSLATION_CACHE_PATH ||
  path.resolve(__dirname, '../../../.bq/definitions/cache/translations.json');

/** @type {string | null} */
let backup = null;

beforeEach(() => {
  resetTranslationCacheMemory();
  setTranslateWithOpenAiForTests(null);
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
  } else if (fs.existsSync(CACHE_PATH)) {
    fs.unlinkSync(CACHE_PATH);
  }
  resetTranslationCacheMemory();
});

describe('extractLinkTextFromXml', () => {
  it('reads text attribute', () => {
    assert.equal(
      extractLinkTextFromXml('<link text="Schuldsaldoverzekering" url="/x" />'),
      'Schuldsaldoverzekering',
    );
  });

  it('unwraps &quot; wrapping from poisoned link XML', () => {
    assert.equal(
      extractLinkTextFromXml('<link text="&quot;welkom&quot;" url="/x" />'),
      'welkom',
    );
  });
});

describe('resolveEnglishTitleHint', () => {
  it('prefers English name when it differs from capture Title', () => {
    assert.equal(resolveEnglishTitleHint('Mobiliteit', 'Mobility'), 'Mobility');
  });

  it('returns null when name equals title', () => {
    assert.equal(resolveEnglishTitleHint('Mobility', 'Mobility'), null);
  });

  it('returns null for empty Title (untitled groups stay empty)', () => {
    assert.equal(resolveEnglishTitleHint('', 'Primary Links Left'), null);
    assert.equal(resolveEnglishTitleHint('   ', 'Legal Links'), null);
  });
});

describe('translateFieldForEmitCulture', () => {
  it('returns source unchanged for source culture', async () => {
    const v = await translateFieldForEmitCulture('Pensioen', 'nl-BE', 'nl-BE');
    assert.equal(v, 'Pensioen');
  });

  it('trusts cached en even when equal to source (EN may equal NL)', async () => {
    const nl = 'Mobiliteit';
    const doc = {
      version: 3,
      entries: {
        [mintOpaqueEntryId()]: {
          sourceCulture: 'nl-BE',
          translations: { 'nl-BE': nl, en: nl },
        },
      },
    };
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, `${JSON.stringify(doc, null, 2)}\n`);
    resetTranslationCacheMemory();

    let aiCalls = 0;
    setTranslateWithOpenAiForTests(async () => {
      aiCalls += 1;
      return 'ShouldNotBeCalled';
    });

    const v = await translateFieldForEmitCulture(nl, 'en', 'nl-BE');
    assert.equal(v, nl);
    assert.equal(aiCalls, 0);
  });

  it('retries only when en was missing from cache and AI returned non-English source', async () => {
    const nl = 'Mobiliteit Probe Nl666';
    if (fs.existsSync(CACHE_PATH)) fs.unlinkSync(CACHE_PATH);
    resetTranslationCacheMemory();

    let aiCalls = 0;
    setTranslateWithOpenAiForTests(async () => {
      aiCalls += 1;
      if (aiCalls === 1) return nl;
      return 'Mobility Probe';
    });

    const v = await translateFieldForEmitCulture(nl, 'en', 'nl-BE');
    assert.equal(aiCalls, 2, `expected 2 AI calls, got ${aiCalls}`);
    assert.equal(v, 'Mobility Probe');
  });
});

describe('buildLinkListTitleLanguageBlocks', () => {
  it('uses englishTitleHint for language en', async () => {
    const blocks = await buildLinkListTitleLanguageBlocks({
      titleSource: 'Mobiliteit',
      cultures: ['nl-BE', 'fr-BE'],
      sourceCulture: 'nl-BE',
      titleFieldId: '{00000000-0000-0000-0000-000000000001}',
      englishTitleHint: 'Mobility',
    });
    const en = blocks.find((b) => b.language === 'en');
    const nl = blocks.find((b) => b.language === 'nl-BE');
    assert.equal(en?.versions?.[0]?.versionFields?.[0]?.value, 'Mobility');
    assert.equal(nl?.versions?.[0]?.versionFields?.[0]?.value, 'Mobiliteit');
  });

  it('keeps Title as true empty string across cultures (no name fill-in)', async () => {
    const blocks = await buildLinkListTitleLanguageBlocks({
      titleSource: '',
      cultures: ['nl-BE', 'fr-BE'],
      sourceCulture: 'be',
      titleFieldId: '{00000000-0000-0000-0000-000000000001}',
      englishTitleHint: 'Primary Links Left',
    });
    for (const lang of ['en', 'be', 'nl-BE', 'fr-BE']) {
      const block = blocks.find((b) => b.language === lang);
      assert.equal(
        block?.versions?.[0]?.versionFields?.[0]?.value,
        '',
        `expected empty Title for ${lang}`,
      );
    }
  });
});

describe('translateLinkXmlForEmitCulture', () => {
  it('does not retry when link text en is already cached', async () => {
    const nl = 'Mobiliteit';
    const doc = {
      version: 3,
      entries: {
        [mintOpaqueEntryId()]: {
          sourceCulture: 'nl-BE',
          translations: { 'nl-BE': nl, en: nl },
        },
      },
    };
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, `${JSON.stringify(doc, null, 2)}\n`);
    resetTranslationCacheMemory();

    let aiCalls = 0;
    setTranslateWithOpenAiForTests(async () => {
      aiCalls += 1;
      return 'ShouldNotRetry';
    });

    const xml = `<link text="${nl}" url="/x" />`;
    const out = await translateLinkXmlForEmitCulture(
      xml,
      'en',
      'nl-BE',
      async () => xml,
    );
    assert.equal(extractLinkTextFromXml(out), nl);
    assert.equal(aiCalls, 0);
  });
});
