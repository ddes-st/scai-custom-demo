/**
 * Run: node --test tools/create-section-components/page-defs.test.mjs
 */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  datasourceNamesMatchLoose,
  definitionHasRenderings,
  extractContentItemNames,
  isHashedOrphanDatasourceLabel,
  pageDefinitionKey,
  pagesDir,
  routePathToSegments,
  soleSeedDatasourceName,
  writePageDefinition,
  ensurePageShellDefinition,
} from './page-defs.mjs';

describe('pageDefinitionKey', () => {
  it('uses site + route without stub-/page- prefix (XOR naming)', () => {
    assert.equal(
      pageDefinitionKey('crelan-be', ['particulieren']),
      'crelan-be-particulieren',
    );
    assert.equal(pageDefinitionKey('crelan-be', []), 'crelan-be-home');
    assert.ok(!pageDefinitionKey('crelan-be', ['a']).startsWith('stub-'));
    assert.ok(!pageDefinitionKey('crelan-be', ['a']).startsWith('page-'));
  });
});

describe('pagesDir', () => {
  it('uses pages/ not _page-stubs', () => {
    const root = path.join(os.tmpdir(), 'bq-components');
    const dir = pagesDir('crelan-be', root);
    assert.equal(dir, path.join(root, 'crelan-be', 'pages'));
    assert.ok(!dir.includes('_page-stubs'));
  });
});

describe('routePathToSegments', () => {
  it('splits path', () => {
    assert.deepEqual(routePathToSegments('/particulieren/blog'), [
      'particulieren',
      'blog',
    ]);
    assert.deepEqual(routePathToSegments('/'), []);
  });
});

describe('extractContentItemNames / soleSeedDatasourceName', () => {
  const sample = `
  content: {
    location: { root: "data", folder: ["Heroes"] },
    items: [
      { name: "Crelan Welcome Hero", fields: { Heading: "Hi" } },
      { name: "Second Hero", fields: {} },
    ],
  },
`;
  it('extracts item names', () => {
    assert.deepEqual(extractContentItemNames(sample), [
      'Crelan Welcome Hero',
      'Second Hero',
    ]);
  });

  it('keeps apostrophes inside double-quoted names', () => {
    const src = `
  content: {
    items: [
      { name: "Thema's", fields: { Title: "Thema's" } },
      { name: "O'Brien", fields: {} },
      { name: 'Direct Links', fields: {} },
    ],
  },
`;
    assert.deepEqual(extractContentItemNames(src), [
      "Thema's",
      "O'Brien",
      'Direct Links',
    ]);
  });

  it('ignores nested children names (LinkList group + Link children)', () => {
    const src = `
  content: {
    location: { root: "data", folder: ["Link Lists"] },
    items: [
      {
        name: "Legal Links",
        fields: { Title: "Legal Links" },
        children: [
          { name: "Privacy", fields: { Link: { text: "Privacy", url: "https://example.com/p" } } },
          { name: "Cookies", fields: { Link: { text: "Cookies", url: "https://example.com/c" } } },
        ],
      },
    ],
  },
`;
    assert.deepEqual(extractContentItemNames(src), ['Legal Links']);
  });

  it('soleSeedDatasourceName returns the only seed or null', () => {
    assert.equal(
      soleSeedDatasourceName(['Site Navigation Header']),
      'Site Navigation Header',
    );
    assert.equal(soleSeedDatasourceName(['Crelan Welcome Hero']), 'Crelan Welcome Hero');
    assert.equal(soleSeedDatasourceName([]), null);
    assert.equal(
      soleSeedDatasourceName(['Our Offer', 'Themes', 'Direct Links', 'Contact Us']),
      null,
    );
    assert.equal(soleSeedDatasourceName(null), null);
  });

  it("datasourceNamesMatchLoose handles apostrophe truncation", () => {
    assert.equal(datasourceNamesMatchLoose('Thema', "Thema's"), true);
    assert.equal(datasourceNamesMatchLoose('OBrien', "O'Brien"), true);
    assert.equal(datasourceNamesMatchLoose('Our Offer', 'Themes'), false);
  });

  it('detects hashed orphan datasource labels', () => {
    assert.equal(
      isHashedOrphanDatasourceLabel('CrelanHeroWithPromotionalCards 5e898255'),
      true,
    );
    assert.equal(isHashedOrphanDatasourceLabel('Contact us'), false);
    assert.equal(isHashedOrphanDatasourceLabel("Thema's"), false);
  });
});

describe('definitionHasRenderings', () => {
  it('detects renderings array with objects', () => {
    assert.equal(definitionHasRenderings('renderings: []'), false);
    assert.equal(
      definitionHasRenderings('renderings: [{ definitionKey: "x" }]'),
      true,
    );
  });
});

describe('writePageDefinition / ensurePageShellDefinition', () => {
  it('writes full page under pages/ and does not overwrite full with shell', async () => {
    const componentsRoot = await mkdtemp(path.join(os.tmpdir(), 'bq-pages-'));
    const host = 'crelan-be';

    const full = await writePageDefinition({
      siteSystem: 'crelan-be',
      collectionSystem: 'crelan',
      hostSlug: host,
      routePath: '/particulieren',
      name: 'Particulieren',
      navigationTitle: 'Particulieren',
      renderings: [
        {
          definitionKey: 'crelan-welcome-hero',
          placeholder: 'headless-main',
          datasourceItem: 'Crelan Welcome Hero',
        },
      ],
      componentsRoot,
    });

    assert.ok(full.file.includes(`${path.sep}pages${path.sep}`));
    assert.equal(full.definitionKey, 'crelan-be-particulieren');
    assert.ok(!full.definitionKey.startsWith('stub-'));
    assert.ok(!full.definitionKey.startsWith('page-'));

    const src = await readFile(full.file, 'utf8');
    assert.match(src, /kind: "page"/);
    assert.match(src, /crelan-welcome-hero/);
    assert.match(src, /Crelan Welcome Hero/);
    assert.ok(!src.includes('_page-stubs'));

    const shell = await ensurePageShellDefinition({
      siteSystem: 'crelan-be',
      collectionSystem: 'crelan',
      hostSlug: host,
      routePath: '/particulieren',
      name: 'ShouldNotOverwrite',
      componentsRoot,
    });
    assert.equal(shell.skipped, 'has-renderings');
    const after = await readFile(full.file, 'utf8');
    assert.match(after, /Crelan Welcome Hero/);
    assert.ok(!after.includes('ShouldNotOverwrite'));
  });

  it('creates shell once then upgrades in place to full layout', async () => {
    const componentsRoot = await mkdtemp(path.join(os.tmpdir(), 'bq-pages-up-'));
    const host = 'axa-be';

    const shell = await ensurePageShellDefinition({
      siteSystem: 'axa-be',
      collectionSystem: 'axa',
      hostSlug: host,
      routePath: '/jobs',
      name: 'Jobs',
      componentsRoot,
    });
    assert.equal(shell.created, true);
    assert.equal(shell.definitionKey, 'axa-be-jobs');
    const shellSrc = await readFile(shell.file, 'utf8');
    assert.equal(definitionHasRenderings(shellSrc), false);

    const full = await writePageDefinition({
      siteSystem: 'axa-be',
      collectionSystem: 'axa',
      hostSlug: host,
      routePath: '/jobs',
      name: 'Jobs',
      renderings: [{ definitionKey: 'axa-hero', placeholder: 'headless-main' }],
      componentsRoot,
    });
    assert.equal(full.file, shell.file);
    assert.equal(definitionHasRenderings(await readFile(full.file, 'utf8')), true);

    const dirFiles = await readdir(pagesDir(host, componentsRoot));
    assert.deepEqual(dirFiles, ['axa-be-jobs.definition.ts']);
  });
});
