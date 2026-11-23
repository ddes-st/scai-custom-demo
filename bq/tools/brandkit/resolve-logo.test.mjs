/**
 * Run: node --test tools/brandkit/resolve-logo.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  absolutizeUrl,
  extractLogoUrlFromHtml,
  isLikelyRasterLogoUrl,
  resolveBrandkitLogo,
} from './resolve-logo.mjs';
import { hostLogoDir, hostLogoMetaPath } from '../capture/lib/save-host-logo.mjs';

describe('absolutizeUrl', () => {
  it('resolves relative against base', () => {
    assert.equal(
      absolutizeUrl('/logo.png', 'https://www.example.com/fr/'),
      'https://www.example.com/logo.png',
    );
  });

  it('skips data URLs', () => {
    assert.equal(absolutizeUrl('data:image/png;base64,aaa', 'https://x.com'), null);
  });
});

describe('isLikelyRasterLogoUrl', () => {
  it('rejects svg and ico', () => {
    assert.equal(isLikelyRasterLogoUrl('https://x.com/a.svg'), false);
    assert.equal(isLikelyRasterLogoUrl('https://x.com/favicon.ico'), false);
  });

  it('accepts png/jpeg without extension', () => {
    assert.equal(isLikelyRasterLogoUrl('https://cdn.x.com/media/logo'), true);
  });
});

describe('extractLogoUrlFromHtml', () => {
  const base = 'https://www.energyprice.be/';

  it('prefers header logo img', () => {
    const html = `
      <html><head>
        <link rel="icon" href="/favicon.png"/>
        <meta property="og:image" content="https://cdn.example.com/og.jpg"/>
      </head><body>
        <header class="site-header">
          <img class="logo" src="/assets/brand-logo.png" alt="Energyprice"/>
        </header>
      </body></html>`;
    assert.equal(
      extractLogoUrlFromHtml(html, base),
      'https://www.energyprice.be/assets/brand-logo.png',
    );
  });

  it('falls back to apple-touch-icon', () => {
    const html = `
      <html><head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png"/>
        <meta property="og:image" content="https://cdn.example.com/og.jpg"/>
      </head><body><p>no logo img</p></body></html>`;
    assert.equal(
      extractLogoUrlFromHtml(html, base),
      'https://www.energyprice.be/apple-touch-icon.png',
    );
  });

  it('returns null when only svg', () => {
    const html = `<img class="logo" src="/logo.svg" alt="x"/>`;
    assert.equal(extractLogoUrlFromHtml(html, base), null);
  });
});

describe('resolveBrandkitLogo prefers capture Logo/meta URL', () => {
  it('uses logo-meta sourceUrl without re-scraping HTML', async () => {
    const hostRoot = await mkdtemp(path.join(os.tmpdir(), 'bq-bk-logo-'));
    const pageDir = path.join(hostRoot, 'site--home');
    await mkdir(path.join(pageDir, 'html'), { recursive: true });
    await mkdir(hostLogoDir(hostRoot), { recursive: true });
    await writeFile(
      hostLogoMetaPath(hostRoot),
      `${JSON.stringify({
        sourceUrl: 'https://cdn.example.com/from-capture.png',
        savedAt: new Date().toISOString(),
      })}\n`,
    );
    await writeFile(
      path.join(pageDir, 'html', 'page.html'),
      '<img class="logo" src="https://cdn.example.com/other.png"/>',
      'utf8',
    );

    const result = await resolveBrandkitLogo({
      pageDir,
      siteUrl: 'https://www.example.com/',
      hostProjectRoot: hostRoot,
      downloadCopy: true,
    });
    assert.equal(result.logoUrl, 'https://cdn.example.com/from-capture.png');
    assert.equal(result.fromCaptureLogo, true);
  });
});
