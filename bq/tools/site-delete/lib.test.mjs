/**
 * Run: node --import tsx --test tools/site-delete/lib.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  resolveIdentityFromInput,
  resolveDeletePlan,
  flattenPlanPaths,
  listCaptureDirsForSite,
  cleanSerializationHashOrphans,
  scrubCreateArtifactsFromCaptures,
  stripRegistrySectionBacklinks,
  scrubUrlRoutesData,
  expandEmitSourceScrubKeys,
  collectInventoryKeysToDelete,
  inventoryKeyMatchesSite,
  inventoryKeyMatchesCollection,
  inventoryJsonBelongsToCollection,
  isSoftFailSerPullAfterModuleScrub,
  applyDeletePlan,
} from './lib.mjs';

describe('resolveIdentityFromInput', () => {
  it('maps deep sitecore.com URLs to the same site', () => {
    const a = resolveIdentityFromInput(
      'https://www.sitecore.com/products/xm-cloud?x=1',
    );
    const b = resolveIdentityFromInput('https://sitecore.com/company/newsroom');
    const c = resolveIdentityFromInput('www.sitecore.com');
    assert.equal(a.siteSystem, 'sitecore-com');
    assert.equal(a.collectionSystem, 'sitecore');
    assert.equal(b.siteSystem, 'sitecore-com');
    assert.equal(c.siteSystem, 'sitecore-com');
    assert.equal(a.hostFolder, 'sitecore-com');
    assert.ok(a.captureHostSlugs.includes('www-sitecore-com'));
  });

  it('accepts bare system names', () => {
    const site = resolveIdentityFromInput('sitecore-com');
    assert.equal(site.siteSystem, 'sitecore-com');
    assert.equal(site.collectionSystem, 'sitecore');
    const coll = resolveIdentityFromInput('sitecore');
    assert.equal(coll.collectionSystem, 'sitecore');
  });
});

describe('resolveDeletePlan', () => {
  it('refuses missing target', async () => {
    await assert.rejects(() => resolveDeletePlan({}), /exactly one/);
  });

  it('builds collection plan for sitecore', async () => {
    const plan = await resolveDeletePlan({ collection: 'sitecore' });
    assert.equal(plan.mode, 'collection');
    assert.equal(plan.collectionSystem, 'sitecore');
    assert.equal(plan.remote.collectionSystem, 'sitecore');
    // Local artifacts may already be wiped; plan still resolves identity.
    assert.ok(Array.isArray(plan.local.sitePlans));
    const flat = flattenPlanPaths(plan);
    assert.ok(Array.isArray(flat.dirs));
    assert.ok(Array.isArray(flat.yamlRoots));
  });

  it('builds collection plan from brand URL', async () => {
    const plan = await resolveDeletePlan({
      collection: 'https://www.sitecore.com/anything',
    });
    assert.equal(plan.mode, 'collection');
    assert.equal(plan.collectionSystem, 'sitecore');
  });

  it('builds site plan from deep URL', async () => {
    const plan = await resolveDeletePlan({
      url: 'https://www.sitecore.com/platform',
    });
    assert.equal(plan.mode, 'site');
    assert.equal(plan.siteSystem, 'sitecore-com');
    assert.equal(plan.collectionSystem, 'sitecore');
    const flat = flattenPlanPaths(plan);
    assert.ok(flat.emitSourceKeys.includes('sitecore::sitecore-com'));
    // Must not wipe whole collection template tree in site mode
    assert.ok(
      !flat.yamlRoots.some((p) =>
        /templates[\\/]Project[\\/]sitecore$/i.test(p),
      ),
    );
  });
});

describe('listCaptureDirsForSite', () => {
  it('returns existing matching capture dirs only', () => {
    const dirs = listCaptureDirsForSite({
      siteSystem: 'sitecore-com',
      collectionSystem: 'sitecore',
      captureHostSlugs: ['www-sitecore-com', 'sitecore-com'],
    });
    assert.ok(Array.isArray(dirs));
    for (const d of dirs) {
      assert.match(d.replace(/\\/g, '/'), /www-sitecore-com|sitecore-com/);
    }
  });
});

describe('cleanSerializationHashOrphans', () => {
  it('removes only hash folders whose Path belongs to the deleted collection', () => {
    const sai = fs.mkdtempSync(path.join(os.tmpdir(), 'bq-hash-'));
    const sites = path.join(sai, 'sites');
    fs.mkdirSync(sites, { recursive: true });
    const orphan = path.join(sites, 'B05955CF9C8C467F');
    const keep = path.join(sites, '0606FE7B2EA1C39A');
    fs.mkdirSync(orphan);
    fs.mkdirSync(keep);
    fs.writeFileSync(
      path.join(orphan, 'x.yml'),
      'Path: "/sitecore/content/sitecore/sitecore-com/Data/Foo"\n',
    );
    fs.writeFileSync(
      path.join(keep, 'y.yml'),
      'Path: "/sitecore/content/domsecurity/domsecurity-com/Data/Bar"\n',
    );

    const preview = cleanSerializationHashOrphans({
      collectionSystem: 'sitecore',
      apply: false,
      saiRoot: sai,
    });
    assert.equal(preview.removed.length, 1);
    assert.ok(preview.removed[0].includes('B05955CF9C8C467F'));

    const applied = cleanSerializationHashOrphans({
      collectionSystem: 'sitecore',
      apply: true,
      saiRoot: sai,
    });
    assert.equal(applied.removed.length, 1);
    assert.equal(fs.existsSync(orphan), false);
    assert.equal(fs.existsSync(keep), true);
  });
});

describe('scrubCreateArtifactsFromCaptures', () => {
  it('keeps capture:webpage crops; removes create/merge artifacts', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bq-scrub-'));
    const page = path.join(root, 'www-sitecore-com--home');
    const section = path.join(page, 'sections', 'section-01');
    fs.mkdirSync(section, { recursive: true });
    fs.mkdirSync(path.join(root, 'section-registry'), { recursive: true });
    fs.writeFileSync(path.join(root, 'section-registry', 'manifest.json'), '{}');
    fs.writeFileSync(path.join(root, 'ai-website-design.md'), '# design');
    fs.writeFileSync(path.join(root, 'site-summary.json'), '{}');
    fs.writeFileSync(path.join(page, 'page-meta.json'), '{"url":"https://www.sitecore.com/"}');
    fs.writeFileSync(path.join(page, 'page-conversion.json'), '{}');
    fs.writeFileSync(path.join(section, 'section.html'), '<section></section>');
    fs.writeFileSync(
      path.join(section, 'section-information.json'),
      JSON.stringify(
        {
          purpose: 'hero',
          registrySection: { componentFolder: 'hero' },
          sharedSection: { legacy: true },
        },
        null,
        2,
      ),
    );
    fs.writeFileSync(path.join(section, 'section-conversion.json'), '{}');
    fs.mkdirSync(path.join(section, 'ai-debug'));
    fs.writeFileSync(path.join(section, 'ai-debug', 'x.prompt.ai'), 'prompt');
    fs.mkdirSync(path.join(section, 'visual-fidelity', 'Hero'), { recursive: true });
    fs.writeFileSync(path.join(section, 'visual-fidelity', 'Hero', 'report.json'), '{}');
    fs.mkdirSync(path.join(section, 'source-fidelity', 'Hero'), { recursive: true });
    fs.writeFileSync(
      path.join(section, 'source-fidelity', 'Hero', 'score-history.json'),
      '{}',
    );

    const dry = await scrubCreateArtifactsFromCaptures([root], { apply: false });
    assert.ok(dry.removedPaths.length >= 3);
    assert.equal(fs.existsSync(path.join(section, 'section.html')), true);
    assert.equal(fs.existsSync(path.join(root, 'section-registry')), true);

    const applied = await scrubCreateArtifactsFromCaptures([root], { apply: true });
    assert.ok(applied.removedPaths.some((p) => /section-registry/.test(p)));
    assert.ok(applied.removedPaths.some((p) => /page-conversion\.json/.test(p)));
    assert.ok(applied.removedPaths.some((p) => /section-conversion\.json/.test(p)));
    assert.ok(applied.removedPaths.some((p) => /ai-debug/.test(p)));
    assert.ok(applied.removedPaths.some((p) => /visual-fidelity/.test(p)));
    assert.ok(applied.removedPaths.some((p) => /source-fidelity/.test(p)));
    assert.ok(applied.strippedSectionInfo.length >= 1);

    assert.equal(fs.existsSync(path.join(section, 'section.html')), true);
    assert.equal(fs.existsSync(path.join(page, 'page-meta.json')), true);
    assert.equal(fs.existsSync(path.join(root, 'section-registry')), false);
    assert.equal(fs.existsSync(path.join(page, 'page-conversion.json')), false);
    assert.equal(fs.existsSync(path.join(section, 'section-conversion.json')), false);
    assert.equal(fs.existsSync(path.join(section, 'ai-debug')), false);
    assert.equal(fs.existsSync(path.join(section, 'visual-fidelity')), false);
    assert.equal(fs.existsSync(path.join(section, 'source-fidelity')), false);

    const info = JSON.parse(
      fs.readFileSync(path.join(section, 'section-information.json'), 'utf8'),
    );
    assert.equal(info.purpose, 'hero');
    assert.equal('registrySection' in info, false);
    assert.equal('sharedSection' in info, false);
  });
});

describe('stripRegistrySectionBacklinks', () => {
  it('no-ops when backlinks absent', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bq-strip-'));
    const file = path.join(dir, 'section-information.json');
    fs.writeFileSync(file, JSON.stringify({ purpose: 'x' }, null, 2));
    const r = await stripRegistrySectionBacklinks(file, { apply: true });
    assert.equal(r.changed, false);
  });
});

describe('flattenPlanPaths capture scrub contract', () => {
  it('lists captureRoots separately and does not schedule whole capture trees as dirs', async () => {
    const plan = await resolveDeletePlan({
      url: 'https://www.sitecore.com/platform',
    });
    const flat = flattenPlanPaths(plan);
    assert.ok(Array.isArray(flat.captureRoots));
    for (const cap of flat.captureRoots) {
      assert.ok(
        !flat.dirs.includes(cap),
        `capture root should not be wholesale-deleted: ${cap}`,
      );
    }
  });

  it('includes null-collection apply-source sibling keys (::site)', async () => {
    const plan = await resolveDeletePlan({
      url: 'https://www.sitecore.com/platform',
    });
    const flat = flattenPlanPaths(plan);
    assert.ok(flat.emitSourceKeys.includes('sitecore::sitecore-com'));
    assert.ok(flat.emitSourceKeys.includes('::sitecore-com'));
  });
});

describe('expandEmitSourceScrubKeys', () => {
  it('expands coll::site to also scrub orphan ::site', () => {
    const keys = expandEmitSourceScrubKeys(['crelan::crelan-be']);
    assert.ok(keys.includes('crelan::crelan-be'));
    assert.ok(keys.includes('::crelan-be'));
  });
});

describe('collectInventoryKeysToDelete', () => {
  const candidates = [
    { key: 'crelan-footer-column' },
    { key: 'stub-crelan-be-appointment-page' },
    { key: 'stub-corporate-over-crelan' },
    {
      key: 'unrelated-name-but-crelan-path',
      data: {
        entries: [
          {
            path: '/sitecore/content/crelan/crelan-be/Home/x',
            id: 'aaa',
          },
        ],
      },
    },
    { key: 'crelan-be-site' },
    { key: 'sitecore-com-site' },
    {
      key: 'other-collection-item',
      data: {
        entries: [
          { path: '/sitecore/content/sitecore/sitecore-com/Home', id: 'bbb' },
        ],
      },
    },
  ];

  it('wipeCollection removes crelan components, stubs, and path-owned inventories', () => {
    const keys = new Set(
      collectInventoryKeysToDelete(candidates, {
        definitionKeys: [],
        collectionSystem: 'crelan',
        siteSystems: ['crelan-be'],
        wipeCollection: true,
      }),
    );
    assert.ok(keys.has('crelan-footer-column'));
    assert.ok(keys.has('stub-crelan-be-appointment-page'));
    assert.ok(keys.has('stub-corporate-over-crelan'));
    assert.ok(keys.has('unrelated-name-but-crelan-path'));
    assert.ok(keys.has('crelan-be-site'));
    assert.equal(keys.has('sitecore-com-site'), false);
    assert.equal(keys.has('other-collection-item'), false);
  });

  it('site delete keeps collection components; drops site + stub-site keys', () => {
    const keys = new Set(
      collectInventoryKeysToDelete(candidates, {
        definitionKeys: [],
        collectionSystem: 'crelan',
        siteSystem: 'crelan-be',
        siteSystems: ['crelan-be'],
        wipeCollection: false,
      }),
    );
    assert.ok(keys.has('crelan-be-site'));
    assert.ok(keys.has('stub-crelan-be-appointment-page'));
    assert.equal(keys.has('crelan-footer-column'), false);
    assert.equal(keys.has('stub-corporate-over-crelan'), false);
    assert.equal(keys.has('unrelated-name-but-crelan-path'), false);
    assert.equal(keys.has('sitecore-com-site'), false);
  });

  it('inventory helpers match expected tokens and paths', () => {
    assert.equal(inventoryKeyMatchesSite('stub-crelan-be-x', 'crelan-be'), true);
    assert.equal(inventoryKeyMatchesSite('crelan-footer-column', 'crelan-be'), false);
    assert.equal(
      inventoryKeyMatchesCollection('stub-corporate-over-crelan', 'crelan'),
      true,
    );
    assert.equal(
      inventoryJsonBelongsToCollection(
        { entries: [{ path: '/sitecore/content/crelan/crelan-be/Home' }] },
        'crelan',
      ),
      true,
    );
    assert.equal(
      inventoryJsonBelongsToCollection(
        { entries: [{ path: '/sitecore/content/sitecore/sitecore-com/Home' }] },
        'crelan',
      ),
      false,
    );
  });
});

describe('isSoftFailSerPullAfterModuleScrub', () => {
  const genericPullFail =
    '[bq:apply:sites-api] ser pull exited with code 1. Ensure CLI login works and module include matches bq-demo.module.json namespace.';

  it('soft-fails generic pull exit after module expand', () => {
    assert.equal(
      isSoftFailSerPullAfterModuleScrub(genericPullFail, {
        moduleExpanded: true,
      }),
      true,
    );
  });

  it('does not soft-fail without module expand/scrub', () => {
    assert.equal(
      isSoftFailSerPullAfterModuleScrub(genericPullFail, {
        moduleExpanded: false,
      }),
      false,
    );
    assert.equal(
      isSoftFailSerPullAfterModuleScrub(genericPullFail, {}),
      false,
    );
  });

  it('soft-fails EXTRA ITEM / integrity text after expand', () => {
    assert.equal(
      isSoftFailSerPullAfterModuleScrub(
        'Filesystem integrity validation found errors in serialized files!',
        { moduleExpanded: true },
      ),
      true,
    );
  });
});

describe('scrubUrlRoutesData', () => {
  const sample = () => ({
    version: 1,
    routes: {
      'crelan/crelan-be': {
        byLocalePath: {
          '/nl/particulieren': {
            englishPath: '/individuals',
            itemId: '{FF461ED3-4056-5A64-9F39-AD05E350A2C7}',
          },
        },
      },
      'crelan/other': {
        byLocalePath: {
          '/nl/x': { englishPath: '/x', itemId: '{AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}' },
        },
      },
      'sitecore/sitecore-com': {
        byLocalePath: {
          '/en/platform': {
            englishPath: '/platform',
            itemId: '{11111111-2222-3333-4444-555555555555}',
          },
        },
      },
    },
  });

  it('collection prefix removes crelan/crelan-be and sibling keys even without exact site key', () => {
    const next = scrubUrlRoutesData(sample(), {
      keys: [],
      collectionPrefixes: ['crelan'],
    });
    assert.equal('crelan/crelan-be' in next.routes, false);
    assert.equal('crelan/other' in next.routes, false);
    assert.ok(next.routes['sitecore/sitecore-com']);
  });

  it('exact site key removes only that block', () => {
    const next = scrubUrlRoutesData(sample(), {
      keys: ['crelan/crelan-be'],
    });
    assert.equal('crelan/crelan-be' in next.routes, false);
    assert.ok(next.routes['crelan/other']);
    assert.ok(next.routes['sitecore/sitecore-com']);
  });

  it('returns same object when nothing matches', () => {
    const data = sample();
    const next = scrubUrlRoutesData(data, {
      keys: ['missing/site'],
      collectionPrefixes: ['axa'],
    });
    assert.equal(next, data);
  });
});

describe('flattenPlanPaths url-routes collection prefixes', () => {
  it('includes collection prefix on collection delete', async () => {
    const plan = await resolveDeletePlan({ collection: 'crelan' });
    const flat = flattenPlanPaths(plan);
    assert.deepEqual(flat.urlRoutesCollectionPrefixes, ['crelan']);
  });

  it('omits collection prefix on site delete', async () => {
    const plan = await resolveDeletePlan({
      url: 'https://www.sitecore.com/platform',
    });
    const flat = flattenPlanPaths(plan);
    assert.deepEqual(flat.urlRoutesCollectionPrefixes, []);
    assert.ok(flat.urlRoutesKeys.includes('sitecore/sitecore-com'));
  });
});

describe('flattenPlanPaths yaml roots (retired)', () => {
  it('no longer schedules sai serialization roots for wipe', async () => {
    const plan = await resolveDeletePlan({ collection: 'crelan' });
    const flat = flattenPlanPaths(plan);
    assert.deepEqual(flat.yamlRoots, []);
  });
});

describe('applyDeletePlan ser session order', () => {
  function bareCollectionPlan() {
    return {
      mode: 'collection',
      collectionSystem: 'lifecycle-coll',
      siteSystem: null,
      local: {
        mode: 'collection',
        sitePlans: [],
        definitionKeys: [],
        collectionDefPath: null,
        collectionSerializationRoots: [],
        collectionCachePaths: [],
      },
      remote: {},
    };
  }

  it('without --package: remote → reset only (no expand/pull)', async () => {
    const calls = [];
    const { result } = await applyDeletePlan(bareCollectionPlan(), {
      apply: true,
      localOnly: false,
      package: false,
      expandModuleForSerSession: () => {
        calls.push('expand');
        return { path: 'x', collectionSystem: 'x', reset: {} };
      },
      pullSerializationNow: async () => {
        calls.push('pull');
      },
      remoteDeleteFn: async () => {
        calls.push('remote');
        return { action: 'deleted-collection', id: 'abc', deletedSites: [] };
      },
      resetModuleJsonToMinimal: () => {
        calls.push('reset');
        return { path: 'module.json', from: 'minimal', changed: true };
      },
    });

    assert.deepEqual(calls, ['remote', 'reset']);
    assert.equal(result.pull.skipped, true);
    assert.equal(result.remote.action, 'deleted-collection');
  });

  it('with --package: expand → ser pull → archive → remote → reset', async () => {
    const calls = [];
    const { result } = await applyDeletePlan(bareCollectionPlan(), {
      apply: true,
      localOnly: false,
      package: true,
      expandModuleForSerSession: ({ collectionSystem }) => {
        calls.push(`expand:${collectionSystem}`);
        return {
          path: 'module.json',
          collectionSystem,
          reset: { changed: true },
        };
      },
      pullSerializationNow: async ({ reason }) => {
        calls.push(`pull:${reason}`);
      },
      packageCollectionDeleteArchive: async () => {
        calls.push('package');
        return {
          archivePath: 'mock.tar.gz',
          deletedCount: 0,
          snapshotCount: 0,
          renameCount: 0,
        };
      },
      remoteDeleteFn: async () => {
        calls.push('remote');
        return { action: 'deleted-collection', id: 'abc', deletedSites: [] };
      },
      resetModuleJsonToMinimal: () => {
        calls.push('reset');
        return { path: 'module.json', from: 'module.json.minimal', changed: true };
      },
    });

    assert.deepEqual(calls, [
      'expand:lifecycle-coll',
      'pull:site:delete package collection lifecycle-coll',
      'package',
      'remote',
      'reset',
    ]);
    assert.equal(result.pull.ok, true);
    assert.equal(result.remote.action, 'deleted-collection');
    assert.equal(result.local.moduleReset?.changed, true);
  });

  it('local-only + --package skips expand/pull and still resets', async () => {
    const calls = [];
    const { result } = await applyDeletePlan(bareCollectionPlan(), {
      apply: true,
      localOnly: true,
      package: true,
      expandModuleForSerSession: () => {
        calls.push('expand');
        return { path: 'x', collectionSystem: 'x', reset: {} };
      },
      pullSerializationNow: async () => {
        calls.push('pull');
      },
      packageCollectionDeleteArchive: async () => {
        calls.push('package');
        return {
          archivePath: 'mock.tar.gz',
          deletedCount: 0,
          snapshotCount: 0,
          renameCount: 0,
        };
      },
      resetModuleJsonToMinimal: () => {
        calls.push('reset');
        return { path: 'module.json', from: 'minimal', changed: true };
      },
    });

    assert.deepEqual(calls, ['package', 'reset']);
    assert.equal(result.pull.skipped, true);
    assert.equal(result.remote.action, 'local-only');
  });
});
