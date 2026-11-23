/**
 * Run: node --import tsx --test tools/site-delete/delete-package.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import {
  archiveEntryPath,
  createTarGz,
  defaultArchiveFileName,
  extractTarGz,
  packageCollectionDeleteArchive,
  restoreCollectionPackage,
  toRepoRelative,
} from './delete-package.mjs';

describe('delete-package helpers', () => {
  it('toRepoRelative maps under root', () => {
    const root = path.join(os.tmpdir(), 'bq-pkg-root');
    const abs = path.join(root, 'a', 'b.yml');
    assert.equal(toRepoRelative(abs, root), 'a/b.yml');
  });

  it('archiveEntryPath prefixes kind', () => {
    assert.equal(
      archiveEntryPath('files', 'authoring/x.yml'),
      'files/authoring/x.yml',
    );
  });

  it('defaultArchiveFileName includes collection + stamp shape', () => {
    const name = defaultArchiveFileName(
      'crelan',
      new Date('2026-10-30T12:34:56.000Z'),
    );
    assert.match(name, /^collection-crelan-20261030-123456Z\.tar\.gz$/);
  });
});

describe('packageCollectionDeleteArchive round-trip', () => {
  /** @type {string} */
  let repoRoot;
  /** @type {string} */
  let packagesDir;
  /** @type {string} */
  let hostDir;
  /** @type {string} */
  let yamlRoot;
  /** @type {string} */
  let defPath;
  /** @type {string} */
  let urlRoutes;
  /** @type {string} */
  let emitSource;
  /** @type {string} */
  let moduleJson;

  before(() => {
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bq-coll-pkg-'));
    packagesDir = path.join(repoRoot, '.bq', 'delete-packages');
    fs.mkdirSync(packagesDir, { recursive: true });

    hostDir = path.join(repoRoot, 'bq', 'src', 'components', 'demo-be');
    fs.mkdirSync(hostDir, { recursive: true });
    fs.writeFileSync(path.join(hostDir, 'keep.txt'), 'host-package\n');

    defPath = path.join(hostDir, 'demo-collection.definition.ts');
    fs.writeFileSync(defPath, 'export const demo = { kind: "collection" };\n');

    yamlRoot = path.join(
      repoRoot,
      'authoring',
      'items',
      'bq-demo',
      'sai',
      'sites',
      'content',
      'demo',
    );
    fs.mkdirSync(yamlRoot, { recursive: true });
    fs.writeFileSync(path.join(yamlRoot, 'Home.yml'), 'Path: /demo/Home\n');

    const cacheDir = path.join(repoRoot, '.bq', 'definitions', 'cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    urlRoutes = path.join(cacheDir, 'url-routes.json');
    emitSource = path.join(cacheDir, 'apply-source.json');
    fs.writeFileSync(
      urlRoutes,
      JSON.stringify({ demo: { routes: true } }, null, 2) + '\n',
    );
    fs.writeFileSync(
      emitSource,
      JSON.stringify({ 'demo/demo-be': { hash: 'abc' } }, null, 2) + '\n',
    );

    const moduleDir = path.join(repoRoot, 'authoring', 'items', 'bq-demo');
    fs.mkdirSync(path.join(moduleDir, 'sai'), { recursive: true });
    moduleJson = path.join(moduleDir, 'bq-demo.module.json');
    fs.writeFileSync(
      moduleJson,
      JSON.stringify(
        {
          namespace: 'BQ',
          items: {
            includes: [{ name: 'demo', path: '/sitecore/content/demo' }],
          },
        },
        null,
        2,
      ) + '\n',
    );
  });

  after(() => {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  function testPlanFlat() {
    const plan = {
      mode: 'collection',
      collectionSystem: 'demo',
      siteSystem: null,
      local: {
        mode: 'collection',
        sitePlans: [{ siteSystem: 'demo-be' }],
        definitionKeys: ['demo-collection'],
      },
    };
    const flat = {
      dirs: [hostDir],
      yamlRoots: [yamlRoot],
      hashOrphanDirs: [],
      definitionFiles: [defPath],
      files: [defPath],
      captureRoots: [],
      definitionKeys: ['demo-collection'],
      emitSourceKeys: [],
      urlRoutesKeys: [],
      urlRoutesCollectionPrefixes: ['demo'],
      componentYaml: [],
    };
    const paths = {
      moduleJson,
      urlRoutes,
      emitSource,
      ownedState: path.join(repoRoot, 'missing-owned.json'),
    };
    return { plan, flat, paths };
  }

  it('dryRun reports counts without writing archive', async () => {
    const { plan, flat, paths } = testPlanFlat();
    const archivePath = path.join(packagesDir, 'dry-run-should-not-exist.tar.gz');
    const pkg = await packageCollectionDeleteArchive({
      plan,
      flat,
      dryRun: true,
      archivePath,
      repoRoot,
      packagesDir,
      paths,
      includeInventories: false,
      includeCaptureScrub: false,
    });
    assert.equal(pkg.dryRun, true);
    assert.ok(pkg.deletedCount >= 1);
    assert.ok(pkg.snapshotCount >= 1);
    assert.equal(fs.existsSync(archivePath), false);
  });

  it('package then simulated delete then restore is byte-equal', async () => {
    const { plan, flat, paths } = testPlanFlat();
    const archivePath = path.join(packagesDir, 'roundtrip.tar.gz');

    const hostBefore = fs.readFileSync(path.join(hostDir, 'keep.txt'), 'utf8');
    const defBefore = fs.readFileSync(defPath, 'utf8');
    const yamlBefore = fs.readFileSync(path.join(yamlRoot, 'Home.yml'), 'utf8');
    const routesBefore = fs.readFileSync(urlRoutes, 'utf8');
    const moduleBefore = fs.readFileSync(moduleJson, 'utf8');

    const pkg = await packageCollectionDeleteArchive({
      plan,
      flat,
      dryRun: false,
      archivePath,
      repoRoot,
      packagesDir,
      paths,
      includeInventories: false,
      includeCaptureScrub: false,
      localOnly: true,
    });
    assert.equal(pkg.dryRun, false);
    assert.ok(fs.existsSync(archivePath));
    assert.ok(pkg.deletedCount >= 2);
    assert.ok(pkg.snapshotCount >= 2);

    // Simulate delete:collection local effects
    fs.renameSync(defPath, `${defPath}.disabled`);
    fs.rmSync(hostDir, { recursive: true, force: true });
    // def lived under hostDir — recreate disabled path as orphan rename leftover
    fs.mkdirSync(hostDir, { recursive: true });
    fs.writeFileSync(`${defPath}.disabled`, defBefore);
    fs.rmSync(yamlRoot, { recursive: true, force: true });
    fs.writeFileSync(urlRoutes, JSON.stringify({ scrubbed: true }, null, 2));
    fs.writeFileSync(
      moduleJson,
      JSON.stringify({ namespace: 'BQ', items: { includes: [] } }, null, 2),
    );

    assert.equal(fs.existsSync(path.join(hostDir, 'keep.txt')), false);

    const restored = await restoreCollectionPackage({
      archivePath,
      dryRun: false,
      repoRoot,
    });
    assert.ok(restored.restoredFiles.length >= 2);
    assert.ok(fs.existsSync(path.join(hostDir, 'keep.txt')));
    assert.equal(
      fs.readFileSync(path.join(hostDir, 'keep.txt'), 'utf8'),
      hostBefore,
    );
    assert.equal(fs.readFileSync(defPath, 'utf8'), defBefore);
    assert.equal(fs.existsSync(`${defPath}.disabled`), false);
    assert.equal(
      fs.readFileSync(path.join(yamlRoot, 'Home.yml'), 'utf8'),
      yamlBefore,
    );
    assert.equal(fs.readFileSync(urlRoutes, 'utf8'), routesBefore);
    assert.equal(fs.readFileSync(moduleJson, 'utf8'), moduleBefore);
  });

  it('createTarGz / extractTarGz round-trip a small tree', () => {
    const stage = fs.mkdtempSync(path.join(packagesDir, '_tar-'));
    const dest = fs.mkdtempSync(path.join(packagesDir, '_out-'));
    const archive = path.join(packagesDir, 'tiny.tar.gz');
    fs.writeFileSync(path.join(stage, 'hello.txt'), 'world\n');
    createTarGz(stage, archive);
    extractTarGz(archive, dest);
    assert.equal(
      fs.readFileSync(path.join(dest, 'hello.txt'), 'utf8'),
      'world\n',
    );
  });
});
