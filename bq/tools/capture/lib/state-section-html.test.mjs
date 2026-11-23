/**
 * State folder HTML contract: original-section.html + styled section.html.
 * Run: node --import tsx --test tools/capture/lib/state-section-html.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import {
  ORIGINAL_SECTION_HTML,
  SECTION_HTML,
} from './section-html-files.mjs';
import { writeStateSectionHtmlArtifacts } from './interactive-states.mjs';

function mockPageForOpenHtml(rawHtml = '<section data-open="1">state</section>') {
  return {
    evaluate: async () => rawHtml,
    setViewportSize: async () => {},
    waitForTimeout: async () => {},
    url: () => 'https://example.test/',
  };
}

describe('writeStateSectionHtmlArtifacts', () => {
  /** @type {string} */
  let tmp;
  /** @type {string} */
  let pageDir;
  /** @type {string} */
  let absStateDir;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bq-state-html-'));
    pageDir = path.join(tmp, 'page');
    absStateDir = path.join(pageDir, 'sections', 'section-10', 'states', 'tab-demo');
    await mkdir(absStateDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('writes original-section.html and falls back section.html when styled fails', async () => {
    const page = mockPageForOpenHtml('<section id="open">tab open</section>');
    const { sectionHtmlRel, originalHtmlRel, styledErrors } =
      await writeStateSectionHtmlArtifacts(page, {
        pageDir,
        absStateDir,
        sectionSelector: 'section#missing',
        panelSelector: null,
        folderName: 'section-10-tab-demo',
      });

    const originalAbs = path.join(absStateDir, ORIGINAL_SECTION_HTML);
    const styledAbs = path.join(absStateDir, SECTION_HTML);
    assert.equal(fs.existsSync(originalAbs), true);
    assert.equal(fs.existsSync(styledAbs), true);
    assert.match(await readFile(originalAbs, 'utf8'), /tab open/);
    // Styled path fails without a real browser; fallback copies original
    assert.match(await readFile(styledAbs, 'utf8'), /tab open/);
    assert.match(originalHtmlRel, /original-section\.html$/);
    assert.match(sectionHtmlRel, /section\.html$/);
    assert.ok(styledErrors.length >= 1);
  });

  it('keeps section.html when original already present and styled fails', async () => {
    const originalAbs = path.join(absStateDir, ORIGINAL_SECTION_HTML);
    await writeFile(originalAbs, '<section>prior</section>', 'utf8');

    const page = mockPageForOpenHtml('<section>fresh open</section>');
    await writeStateSectionHtmlArtifacts(page, {
      pageDir,
      absStateDir,
      sectionSelector: 'section#x',
      folderName: 'section-10-tab-demo',
    });

    assert.match(await readFile(originalAbs, 'utf8'), /fresh open/);
    assert.equal(fs.existsSync(path.join(absStateDir, SECTION_HTML)), true);
  });
});
