/**
 * Unit tests for resolveContentLanguages + culture helpers.
 * Run: node --import tsx --test tools/shared/resolve-content-languages.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizeCultureKey,
  resolveContentLanguages,
  toSitecoreCulture,
} from './resolve-content-languages.ts';
import {
  ensureDefinitionSourceCulture,
  toSitecoreCulture as toSitecoreCultureMjs,
} from './cultures.mjs';
import {
  fixJsxClassNameEscapedQuotes,
} from '../create-section-components/ai-source-fixup.mjs';
import {
  extractLinkStubsFromDefinitionTs,
} from '../create-section-components/stub-pages.mjs';
import {
  mintOpaqueEntryId,
  normalizeCultureKeyForCache,
  resetTranslationCacheMemory,
  setForceTranslations,
  translateText,
} from './translate-core.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = path.resolve(
  __dirname,
  '../../../.bq/definitions/cache/translations.json',
);

describe('resolveContentLanguages', () => {
  it('always includes en and source culture', () => {
    const r = resolveContentLanguages({
      culture: 'nl-BE',
      cultures: ['fr-BE'],
    });
    assert.equal(r.sourceCulture, 'nl-BE');
    assert.deepEqual(r.emitCultures, ['en', 'nl-BE', 'fr-BE']);
  });

  it('dedupes en when listed in cultures', () => {
    const r = resolveContentLanguages({
      culture: 'en',
      cultures: ['en', 'nl-BE'],
    });
    assert.deepEqual(r.emitCultures, ['en', 'nl-BE']);
  });

  it('defaults source to en', () => {
    const r = resolveContentLanguages({ cultures: ['nl-BE'] });
    assert.equal(r.sourceCulture, 'en');
    assert.ok(r.emitCultures.includes('en'));
    assert.ok(r.emitCultures.includes('nl-BE'));
  });
});

describe('toSitecoreCulture / normalizeCultureKey', () => {
  it('maps short nl to nl-BE preferring cultures list', () => {
    assert.equal(toSitecoreCulture('nl', ['nl-BE', 'fr-BE']), 'nl-BE');
    assert.equal(toSitecoreCultureMjs('nl', ['nl-BE', 'fr-BE']), 'nl-BE');
    assert.equal(normalizeCultureKey('nl'), 'nl-BE');
    assert.equal(normalizeCultureKeyForCache('nl-be'), 'nl-BE');
    assert.equal(normalizeCultureKeyForCache('en-US'), 'en');
  });
});

describe('ensureDefinitionSourceCulture', () => {
  it('inserts culture inside content block', () => {
    const src = `export const x = {
  content: {
    location: { root: "data", folder: ["X"] },
    items: [],
  },
};`;
    const out = ensureDefinitionSourceCulture(src, 'nl-BE');
    assert.match(out, /culture:\s*"nl-BE"/);
  });
});

describe('fixJsxClassNameEscapedQuotes', () => {
  it("rewrites font-[\\\"…\\\"] to font-['…']", () => {
    const bad = `className="mx-0 font-[\\"Source_Sans_Pro\\"] md:mb-20"`;
    const out = fixJsxClassNameEscapedQuotes(bad);
    assert.match(out, /font-\['Source_Sans_Pro'\]/);
    assert.doesNotMatch(out, /\\"/);
  });
});

describe('extractLinkStubsFromDefinitionTs', () => {
  it('extracts same-site paths and skips facebook', () => {
    const def = `
content: {
  items: [{
    children: [
      { fields: { Link: { text: "Jobs", url: "https://www.axa.be/nl/jobs" } } },
      { fields: { Link: { text: "FB", url: "https://www.facebook.com/AXA" } } },
      { fields: { Link: { text: "FAQ", url: "/nl/veelgestelde-vragen" } } },
    ]
  }]
}`;
    const stubs = extractLinkStubsFromDefinitionTs(
      def,
      'https://www.axa.be/nl/particulieren',
    );
    const paths = stubs.map((s) => s.path).sort();
    assert.deepEqual(paths, ['/jobs', '/veelgestelde-vragen']);
  });

  it('strips market/language folders (/be/en/…) from stub paths', () => {
    const def = `
content: {
  items: [{
    children: [
      { fields: { Link: { text: "Product", url: "https://www.dom-security.com/be/en/products/els" } } },
    ]
  }]
}`;
    const stubs = extractLinkStubsFromDefinitionTs(
      def,
      'https://www.dom-security.com/be/en/',
    );
    assert.deepEqual(
      stubs.map((s) => s.path),
      ['/products/els'],
    );
  });
});

describe('translateText cache force + reverse', () => {
  it('force still uses cache hit; reverse pair works', async () => {
    resetTranslationCacheMemory();
    const en = 'HelloUniqueCacheProbeBq123';
    const nl = 'HalloUniqueCacheProbeBq123';
    const cache = {
      version: 3,
      entries: {
        [mintOpaqueEntryId()]: {
          sourceCulture: 'en',
          translations: {
            en,
            'nl-BE': nl,
          },
        },
      },
    };
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`);
    resetTranslationCacheMemory();

    setForceTranslations(true);
    const a = await translateText(en, 'nl-BE', 'en');
    assert.equal(a, nl);
    const b = await translateText(nl, 'en', 'nl-BE');
    assert.equal(b, en);
    setForceTranslations(false);
    resetTranslationCacheMemory();
  });
});
