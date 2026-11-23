/**
 * CM-align structural YAML emitters (placeholders, data folders, Partial Designs).
 * Run: node --import tsx --test tools/definitions/apply/structural-cm-align.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { clearAuthoringPathCache } from '../../shared/authoring-path-cache.ts';
import { clearItemIdByPathCmCache } from '../../shared/resolve-item-id-by-path.ts';
import { getSaiModuleDiskRoot } from '../../shared/data-placement.ts';
import { ensurePlaceholderSettingsCollectionFolder } from './placeholders.ts';
import { ensureFolderChain } from './shared.ts';
import { ensurePartialDesignsFolderParent } from './site-presentation.ts';

const CM_COLLECTION = 'cccccccccccccccccccccccccccccccc';
const CM_FOLDER = 'ffffffffffffffffffffffffffffffff';
const CM_PARTIALS = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

describe('ensurePlaceholderSettingsCollectionFolder CM align', () => {
  /** @type {string} */
  let collection;
  /** @type {string} */
  let folderYaml;

  beforeEach(() => {
    clearItemIdByPathCmCache();
    collection = `cm-ph-${Date.now().toString(36)}`;
    folderYaml = path.join(
      getSaiModuleDiskRoot(),
      'layout',
      'Project',
      `${collection}.yml`,
    );
  });

  afterEach(() => {
    clearItemIdByPathCmCache();
    if (fs.existsSync(folderYaml)) fs.rmSync(folderYaml, { force: true });
    const collDir = path.join(
      getSaiModuleDiskRoot(),
      'layout',
      'Project',
      collection,
    );
    if (fs.existsSync(collDir)) {
      fs.rmSync(collDir, { recursive: true, force: true });
    }
  });

  it('writes collection folder with CM id when disk missing', async () => {
    // Never CM-return for existing Project.yml — a fake id would remap live SAI.
    const { id } = await ensurePlaceholderSettingsCollectionFolder(collection, {
      lookupPath: async (p) => {
        if (p === '/sitecore/layout/Placeholder Settings/Project') {
          return undefined;
        }
        if (p.endsWith(`/Project/${collection}`)) return CM_COLLECTION;
        return undefined;
      },
    });
    assert.ok(fs.existsSync(folderYaml));
    const body = fs.readFileSync(folderYaml, 'utf8');
    assert.match(body, /ID: "cccccccc-cccc-cccc-cccc-cccccccccccc"/);
    assert.equal(id.replace(/-/g, ''), CM_COLLECTION);
  });
});

describe('ensureFolderChain CM align', () => {
  /** @type {string} */
  let tmp;

  beforeEach(() => {
    clearItemIdByPathCmCache();
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bq-folder-cm-'));
  });

  afterEach(() => {
    clearItemIdByPathCmCache();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('writes data folder segment with CM id when disk missing', async () => {
    const scope = {
      diskRoot: tmp,
      sitecorePath: '/sitecore/content/demo/site',
      rootItemId: '11111111-1111-1111-1111-111111111111',
    };
    // Stable English name (no Title-Case rewrite that would miss the CM path).
    const segment = 'Footers';
    const result = await ensureFolderChain(scope, [segment], 'test-handle', {
      lookupPath: async (p) =>
        p === `/sitecore/content/demo/site/${segment}`
          ? CM_FOLDER
          : undefined,
    });
    const yamlPath = path.join(tmp, `${segment}.yml`);
    assert.ok(fs.existsSync(yamlPath));
    const body = fs.readFileSync(yamlPath, 'utf8');
    assert.match(body, /ID: "ffffffff-ffff-ffff-ffff-ffffffffffff"/);
    assert.equal(result.parentId.replace(/-/g, ''), CM_FOLDER);
  });
});

describe('ensurePartialDesignsFolderParent CM align', () => {
  beforeEach(() => {
    clearItemIdByPathCmCache();
    clearAuthoringPathCache();
  });

  afterEach(() => {
    clearItemIdByPathCmCache();
    clearAuthoringPathCache();
  });

  it('returns the CM id when Partial Designs already exists (no disk read)', async () => {
    const { id } = await ensurePartialDesignsFolderParent({
      collectionSystem: 'demo-coll',
      siteSystem: 'demo-site',
      handle: 'sai:demo',
      lookupPath: async (p) =>
        p === '/sitecore/content/demo-coll/demo-site/Presentation/Partial Designs'
          ? CM_PARTIALS
          : undefined,
    });
    assert.equal(id.replace(/-/g, ''), CM_PARTIALS);
  });

  it('throws citing the CM path when Presentation is missing', async () => {
    await assert.rejects(
      () =>
        ensurePartialDesignsFolderParent({
          collectionSystem: 'demo-coll',
          siteSystem: 'demo-site',
          lookupPath: async () => undefined,
        }),
      /\/sitecore\/content\/demo-coll\/demo-site\/Presentation/,
    );
  });
});
