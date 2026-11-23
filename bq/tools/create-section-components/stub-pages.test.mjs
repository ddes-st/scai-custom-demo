/**
 * Run: node --import tsx --test tools/create-section-components/stub-pages.test.mjs
 */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  healCollidingPageStubDefinitionKeys,
  pageStubDefinitionKey,
} from './stub-pages.mjs';

describe('pageStubDefinitionKey', () => {
  it('uses site + route without stub- prefix', () => {
    assert.equal(
      pageStubDefinitionKey('crelan-be', ['individuals']),
      'crelan-be-individuals',
    );
    assert.equal(
      pageStubDefinitionKey('axa-be', ['individuals']),
      'axa-be-individuals',
    );
    assert.notEqual(
      pageStubDefinitionKey('crelan-be', ['jobs']),
      pageStubDefinitionKey('axa-be', ['jobs']),
    );
  });
});

describe('healCollidingPageStubDefinitionKeys', () => {
  it('renames bare colliding pages to site-prefixed keys under pages/', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-stub-heal-'));
    const writeStub = async (host, site, key) => {
      const dir = path.join(root, host, 'pages');
      await mkdir(dir, { recursive: true });
      const abs = path.join(dir, `${key}.definition.ts`);
      await writeFile(
        abs,
        `export const stubX = {
  kind: "page",
  definitionKey: "${key}",
  routePath: "/individuals",
  siteSystem: "${site}",
  collectionSystem: "x",
};
`,
        'utf8',
      );
      return abs;
    };
    await writeStub('axa-be', 'axa-be', 'individuals');
    await writeStub('crelan-be', 'crelan-be', 'individuals');

    const out = await healCollidingPageStubDefinitionKeys(root);
    assert.equal(out.healed, 2);
    assert.equal(out.collisions, 1);

    const axa = await readFile(
      path.join(root, 'axa-be', 'pages', 'axa-be-individuals.definition.ts'),
      'utf8',
    );
    const crelan = await readFile(
      path.join(root, 'crelan-be', 'pages', 'crelan-be-individuals.definition.ts'),
      'utf8',
    );
    assert.match(axa, /definitionKey: "axa-be-individuals"/);
    assert.match(crelan, /definitionKey: "crelan-be-individuals"/);
    assert.match(axa, /kind: "page"/);
  });

  it('migrates colliding legacy _page-stubs into pages/', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-stub-migrate-'));
    const writeLegacy = async (host, site, key) => {
      const dir = path.join(root, host, '_page-stubs');
      await mkdir(dir, { recursive: true });
      await writeFile(
        path.join(dir, `${key}.definition.ts`),
        `export const x = {
  kind: "page-stub",
  definitionKey: "${key}",
  routePath: "/jobs",
  siteSystem: "${site}",
  collectionSystem: "x",
};
`,
        'utf8',
      );
    };
    await writeLegacy('axa-be', 'axa-be', 'jobs');
    await writeLegacy('crelan-be', 'crelan-be', 'jobs');

    const out = await healCollidingPageStubDefinitionKeys(root);
    assert.equal(out.healed, 2);

    const axaPages = path.join(root, 'axa-be', 'pages', 'axa-be-jobs.definition.ts');
    const crelanPages = path.join(
      root,
      'crelan-be',
      'pages',
      'crelan-be-jobs.definition.ts',
    );
    await access(axaPages);
    await access(crelanPages);
    assert.match(await readFile(axaPages, 'utf8'), /kind: "page"/);

    await assert.rejects(
      () => access(path.join(root, 'axa-be', '_page-stubs', 'jobs.definition.ts')),
    );
  });
});
