/**
 * Evidence attach + single-mode AppPlaceholder prompt gating.
 */
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import sharp from 'sharp';
import {
  buildSectionEvidenceParts,
  isConsentOverlayEvidence,
  loadSectionHtmlForAiEvidence,
  resolveCodegenAttachScreenshots,
  resolveCodegenEvidenceMode,
  warnIfViewportCropWidthMismatch,
} from './ai-codegen.mjs';

describe('resolveCodegenEvidenceMode', () => {
  it('defaults to html when unset', () => {
    assert.equal(resolveCodegenEvidenceMode({}), 'html');
  });

  it('accepts png and png-leading aliases', () => {
    assert.equal(resolveCodegenEvidenceMode({ BQ_CODEGEN_EVIDENCE_MODE: 'png' }), 'png');
    assert.equal(
      resolveCodegenEvidenceMode({ BQ_CODEGEN_EVIDENCE_MODE: 'png-leading' }),
      'png',
    );
    assert.equal(
      resolveCodegenEvidenceMode({ BQ_CODEGEN_EVIDENCE_MODE: 'screenshots' }),
      'png',
    );
  });

  it('accepts html and html-leading aliases', () => {
    assert.equal(resolveCodegenEvidenceMode({ BQ_CODEGEN_EVIDENCE_MODE: 'html' }), 'html');
    assert.equal(
      resolveCodegenEvidenceMode({ BQ_CODEGEN_EVIDENCE_MODE: 'html-leading' }),
      'html',
    );
  });

  it('ignores legacy BQ_CODEGEN_ATTACH_SCREENSHOTS', () => {
    assert.equal(
      resolveCodegenEvidenceMode({ BQ_CODEGEN_ATTACH_SCREENSHOTS: '1' }),
      'html',
    );
    assert.equal(
      resolveCodegenAttachScreenshots({ BQ_CODEGEN_ATTACH_SCREENSHOTS: '1' }),
      false,
    );
  });
});

describe('resolveCodegenAttachScreenshots', () => {
  it('is false for html mode (default)', () => {
    assert.equal(resolveCodegenAttachScreenshots({}), false);
    assert.equal(
      resolveCodegenAttachScreenshots({ BQ_CODEGEN_EVIDENCE_MODE: 'html' }),
      false,
    );
  });

  it('is true only for png mode', () => {
    assert.equal(
      resolveCodegenAttachScreenshots({ BQ_CODEGEN_EVIDENCE_MODE: 'png' }),
      true,
    );
    assert.equal(
      resolveCodegenAttachScreenshots({ BQ_CODEGEN_EVIDENCE_MODE: 'png-leading' }),
      true,
    );
  });
});

describe('buildSectionEvidenceParts image order + width warn', () => {
  /** @type {string[]} */
  const temps = [];

  after(async () => {
    for (const dir of temps) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  async function writePng(abs, width, height) {
    await mkdir(path.dirname(abs), { recursive: true });
    await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 10, g: 20, b: 30 },
      },
    })
      .png()
      .toFile(abs);
  }

  it('returns imageRelsInOrder as desktop→tablet→mobile (not alpha sort)', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-evidence-order-'));
    temps.push(root);
    const section = 'section-01';
    const dir = path.join(root, 'sections', section);
    await writePng(path.join(dir, 'section-01-desktop.png'), 1024, 100);
    await writePng(path.join(dir, 'section-01-tablet.png'), 768, 100);
    await writePng(path.join(dir, 'section-01-mobile.png'), 370, 100);

    const { imageRelsInOrder, attachments, parts } =
      await buildSectionEvidenceParts(
        root,
        section,
        {
          outputs: {
            mobile: { path: `sections/${section}/section-01-mobile.png` },
            tablet: { path: `sections/${section}/section-01-tablet.png` },
            desktop: { path: `sections/${section}/section-01-desktop.png` },
          },
        },
        { attachScreenshots: true },
      );

    assert.deepEqual(imageRelsInOrder, [
      `sections/${section}/section-01-desktop.png`,
      `sections/${section}/section-01-tablet.png`,
      `sections/${section}/section-01-mobile.png`,
    ]);
    // attachments stay sorted for humans
    assert.deepEqual(attachments, [
      `sections/${section}/section-01-desktop.png`,
      `sections/${section}/section-01-mobile.png`,
      `sections/${section}/section-01-tablet.png`,
    ]);
    const texts = parts
      .filter((p) => p.type === 'text')
      .map((p) => p.text);
    assert.match(texts[0], /Screenshot \(desktop\)/);
    assert.match(texts[1], /Screenshot \(tablet\)/);
    assert.match(texts[2], /Screenshot \(mobile\)/);
    assert.equal(parts[1]._bqRelPath, `sections/${section}/section-01-desktop.png`);
    assert.equal(parts[3]._bqRelPath, `sections/${section}/section-01-tablet.png`);
    assert.equal(parts[5]._bqRelPath, `sections/${section}/section-01-mobile.png`);
  });

  it('skips PNG parts when evidence mode is html (default)', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-evidence-no-png-'));
    temps.push(root);
    const section = 'section-01';
    const dir = path.join(root, 'sections', section);
    await writePng(path.join(dir, 'section-01-desktop.png'), 1024, 100);

    const prev = process.env.BQ_CODEGEN_EVIDENCE_MODE;
    delete process.env.BQ_CODEGEN_EVIDENCE_MODE;
    try {
      const { imageRelsInOrder, attachments, parts, attachScreenshots } =
        await buildSectionEvidenceParts(root, section, {
          outputs: {
            desktop: { path: `sections/${section}/section-01-desktop.png` },
          },
        });
      assert.equal(attachScreenshots, false);
      assert.deepEqual(imageRelsInOrder, []);
      assert.deepEqual(attachments, []);
      assert.equal(
        parts.filter((p) => p.type === 'image_url' || p.image_url || p.type === 'image')
          .length,
        0,
      );
    } finally {
      if (prev === undefined) delete process.env.BQ_CODEGEN_EVIDENCE_MODE;
      else process.env.BQ_CODEGEN_EVIDENCE_MODE = prev;
    }
  });

  it('attaches PNG parts when evidence mode is png', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-evidence-png-mode-'));
    temps.push(root);
    const section = 'section-01';
    const dir = path.join(root, 'sections', section);
    await writePng(path.join(dir, 'section-01-desktop.png'), 1024, 100);

    const prev = process.env.BQ_CODEGEN_EVIDENCE_MODE;
    process.env.BQ_CODEGEN_EVIDENCE_MODE = 'png';
    try {
      const { imageRelsInOrder, attachScreenshots } =
        await buildSectionEvidenceParts(root, section, {
          outputs: {
            desktop: { path: `sections/${section}/section-01-desktop.png` },
          },
        });
      assert.equal(attachScreenshots, true);
      assert.deepEqual(imageRelsInOrder, [
        `sections/${section}/section-01-desktop.png`,
      ]);
    } finally {
      if (prev === undefined) delete process.env.BQ_CODEGEN_EVIDENCE_MODE;
      else process.env.BQ_CODEGEN_EVIDENCE_MODE = prev;
    }
  });

  it('prefers original-section.html in png mode and section.html in html mode', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-evidence-html-src-'));
    temps.push(root);
    const section = 'section-01';
    const dir = path.join(root, 'sections', section);
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, 'original-section.html'),
      '<section id="orig">original</section>',
      'utf8',
    );
    await writeFile(
      path.join(dir, 'section.html'),
      '<!doctype html><html><style>.x{}</style><section id="styled">styled</section></html>',
      'utf8',
    );

    const styled = await loadSectionHtmlForAiEvidence(root, section, {}, {
      evidenceMode: 'html',
    });
    assert.equal(styled.label, 'section.html');
    assert.match(styled.html, /styled/);

    const original = await loadSectionHtmlForAiEvidence(root, section, {}, {
      evidenceMode: 'png',
    });
    assert.equal(original.label, 'original-section.html');
    assert.match(original.html, /original/);
  });

  it('warnIfViewportCropWidthMismatch warns on swapped tablet/mobile widths', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-evidence-warn-'));
    temps.push(root);
    const mobilePath = path.join(root, 'narrow.png');
    const tabletPath = path.join(root, 'wide.png');
    await writePng(mobilePath, 370, 80);
    await writePng(tabletPath, 768, 80);

    const warns = [];
    const orig = console.warn;
    console.warn = (...args) => warns.push(args.join(' '));
    try {
      await warnIfViewportCropWidthMismatch('tablet', mobilePath, 'narrow.png');
      await warnIfViewportCropWidthMismatch('mobile', tabletPath, 'wide.png');
      await warnIfViewportCropWidthMismatch('tablet', tabletPath, 'wide.png');
    } finally {
      console.warn = orig;
    }
    assert.equal(warns.length, 2);
    assert.match(warns[0], /label=tablet/);
    assert.match(warns[1], /label=mobile/);
  });

  it('warnIfViewportCropWidthMismatch skips consent/CMP dialog crops', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-evidence-consent-'));
    temps.push(root);
    const dialogPath = path.join(root, 'dialog.png');
    await writePng(dialogPath, 578, 400);

    assert.equal(
      isConsentOverlayEvidence({
        role: 'partial-cookie',
        track: 'overlay',
        isOverlay: true,
      }),
      true,
    );
    assert.equal(
      isConsentOverlayEvidence({
        cmsName: 'consent-banner',
        track: 'overlay',
      }),
      true,
    );
    assert.equal(isConsentOverlayEvidence({ cmsName: 'hero-banner' }), false);

    const warns = [];
    const orig = console.warn;
    console.warn = (...args) => warns.push(args.join(' '));
    try {
      await warnIfViewportCropWidthMismatch(
        'desktop',
        dialogPath,
        'dialog.png',
        {
          role: 'partial-cookie',
          track: 'overlay',
          isOverlay: true,
          purpose: 'cookie consent CMP',
        },
      );
      await warnIfViewportCropWidthMismatch(
        'tablet',
        dialogPath,
        'dialog.png',
        { cmsName: 'consent-banner', track: 'overlay' },
      );
      // Without consent info, same narrow PNG still warns.
      await warnIfViewportCropWidthMismatch('desktop', dialogPath, 'dialog.png');
    } finally {
      console.warn = orig;
    }
    assert.equal(warns.length, 1);
    assert.match(warns[0], /label=desktop/);
  });
});
