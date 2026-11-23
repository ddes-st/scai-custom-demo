/**
 * Media URL unwrap + sourceKey-gated leaf reuse.
 * Run: node --import tsx --test tools/shared/media-from-source.test.mjs
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  absolutizeMediaDownloadUrl,
  fetchMediaUrlWithRetries,
  isMediaDownloadFailure,
  loadMediaBytes,
  mediaSourceKeysCompatible,
  nameFromUrl,
  normalizeCdnMediaUrl,
  pickMediaLeafHitBySourceKey,
  resolveMediaEnglishItemName,
  resolveMediaSourceUrl,
} from './media-from-source.ts';
import {
  resetTranslationCacheMemory,
  setTranslateWithOpenAiForTests,
} from './translate.ts';

const NEXT_IMAGE_A =
  'https://www.energyprice.be/_next/image?url=https%3A%2F%2Fwww.mijnenergie.be%2Fapp%2Fuploads%2F2024%2F01%2Fcomparateur-prix-energie-1.jpg&w=1920&q=75';
const NEXT_IMAGE_B =
  'https://www.energyprice.be/_next/image?url=https%3A%2F%2Fwww.mijnenergie.be%2Fapp%2Fuploads%2F2024%2F01%2Fhousehold-appliances-consumption.jpg&w=1920&q=75';
const NEXT_IMAGE_HERO =
  'https://www.energyprice.be/_next/image?url=https%3A%2F%2Fwww.mijnenergie.be%2Fapp%2Fuploads%2F2026%2F03%2Ftest-image-energy.png&w=1200&q=75';

describe('resolveMediaSourceUrl', () => {
  it('unwraps /_next/image?url= to the underlying asset', () => {
    const out = resolveMediaSourceUrl(NEXT_IMAGE_A);
    assert.equal(
      out,
      'https://www.mijnenergie.be/app/uploads/2024/01/comparateur-prix-energie-1.jpg',
    );
  });

  it('leaves normal CDN URLs unchanged', () => {
    const direct =
      'https://www.mijnenergie.be/app/uploads/2024/01/comparateur-prix-energie-1.jpg';
    assert.equal(resolveMediaSourceUrl(direct), direct);
  });

  it('resolves relative url= query against optimizer origin', () => {
    const out = resolveMediaSourceUrl(
      'https://www.energyprice.be/_next/image?url=%2Fuploads%2Flogo.png&w=64',
    );
    assert.equal(out, 'https://www.energyprice.be/uploads/logo.png');
  });
});

describe('normalizeCdnMediaUrl', () => {
  it('unwraps then strips savif/swebp', () => {
    const out = normalizeCdnMediaUrl(
      `${NEXT_IMAGE_A}&savif=1&swebp=1`,
    );
    assert.equal(
      out,
      'https://www.mijnenergie.be/app/uploads/2024/01/comparateur-prix-energie-1.jpg',
    );
  });
});

describe('nameFromUrl', () => {
  it('names from unwrapped asset basename, not "image"', () => {
    assert.equal(nameFromUrl(NEXT_IMAGE_A), 'comparateur-prix-energie-1');
    assert.equal(nameFromUrl(NEXT_IMAGE_B), 'household-appliances-consumption');
    assert.equal(nameFromUrl(NEXT_IMAGE_HERO), 'test-image-energy');
  });

  it('gives distinct names for distinct optimizer URLs', () => {
    const a = nameFromUrl(NEXT_IMAGE_A);
    const b = nameFromUrl(NEXT_IMAGE_B);
    assert.notEqual(a, b);
    assert.notEqual(a, 'image');
    assert.notEqual(b, 'image');
  });
});

describe('mediaSourceKeysCompatible', () => {
  it('allows both empty', () => {
    assert.equal(mediaSourceKeysCompatible('', ''), true);
    assert.equal(mediaSourceKeysCompatible(undefined, null), true);
  });

  it('requires exact equality when either side is set', () => {
    assert.equal(mediaSourceKeysCompatible('url:a', 'url:a'), true);
    assert.equal(mediaSourceKeysCompatible('url:a', 'url:b'), false);
    assert.equal(mediaSourceKeysCompatible('url:a', ''), false);
    assert.equal(mediaSourceKeysCompatible('', 'url:a'), false);
  });
});

describe('pickMediaLeafHitBySourceKey', () => {
  const preferredDir = '/media/Business Articles Faqs';
  const hits = [
    {
      filePath: `${preferredDir}/image.yml`,
      id: 'id-first',
      sourceKey: 'url:https://cdn.example/first.jpg',
    },
    {
      filePath: '/media/Business Article Cards/image.yml',
      id: 'id-other',
      sourceKey: 'url:https://cdn.example/other.jpg',
    },
  ];

  it('reuses preferred leaf only when sourceKey matches', () => {
    const pick = pickMediaLeafHitBySourceKey(
      hits,
      'url:https://cdn.example/first.jpg',
      preferredDir,
    );
    assert.deepEqual(pick, {
      filePath: `${preferredDir}/image.yml`,
      id: 'id-first',
    });
  });

  it('does not pick an unrelated image.yml when sourceKeys differ', () => {
    const pick = pickMediaLeafHitBySourceKey(
      hits,
      'url:https://cdn.example/brand-new.jpg',
      preferredDir,
    );
    assert.equal(pick, undefined);
  });

  it('prefers preferredDiskDir among matching sourceKeys', () => {
    const sameKeyHits = [
      {
        filePath: '/media/Other Folder/logo.yml',
        id: 'id-other-folder',
        sourceKey: 'url:same',
      },
      {
        filePath: `${preferredDir}/logo.yml`,
        id: 'id-preferred',
        sourceKey: 'url:same',
      },
    ];
    const pick = pickMediaLeafHitBySourceKey(
      sameKeyHits,
      'url:same',
      preferredDir,
    );
    assert.equal(pick?.id, 'id-preferred');
  });
});

describe('resolveMediaEnglishItemName', () => {
  afterEach(() => {
    setTranslateWithOpenAiForTests(null);
    resetTranslationCacheMemory();
  });

  it('keeps already-English names as Path and DisplayName', async () => {
    const out = await resolveMediaEnglishItemName('Hero Background', 'nl-NL');
    assert.equal(out.englishName, 'Hero Background');
    assert.equal(out.displayName, 'Hero Background');
  });

  it('translates Dutch raw name to English Path and keeps Dutch DisplayName', async () => {
    setTranslateWithOpenAiForTests(async () => 'Care Card');
    const out = await resolveMediaEnglishItemName('Zorgkaart', 'nl-NL');
    assert.equal(out.englishName, 'Care Card');
    assert.equal(out.displayName, 'Zorgkaart');
  });
});

describe('absolutizeMediaDownloadUrl', () => {
  it('joins root-relative paths against site origin', () => {
    assert.equal(
      absolutizeMediaDownloadUrl(
        '/Resources/Foundation/Branding/content/images/Menzis/logo-small.svg',
        'https://www.menzis.nl',
      ),
      'https://www.menzis.nl/Resources/Foundation/Branding/content/images/Menzis/logo-small.svg',
    );
  });

  it('leaves absolute URLs unchanged (aside from CDN normalize)', () => {
    const abs =
      'https://www.menzis.nl/Resources/Foundation/Branding/content/images/Menzis/logo-small.svg';
    assert.equal(absolutizeMediaDownloadUrl(abs, 'https://other.example'), abs);
  });

  it('upgrades protocol-relative URLs', () => {
    assert.equal(
      absolutizeMediaDownloadUrl('//cdn.example/a.png', 'https://www.menzis.nl'),
      'https://cdn.example/a.png',
    );
  });

  it('returns root-relative unchanged when origin is missing', () => {
    assert.equal(
      absolutizeMediaDownloadUrl('/Resources/logo.svg', null),
      '/Resources/logo.svg',
    );
  });
});

describe('fetchMediaUrlWithRetries / loadMediaBytes', () => {
  const sleepNoop = async () => {};
  /** @type {typeof fetch | undefined} */
  let originalFetch;

  afterEach(() => {
    if (originalFetch) {
      globalThis.fetch = originalFetch;
      originalFetch = undefined;
    }
  });

  it('retries transient 503 then succeeds on attempt 3', async () => {
    originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      if (calls < 3) {
        return new Response('unavailable', { status: 503 });
      }
      return new Response(Buffer.from('ok-bytes'), {
        status: 200,
        headers: { 'content-type': 'image/svg+xml' },
      });
    };
    const res = await fetchMediaUrlWithRetries(
      'https://www.menzis.nl/Resources/logo.svg',
      { sleep: sleepNoop },
    );
    assert.equal(res.status, 200);
    assert.equal(calls, 3);
  });

  it('does not retry permanent 404', async () => {
    originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return new Response('missing', { status: 404 });
    };
    await assert.rejects(
      () =>
        fetchMediaUrlWithRetries('https://www.menzis.nl/missing.svg', {
          sleep: sleepNoop,
        }),
      (err) => {
        assert.ok(isMediaDownloadFailure(err));
        assert.match(String(err.message), /Failed to download media \(404\)/);
        return true;
      },
    );
    assert.equal(calls, 1);
  });

  it('retries network failures then succeeds', async () => {
    originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      if (calls < 2) {
        throw new TypeError('fetch failed');
      }
      return new Response(Buffer.from('<svg/>'), {
        status: 200,
        headers: { 'content-type': 'image/svg+xml' },
      });
    };
    const loaded = await loadMediaBytes(
      {
        url: '/Resources/Foundation/Branding/content/images/Menzis/logo-small.svg',
      },
      { siteOrigin: 'https://www.menzis.nl', sleep: sleepNoop },
    );
    assert.equal(calls, 2);
    assert.equal(loaded.bytes.toString('utf8'), '<svg/>');
    assert.equal(
      loaded.sourceKey,
      'url:https://www.menzis.nl/Resources/Foundation/Branding/content/images/Menzis/logo-small.svg',
    );
  });

  it('soft-fail shaped error when relative URL has no origin', async () => {
    await assert.rejects(
      () => loadMediaBytes({ url: '/Resources/logo.svg' }, { sleep: sleepNoop }),
      (err) => {
        assert.ok(isMediaDownloadFailure(err));
        assert.match(String(err.message), /Failed to parse URL/);
        return true;
      },
    );
  });
});
