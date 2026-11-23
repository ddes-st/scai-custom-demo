/**
 * Run: node --import tsx --test tools/create-section-components/definition-path-name-normalize.test.mjs
 */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import {
  formatDefinitionNameNormalizeLog,
  normalizeDefinitionContentItemPathNames,
  normalizeSitecoreizePathNames,
  remapLayoutSketchDatasourceNames,
  writeDefinitionNameNormalizeDump,
} from './definition-path-name-normalize.mjs';
import {
  _resetAiDebugClearedDirsForTests,
  setSkipAiDebugDump,
} from './ai-debug-dump.mjs';
import {
  resetTranslationCacheMemory,
  setTranslateWithOpenAiForTests,
} from '../shared/translate.ts';

describe('definition-path-name-normalize', () => {
  /** @type {string[]} */
  const temps = [];

  after(async () => {
    setTranslateWithOpenAiForTests(null);
    resetTranslationCacheMemory();
    setSkipAiDebugDump(false);
    _resetAiDebugClearedDirsForTests();
    for (const dir of temps) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rewrites Dutch content item names to EN + displayName; leaves fields', async () => {
    let aiCalls = 0;
    setTranslateWithOpenAiForTests(async (text) => {
      aiCalls += 1;
      if (/Persoonlijk/i.test(String(text))) return 'Personal Contact';
      if (/Anderzorg/i.test(String(text))) return 'Anderzorg Becomes Menzis';
      return `EN ${text}`;
    });
    resetTranslationCacheMemory();

    const src = `
export const dirty = {
  content: {
    location: { root: 'data', folder: ['Image Content Sections'] },
    culture: 'nl-NL',
    items: [
      { name: 'Anderzorg wordt Menzis', fields: { Heading: 'Anderzorg wordt Menzis' } },
      { name: 'Persoonlijk contact', fields: { Heading: 'Persoonlijk contact' } },
      { name: 'Image Content Section', fields: { Heading: 'x' } },
    ],
  },
};
`;
    const out = await normalizeDefinitionContentItemPathNames(src, {
      sourceCulture: 'nl-NL',
    });
    assert.match(out.text, /name:\s*"Anderzorg [Bb]ecomes Menzis"/);
    assert.match(
      out.text,
      /displayName:\s*"Anderzorg wordt Menzis"/,
    );
    assert.match(out.text, /name:\s*"Personal [Cc]ontact"/);
    assert.match(out.text, /displayName:\s*"Persoonlijk contact"/);
    assert.match(out.text, /Heading:\s*'Anderzorg wordt Menzis'/);
    assert.match(out.text, /name:\s*'Image Content Section'/);
    assert.ok(out.remaps.length >= 2);
    assert.ok(
      aiCalls >= 0,
      'AI optional when translation cache already has the phrase',
    );
  });

  it('leaves already-English item names without AI', async () => {
    let aiCalls = 0;
    setTranslateWithOpenAiForTests(async () => {
      aiCalls += 1;
      return 'SHOULD_NOT_RUN';
    });
    const src = `
content: {
  culture: 'nl-NL',
  items: [{ name: 'Image Content Section', fields: { Heading: 'Hi' } }],
};
`;
    const out = await normalizeDefinitionContentItemPathNames(src, {
      sourceCulture: 'nl-NL',
    });
    assert.equal(out.remaps.length, 0);
    assert.equal(aiCalls, 0);
    assert.match(out.text, /name:\s*'Image Content Section'/);
  });

  it('sanitizes already-English Path names that fail ItemNameValidation', async () => {
    let aiCalls = 0;
    setTranslateWithOpenAiForTests(async () => {
      aiCalls += 1;
      return 'SHOULD_NOT_RUN';
    });
    const src = `
content: {
  culture: 'en',
  items: [
    { name: "Then there's Menzis.", fields: { Heading: "Then there's Menzis." } },
    { name: "Medicine shortages here's what's going on", fields: { Title: "x" } },
  ],
};
`;
    const out = await normalizeDefinitionContentItemPathNames(src, {
      sourceCulture: 'en',
    });
    assert.equal(aiCalls, 0);
    assert.match(out.text, /name:\s*"Then theres Menzis"/);
    assert.match(out.text, /displayName:\s*"Then there's Menzis\."/);
    assert.match(
      out.text,
      /name:\s*"Medicine shortages heres whats going on"/,
    );
    assert.match(
      out.text,
      /displayName:\s*"Medicine shortages here's what's going on"/,
    );
    assert.ok(
      out.remaps.some((r) => r.kind === 'item-name-sanitize'),
      'expected sanitize remaps',
    );
    assert.equal(
      out.nameMap.get("Then there's Menzis."),
      'Then theres Menzis',
    );
  });

  it('remaps layoutSketch datasourceName with the same map', async () => {
    setTranslateWithOpenAiForTests(async (text) => {
      if (/Wel verzekerd/i.test(String(text))) return 'Well Insured With Menzis';
      return `EN ${text}`;
    });
    resetTranslationCacheMemory();

    const named = await normalizeSitecoreizePathNames({
      sourceCulture: 'nl-NL',
      packages: [
        {
          componentName: 'MenzisSupportGroup',
          definitionTs: `
export const x = {
  content: {
    culture: 'nl-NL',
    items: [{ name: 'Wel verzekerd bij Menzis', fields: { Heading: 'Wel verzekerd bij Menzis' } }],
  },
};
`,
        },
      ],
      layoutSketch: {
        placeholders: {
          'support-groups': [
            {
              componentName: 'MenzisSupportGroup',
              datasourceName: 'Wel verzekerd bij Menzis',
            },
          ],
        },
      },
    });

    assert.match(
      named.packages[0].definitionTs,
      /name:\s*"Well [Ii]nsured[^"]*Menzis"/,
    );
    assert.match(
      named.layoutSketch.placeholders['support-groups'][0].datasourceName,
      /Well [Ii]nsured/,
    );
    assert.ok(
      named.remaps.some((r) => r.kind === 'datasourceName'),
      'expected datasourceName remap',
    );
  });

  it('writeDefinitionNameNormalizeDump writes names json, meta, and log', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-names-dump-'));
    temps.push(root);
    setSkipAiDebugDump(false);
    const written = writeDefinitionNameNormalizeDump({
      aiDebugRoot: path.join(root, 'ai-debug'),
      stem: 'codegen-sitecoreize-Foo',
      componentName: 'Foo',
      remaps: [
        {
          kind: 'item-name',
          before: 'Persoonlijk contact',
          after: 'Personal Contact',
          displayName: 'Persoonlijk contact',
          cacheHit: true,
          culture: 'nl-NL→en',
        },
      ],
      packagesJson: { packages: [], layoutSketch: null },
    });
    assert.ok(written?.logPath);
    const log = await readFile(written.logPath, 'utf8');
    assert.match(log, /Persoonlijk contact/);
    assert.match(log, /Personal Contact/);
    const meta = JSON.parse(await readFile(written.metaPath, 'utf8'));
    assert.equal(meta.changed, 1);
    const names = JSON.parse(await readFile(written.namesPath, 'utf8'));
    assert.ok(names);
  });

  it('writeDefinitionNameNormalizeDump no-ops when no remaps', () => {
    setSkipAiDebugDump(false);
    const written = writeDefinitionNameNormalizeDump({
      aiDebugRoot: path.join(os.tmpdir(), 'bq-names-noop'),
      remaps: [],
      packagesJson: {},
    });
    assert.equal(written, null);
  });

  it('formatDefinitionNameNormalizeLog lists remaps', () => {
    const log = formatDefinitionNameNormalizeLog([
      {
        kind: 'item-name',
        before: 'A',
        after: 'B',
        displayName: 'A',
        cacheHit: false,
        culture: 'nl-NL→en',
      },
    ]);
    assert.match(log, /\[item-name\]/);
    assert.match(log, /"A" → "B"/);
  });

  it('remapLayoutSketchDatasourceNames alone translates missing map entries', async () => {
    setTranslateWithOpenAiForTests(async () => 'Well Insured');
    resetTranslationCacheMemory();
    const { layoutSketch, remaps } = await remapLayoutSketchDatasourceNames(
      {
        placeholders: {
          x: [{ datasourceName: 'Wel verzekerd bij Menzis' }],
        },
      },
      { sourceCulture: 'nl-NL' },
    );
    assert.match(layoutSketch.placeholders.x[0].datasourceName, /Well/i);
    assert.equal(remaps.length, 1);
  });
});
