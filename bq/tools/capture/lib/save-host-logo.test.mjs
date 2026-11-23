/**
 * Run: node --test tools/capture/lib/save-host-logo.test.mjs
 */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { before, describe, it } from 'node:test';
import {
  hostLogoMetaPath,
  readExistingHostLogo,
  saveHostLogo,
} from './save-host-logo.mjs';
import { extractLogoUrlFromHtml } from './logo-from-html.mjs';

describe('saveHostLogo (URL only)', () => {
  /** @type {string} */
  let hostRoot;
  /** @type {string} */
  let pageDir;

  before(async () => {
    hostRoot = await mkdtemp(path.join(os.tmpdir(), 'bq-host-logo-'));
    pageDir = path.join(hostRoot, 'site--home');
    await mkdir(path.join(pageDir, 'html'), { recursive: true });
    const html = `
      <html><body>
        <header><img class="logo" src="https://cdn.example.com/brand-logo.png" alt="Brand"/></header>
      </body></html>`;
    await writeFile(path.join(pageDir, 'html', 'page.html'), html, 'utf8');
  });

  it('extracts logo URL from HTML', () => {
    assert.equal(
      extractLogoUrlFromHtml(
        '<img class="logo" src="/a.png"/>',
        'https://www.example.com/',
      ),
      'https://www.example.com/a.png',
    );
  });

  it('writes Logo/logo-meta.json with sourceUrl only', async () => {
    const result = await saveHostLogo({
      hostProjectRoot: hostRoot,
      siteUrl: 'https://www.example.com/',
      pageDir,
    });
    assert.equal(result.ok, true);
    assert.equal(result.skipped, undefined);
    assert.equal(result.logoUrl, 'https://cdn.example.com/brand-logo.png');

    const meta = JSON.parse(await readFile(hostLogoMetaPath(hostRoot), 'utf8'));
    assert.equal(meta.sourceUrl, 'https://cdn.example.com/brand-logo.png');
    assert.ok(meta.savedAt);
    assert.equal(meta.fileName, undefined);

    const again = await saveHostLogo({
      hostProjectRoot: hostRoot,
      siteUrl: 'https://www.example.com/',
      pageDir,
    });
    assert.equal(again.ok, true);
    assert.equal(again.skipped, true);
    assert.equal(again.reason, 'already-exists');

    const existing = await readExistingHostLogo(hostRoot);
    assert.equal(existing?.logoUrl, 'https://cdn.example.com/brand-logo.png');
  });
});
