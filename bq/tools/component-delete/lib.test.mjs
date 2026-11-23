/**
 * Run: node --import tsx --test tools/component-delete/lib.test.mjs
 */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { bqRoot } from '../capture/paths.mjs';
import {
  collectWiredDefinitionKeys,
  deleteBqOwnedYaml,
  filterSafeDeleteRoots,
  listYamlUnderRoots,
  parsePresentationLiteral,
  planComponentDelete,
  scrubPresentationFile,
  scrubPresentationObject,
} from './lib.mjs';

describe('collectWiredDefinitionKeys', () => {
  it('collects pages/partials but not availableRenderings-only', () => {
    const pres = {
      availableRenderings: {
        Navigation: ['orphan-key', 'wired-key'],
      },
      partialDesigns: [
        {
          definitionKey: 'wired-key',
          children: [{ definitionKey: 'child-key' }],
        },
      ],
      pages: {
        home: {
          renderings: [{ definitionKey: 'page-key' }],
        },
      },
    };
    const wired = collectWiredDefinitionKeys(pres);
    assert.equal(wired.has('wired-key'), true);
    assert.equal(wired.has('child-key'), true);
    assert.equal(wired.has('page-key'), true);
    assert.equal(wired.has('orphan-key'), false);
  });
});

describe('scrubPresentationObject', () => {
  it('removes from available and layout trees', () => {
    const { presentation, removedAvailable, removedWired } =
      scrubPresentationObject(
        {
          availableRenderings: { Navigation: ['a', 'b'] },
          pages: {
            home: {
              renderings: [
                { definitionKey: 'a' },
                { definitionKey: 'keep' },
              ],
            },
          },
          partialDesigns: [],
        },
        ['a'],
      );
    assert.equal(removedAvailable, 1);
    assert.equal(removedWired, 1);
    assert.deepEqual(presentation.availableRenderings.Navigation, ['b']);
    assert.equal(presentation.pages.home.renderings.length, 1);
    assert.equal(presentation.pages.home.renderings[0].definitionKey, 'keep');
  });
});

describe('parsePresentationLiteral', () => {
  it('parses export const object', () => {
    const src = `export const x = {
  kind: "site-presentation",
  availableRenderings: { "Page Content": ["a"] },
  pages: {},
  partialDesigns: [],
};`;
    const obj = parsePresentationLiteral(src);
    assert.equal(obj.kind, 'site-presentation');
    assert.deepEqual(obj.availableRenderings['Page Content'], ['a']);
  });
});

describe('listYamlUnderRoots + deleteBqOwnedYaml', () => {
  it('lists yaml files and skips non-BQ on delete plan', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-del-'));
    const yml = path.join(root, 'item.yml');
    await writeFile(
      yml,
      `---
ID: "{11111111-1111-1111-1111-111111111111}"
Path: /sitecore/content/Test
SharedFields:
- ID: "{25bed78c-4957-4165-998a-ca89ff80f7b7}"
  Hint: __Created by
  Value: sitecore\\Admin
`,
    );
    const listed = listYamlUnderRoots([root]);
    assert.equal(listed.length, 1);
    const plan = deleteBqOwnedYaml(listed, { apply: false });
    assert.equal(plan.deleted.length, 0);
    assert.equal(plan.skipped.length, 1);
    assert.equal(fs.existsSync(yml), true);
  });
});

describe('refuse when wired (integration-style)', () => {
  it('detects wired key so callers can refuse without --force', () => {
    const wired = collectWiredDefinitionKeys({
      availableRenderings: { Navigation: ['keep-avail'] },
      partialDesigns: [{ definitionKey: 'still-wired' }],
      pages: {},
    });
    assert.equal(wired.has('still-wired'), true);
    assert.equal(wired.has('keep-avail'), false);
  });
});

describe('scrubPresentationFile', () => {
  it('skips when presentation file is missing (no throw)', async () => {
    const missing = path.join(
      os.tmpdir(),
      `bq-missing-pres-${Date.now()}`,
      'sitecore-com-presentation.definition.ts',
    );
    assert.equal(fs.existsSync(missing), false);
    const result = await scrubPresentationFile(missing, ['old-key'], {
      apply: true,
    });
    assert.equal(result.skipped, true);
    assert.equal(result.reason, 'presentation file missing');
    assert.equal(result.removedAvailable, 0);
    assert.equal(result.removedWired, 0);
  });
});

describe('planComponentDelete missing presentation', () => {
  // hostToHostSlugFolder strips non [a-z0-9-] — use a clean slug.
  const HOST = 'test-component-delete-missing-pres';
  const hostDir = path.join(bqRoot, 'src', 'components', HOST);
  const pkg = path.join(hostDir, 'SitecoreComConsentBanner');

  beforeEach(async () => {
    await rm(hostDir, { recursive: true, force: true });
    await mkdir(pkg, { recursive: true });
    await writeFile(
      path.join(pkg, 'sitecore-com-consent-banner.definition.ts'),
      `export const def = {
  kind: "component",
  definitionKey: "sitecore-com-consent-banner",
  componentName: "SitecoreComConsentBanner",
  name: "SitecoreComConsentBanner",
};
`,
    );
  });

  afterEach(async () => {
    await rm(hostDir, { recursive: true, force: true });
  });

  it('force plan succeeds when presentation definition is absent', async () => {
    const plan = await planComponentDelete({
      target: 'SitecoreComConsentBanner',
      host: HOST,
      apply: false,
      force: true,
    });
    assert.equal(plan.error, undefined, plan.error || '');
    assert.equal(plan.ok, true);
  });
});

describe('filterSafeDeleteRoots', () => {
  it('keeps named template/rendering files; drops broad layout + Data', () => {
    const roots = [
      path.join('C:', 'templates', 'SitecoreFooter.yml'),
      path.join('C:', 'templates', 'SitecoreFooter'),
      path.join('C:', 'layout', 'Project', 'sitecore'),
      path.join('C:', 'content', 'Data', 'Footers'),
      path.join('C:', 'renderings', 'SitecoreFooter.yml'),
    ];
    const safe = filterSafeDeleteRoots(roots, {
      componentName: 'SitecoreFooter',
      name: 'SitecoreFooter',
    });
    assert.ok(safe.some((p) => p.endsWith('SitecoreFooter.yml')));
    assert.ok(safe.some((p) => /SitecoreFooter$/.test(p) && !p.endsWith('.yml')));
    assert.equal(
      safe.some((p) => /[\\/]layout[\\/]Project[\\/]sitecore$/i.test(p)),
      false,
    );
    assert.equal(safe.some((p) => /[\\/]Data[\\/]/i.test(p)), false);
  });
});
