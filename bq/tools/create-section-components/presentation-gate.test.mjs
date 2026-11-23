/**
 * Run: node --test tools/create-section-components/presentation-gate.test.mjs
 */
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, after } from 'node:test';
import {
  assertPresentationReadyForGenerate,
  buildPageConversionPayload,
  pageSectionsExpectPresentation,
  resolvePageConversionPresentationField,
} from './presentation-gate.mjs';

describe('resolvePageConversionPresentationField', () => {
  it('keeps wired presentation rel', () => {
    const r = resolvePageConversionPresentationField({
      codegenOnly: true,
      presentationRel: 'bq/src/components/x/x-presentation.definition.ts',
    });
    assert.equal(
      r.presentationDefinition,
      'bq/src/components/x/x-presentation.definition.ts',
    );
  });

  it('codegenOnly preserves prior presentation path instead of null', () => {
    const r = resolvePageConversionPresentationField({
      codegenOnly: true,
      presentationRel: null,
      existingPresentationDefinition: 'bq/src/components/x/x-presentation.definition.ts',
    });
    assert.equal(
      r.presentationDefinition,
      'bq/src/components/x/x-presentation.definition.ts',
    );
  });

  it('codegenOnly omits field when no prior (never stamps null)', () => {
    const r = resolvePageConversionPresentationField({
      codegenOnly: true,
      presentationRel: null,
    });
    assert.equal(r.omit, true);
  });

  it('full wire path may stamp null when presentation missing', () => {
    const r = resolvePageConversionPresentationField({
      codegenOnly: false,
      presentationRel: null,
    });
    assert.equal(r.presentationDefinition, null);
  });
});

describe('buildPageConversionPayload', () => {
  it('does not write presentationDefinition:null on codegenOnly', () => {
    const payload = buildPageConversionPayload(
      {
        site: 'demo-be',
        presentationDefinition: null,
        sections: [{ folderName: 'section-01' }],
      },
      { codegenOnly: true, existing: null },
    );
    assert.equal('presentationDefinition' in payload, false);
  });

  it('preserves existing presentation under codegenOnly', () => {
    const payload = buildPageConversionPayload(
      {
        site: 'demo-be',
        presentationDefinition: null,
      },
      {
        codegenOnly: true,
        existing: {
          presentationDefinition: 'bq/src/components/demo-be/demo-be-presentation.definition.ts',
        },
      },
    );
    assert.equal(
      payload.presentationDefinition,
      'bq/src/components/demo-be/demo-be-presentation.definition.ts',
    );
  });
});

describe('pageSectionsExpectPresentation', () => {
  it('true when a section has definitionKeys', () => {
    assert.equal(
      pageSectionsExpectPresentation([
        { folderName: 'section-01', definitionKeys: ['demo-hero'], skipped: false },
      ]),
      true,
    );
  });

  it('true even when AI skipped (--wire-only); false when empty', () => {
    assert.equal(
      pageSectionsExpectPresentation([
        { folderName: 'section-01', definitionKeys: ['x'], skipped: true },
      ]),
      true,
    );
    assert.equal(pageSectionsExpectPresentation([]), false);
  });
});

describe('assertPresentationReadyForGenerate', () => {
  /** @type {string|null} */
  let tmp = null;
  after(async () => {
    if (tmp) await rm(tmp, { recursive: true, force: true });
  });

  it('throws with --wire-only hint when required file missing', async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), 'bq-pres-gate-'));
    const hostSlug = 'demo-be';
    const siteSystem = 'demo-be';
    await mkdir(path.join(tmp, 'src', 'components', hostSlug), { recursive: true });

    // Point presentation path by chdir-relative hostComponentsDir — use real bq layout via abs check.
    // assert uses presentationDefinitionPath under bq/src/components — so create under repo is heavy.
    // Instead: call with pageSections empty + requireWhenNoSections after writing nowhere → throws.
    await assert.rejects(
      () =>
        assertPresentationReadyForGenerate({
          hostSlug: 'zzzz-missing-host-for-gate-test',
          siteSystem: 'zzzz-missing-site-for-gate-test',
          pageSections: [
            { folderName: 'section-01', definitionKeys: ['a'], skipped: false },
          ],
        }),
      /Missing zzzz-missing-site-for-gate-test-presentation\.definition\.ts[\s\S]*--wire-only/,
    );
  });

  it('no-ops when no sections expect presentation', async () => {
    const r = await assertPresentationReadyForGenerate({
      hostSlug: 'zzzz-missing-host-for-gate-test',
      siteSystem: 'zzzz-missing-site-for-gate-test',
      pageSections: [],
    });
    assert.equal(r.required, false);
  });

  it('passes when presentation file exists', async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), 'bq-pres-gate-ok-'));
    // presentationDefinitionPath joins hostComponentsDir which is under bq root —
    // write via the same helper path by importing and writing there is invasive.
    // Use requireWhenNoSections false + empty sections already covered.
    // Create a temp module path by stubbing: write file where presentationDefinitionPath points
    // relative to process — hostComponentsDir uses bqRoot. Write into real bq temp host folder.
    const { hostComponentsDir } = await import('./definition-paths.mjs');
    const { presentationDefinitionPath } = await import('./definition-paths.mjs');
    const hostSlug = `__gate_test_${Date.now()}`;
    const siteSystem = hostSlug;
    const dir = hostComponentsDir(hostSlug);
    await mkdir(dir, { recursive: true });
    const file = presentationDefinitionPath(hostSlug, siteSystem);
    await writeFile(file, 'export {}\n', 'utf8');
    try {
      const r = await assertPresentationReadyForGenerate({
        hostSlug,
        siteSystem,
        requireWhenNoSections: true,
      });
      assert.equal(r.required, true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
