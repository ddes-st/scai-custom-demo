import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  buildPlanFromPackages,
  formatLockedChildrenSitecoreizeHardLines,
} from './section-codegen.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('buildPlanFromPackages', () => {
  it('does not set placeholderKey from layoutSketch when there are no child packages', () => {
    const plan = buildPlanFromPackages({
      sectionPkg: {
        componentName: 'CrelanImageHero',
        packageKind: 'default',
      },
      childPkgs: [],
      layoutSketch: {
        target: 'page',
        renderings: [
          {
            componentName: 'CrelanImageHero',
            placeholders: {
              'hero-cards': [
                { componentName: 'HeroCard', datasourceName: 'A' },
              ],
            },
          },
        ],
      },
      reason: 'test',
    });
    assert.equal(plan.mode, 'single');
    assert.deepEqual(plan.placeholderKeys, []);
    assert.equal(plan.section.placeholderKey, null);
  });

  it('derives placeholderKey only from child parentPlaceholder', () => {
    const plan = buildPlanFromPackages({
      sectionPkg: {
        componentName: 'CrelanImageHero',
        packageKind: 'default',
      },
      childPkgs: [
        {
          componentName: 'HeroCard',
          parentPlaceholder: 'hero-cards',
          packageKind: 'default',
          repeatHint: 2,
        },
      ],
      layoutSketch: {
        target: 'page',
        renderings: [
          {
            placeholders: {
              'hero-cards': [],
              'extra-from-sketch-only': [],
            },
          },
        ],
      },
    });
    assert.equal(plan.mode, 'composite');
    assert.deepEqual(plan.placeholderKeys, ['hero-cards']);
    assert.equal(plan.section.placeholderKey, 'hero-cards');
    assert.ok(!plan.placeholderKeys.includes('extra-from-sketch-only'));
  });
});

describe('SITECOREIZE_MULTI_BAND_COMPOSITE_HARD', () => {
  it('exports HARD requiring packages + layoutSketch for multi-band HTML', async () => {
    const { SITECOREIZE_MULTI_BAND_COMPOSITE_HARD } = await import(
      './section-codegen.mjs'
    );
    assert.match(SITECOREIZE_MULTI_BAND_COMPOSITE_HARD, /^HARD —/);
    assert.match(SITECOREIZE_MULTI_BAND_COMPOSITE_HARD, /role:"section"/);
    assert.match(SITECOREIZE_MULTI_BAND_COMPOSITE_HARD, /role:"child"/);
    assert.match(SITECOREIZE_MULTI_BAND_COMPOSITE_HARD, /layoutSketch/);
    assert.match(SITECOREIZE_MULTI_BAND_COMPOSITE_HARD, /allowedControls/);
    assert.doesNotMatch(SITECOREIZE_MULTI_BAND_COMPOSITE_HARD, /\bplanMode\b/);
    const src = await readFile(
      path.join(__dirname, 'section-codegen.mjs'),
      'utf8',
    );
    assert.match(src, /SITECOREIZE_MULTI_BAND_COMPOSITE_HARD/);
    assert.match(src, /collectHtmlMultiBandEmitDiagnostics/);
    const prompt = await readFile(
      path.join(__dirname, 'prompts', 'system-codegen-sitecoreize.md'),
      'utf8',
    );
    assert.match(prompt, /Stacked peer bands|MULTI_BAND_COMPOSITE_EXAMPLE|Support\+Health/);
    assert.match(prompt, /layoutSketch/);
    assert.doesNotMatch(prompt, /planMode=composite|planMode=single/);
  });
});

describe('MULTI_BAND_COMPOSITE_EXAMPLE_SNIPPET', () => {
  it('teaches mixed types, repeated split seeds, and VF image/link shapes', async () => {
    const { MULTI_BAND_COMPOSITE_EXAMPLE_SNIPPET } = await import(
      './section-codegen.mjs'
    );
    assert.match(MULTI_BAND_COMPOSITE_EXAMPLE_SNIPPET, /ExampleSupportHealthStack/);
    assert.match(MULTI_BAND_COMPOSITE_EXAMPLE_SNIPPET, /ExampleSplitContentBand/);
    assert.match(MULTI_BAND_COMPOSITE_EXAMPLE_SNIPPET, /repeatHint": 3/);
    assert.match(MULTI_BAND_COMPOSITE_EXAMPLE_SNIPPET, /Band One/);
    assert.match(MULTI_BAND_COMPOSITE_EXAMPLE_SNIPPET, /Band Two/);
    assert.match(MULTI_BAND_COMPOSITE_EXAMPLE_SNIPPET, /Band Three/);
    assert.match(MULTI_BAND_COMPOSITE_EXAMPLE_SNIPPET, /url: 'https:\/\/cdn\.example/);
    assert.match(MULTI_BAND_COMPOSITE_EXAMPLE_SNIPPET, /text: 'Meer'/);
    assert.match(MULTI_BAND_COMPOSITE_EXAMPLE_SNIPPET, /allowedControls/);
    assert.match(MULTI_BAND_COMPOSITE_EXAMPLE_SNIPPET, /host only/i);
    assert.match(MULTI_BAND_COMPOSITE_EXAMPLE_SNIPPET, /unused/);
    assert.match(MULTI_BAND_COMPOSITE_EXAMPLE_SNIPPET, /content\.items\.length=0/);
    const src = await readFile(
      path.join(__dirname, 'section-codegen.mjs'),
      'utf8',
    );
    assert.match(src, /MULTI_BAND_COMPOSITE_EXAMPLE_SNIPPET/);
  });
});

describe('SITECOREIZE_NO_CAPTURE_IMAGE_URLS_HARD', () => {
  it('exports HARD forbidding hardcoded capture image URLs in runtime tsx', async () => {
    const { SITECOREIZE_NO_CAPTURE_IMAGE_URLS_HARD } = await import(
      './section-codegen.mjs'
    );
    assert.match(SITECOREIZE_NO_CAPTURE_IMAGE_URLS_HARD, /^HARD —/);
    assert.match(SITECOREIZE_NO_CAPTURE_IMAGE_URLS_HARD, /mask-image|maskImage/);
    assert.match(SITECOREIZE_NO_CAPTURE_IMAGE_URLS_HARD, /svgMarkup/);
    assert.match(SITECOREIZE_NO_CAPTURE_IMAGE_URLS_HARD, /CORS|cross-origin/i);
    assert.match(SITECOREIZE_NO_CAPTURE_IMAGE_URLS_HARD, /<Image|Image field/);
    assert.match(SITECOREIZE_NO_CAPTURE_IMAGE_URLS_HARD, /picture|srcSet/);
    assert.match(SITECOREIZE_NO_CAPTURE_IMAGE_URLS_HARD, /\/-\/media/);
    assert.match(SITECOREIZE_NO_CAPTURE_IMAGE_URLS_HARD, /sc-cta-after-arrow/);
    const src = await readFile(
      path.join(__dirname, 'section-codegen.mjs'),
      'utf8',
    );
    assert.match(src, /SITECOREIZE_NO_CAPTURE_IMAGE_URLS_HARD/);
  });
});

describe('SITECOREIZE_NO_ANY_CALLBACKS_HARD', () => {
  it('exports HARD forbidding : any and bare untyped map callbacks', async () => {
    const { SITECOREIZE_NO_ANY_CALLBACKS_HARD } = await import(
      './section-codegen.mjs'
    );
    assert.match(SITECOREIZE_NO_ANY_CALLBACKS_HARD, /^HARD —/);
    assert.match(SITECOREIZE_NO_ANY_CALLBACKS_HARD, /: any|as any/);
    assert.match(SITECOREIZE_NO_ANY_CALLBACKS_HARD, /\.map/);
    assert.match(SITECOREIZE_NO_ANY_CALLBACKS_HARD, /named interface|MenuColumn/i);
    assert.match(SITECOREIZE_NO_ANY_CALLBACKS_HARD, /TS7006|parenthesiz/i);
    const src = await readFile(
      path.join(__dirname, 'section-codegen.mjs'),
      'utf8',
    );
    assert.match(src, /SITECOREIZE_NO_ANY_CALLBACKS_HARD/);
  });
});

describe('PEER COLUMN GRID layout-hints HARD', () => {
  it('emits PEER COLUMN GRID HARD when columnsMax >= 2', async () => {
    const { formatLayoutHintsForPrompt } = await import('./layout-hints.mjs');
    const block = formatLayoutHintsForPrompt(
      {
        layout: { columnsMax: 3, cardCount: 3 },
        htmlLayout: { desktop: { columnsMax: 3 }, cardCount: 3 },
      },
      '',
      '',
    );
    assert.match(block, /PEER COLUMN GRID \(HARD\)/);
    assert.match(block, /lg:grid-cols-3/);
  });
});

describe('SITECOREIZE_APPPLACEHOLDER_DEF_PARITY_HARD', () => {
  it('exports parity HARD covering clientTsx + empty placeholders ban', async () => {
    const { SITECOREIZE_APPPLACEHOLDER_DEF_PARITY_HARD } = await import(
      './section-codegen.mjs'
    );
    assert.match(SITECOREIZE_APPPLACEHOLDER_DEF_PARITY_HARD, /^HARD —/);
    assert.match(SITECOREIZE_APPPLACEHOLDER_DEF_PARITY_HARD, /clientTsx/);
    assert.match(SITECOREIZE_APPPLACEHOLDER_DEF_PARITY_HARD, /placeholders: \[\]/);
    assert.match(
      SITECOREIZE_APPPLACEHOLDER_DEF_PARITY_HARD,
      /ONLY on server map-entry|never clientTsx/i,
    );
    assert.match(
      SITECOREIZE_APPPLACEHOLDER_DEF_PARITY_HARD,
      /React Server Components \(RSC\)|Default: function Default/,
    );
    assert.match(
      SITECOREIZE_APPPLACEHOLDER_DEF_PARITY_HARD,
      /requireParentPlaceholderHost|sanitizePartialNesting/,
    );
    const src = await readFile(
      path.join(__dirname, 'section-codegen.mjs'),
      'utf8',
    );
    assert.match(src, /SITECOREIZE_APPPLACEHOLDER_DEF_PARITY_HARD/);
    assert.match(src, /AppPlaceholder \+ componentMap ONLY on server/);
  });
});

describe('formatLockedChildrenSitecoreizeHardLines', () => {
  it('returns empty when lockedChildren is empty', () => {
    assert.deepEqual(formatLockedChildrenSitecoreizeHardLines([]), []);
    assert.deepEqual(formatLockedChildrenSitecoreizeHardLines(null), []);
  });

  it('includes composite + forbidden leaf wording with locked PH keys', () => {
    const lines = formatLockedChildrenSitecoreizeHardLines([
      {
        componentName: 'MenzisSupportCard',
        definitionKey: 'menzis-support-card',
        placeholderKey: 'support-cards',
      },
      {
        componentName: 'MenzisHealthCard',
        definitionKey: 'menzis-health-card',
        placeholderKey: 'health-cards',
      },
      {
        componentName: 'MenzisSplitContent',
        definitionKey: 'menzis-split-content',
        placeholderKey: 'split-content',
      },
    ]);
    assert.equal(lines.length, 2);
    assert.match(lines[0], /lockedChildren non-empty ⇒ composite parent/);
    assert.match(lines[0], /support-cards/);
    assert.match(lines[0], /health-cards/);
    assert.match(lines[0], /split-content/);
    assert.match(lines[0], /AppPlaceholder/);
    assert.match(lines[0], /server map-entry|never AppPlaceholder in clientTsx/);
    assert.match(lines[1], /placeholders: \[\]/);
    assert.match(lines[1], /requireParentPlaceholderHost/);
  });
});

describe('section-codegen lockedChildren SECTION INPUT', () => {
  it('wires conditional lockedChildren HARD into SECTION INPUT only', async () => {
    const src = await readFile(
      path.join(__dirname, 'section-codegen.mjs'),
      'utf8',
    );
    assert.match(src, /formatLockedChildrenSitecoreizeHardLines/);
    assert.match(src, /=== SECTION INPUT ===/);
    assert.match(
      src,
      /lockedChildren non-empty ⇒ composite parent/,
    );
    assert.match(src, /requireParentPlaceholderHost/);
  });
});
