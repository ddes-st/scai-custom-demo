/**
 * Run: node --test tools/capture/lib/screenshot-section-html.test.mjs
 */
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, access, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, after } from 'node:test';
import { resolvePlaywright } from './playwright-resolve.mjs';
import { screenshotSectionHtmlAtViewport } from './screenshot-section-html.mjs';
import { VIEWPORTS } from './viewports.mjs';

describe('screenshotSectionHtmlAtViewport', () => {
  /** @type {string[]} */
  const temps = [];
  /** @type {import('playwright').Browser|null} */
  let browser = null;

  after(async () => {
    if (browser) await browser.close().catch(() => {});
    for (const dir of temps) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('writes a PNG for a tiny fixture HTML at mobile viewport', async (t) => {
    let pw;
    try {
      pw = resolvePlaywright();
    } catch {
      t.skip('playwright package not available');
      return;
    }
    try {
      browser = await pw.chromium.launch({ headless: true });
    } catch (err) {
      t.skip(
        `playwright browser not installed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }
    const context = await browser.newContext();
    const livePage = await context.newPage();
    await livePage.goto('about:blank');

    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-html-shot-'));
    temps.push(root);
    const htmlPath = path.join(root, 'section.html');
    const outPath = path.join(root, 'section-01-mobile.png');
    await writeFile(
      htmlPath,
      `<!DOCTYPE html><html><head><style>
        body{margin:0}
        .box{width:100%;height:120px;background:#0a7;color:#fff;font:16px sans-serif;display:flex;align-items:center;justify-content:center}
      </style></head><body><div class="box">Hello section</div></body></html>`,
      'utf8',
    );

    const result = await screenshotSectionHtmlAtViewport(livePage, {
      htmlPath,
      outPath,
      device: 'mobile',
      baseURL: 'https://example.com/',
    });
    assert.equal(result.ok, true);
    assert.equal(result.method, 'section-html');
    await access(outPath);
    assert.equal(VIEWPORTS.mobile.width, 370);
  });

  it('fails closed when body content is not visible (no blank fullPage success)', async (t) => {
    let pw;
    try {
      pw = resolvePlaywright();
    } catch {
      t.skip('playwright package not available');
      return;
    }
    if (!browser) {
      try {
        browser = await pw.chromium.launch({ headless: true });
      } catch (err) {
        t.skip(
          `playwright browser not installed: ${err instanceof Error ? err.message : String(err)}`,
        );
        return;
      }
    }
    const context = await browser.newContext();
    const livePage = await context.newPage();
    await livePage.goto('about:blank');

    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-html-shot-hidden-'));
    temps.push(root);
    const htmlPath = path.join(root, 'section.html');
    const outPath = path.join(root, 'section-01-desktop.png');
    await writeFile(
      htmlPath,
      `<!DOCTYPE html><html><head><style>
        body{margin:0}
        .banner{display:none;width:100%;height:80px;background:#333}
      </style></head><body><div class="banner">Hidden consent</div></body></html>`,
      'utf8',
    );

    const result = await screenshotSectionHtmlAtViewport(livePage, {
      htmlPath,
      outPath,
      device: 'desktop',
      baseURL: 'https://example.com/',
    });
    assert.equal(result.ok, false);
    assert.equal(result.method, 'section-html');
    assert.match(String(result.error || ''), /no visible element/i);
    await context.close();
  });
});
