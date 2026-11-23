/**
 * Multilingual URL route cache.
 * Run: node --import tsx --test tools/shared/url-route-cache.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  URL_ROUTES_CACHE_PATH,
  lookupByEnglishPath,
  lookupByLocalePath,
  makeSiteKey,
  normalizeLocalePath,
  rememberRoute,
  resetUrlRouteCacheMemory,
  resolveCanonicalEnglishPath,
  stripCulturePrefixes,
  toEnglishPathSegment,
} from './url-route-cache.ts';
import {
  lookupPhrase,
  resetTranslationCacheMemory,
  setTranslateWithOpenAiForTests,
  TRANSLATION_CACHE_PATH,
} from './translate.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_PATH =
  URL_ROUTES_CACHE_PATH ||
  path.resolve(__dirname, '../../../.bq/definitions/cache/url-routes.json');
const TRANSLATION_PATH =
  TRANSLATION_CACHE_PATH ||
  path.resolve(__dirname, '../../../.bq/definitions/cache/translations.json');

/** @type {string | null} */
let backup = null;
/** @type {string | null} */
let translationBackup = null;

beforeEach(() => {
  resetUrlRouteCacheMemory();
  resetTranslationCacheMemory();
  if (fs.existsSync(CACHE_PATH)) {
    backup = fs.readFileSync(CACHE_PATH, 'utf8');
  } else {
    backup = null;
  }
  if (fs.existsSync(TRANSLATION_PATH)) {
    translationBackup = fs.readFileSync(TRANSLATION_PATH, 'utf8');
  } else {
    translationBackup = null;
  }
  if (fs.existsSync(CACHE_PATH)) fs.unlinkSync(CACHE_PATH);
  // Keep real translations for other tests; only assert seed via unique probe phrases.
  resetUrlRouteCacheMemory();
  resetTranslationCacheMemory();
});

afterEach(() => {
  resetUrlRouteCacheMemory();
  resetTranslationCacheMemory();
  if (backup != null) {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, backup, 'utf8');
  } else if (fs.existsSync(CACHE_PATH)) {
    fs.unlinkSync(CACHE_PATH);
  }
  if (translationBackup != null) {
    fs.mkdirSync(path.dirname(TRANSLATION_PATH), { recursive: true });
    fs.writeFileSync(TRANSLATION_PATH, translationBackup, 'utf8');
  }
  resetUrlRouteCacheMemory();
  resetTranslationCacheMemory();
});

describe('normalizeLocalePath', () => {
  it('lowercases, strips query/hash, trims trailing slash', () => {
    assert.equal(
      normalizeLocalePath('/NL/Particulieren/Pensioen/?x=1#frag'),
      '/nl/particulieren/pensioen',
    );
    assert.equal(normalizeLocalePath('/'), '/');
  });
});

describe('stripCulturePrefixes', () => {
  it('strips leading locale and culture codes', () => {
    assert.deepEqual(
      stripCulturePrefixes(['nl', 'particulieren', 'pensioen'], ['nl-BE', 'fr-BE']),
      ['particulieren', 'pensioen'],
    );
    assert.deepEqual(
      stripCulturePrefixes(['nl-BE', 'particulieren'], ['nl-BE']),
      ['particulieren'],
    );
    assert.deepEqual(
      stripCulturePrefixes(['be', 'en', 'products', 'els'], []),
      ['products', 'els'],
    );
  });
});

describe('resolveCanonicalEnglishPath', () => {
  it('maps NL and FR glossary segments to the same English path', async () => {
    const cultures = ['nl-BE', 'fr-BE'];
    const nl = await resolveCanonicalEnglishPath({
      pathname: '/nl/particulieren/pensioen',
      sourceCulture: 'nl-BE',
      cultures,
    });
    const fr = await resolveCanonicalEnglishPath({
      pathname: '/fr/particuliers/pension',
      sourceCulture: 'fr-BE',
      cultures,
    });
    assert.equal(nl, '/individuals/pension');
    assert.equal(fr, '/individuals/pension');
  });

  it('is stable across repeated resolve (no translate drift on glossary)', async () => {
    const a = await resolveCanonicalEnglishPath({
      pathname: '/particulieren/gezin',
      sourceCulture: 'nl-BE',
      cultures: ['nl-BE'],
    });
    const b = await resolveCanonicalEnglishPath({
      pathname: '/particulieren/gezin',
      sourceCulture: 'nl-BE',
      cultures: ['nl-BE'],
    });
    assert.equal(a, '/individuals/family');
    assert.equal(b, a);
  });

  it('maps crelan NL banking path to fully English leaves (no Dutch)', async () => {
    const pathEn = await resolveCanonicalEnglishPath({
      pathname: '/nl/particulieren/sparen-en-beleggen/beleggen',
      sourceCulture: 'nl-BE',
      cultures: ['nl-BE'],
    });
    assert.equal(pathEn, '/individuals/saving-and-investing/investing');
    assert.doesNotMatch(pathEn, /sparen|beleggen|particulieren|lenen|betalen/i);

    const deep = await resolveCanonicalEnglishPath({
      pathname:
        '/nl/particulieren/sparen-en-beleggen/beleggen/product/beleggingsadvies',
      sourceCulture: 'nl-BE',
      cultures: ['nl-BE'],
    });
    assert.equal(
      deep,
      '/individuals/saving-and-investing/investing/product/investment-advice',
    );
    assert.doesNotMatch(deep, /beleggingsadvies|sparen-en-beleggen/i);
  });

  it('translates zoeken even when sourceCulture is wrongly en', async () => {
    if (fs.existsSync(TRANSLATION_PATH)) fs.unlinkSync(TRANSLATION_PATH);
    resetTranslationCacheMemory();
    setTranslateWithOpenAiForTests(async (text, target, from) => {
      assert.equal(target, 'en');
      assert.match(String(from), /nl/i);
      assert.match(String(text), /zoeken/i);
      return 'search';
    });
    try {
      const leaf = await toEnglishPathSegment('zoeken', 'en', 'link-page-path');
      assert.match(leaf, /search/i);
      assert.doesNotMatch(leaf, /zoeken/i);

      const pathEn = await resolveCanonicalEnglishPath({
        pathname: '/nl/particulieren/zoeken',
        sourceCulture: 'en',
        cultures: ['nl-BE'],
      });
      assert.equal(pathEn, '/individuals/search');
    } finally {
      setTranslateWithOpenAiForTests(null);
    }
  });
});

describe('rememberRoute / lookup', () => {
  it('reuses englishPath + itemId for NL and FR aliases of the same route', () => {
    const siteKey = makeSiteKey('axa', 'axa-be');
    const itemId = '{aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee}';
    const englishPath = '/individuals/pension';

    rememberRoute({
      siteKey,
      localePath: '/nl/particulieren/pensioen',
      englishPath,
      itemId,
      sourceCulture: 'nl-BE',
    });
    rememberRoute({
      siteKey,
      localePath: '/fr/particuliers/pension',
      englishPath,
      itemId,
      sourceCulture: 'fr-BE',
    });

    const nl = lookupByLocalePath(siteKey, '/nl/particulieren/pensioen');
    const fr = lookupByLocalePath(siteKey, '/fr/particuliers/pension');
    assert.ok(nl);
    assert.ok(fr);
    assert.equal(nl.englishPath, englishPath);
    assert.equal(fr.englishPath, englishPath);
    assert.equal(nl.itemId, itemId);
    assert.equal(fr.itemId, itemId);

    const byEn = lookupByEnglishPath(siteKey, englishPath);
    assert.ok(byEn);
    assert.equal(byEn.itemId, itemId);
    assert.deepEqual(byEn.localePaths.sort(), [
      '/fr/particuliers/pension',
      '/nl/particulieren/pensioen',
    ]);
  });

  it('persists to disk and reloads after memory reset', () => {
    const siteKey = makeSiteKey('axa', 'axa-be');
    rememberRoute({
      siteKey,
      localePath: '/nl/particulieren/woning',
      englishPath: '/individuals/property',
      itemId: '{11111111-2222-3333-4444-555555555555}',
      sourceCulture: 'nl-BE',
    });
    assert.ok(fs.existsSync(CACHE_PATH));

    resetUrlRouteCacheMemory();
    const hit = lookupByLocalePath(siteKey, '/nl/particulieren/woning/');
    assert.ok(hit);
    assert.equal(hit.englishPath, '/individuals/property');
  });

  it('seeds translation cache per path segment', () => {
    const siteKey = makeSiteKey('axa', 'axa-be');
    const localeLeaf = 'url-route-seed-probe-nl-xyz';
    const englishLeaf = 'url-route-seed-probe-en-xyz';
    rememberRoute({
      siteKey,
      localePath: `/nl/particulieren/${localeLeaf}`,
      englishPath: `/individuals/${englishLeaf}`,
      itemId: '{22222222-3333-4444-5555-666666666666}',
      sourceCulture: 'nl-BE',
      cultures: ['nl-BE', 'fr-BE'],
    });

    const leaf = lookupPhrase('nl-BE', localeLeaf);
    assert.ok(leaf);
    assert.equal(leaf.translations.en, englishLeaf);

    // Parent segment also seeded when missing (glossary-equivalent mapping).
    const parent = lookupPhrase('nl-BE', 'particulieren');
    assert.ok(parent?.translations?.en);
    assert.match(String(parent.translations.en), /individual/i);
  });
});
