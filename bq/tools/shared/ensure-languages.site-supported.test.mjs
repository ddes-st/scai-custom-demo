/**
 * Site supportedLanguages via Sites API (normalize + ensureSiteSupportedLanguages).
 * Run: node --import tsx --test tools/shared/ensure-languages.site-supported.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  mergeSiteSupportedLanguages,
  normalizeSiteSupportedLanguages,
  remoteSiteSupportedLanguages,
  siteSupportedLanguagesIncomplete,
} from '../definitions/apply/sites-api.ts';
import {
  ensureSiteSupportedLanguages,
} from './ensure-languages.ts';
import { emptyWriteStats } from './authoring-item-model.ts';

describe('normalizeSiteSupportedLanguages', () => {
  it('always includes en and collapses en-*', () => {
    assert.deepEqual(normalizeSiteSupportedLanguages(['nl-NL', 'en-US']), [
      'en',
      'nl-NL',
    ]);
  });

  it('dedupes case-insensitively', () => {
    assert.deepEqual(normalizeSiteSupportedLanguages(['nl-NL', 'NL-NL', 'en']), [
      'en',
      'nl-NL',
    ]);
  });

  it('empty input still yields en', () => {
    assert.deepEqual(normalizeSiteSupportedLanguages([]), ['en']);
    assert.deepEqual(normalizeSiteSupportedLanguages(null), ['en']);
  });
});

describe('remote / merge / incomplete', () => {
  it('prefers supportedLanguages over languages on ApiSite', () => {
    assert.deepEqual(
      remoteSiteSupportedLanguages({
        supportedLanguages: ['en', 'nl-NL'],
        languages: ['en'],
      }),
      ['en', 'nl-NL'],
    );
  });

  it('falls back to languages when supportedLanguages absent', () => {
    assert.deepEqual(
      remoteSiteSupportedLanguages({ languages: ['da', 'en'] }),
      ['en', 'da'],
    );
  });

  it('merge unions remote + needed', () => {
    assert.deepEqual(
      mergeSiteSupportedLanguages(['en'], ['nl-NL', 'fr-BE']),
      ['en', 'nl-NL', 'fr-BE'],
    );
  });

  it('incomplete when needed culture missing', () => {
    assert.equal(
      siteSupportedLanguagesIncomplete(['en'], ['en', 'nl-NL']),
      true,
    );
    assert.equal(
      siteSupportedLanguagesIncomplete(['en', 'nl-NL'], ['en', 'nl-NL']),
      false,
    );
  });
});

describe('ensureSiteSupportedLanguages', () => {
  const ctx = {
    endpoint: {},
    environmentId: 'env',
    token: 'tok',
  };

  it('skips when siteSystem missing', async () => {
    const result = await ensureSiteSupportedLanguages(
      { siteSystem: '', cultures: ['nl-NL'] },
      {
        ensureSystemLanguages: async () => {
          throw new Error('should not ensure');
        },
      },
    );
    assert.equal(result, 'skipped');
  });

  it('skips when site not found', async () => {
    let ensured = false;
    const result = await ensureSiteSupportedLanguages(
      { siteSystem: 'menzis-nl', cultures: ['nl-NL'] },
      {
        ensureSystemLanguages: async () => {
          ensured = true;
          return emptyWriteStats();
        },
        createSitesApiContext: async () => ctx,
        findSiteByName: async () => undefined,
        updateSiteViaApi: async () => {
          throw new Error('should not patch');
        },
      },
    );
    assert.equal(ensured, true);
    assert.equal(result, 'skipped');
  });

  it('unchanged when remote already has cultures', async () => {
    let patched = false;
    const result = await ensureSiteSupportedLanguages(
      { siteSystem: 'menzis-nl', cultures: ['nl-NL'] },
      {
        ensureSystemLanguages: async () => emptyWriteStats(),
        createSitesApiContext: async () => ctx,
        findSiteByName: async () => ({
          id: 'site-1',
          name: 'menzis-nl',
          supportedLanguages: ['en', 'nl-NL'],
        }),
        updateSiteViaApi: async () => {
          patched = true;
          return undefined;
        },
      },
    );
    assert.equal(result, 'unchanged');
    assert.equal(patched, false);
  });

  it('PATCHes supportedLanguages when culture missing (existing env lang)', async () => {
    /** @type {string[]|undefined} */
    let patched;
    const result = await ensureSiteSupportedLanguages(
      { siteSystem: 'menzis-nl', cultures: ['nl-NL'] },
      {
        ensureSystemLanguages: async () => emptyWriteStats(),
        createSitesApiContext: async () => ctx,
        findSiteByName: async () => ({
          id: 'site-1',
          name: 'menzis-nl',
          supportedLanguages: ['en'],
        }),
        updateSiteViaApi: async (_ctx, id, input) => {
          assert.equal(id, 'site-1');
          patched = input.supportedLanguages;
          return { id, supportedLanguages: patched };
        },
      },
    );
    assert.equal(result, 'updated');
    assert.deepEqual(patched, ['en', 'nl-NL']);
  });

  it('ensures env languages before PATCH', async () => {
    /** @type {string[]} */
    const ensured = [];
    await ensureSiteSupportedLanguages(
      { siteSystem: 'menzis-nl', cultures: ['nl-NL', 'fr-BE'] },
      {
        ensureSystemLanguages: async (cultures) => {
          ensured.push(...cultures);
          return emptyWriteStats();
        },
        createSitesApiContext: async () => ctx,
        findSiteByName: async () => ({
          id: 'site-1',
          supportedLanguages: ['en'],
        }),
        updateSiteViaApi: async () => ({ id: 'site-1' }),
      },
    );
    assert.deepEqual(ensured, ['en', 'nl-NL', 'fr-BE']);
  });
});

describe('create-site languages body shape', () => {
  it('create payload languages matches normalize (en + cultures)', () => {
    // Mirrors syncSiteViaApi create: always send normalized languages.
    const inputLanguages = ['nl-NL'];
    const inputLanguage = 'en';
    const bodyLanguages = normalizeSiteSupportedLanguages([
      inputLanguage,
      ...inputLanguages,
    ]);
    assert.deepEqual(bodyLanguages, ['en', 'nl-NL']);
  });
});
