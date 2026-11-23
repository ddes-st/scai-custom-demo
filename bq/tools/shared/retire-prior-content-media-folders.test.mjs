/**
 * Scoped prior Data/media folder retire on rename.
 * Run: node --import tsx --test tools/shared/retire-prior-content-media-folders.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  extractFolderPathsFromDefinitionTs,
  folderPathKey,
  folderPathsFromCaptureMeta,
  removeSerializedFolderTree,
  retirePriorContentAndMediaFolders,
  retirePriorFoldersIfChangedForComponent,
} from './retire-prior-content-media-folders.ts';

describe('folderPathKey / extractFolderPathsFromDefinitionTs', () => {
  it('normalizes and keys folder segments', () => {
    assert.equal(folderPathKey(['Hero Cards']), folderPathKey(['hero cards']));
    assert.equal(folderPathKey(['A', 'B']), 'a/b');
  });

  it('extracts each folder array as its own path', () => {
    const paths = extractFolderPathsFromDefinitionTs(`
      datasourceLocation: { folder: ['Image Hero Cards'] },
      content: { location: { folder: ['Image Hero Cards'] } },
      nested: { folder: ['Parent', 'Child'] },
    `);
    assert.deepEqual(
      paths.map((p) => folderPathKey(p)).sort(),
      ['image hero cards', 'parent/child'].sort(),
    );
  });
});

describe('folderPathsFromCaptureMeta', () => {
  it('prefers contentFolders arrays and maps mediaFolders to paths', () => {
    const from = folderPathsFromCaptureMeta({
      contentFolders: [['Hero Cards']],
      mediaFolders: ['Hero Cards', 'Legacy Media'],
    });
    assert.deepEqual(
      from.contentFolderPaths.map(folderPathKey),
      ['hero cards'],
    );
    assert.deepEqual(
      from.mediaFolderPaths.map(folderPathKey).sort(),
      ['hero cards', 'legacy media'].sort(),
    );
  });

  it('falls back mediaFolders into content when contentFolders missing', () => {
    const from = folderPathsFromCaptureMeta({
      mediaFolders: ['Image Hero Cards'],
    });
    assert.deepEqual(from.contentFolderPaths.map(folderPathKey), [
      'image hero cards',
    ]);
    assert.deepEqual(from.mediaFolderPaths.map(folderPathKey), [
      'image hero cards',
    ]);
  });
});

describe('retirePriorContentAndMediaFolders', () => {
  /** @type {string} */
  let tmp;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bq-retire-prior-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('removes prior Data + media trees and keeps destination folders', () => {
    const coll = 'crelan';
    const site = 'crelan-be';
    const dataRoot = path.join(
      tmp,
      'sites',
      'content',
      coll,
      site,
      'Data',
    );
    const mediaRoot = path.join(
      tmp,
      'media-library',
      'Project',
      coll,
      site,
    );

    const oldContentDir = path.join(dataRoot, 'Image Hero Cards');
    const newContentDir = path.join(dataRoot, 'Hero Cards');
    const oldMediaDir = path.join(mediaRoot, 'Image Hero Cards');
    const newMediaDir = path.join(mediaRoot, 'Hero Cards');

    fs.mkdirSync(oldContentDir, { recursive: true });
    fs.writeFileSync(
      path.join(oldContentDir, '2010 Euro Card.yml'),
      'Template: "38ff5f9d-7e09-55d8-91c8-e3e4340a88e0"\n',
    );
    fs.writeFileSync(
      path.join(dataRoot, 'Image Hero Cards.yml'),
      'Path: "/sitecore/content/crelan/crelan-be/Data/Image Hero Cards"\n',
    );
    fs.mkdirSync(newContentDir, { recursive: true });
    fs.writeFileSync(
      path.join(newContentDir, '2010 Euro Card.yml'),
      'Template: "8e061522-7ad2-5734-b49e-60c4ed35ba80"\n',
    );
    fs.writeFileSync(
      path.join(dataRoot, 'Hero Cards.yml'),
      'Path: "/sitecore/content/crelan/crelan-be/Data/Hero Cards"\n',
    );

    fs.mkdirSync(oldMediaDir, { recursive: true });
    fs.writeFileSync(path.join(oldMediaDir, 'x.png.yml'), 'ID: "1"\n');
    fs.writeFileSync(path.join(mediaRoot, 'Image Hero Cards.yml'), 'ID: "2"\n');
    fs.mkdirSync(newMediaDir, { recursive: true });
    fs.writeFileSync(path.join(newMediaDir, 'y.png.yml'), 'ID: "3"\n');
    fs.writeFileSync(path.join(mediaRoot, 'Hero Cards.yml'), 'ID: "4"\n');

    const result = retirePriorContentAndMediaFolders({
      collectionSystem: coll,
      siteSystem: site,
      priorContentFolderPaths: [['Image Hero Cards']],
      priorMediaFolderPaths: [['Image Hero Cards']],
      keepContentFolderPaths: [['Hero Cards']],
      keepMediaFolderPaths: [['Hero Cards']],
      saiModuleDiskRoot: tmp,
    });

    assert.ok(result.removed.length >= 2);
    assert.equal(fs.existsSync(oldContentDir), false);
    assert.equal(fs.existsSync(path.join(dataRoot, 'Image Hero Cards.yml')), false);
    assert.equal(fs.existsSync(oldMediaDir), false);
    assert.equal(fs.existsSync(newContentDir), true);
    assert.equal(fs.existsSync(path.join(newContentDir, '2010 Euro Card.yml')), true);
    assert.equal(fs.existsSync(newMediaDir), true);
  });

  it('uses siteSystem as media leaf when mediaSiteName omitted', () => {
    const coll = 'menzis';
    const site = 'menzis-nl';
    const mediaRoot = path.join(
      tmp,
      'media-library',
      'Project',
      coll,
      site,
    );
    const oldMediaDir = path.join(mediaRoot, 'Hero Images');
    fs.mkdirSync(oldMediaDir, { recursive: true });
    fs.writeFileSync(path.join(oldMediaDir, 'x.png.yml'), 'ID: "1"\n');
    fs.writeFileSync(path.join(mediaRoot, 'Hero Images.yml'), 'ID: "2"\n');

    const result = retirePriorContentAndMediaFolders({
      collectionSystem: coll,
      siteSystem: site,
      priorMediaFolderPaths: [['Hero Images']],
      keepMediaFolderPaths: [],
      saiModuleDiskRoot: tmp,
    });

    assert.ok(result.removed.length >= 1);
    assert.equal(fs.existsSync(oldMediaDir), false);
  });

  it('skips delete when prior path is in keep set', () => {
    const coll = 'crelan';
    const site = 'crelan-be';
    const dataRoot = path.join(
      tmp,
      'sites',
      'content',
      coll,
      site,
      'Data',
    );
    const keepDir = path.join(dataRoot, 'Hero Cards');
    fs.mkdirSync(keepDir, { recursive: true });
    fs.writeFileSync(path.join(keepDir, 'item.yml'), 'ID: "1"\n');

    const result = retirePriorContentAndMediaFolders({
      collectionSystem: coll,
      siteSystem: site,
      priorContentFolderPaths: [['Hero Cards']],
      keepContentFolderPaths: [['Hero Cards']],
      saiModuleDiskRoot: tmp,
    });

    assert.equal(result.removed.length, 0);
    assert.ok(result.skippedKeep.length >= 1);
    assert.equal(fs.existsSync(path.join(keepDir, 'item.yml')), true);
  });

  it('removeSerializedFolderTree is dry-run safe', () => {
    const root = path.join(tmp, 'Data');
    const dir = path.join(root, 'Orphan');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'x.yml'), 'x\n');
    fs.writeFileSync(path.join(root, 'Orphan.yml'), 'folder\n');

    const would = removeSerializedFolderTree(root, ['Orphan'], { dryRun: true });
    assert.ok(would.length >= 2);
    assert.equal(fs.existsSync(dir), true);

    removeSerializedFolderTree(root, ['Orphan']);
    assert.equal(fs.existsSync(dir), false);
    assert.equal(fs.existsSync(path.join(root, 'Orphan.yml')), false);
  });
});

describe('retirePriorFoldersIfChangedForComponent', () => {
  /** @type {string} */
  let tmp;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bq-retire-comp-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('retires prior paths when capture-meta folders differ from new location', () => {
    const coll = 'crelan';
    const site = 'crelan-be';
    const componentsRoot = path.join(tmp, 'components');
    const saiRoot = path.join(tmp, 'sai');
    const pkgDir = path.join(componentsRoot, site, 'CrelanHeroCard');
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(
      path.join(pkgDir, 'crelan-hero-card.capture-meta.json'),
      `${JSON.stringify({
        componentName: 'CrelanHeroCard',
        mediaFolders: ['Image Hero Cards'],
        contentFolders: [['Image Hero Cards']],
      })}\n`,
    );

    const dataRoot = path.join(
      saiRoot,
      'sites',
      'content',
      coll,
      site,
      'Data',
    );
    fs.mkdirSync(path.join(dataRoot, 'Image Hero Cards'), { recursive: true });
    fs.writeFileSync(
      path.join(dataRoot, 'Image Hero Cards', 'old.yml'),
      'Template: dead\n',
    );
    fs.writeFileSync(path.join(dataRoot, 'Image Hero Cards.yml'), 'folder\n');

    const result = retirePriorFoldersIfChangedForComponent({
      collectionSystem: coll,
      siteSystem: site,
      componentName: 'CrelanHeroCard',
      newContentFolder: ['Hero Cards'],
      componentsRoot,
      saiModuleDiskRoot: saiRoot,
    });

    assert.ok(result);
    assert.ok(result.removed.length >= 1);
    assert.equal(fs.existsSync(path.join(dataRoot, 'Image Hero Cards')), false);
  });

  it('no-ops when prior folders already match new location', () => {
    const coll = 'crelan';
    const site = 'crelan-be';
    const componentsRoot = path.join(tmp, 'components');
    const pkgDir = path.join(componentsRoot, site, 'CrelanHeroCard');
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(
      path.join(pkgDir, 'crelan-hero-card.capture-meta.json'),
      `${JSON.stringify({
        contentFolders: [['Hero Cards']],
        mediaFolders: ['Hero Cards'],
      })}\n`,
    );

    const result = retirePriorFoldersIfChangedForComponent({
      collectionSystem: coll,
      siteSystem: site,
      componentName: 'CrelanHeroCard',
      newContentFolder: ['Hero Cards'],
      componentsRoot,
      saiModuleDiskRoot: path.join(tmp, 'sai'),
    });

    assert.equal(result, null);
  });
});
