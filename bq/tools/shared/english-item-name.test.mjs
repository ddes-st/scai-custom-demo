/**
 * Run: node --import tsx --test tools/shared/english-item-name.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { resolveEnglishItemName } from './english-item-name.ts';
import {
  isPoisonedEnglishIdentity,
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
  backup = fs.existsSync(CACHE_PATH) ? fs.readFileSync(CACHE_PATH, 'utf8') : null;
});

afterEach(() => {
  setTranslateWithOpenAiForTests(null);
  resetTranslationCacheMemory();
  if (backup != null) {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, backup, 'utf8');
  }
});

describe('resolveEnglishItemName structuralFolder', () => {
  it('keeps already-English Data folder segments under nl-BE (no Site→Website)', async () => {
    let called = 0;
    setTranslateWithOpenAiForTests(async (text) => {
      called += 1;
      return String(text).replace(/\bSite\b/g, 'Website');
    });
    try {
      const out = await resolveEnglishItemName('Crelan Site Footers', {
        sourceLanguage: 'nl-BE',
        structuralFolder: true,
      });
      assert.equal(out, 'Crelan Site Footers');
      assert.equal(
        called,
        0,
        'must not call translate for already-English structural folder',
      );
    } finally {
      setTranslateWithOpenAiForTests(null);
    }
  });
});

describe('resolveEnglishItemName poisoned Dutch EN identity', () => {
  it('detects Welkom headline as poisoned EN identity', () => {
    const nl =
      'Welkom bij Crelan, de bank die dicht bij haar klanten staat';
    assert.equal(isPoisonedEnglishIdentity(nl, nl), true);
  });

  it('re-translates poisoned Welkom cache to English Path name', async () => {
    const nl =
      'Welkom bij Crelan, de bank die dicht bij haar klanten staat';
    const doc = backup ? JSON.parse(backup) : { version: 3, entries: {} };
    doc.version = 3;
    doc.entries = doc.entries || {};
    doc.entries[mintOpaqueEntryId()] = {
      sourceCulture: 'nl-BE',
      translations: { en: nl, 'nl-BE': nl },
    };
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(doc, null, 2), 'utf8');
    resetTranslationCacheMemory();

    let aiCalls = 0;
    setTranslateWithOpenAiForTests(async () => {
      aiCalls += 1;
      return 'Welcome to Crelan, the bank close to its customers';
    });

    const out = await resolveEnglishItemName(nl, { sourceLanguage: 'nl-BE' });
    assert.match(out, /Welcome to Crelan/i);
    assert.equal(isPoisonedEnglishIdentity(nl, out), false);
    assert.ok(aiCalls >= 1, 'must call AI to replace poisoned EN identity');
  });
});
