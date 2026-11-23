/**
 * Run: node --test tools/brandkit/export-guidelines-pdf.test.mjs
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { exportBrandkitGuidelinesPdf } from './export-guidelines-pdf.mjs';

describe('exportBrandkitGuidelinesPdf', () => {
  /** @type {string} */
  let dir;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'bq-pdf-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('writes a non-empty guidelines.pdf', async () => {
    const result = await exportBrandkitGuidelinesPdf({
      hostProjectRoot: dir,
      draft: {
        brandName: 'Test Co',
        description: 'A test brand.',
        sections: {
          'Brand Context': {
            Purpose: 'Serve customers well.\nBe clear.\nStay helpful.',
          },
        },
      },
    });
    assert.equal(result.ok, true);
    const st = await stat(result.pdfPath);
    assert.ok(st.size > 100, `expected non-empty pdf, got ${st.size}`);
  });
});
