import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  captureOwnsSiteChrome,
  isHostSeedPathname,
  listHostCapturePages,
  resolveCapturePageDir,
  resolveFallbackCapturePage,
  scoreLocaleHomePath,
  urlsRoughlyEqual,
} from './resolve-capture.mjs';

describe('isHostSeedPathname', () => {
  it('treats root and docs ellipsis as host seeds', () => {
    assert.equal(isHostSeedPathname('/'), true);
    assert.equal(isHostSeedPathname(''), true);
    assert.equal(isHostSeedPathname('/…'), true);
    assert.equal(isHostSeedPathname('/%E2%80%A6'), true);
    assert.equal(isHostSeedPathname('/...'), true);
    assert.equal(isHostSeedPathname('/nl/particulieren'), false);
  });
});

describe('scoreLocaleHomePath', () => {
  it('scores root and locale homes high', () => {
    assert.equal(scoreLocaleHomePath('/'), 100);
    assert.equal(scoreLocaleHomePath('/nl'), 90);
    assert.equal(scoreLocaleHomePath('/nl/particulieren'), 85);
    assert.equal(scoreLocaleHomePath('/fr/particuliers'), 85);
    assert.equal(scoreLocaleHomePath('/nl/products/cards'), 0);
  });
});

describe('urlsRoughlyEqual', () => {
  it('ignores trailing slash', () => {
    assert.equal(
      urlsRoughlyEqual('https://www.crelan.be/', 'https://www.crelan.be'),
      true,
    );
  });
});

describe('resolveCapturePageDir home fallback', () => {
  async function makePage(project, slug, url) {
    const dir = path.join(project, slug);
    await mkdir(path.join(dir, 'sections', 'section-01'), { recursive: true });
    await writeFile(path.join(dir, 'source-url.txt'), url, 'utf8');
    return dir;
  }

  it('falls back from site-root URL to sole locale-home capture', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-capture-fb-'));
    const host = 'www-crelan-be';
    const project = path.join(root, host);
    await makePage(
      project,
      'www-crelan-be--nl-particulieren',
      'https://www.crelan.be/nl/particulieren',
    );

    const fb = await resolveFallbackCapturePage(
      project,
      'https://www.crelan.be/',
    );
    assert.ok(fb);
    assert.equal(fb.pageSlug, 'www-crelan-be--nl-particulieren');

    const resolved = await resolveCapturePageDir('https://www.crelan.be/', root);
    assert.equal(resolved.pageSlug, 'www-crelan-be--nl-particulieren');
    assert.match(String(resolved.resolvedFrom || ''), /sole|locale-home/i);
  });

  it('does not guess when multiple locale homes score equally', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-capture-amb-'));
    const host = 'www-example-com';
    const project = path.join(root, host);
    await makePage(project, 'www-example-com--nl', 'https://www.example.com/nl');
    await makePage(project, 'www-example-com--fr', 'https://www.example.com/fr');

    const fb = await resolveFallbackCapturePage(
      project,
      'https://www.example.com/',
    );
    assert.equal(fb, null);

    await assert.rejects(
      () => resolveCapturePageDir('https://www.example.com/', root),
      /Available captures:/,
    );
  });

  it('keeps exact slug when present', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-capture-exact-'));
    const host = 'www-example-com';
    const project = path.join(root, host);
    await makePage(project, 'www-example-com--home', 'https://www.example.com/');
    await makePage(
      project,
      'www-example-com--nl-particulieren',
      'https://www.example.com/nl/particulieren',
    );

    const resolved = await resolveCapturePageDir(
      'https://www.example.com/',
      root,
    );
    assert.equal(resolved.pageSlug, 'www-example-com--home');
    assert.equal(resolved.resolvedFrom, null);
  });

  it('site-entry fallback owns chrome even when path is not /', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-capture-chrome-'));
    const host = 'www-crelan-be';
    const project = path.join(root, host);
    await makePage(
      project,
      'www-crelan-be--nl-particulieren',
      'https://www.crelan.be/nl/particulieren',
    );
    const resolved = await resolveCapturePageDir('https://www.crelan.be/', root);
    assert.equal(resolved.isSiteEntryFallback, true);
    assert.equal(await captureOwnsSiteChrome(resolved, { isHome: false }), true);
  });

  it('ellipsis host seed resolves to sole locale-home capture', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-capture-ellip-'));
    const host = 'www-crelan-be';
    const project = path.join(root, host);
    await makePage(
      project,
      'www-crelan-be--nl-particulieren',
      'https://www.crelan.be/nl/particulieren',
    );

    for (const seed of [
      'https://www.crelan.be/\u2026',
      'https://www.crelan.be/%E2%80%A6',
      'https://www.crelan.be/...',
    ]) {
      const resolved = await resolveCapturePageDir(seed, root);
      assert.equal(
        resolved.pageSlug,
        'www-crelan-be--nl-particulieren',
        seed,
      );
      assert.equal(resolved.isSiteEntryFallback, true, seed);
    }
  });

  it('hostWide seeds from usable captures when deep path is missing', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-capture-hw-'));
    const host = 'www-crelan-be';
    const project = path.join(root, host);
    await makePage(
      project,
      'www-crelan-be--nl-particulieren',
      'https://www.crelan.be/nl/particulieren',
    );
    await makePage(
      project,
      'www-crelan-be--nl-jobs',
      'https://www.crelan.be/nl/jobs',
    );

    await assert.rejects(
      () =>
        resolveCapturePageDir(
          'https://www.crelan.be/nl/products/missing',
          root,
          { hostWide: false },
        ),
      /Available captures:/,
    );

    const resolved = await resolveCapturePageDir(
      'https://www.crelan.be/nl/products/missing',
      root,
      { hostWide: true },
    );
    assert.equal(resolved.pageSlug, 'www-crelan-be--nl-particulieren');
    assert.equal(resolved.isSiteEntryFallback, false);

    const pages = await listHostCapturePages(
      'https://www.crelan.be/nl/products/missing',
      root,
    );
    assert.equal(pages.length, 2);
    assert.equal(pages[0].pageSlug, 'www-crelan-be--nl-particulieren');
  });

  it('hostWide breaks ambiguous locale-home ties; page-only still fails', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-capture-hw-amb-'));
    const host = 'www-example-com';
    const project = path.join(root, host);
    await makePage(project, 'www-example-com--fr', 'https://www.example.com/fr');
    await makePage(project, 'www-example-com--nl', 'https://www.example.com/nl');

    await assert.rejects(
      () => resolveCapturePageDir('https://www.example.com/', root),
      /Available captures:/,
    );

    const hw = await resolveCapturePageDir('https://www.example.com/', root, {
      hostWide: true,
    });
    // Slug tie-break: fr before nl alphabetically when scores equal
    assert.equal(hw.pageSlug, 'www-example-com--fr');

    const pages = await listHostCapturePages('https://www.example.com/', root);
    assert.equal(pages.length, 2);
  });
});
