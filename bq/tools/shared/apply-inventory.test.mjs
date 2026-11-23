/**
 * Run: node --test --import tsx tools/shared/apply-inventory.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, before, after } from 'node:test';
import {
  canSkipFromApplyInventory,
  canSkipContentLeaf,
  computeDefinitionPackageFacets,
  computeDefinitionPackageHash,
  findInventoryEntry,
  inferApplyInventoryKind,
  loadApplyInventory,
  resolveApplySlicePlan,
  saveApplyInventory,
  beginApplyInventorySession,
  endApplyInventorySession,
  clearApplyInventorySession,
  stripContentSeedsFromDefinitionSource,
} from './apply-inventory.ts';

describe('inferApplyInventoryKind', () => {
  it('infers rendering, template, placeholder, media, content', () => {
    assert.equal(
      inferApplyInventoryKind(
        '/sitecore/layout/Renderings/Project/demo/Hero',
      ),
      'rendering',
    );
    assert.equal(
      inferApplyInventoryKind(
        '/sitecore/templates/Project/demo/Hero',
      ),
      'template',
    );
    assert.equal(
      inferApplyInventoryKind(
        '/sitecore/layout/Placeholder Settings/Project/demo/hero-ph',
      ),
      'placeholder-setting',
    );
    assert.equal(
      inferApplyInventoryKind(
        '/sitecore/media library/Project/demo/site/Hero/logo.png',
      ),
      'media',
    );
    assert.equal(
      inferApplyInventoryKind(
        '/sitecore/media library/Project/demo/site/Hero',
      ),
      'media-folder',
    );
    assert.equal(
      inferApplyInventoryKind(
        '/sitecore/content/demo/demo-site/Data/Hero/Seed',
      ),
      'content',
    );
    assert.equal(
      inferApplyInventoryKind(
        '/sitecore/content/demo/demo-site/Data/Hero Folder',
      ),
      'folder',
    );
  });
});

describe('apply-inventory', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bq-emit-inv-'));
  const defFile = path.join(tmp, 'Demo.definition.ts');
  const contentFile = path.join(tmp, 'Demo.content.ts');

  before(() => {
    fs.writeFileSync(defFile, 'export default { definitionKey: "demo" };\n');
    fs.writeFileSync(contentFile, 'export const items = [];\n');
  });

  after(() => {
    clearApplyInventorySession();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('computeDefinitionPackageHash is stable for same bytes', async () => {
    const a = await computeDefinitionPackageHash(defFile);
    const b = await computeDefinitionPackageHash(defFile);
    assert.equal(a, b);
    assert.match(a, /^[0-9a-f]{64}$/);
  });

  it('computeDefinitionPackageHash changes when content changes', async () => {
    const before = await computeDefinitionPackageHash(defFile);
    fs.writeFileSync(contentFile, 'export const items = [1];\n');
    const after = await computeDefinitionPackageHash(defFile);
    assert.notEqual(before, after);
  });

  it('save/load + canSkipFromApplyInventory', () => {
    const key = `test-skip-${Date.now()}`;
    const disk = path.join(tmp, 'item.yml');
    fs.writeFileSync(disk, 'ID: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"\n');
    saveApplyInventory({
      definitionKey: key,
      sourceContentHash: 'abc123',
      updatedAt: new Date().toISOString(),
      entries: [
        {
          id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          path: '/sitecore/media library/Project/sitecore/bq-demo/X/item',
          diskPath: disk,
          kind: 'media',
          sourceKey: 'url:https://example.com/x.webp',
          leafName: 'item',
        },
      ],
    });
    const loaded = loadApplyInventory(key);
    assert.ok(loaded);
    assert.equal(loaded.sourceContentHash, 'abc123');
    const hit = findInventoryEntry(loaded, {
      sourceKey: 'url:https://example.com/x.webp',
    });
    assert.equal(hit?.leafName, 'item');

    const skip = canSkipFromApplyInventory({
      definitionKey: key,
      sourceContentHash: 'abc123',
    });
    assert.equal(skip.skip, true);

    const noSkip = canSkipFromApplyInventory({
      definitionKey: key,
      sourceContentHash: 'other',
    });
    assert.equal(noSkip.skip, false);

    // force: true bypasses hash skip (--force / --force:apply)
    const forced = canSkipFromApplyInventory({
      definitionKey: key,
      sourceContentHash: 'abc123',
      force: true,
    });
    assert.equal(forced.skip, false);
    assert.equal(forced.reason, 'forced');
  });

  it('session flush writes inventory', () => {
    const key = `test-session-${Date.now()}`;
    const session = beginApplyInventorySession(key);
    session.record({
      id: '11111111-2222-3333-4444-555555555555',
      path: '/sitecore/content/x',
      kind: 'content',
      leafName: 'x',
    });
    const inv = endApplyInventorySession('hash-xyz');
    assert.equal(inv?.sourceContentHash, 'hash-xyz');
    assert.equal(inv?.entries.length, 1);
    assert.equal(loadApplyInventory(key)?.entries[0]?.leafName, 'x');
  });

  it('faceted hashes: content-only change dirties contentHash not modelHash', async () => {
    const facetedDef = path.join(tmp, 'Faceted.definition.ts');
    fs.writeFileSync(
      facetedDef,
      `export default {
  kind: "component",
  model: { itemTemplate: { name: "X" } },
  content: { items: [{ name: "A", fields: { Title: "one" } }] },
};\n`,
    );
    const before = await computeDefinitionPackageFacets(facetedDef);
    fs.writeFileSync(
      facetedDef,
      `export default {
  kind: "component",
  model: { itemTemplate: { name: "X" } },
  content: { items: [{ name: "A", fields: { Title: "two" } }] },
};\n`,
    );
    const after = await computeDefinitionPackageFacets(facetedDef);
    assert.equal(before.modelHash, after.modelHash);
    assert.notEqual(before.contentHash, after.contentHash);
    assert.notEqual(before.packageHash, after.packageHash);

    const key = `facet-${Date.now()}`;
    saveApplyInventory({
      definitionKey: key,
      sourceContentHash: before.packageHash,
      modelHash: before.modelHash,
      contentHash: before.contentHash,
      presentationHash: before.presentationHash,
      updatedAt: new Date().toISOString(),
      entries: [
        {
          id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          path: '/sitecore/x',
          diskPath: path.join(tmp, 'item.yml'),
          kind: 'content',
          leafName: 'A',
        },
      ],
    });
    fs.writeFileSync(path.join(tmp, 'item.yml'), 'ID: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"\n');
    const slice = resolveApplySlicePlan({
      facets: after,
      inventory: loadApplyInventory(key),
    });
    assert.equal(slice.skipAll, false);
    assert.equal(slice.applyModel, false);
    assert.equal(slice.applyContent, true);
  });

  it('stripContentSeedsFromDefinitionSource removes content block', () => {
    const stripped = stripContentSeedsFromDefinitionSource(
      'export default { model: { a: 1 }, content: { items: [1] }, x: 2 };',
    );
    assert.match(stripped, /content-omitted/);
    assert.doesNotMatch(stripped, /items:\s*\[1\]/);
  });

  it('faceted plan forces applyModel when template disk paths are missing', async () => {
    const facetedDef = path.join(tmp, 'MissingModel.definition.ts');
    fs.writeFileSync(
      facetedDef,
      `export default {
  kind: "component",
  model: { itemTemplate: { name: "X" } },
  content: { items: [{ name: "A", fields: { Title: "one" } }] },
};\n`,
    );
    const facets = await computeDefinitionPackageFacets(facetedDef);
    const key = `facet-missing-model-${Date.now()}`;
    const missingTpl = path.join(tmp, 'gone-template.yml');
    const contentYml = path.join(tmp, 'content-leaf.yml');
    fs.writeFileSync(contentYml, 'ID: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"\n');
    saveApplyInventory({
      definitionKey: key,
      sourceContentHash: 'stale-package',
      modelHash: facets.modelHash,
      contentHash: 'old-content',
      presentationHash: facets.presentationHash,
      updatedAt: new Date().toISOString(),
      entries: [
        {
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          path: '/sitecore/templates/Project/x/X',
          diskPath: missingTpl,
          kind: 'template',
          leafName: 'X',
        },
        {
          id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          path: '/sitecore/content/x/A',
          diskPath: contentYml,
          kind: 'content',
          leafName: 'A',
        },
      ],
    });
    const slice = resolveApplySlicePlan({
      facets,
      inventory: loadApplyInventory(key),
    });
    assert.equal(slice.applyModel, true);
    assert.equal(slice.applyContent, true);
    assert.match(slice.reason, /model disk paths missing/);
  });

  it('canSkipContentLeaf scopes by diskPath so parent≠child same leafName', () => {
    const parentYml = path.join(tmp, 'Contact.yml');
    const childYml = path.join(tmp, 'Contact', 'Contact.yml');
    fs.mkdirSync(path.dirname(childYml), { recursive: true });
    fs.writeFileSync(childYml, 'ID: "cccccccc-cccc-cccc-cccc-cccccccccccc"\n');
    // Parent YAML intentionally missing — must not skip via child inventory.
    const hash = 'deadbeef';
    const inventory = {
      definitionKey: 'skip-path-scope',
      sourceContentHash: 'x',
      updatedAt: new Date().toISOString(),
      entries: [
        {
          id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          path: '/sitecore/content/x/Contact/Contact',
          diskPath: childYml,
          kind: 'content',
          leafName: 'Contact',
          payloadHash: hash,
        },
      ],
    };
    assert.equal(
      canSkipContentLeaf({
        inventory,
        leafName: 'Contact',
        payloadHash: hash,
        diskPath: parentYml,
      }),
      false,
      'missing parent.yml must not skip via child Contact/Contact.yml',
    );
    fs.writeFileSync(parentYml, 'ID: "pppppppp-pppp-pppp-pppp-pppppppppppp"\n');
    inventory.entries.push({
      id: 'pppppppp-pppp-pppp-pppp-pppppppppppp',
      path: '/sitecore/content/x/Contact',
      diskPath: parentYml,
      kind: 'content',
      leafName: 'Contact',
      payloadHash: hash,
    });
    assert.equal(
      canSkipContentLeaf({
        inventory,
        leafName: 'Contact',
        payloadHash: hash,
        diskPath: parentYml,
      }),
      true,
    );
    assert.equal(
      canSkipContentLeaf({
        inventory,
        leafName: 'Contact',
        payloadHash: hash,
        diskPath: childYml,
      }),
      true,
    );
  });
});
