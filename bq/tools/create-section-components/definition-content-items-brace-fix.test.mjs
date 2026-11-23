/**
 * Run: node --test tools/create-section-components/definition-content-items-brace-fix.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { transformSync } from 'esbuild';
import {
  closeUnbalancedBracesBeforeSatisfies,
  collapseDoubleJsonStringify,
  repairContentItemsMissingItemClose,
  repairDefinitionContentItems,
} from './definition-content-items-brace-fix.mjs';
import {
  isGhostEmptyBandChildPackage,
  warnIfContentItemCountBelowHint,
} from './section-codegen.mjs';
import { DEFINITION_PARSE_FIX_HEADER } from './definition-validate-iters.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../../..');
const DUMP_DIR = path.join(
  REPO,
  '.bq/captures/www-menzis-nl/www-menzis-nl--home/sections/section-04/ai-debug',
);

function assertParseable(src, label = 'def') {
  try {
    transformSync(String(src), { loader: 'ts', format: 'esm' });
  } catch (err) {
    assert.fail(`${label}: ${err.errors?.[0]?.text || err.message}`);
  }
}

function countItems(src) {
  const m = String(src).match(/\bitems\s*:\s*\[/);
  if (!m) return 0;
  // rough: top-level `{ name` after items
  const start = String(src).indexOf(m[0]) + m[0].length;
  const body = String(src).slice(start);
  let depth = 0;
  let count = 0;
  let inStr = null;
  let esc = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (ch === '\\') {
        esc = true;
        continue;
      }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = ch;
      continue;
    }
    if (ch === '{') {
      if (depth === 0) count += 1;
      depth += 1;
    } else if (ch === '}') depth = Math.max(0, depth - 1);
    else if (ch === ']' && depth === 0) break;
  }
  return count;
}

describe('repairDefinitionContentItems', () => {
  it('repairs object-last-field missing item close (CTA)', () => {
    const broken = `export const X = { content: { items: [
  { name: 'One', fields: { Heading: JSON.stringify('One'), CTA: { text: 'Go', url: '/go' } },
  { name: 'Two', fields: { Heading: JSON.stringify('Two'), CTA: { text: 'More', url: '/more' } } },
] } };`;
    assert.throws(() => transformSync(broken, { loader: 'ts', format: 'esm' }));
    const { text, inserted } = repairContentItemsMissingItemClose(broken);
    assert.ok(inserted >= 1);
    assertParseable(text, 'CTA');
    assert.match(
      text,
      /CTA:\s*\{\s*text:\s*'Go',\s*url:\s*'\/go'\s*\}\s*\}\s*\},\s*\{\s*name:\s*'Two'/,
    );
  });

  it('repairs object-last-field missing item close (Image) and trailing ]', () => {
    const broken = `export const X = { content: { items: [
  { name: 'CardA', fields: { Title: JSON.stringify('A'), Image: { src: '/a.png', alt: 'A' } },
  { name: 'CardB', fields: { Title: JSON.stringify('B'), Image: { src: '/b.png', alt: 'B' } }
] } };`;
    assert.throws(() => transformSync(broken, { loader: 'ts', format: 'esm' }));
    const { text, inserted } = repairContentItemsMissingItemClose(broken);
    assert.ok(inserted >= 2);
    assertParseable(text, 'Image');
    assert.equal(countItems(text), 2);
  });

  it('repairs double JSON.stringify + missing item close', () => {
    const broken = `export const X = { content: { items: [
  { name: 'A', fields: { Links: JSON.stringify(JSON.stringify([{ text: 'a', url: '/a' }])) },
  { name: 'B', fields: { Title: JSON.stringify('B') } },
] } };`;
    assert.throws(() => transformSync(broken, { loader: 'ts', format: 'esm' }));
    const { text, inserted, collapsedStringify } = repairDefinitionContentItems(broken);
    assert.ok(collapsedStringify >= 1);
    assert.ok(inserted >= 1);
    assertParseable(text, 'double-stringify');
    assert.doesNotMatch(text, /JSON\.stringify\s*\(\s*JSON\.stringify/);
  });

  it('repairs object-last-field HelpFeature dump', () => {
    const dump = path.join(
      DUMP_DIR,
      'menzis-help-feature/definition-after-fixups-MenzisHelpFeature.ts.ai',
    );
    let raw;
    try {
      raw = readFileSync(dump, 'utf8');
    } catch {
      return; // optional capture dump
    }
    assert.throws(() => transformSync(raw, { loader: 'ts', format: 'esm' }));
    const { text, inserted } = repairDefinitionContentItems(raw);
    assert.ok(inserted >= 1);
    assertParseable(text, 'HelpFeature');
    assert.equal(countItems(text), 7);
  });

  it('repairs HealthCard dump', () => {
    const dump = path.join(
      DUMP_DIR,
      'menzis-health-card/definition-after-fixups-MenzisHealthCard.ts.ai',
    );
    let raw;
    try {
      raw = readFileSync(dump, 'utf8');
    } catch {
      return;
    }
    assert.throws(() => transformSync(raw, { loader: 'ts', format: 'esm' }));
    const { text, inserted } = repairDefinitionContentItems(raw);
    assert.ok(inserted >= 1);
    assertParseable(text, 'HealthCard');
    assert.equal(countItems(text), 3);
  });

  it('repairs HelpCard dump (double JSON.stringify + missing item close)', () => {
    const dump = path.join(
      DUMP_DIR,
      'menzis-help-card/definition-after-fixups-MenzisHelpCard.ts.ai',
    );
    let raw;
    try {
      raw = readFileSync(dump, 'utf8');
    } catch {
      return;
    }
    assert.throws(() => transformSync(raw, { loader: 'ts', format: 'esm' }));
    const { text, inserted, collapsedStringify } = repairDefinitionContentItems(raw);
    assert.ok(collapsedStringify >= 1);
    assert.ok(inserted >= 1);
    assertParseable(text, 'HelpCard');
    assert.equal(countItems(text), 3);
    assert.doesNotMatch(text, /JSON\.stringify\s*\(\s*JSON\.stringify/);
  });

  it('does not over-insert on scalar-last-field multi-item (HelpReason-like)', () => {
    const src = `import type { ComponentTemplateDefinition } from 'x';
export const DemoDefinition = {
  kind: 'component', definitionKey: 'demo-reason', name: 'demo-reason', componentName: 'DemoReason',
  content: { location: { root: 'data', folder: ['X'] }, culture: 'nl-NL', items: [
    { name: 'A', fields: { Heading: JSON.stringify('A'), Icon: JSON.stringify('people') } },
    { name: 'B', fields: { Heading: JSON.stringify('B'), Icon: JSON.stringify('heart') } },
  ] },
} satisfies ComponentTemplateDefinition;
`;
    assertParseable(src, 'control-before');
    const { text, inserted } = repairContentItemsMissingItemClose(src);
    assert.equal(inserted, 0);
    assert.equal(text, src);
    const root = repairDefinitionContentItems(src);
    assert.equal(root.rootClosed, 0);
    assert.equal(root.text, src);
  });

  it('closes missing root } before satisfies (HealthCardGrid one-liner)', () => {
    // AI often emits content close but omits the export-object close before satisfies.
    const broken = `import type { ComponentTemplateDefinition } from 'x';
export const MenzisHealthCardGridDefinition = { kind: 'component', definitionKey: 'menzis-health-card-grid', name: 'menzis-health-card-grid', componentName: 'MenzisHealthCardGrid', model: { childItemTemplate: { name: 'Health Card', sections: [{ name: 'Content', fields: [{ name: 'Image', type: 'Image' }] }] } }, content: { location: { root: 'data', folder: ['Further Help and Health'] }, culture: 'nl-NL', items: [{ name: 'More Health', fields: { Heading: JSON.stringify('Meer gezondheid') }, children: [{ name: 'Sleeping', fields: { Heading: JSON.stringify('Sleep'), Body: JSON.stringify('<p>Het lukt.</p>'), Image: { url: 'https://cdn.example/sleep.jpg', alt: 'Sleep' } } }, { name: 'Therapieland', fields: { Heading: JSON.stringify("Zit je niet lekker?"), Body: JSON.stringify("<p>Met de online programma's van Therapieland.</p>"), Image: { url: 'https://cdn.example/t.jpg', alt: "programma's" } } }, { name: 'Treatment Waiting', fields: { Heading: JSON.stringify('Waiting'), Body: JSON.stringify('<p>Wachten.</p>'), Image: { url: 'https://cdn.example/w.jpg', alt: 'Waiting' } } }] }] } satisfies ComponentTemplateDefinition;
`;
    assert.throws(() => transformSync(broken, { loader: 'ts', format: 'esm' }));
    const onlyRoot = closeUnbalancedBracesBeforeSatisfies(broken);
    assert.equal(onlyRoot.rootClosed, 1);
    assertParseable(onlyRoot.text, 'healthcard-root-only');
    const { text, rootClosed, inserted } = repairDefinitionContentItems(broken);
    assert.equal(rootClosed, 1);
    assert.equal(inserted, 0);
    assertParseable(text, 'healthcard-repaired');
    assert.match(text, /url:\s*'https:\/\/cdn\.example\/sleep\.jpg'/);
    assert.match(text, /url:\s*'https:\/\/cdn\.example\/t\.jpg'/);
    assert.match(text, /url:\s*'https:\/\/cdn\.example\/w\.jpg'/);
    assert.match(text, /\}\s*satisfies\s+ComponentTemplateDefinition/);
  });

  it('does not over-insert on LinkList nested children after parent fields close', () => {
    const src = `import type { ComponentTemplateDefinition } from 'x';
export const LinkListDefinition = {
  kind: 'component', definitionKey: 'demo-link-list', name: 'demo-link-list', componentName: 'DemoLinkList',
  content: { location: { root: 'data', folder: ['Link Lists'] }, culture: 'nl-NL', items: [
    { name: 'Insured Links', fields: { Title: JSON.stringify('Wel verzekerd.') }, children: [{ name: 'Declaratie indienen', fields: { Link: { text: 'Declaratie indienen', url: 'https://example.com/a' } } }, { name: 'Wijzigingen doorgeven', fields: { Link: { text: 'Wijzigingen doorgeven', url: 'https://example.com/b' } } }] },
    { name: 'Help Links', fields: { Title: JSON.stringify('Hulp?') }, children: [{ name: 'Contact', fields: { Link: { text: 'Contact', url: 'https://example.com/c' } } }] },
  ] },
} satisfies ComponentTemplateDefinition;
`;
    assertParseable(src, 'linklist-before');
    const { text, inserted } = repairContentItemsMissingItemClose(src);
    assert.equal(inserted, 0);
    assert.equal(text, src);
    assertParseable(text, 'linklist-after');
  });

  it('still inserts missing parent close when item has nested children', () => {
    // Parent fields closed, children closed, but parent `}` omitted before next item
    const broken = `export const X = { content: { items: [
    { name: 'Insured Links', fields: { Title: JSON.stringify('A') }, children: [{ name: 'Child', fields: { Link: { text: 'Child', url: '/c' } } }] ,
    { name: 'Help Links', fields: { Title: JSON.stringify('B') } },
  ] } };`;
    assert.throws(() => transformSync(broken, { loader: 'ts', format: 'esm' }));
    const { text, inserted } = repairContentItemsMissingItemClose(broken);
    assert.ok(inserted >= 1);
    assertParseable(text, 'linklist-missing-parent-close');
  });

  it('leaves parseable SupportLinkList raw AI package untouched', () => {
    const rawPath = path.join(
      DUMP_DIR,
      'codegen-sitecoreize-MenzisSupportAndHealthContent.raw.ai.json',
    );
    let rawPkg;
    try {
      const j = JSON.parse(readFileSync(rawPath, 'utf8'));
      rawPkg = (j.packages || []).find(
        (p) => p.componentName === 'MenzisSupportLinkList',
      );
    } catch {
      // Capture dump may be absent in CI — skip quietly
      return;
    }
    if (!rawPkg?.definitionTs) return;
    assertParseable(rawPkg.definitionTs, 'SupportLinkList-raw');
    const { text, inserted } = repairDefinitionContentItems(rawPkg.definitionTs);
    assert.equal(inserted, 0);
    assert.equal(text, rawPkg.definitionTs);
    assertParseable(text, 'SupportLinkList-repaired');
  });

  it('collapseDoubleJsonStringify is idempotent', () => {
    const raw = `Links: JSON.stringify(JSON.stringify([{ text: 'a', url: '/a' }]))`;
    const once = collapseDoubleJsonStringify(raw);
    assert.equal(once.collapsed, 1);
    assert.equal(once.text, `Links: JSON.stringify([{ text: 'a', url: '/a' }])`);
    const twice = collapseDoubleJsonStringify(once.text);
    assert.equal(twice.collapsed, 0);
    assert.equal(twice.text, once.text);
  });

  it('repairs JSON.stringify(JSON.stringify({…}), missing outer paren', () => {
    const raw = `export const X = {
  content: { items: [{ name: 'Nav', fields: {
    'Navigation Data': JSON.stringify(JSON.stringify({ items: ['A'], panels: { 'A': [{ title: "Extra's", links: [['x', '/x']] }] } }),
    'Search Label': "Zoeken",
  } }] },
};`;
    assert.throws(() => assertParseable(raw, 'nav-broken'));
    const once = collapseDoubleJsonStringify(raw);
    assert.equal(once.collapsed, 1);
    assert.match(once.text, /'Navigation Data':\s*JSON\.stringify\(\{/);
    assert.doesNotMatch(once.text, /JSON\.stringify\s*\(\s*JSON\.stringify/);
    assertParseable(once.text, 'nav-repaired');
  });
});

describe('isGhostEmptyBandChildPackage', () => {
  it('detects empty items + empty layout PH', () => {
    const pkg = {
      componentName: 'MenzisHelpAdditional',
      definitionKey: 'menzis-help-additional',
      parentPlaceholder: 'additional-items',
      repeatHint: 1,
      definitionTs: `export const x = {
  model: { itemTemplate: { name: 'X', sections: [{ name: 'Content', fields: [] }] } },
  content: { items: [] },
} satisfies ComponentTemplateDefinition;`,
    };
    const sketch = {
      renderings: [
        {
          placeholders: {
            'additional-items': [],
            reasons: [{ componentName: 'MenzisHelpReason' }],
          },
        },
      ],
    };
    assert.equal(isGhostEmptyBandChildPackage(pkg, sketch), true);
  });

  it('does not treat seeded child as ghost', () => {
    const pkg = {
      parentPlaceholder: 'reasons',
      definitionTs: `export const x = {
  content: { items: [{ name: 'A', fields: { Heading: JSON.stringify('A') } }] },
} satisfies ComponentTemplateDefinition;`,
    };
    const sketch = {
      renderings: [{ placeholders: { reasons: [{ componentName: 'X' }] } }],
    };
    assert.equal(isGhostEmptyBandChildPackage(pkg, sketch), false);
  });
});

describe('prompt / header item-close examples', () => {
  it('DEFINITION_PARSE_FIX_HEADER mentions item close Bad/Good', () => {
    assert.match(DEFINITION_PARSE_FIX_HEADER, /CTA:\s*\{\s*text:/);
    assert.match(DEFINITION_PARSE_FIX_HEADER, /fields closed, item still open|fields then item/i);
    assert.match(DEFINITION_PARSE_FIX_HEADER, /JSON\.stringify\(JSON\.stringify/);
  });

  it('DEFINITION SCHEMA mentions item-close HARD rule', () => {
    const src = readFileSync(path.join(__dirname, 'section-codegen.mjs'), 'utf8');
    assert.match(src, /HARD — content\.items element close/);
    assert.match(src, /Bad:.*CTA:.*\}, \{ name: 'Next'/);
    assert.match(src, /Good:.*CTA:.*\} \} \}, \{ name: 'Next'/);
  });
});

describe('warnIfContentItemCountBelowHint quiet default', () => {
  it('still returns under-seeded result without throwing', () => {
    const sample = `export const x = {
  content: { items: [{ name: 'Only', fields: {} }] },
} satisfies ComponentTemplateDefinition;`;
    const result = warnIfContentItemCountBelowHint(sample, 3, 'Card');
    assert.equal(result.ok, false);
    assert.equal(result.actual, 1);
  });
});
