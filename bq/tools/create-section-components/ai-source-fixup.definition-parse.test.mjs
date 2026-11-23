/**
 * Definition parse gate + injectMissingLinkSeeds nested Image safety.
 * Run: node --test tools/create-section-components/ai-source-fixup.definition-parse.test.mjs
 */
import './force-mutating-fixups-for-tests.mjs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertDefinitionTsParseable,
  assertDefinitionTsSeedShape,
  injectMissingLinkSeeds,
  normalizeDefinitionTs,
  repairCorruptedDefinitionLiterals,
} from './ai-source-fixup.mjs';

const BASE = `
import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const demoDefinition = {
  kind: "component",
  definitionKey: "demo-card",
  name: "demo-card",
  displayName: "Demo Card",
  componentName: "DemoCard",
  icon: "Office/32x32/window_dialog.png",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  datasourceLocation: { scope: "site", root: "data", folder: ["Demo Cards"] },
  model: {
    folderTemplate: { name: "Demo Card Folder" },
    itemTemplate: {
      name: "Demo Card",
      sections: [{
        name: "Data",
        sortOrder: 100,
        fields: [
          { name: "Image", type: "Image" },
          { name: "Title", type: "Single-Line Text" },
          { name: "Link", type: "General Link" },
        ],
      }],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Demo Cards"] },
    culture: "en",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Card One",
        displayName: "Card One",
        fields: {
          Image: { url: "https://example.com/a.jpg", alt: "A" },
          Title: "Card One"
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
`;

describe('injectMissingLinkSeeds (nested Image)', () => {
  it('does not stop fields body at Image closing brace', () => {
    const out = injectMissingLinkSeeds(BASE, null, '<a href="/x">Card One</a>');
    assert.match(out, /fields:\s*\{[\s\S]*Image:\s*\{[\s\S]*\}\s*,[\s\S]*Title:[\s\S]*Link:\s*\{/);
    assert.doesNotMatch(out, /Link:\s*\{[\s\S]*\}\s*\}\s*\n\s*Title:/);
    assertDefinitionTsParseable(out, 'inject-nested-image.definition.ts');
  });

  it('does not nest Link inside Image when alt contains commas', () => {
    const src = BASE.replace(
      'Image: { url: "https://example.com/a.jpg", alt: "A" },',
      'Image: { url: "https://example.com/a.jpg", alt: "Back-to-School Bootcamp: AI, Content & Customer Experience | Sitecore" },',
    );
    const out = injectMissingLinkSeeds(
      src,
      null,
      '<a href="/resources/events-webinars/bootcamp">Back-to-School Bootcamp: AI, Content & Customer Experience</a>',
    );
    assert.doesNotMatch(out, /Image:\s*\{[^}]*Link\s*:/);
    assert.match(
      out,
      /Link:\s*\{\s*text:\s*"Back-to-School Bootcamp: AI, Content & Customer Experience",\s*url:\s*"\/resources\/events-webinars\/bootcamp"\s*\}/,
    );
    assertDefinitionTsParseable(out, 'inject-comma-alt.definition.ts');
  });

  it('does not invent Lees meer + "/" when HTML has no href', () => {
    const out = injectMissingLinkSeeds(BASE, null, '<p>No links here</p>');
    assert.doesNotMatch(out, /Lees meer/);
    assert.doesNotMatch(out, /Link:\s*\{\s*text:[^}]*url:\s*"\/"\s*\}/);
    assert.match(out, /Title:\s*"Card One"/);
  });
});

describe('repairCorruptedDefinitionLiterals', () => {
  it('unsplices Link from the middle of a name string', () => {
    const broken = `
content: { items: [ {
  name: "Building An AI Ready },
          Link: {
            text: "x",
            url: "/y",
          } Content Foundation With DAM",
  displayName: "Building an AI-ready content foundation with DAM",
  fields: { Title: "x" },
} ] }
`;
    const out = repairCorruptedDefinitionLiterals(broken);
    assert.match(
      out,
      /name:\s*"Building An AI Ready Content Foundation With DAM"/,
    );
    assert.match(out, /Link:\s*\{\s*text:\s*"x"/);
  });
});

describe('keepExpectedComponentDefinitionExport prefix drift', () => {
  it('keeps AI unprefixed definitionKey when write expects brand-prefixed key', () => {
    const src = `
import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const NavigationItemDefinition = {
  kind: "component",
  definitionKey: "navigation-item",
  name: "navigation-item",
  displayName: "Navigation Item",
  componentName: "NavigationItem",
  icon: "Office/32x32/window_dialog.png",
  collectionSystem: "crelan",
  siteSystem: "crelan-be",
  datasourceLocation: { scope: "site", root: "data", folder: ["Navigation Items"] },
  model: {
    folderTemplate: { name: "Navigation Item Folder" },
    itemTemplate: {
      name: "Navigation Item",
      sections: [{
        name: "Content",
        fields: [
          { name: "Title", type: "Single-Line Text" },
          { name: "Link", type: "General Link" },
        ],
      }],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Navigation Items"] },
    culture: "nl-BE",
    cultures: ["nl-BE"],
    items: [{ name: "One", fields: { Title: "One", Link: { text: "One", url: "/" } } }],
  },
} satisfies ComponentTemplateDefinition;
`;
    const out = normalizeDefinitionTs(src, {
      definitionKey: 'crelan-navigation-item',
      componentName: 'CrelanNavigationItem',
      codePrefix: 'crelan',
    });
    assert.match(out, /definitionKey:\s*["']crelan-navigation-item["']/);
    assert.match(out, /Title:\s*["']One["']/);
    assert.ok(out.length > 400, `expected full definition, got len=${out.length}`);
  });
});

describe('assertDefinitionTsParseable', () => {
  it('accepts valid definition', () => {
    assertDefinitionTsParseable(BASE);
  });

  it('rejects unexpected braces', () => {
    assert.throws(
      () =>
        assertDefinitionTsParseable(
          'export const x = { foo: 1, }, } satisfies X;',
        ),
      /not valid TypeScript/,
    );
  });

  it('dumps post-lean source to ai-debug on parse failure when dumpOpts set', async () => {
    const { mkdtemp, readFile, rm } = await import('node:fs/promises');
    const { readdirSync } = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const {
      setSkipAiDebugDump,
      _resetAiDebugClearedDirsForTests,
    } = await import('./ai-debug-dump.mjs');
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-def-parse-dump-'));
    try {
      setSkipAiDebugDump(false);
      _resetAiDebugClearedDirsForTests();
      const aiDebugRoot = path.join(root, 'ai-debug');
      assert.throws(
        () =>
          assertDefinitionTsParseable(
            'export const x = { foo: 1, }, } satisfies X;',
            'example.definition.ts',
            { aiDebugRoot, componentName: 'Example', definitionKey: 'example' },
          ),
        /not valid TypeScript/,
      );
      const names = readdirSync(aiDebugRoot);
      assert.ok(
        names.some((n) => /definition-after-fixups-Example\.ts\.ai$/.test(n)),
        `expected after-fixups dump, got ${names.join(',')}`,
      );
      const dumpName = names.find((n) =>
        /definition-after-fixups-Example\.ts\.ai$/.test(n),
      );
      const body = await readFile(path.join(aiDebugRoot, dumpName), 'utf8');
      assert.match(body, /export const x/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('normalizeDefinitionTs refuses to return unparseable output', () => {
    assert.throws(
      () =>
        normalizeDefinitionTs('export const broken = { name: "a },\n} satisfies X;', {
          definitionKey: 'broken',
          componentName: 'Broken',
        }),
      /not valid TypeScript/,
    );
  });
});

describe('assertDefinitionTsSeedShape (definition seeds)', () => {
  it('accepts flat seeds + named templates', () => {
    assertDefinitionTsSeedShape(BASE);
  });

  it('rejects runtime { value } wrappers', () => {
    const bad = BASE.replace(
      'Title: "Card One"',
      "Title: { value: 'Card One' }",
    );
    assert.throws(
      () => assertDefinitionTsSeedShape(bad, 'demo.definition.ts'),
      /runtime Field wrappers/,
    );
  });

  it('rejects Image src seeds', () => {
    const bad = BASE.replace(
      'Image: { url: "https://example.com/a.jpg", alt: "A" }',
      "Image: { src: 'https://example.com/a.jpg', alt: 'A' }",
    );
    assert.throws(
      () => assertDefinitionTsSeedShape(bad, 'demo.definition.ts'),
      /Image seed with `src`/,
    );
  });

  it('rejects missing itemTemplate.name', () => {
    const bad = BASE.replace(
      /itemTemplate:\s*\{\s*name:\s*"Demo Card",/,
      'itemTemplate: {',
    );
    assert.throws(
      () => assertDefinitionTsSeedShape(bad, 'demo.definition.ts'),
      /missing model\.itemTemplate\.name/,
    );
  });

  it('rejects missing folderTemplate.name', () => {
    const bad = BASE.replace(
      /folderTemplate:\s*\{\s*name:\s*"Demo Card Folder"\s*\},/,
      'folderTemplate: { },',
    );
    assert.throws(
      () => assertDefinitionTsSeedShape(bad, 'demo.definition.ts'),
      /missing model\.folderTemplate\.name/,
    );
  });

  it('rejects missing content.location', () => {
    const bad = BASE.replace(
      /location:\s*\{\s*root:\s*"data",\s*folder:\s*\["Demo Cards"\]\s*\},/,
      '',
    );
    assert.throws(
      () => assertDefinitionTsSeedShape(bad, 'demo.definition.ts'),
      /missing content\.location/,
    );
  });

  it('rejects missing top-level name', () => {
    const bad = BASE.replace(/\n\s*name:\s*"demo-card",/, '\n');
    assert.throws(
      () => assertDefinitionTsSeedShape(bad, 'demo.definition.ts'),
      /missing top-level name/,
    );
  });
});
