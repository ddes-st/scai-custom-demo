/**
 * Early unique naming helpers.
 * Run: node --test tools/create-section-components/early-naming.test.mjs
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { bqRoot } from '../capture/paths.mjs';
import {
  childNameFromIndexEntry,
  listTakenComponentNames,
  normalizeIndexChildren,
  normalizeProposedComponentName,
  parseDefinitionIdentityFields,
  pruneRenderingsMissingDefinitionKeys,
  readDefinitionKeyFromPackage,
  upsertSectionNameLock,
  validateProposedComponentName,
} from './early-naming.mjs';
import { buildPlanFromPackages } from './section-codegen.mjs';
import { toKebabCase } from './naming.mjs';

const HOST = '__test-early-naming-host__';

describe('early-naming helpers', () => {
  const hostDir = path.join(bqRoot, 'src', 'components', HOST);

  beforeEach(async () => {
    await rm(hostDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    await rm(hostDir, { recursive: true, force: true });
  });

  it('normalizeProposedComponentName applies brand prefix', () => {
    assert.equal(
      normalizeProposedComponentName('ImageHero', 'Crelan'),
      'CrelanImageHero',
    );
    assert.equal(
      normalizeProposedComponentName('CrelanImageHero', 'Crelan'),
      'CrelanImageHero',
    );
  });

  it('validateProposedComponentName rejects taken names', () => {
    const taken = new Set(['crelanimagehero', 'crelan-image-hero']);
    const bad = validateProposedComponentName('ImageHero', 'Crelan', taken);
    assert.equal(bad.ok, false);
    const good = validateProposedComponentName(
      'ProductGrid',
      'Crelan',
      taken,
    );
    assert.equal(good.ok, true);
    assert.equal(good.componentName, 'CrelanProductGrid');
    assert.equal(good.definitionKey, 'crelan-product-grid');
  });

  it('normalizeIndexChildren accepts string and rich entries', () => {
    const kids = normalizeIndexChildren([
      'CrelanUspItem',
      {
        componentName: 'CrelanHeroCard',
        definitionKey: 'crelan-hero-card',
        placeholderKey: 'hero-cards',
      },
    ]);
    assert.equal(kids.length, 2);
    assert.equal(kids[0].componentName, 'CrelanUspItem');
    assert.equal(kids[0].definitionKey, 'crelan-usp-item');
    assert.equal(kids[1].placeholderKey, 'hero-cards');
    assert.equal(
      childNameFromIndexEntry({ children: kids }, 1),
      'CrelanHeroCard',
    );
  });

  it('upsertSectionNameLock sticks on rerun unless force', async () => {
    const first = await upsertSectionNameLock({
      hostSlug: HOST,
      pageSlug: 'page-a',
      sectionDir: 'sections/section-01',
      componentName: 'CrelanImageHero',
      definitionKey: 'crelan-image-hero',
    });
    assert.equal(first.componentName, 'CrelanImageHero');

    const second = await upsertSectionNameLock({
      hostSlug: HOST,
      pageSlug: 'page-a',
      sectionDir: 'sections/section-01',
      componentName: 'CrelanTotallyDifferent',
      definitionKey: 'crelan-totally-different',
    });
    assert.equal(second.componentName, 'CrelanImageHero');
    assert.equal(second.definitionKey, 'crelan-image-hero');

    const forced = await upsertSectionNameLock({
      hostSlug: HOST,
      pageSlug: 'page-a',
      sectionDir: 'sections/section-01',
      componentName: 'CrelanCookieModal',
      definitionKey: 'crelan-cookie-modal',
      force: true,
    });
    assert.equal(forced.componentName, 'CrelanCookieModal');
  });

  it('upsertSectionNameLock persists rich children', async () => {
    await upsertSectionNameLock({
      hostSlug: HOST,
      pageSlug: 'page-a',
      sectionDir: 'sections/section-02',
      componentName: 'CrelanProductGrid',
      definitionKey: 'crelan-product-grid',
      children: [
        {
          componentName: 'CrelanUspItem',
          definitionKey: 'crelan-usp-item',
          placeholderKey: 'usp-items',
        },
      ],
    });
    const { readSectionNameIndex } = await import('./write-component.mjs');
    const index = await readSectionNameIndex(HOST);
    const entry = index['page-a/sections/section-02'];
    assert.ok(entry);
    const kids = normalizeIndexChildren(entry.children);
    assert.equal(kids[0].componentName, 'CrelanUspItem');
    assert.equal(kids[0].placeholderKey, 'usp-items');
  });

  it('listTakenComponentNames includes index locks and packages', async () => {
    await upsertSectionNameLock({
      hostSlug: HOST,
      pageSlug: 'page-a',
      sectionDir: 'sections/section-01',
      componentName: 'CrelanLockedBand',
      definitionKey: 'crelan-locked-band',
      children: ['CrelanLockedChild'],
    });
    const pkg = path.join(hostDir, 'CrelanDiskPackage');
    await mkdir(pkg, { recursive: true });
    await writeFile(
      path.join(pkg, 'crelan-disk-package.definition.ts'),
      `export const x = {
  kind: "component",
  collectionSystem: "crelan",
  siteSystem: "crelan-be",
  definitionKey: "crelan-disk-package",
  componentName: "CrelanDiskPackage",
};\n`,
      'utf8',
    );

    const taken = await listTakenComponentNames({
      collectionSystem: 'crelan',
      hostSlug: HOST,
      extraNames: ['CrelanInFlight'],
    });
    assert.ok(taken.takenLower.has('crelanlockedband'));
    assert.ok(taken.takenLower.has('crelanlockedchild'));
    assert.ok(taken.takenLower.has('crelandiskpackage'));
    assert.ok(taken.takenLower.has('crelaninflight'));
  });

  it('readDefinitionKeyFromPackage reads written definition', async () => {
    const name = 'CrelanReadKey';
    const kebab = toKebabCase(name);
    const dir = path.join(hostDir, name);
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, `${kebab}.definition.ts`),
      `export const d = {
  kind: "component",
  collectionSystem: "crelan",
  definitionKey: "crelan-read-key",
  componentName: "CrelanReadKey",
};\n`,
      'utf8',
    );
    const key = await readDefinitionKeyFromPackage(HOST, name);
    assert.equal(key, 'crelan-read-key');
  });

  it('pruneRenderingsMissingDefinitionKeys drops unknown keys', async () => {
    const name = 'CrelanPresentPkg';
    const kebab = toKebabCase(name);
    const dir = path.join(hostDir, name);
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, `${kebab}.definition.ts`),
      `export const d = {
  kind: "component",
  collectionSystem: "crelan",
  definitionKey: "crelan-present-pkg",
  componentName: "CrelanPresentPkg",
};\n`,
      'utf8',
    );
    const pruned = await pruneRenderingsMissingDefinitionKeys(
      [
        { definitionKey: 'crelan-present-pkg' },
        { definitionKey: 'crelan-missing-pkg' },
      ],
      HOST,
    );
    assert.equal(pruned.length, 1);
    assert.equal(pruned[0].definitionKey, 'crelan-present-pkg');
  });

  it('pruneRenderingsMissingDefinitionKeys drops nested missing children', async () => {
    const parent = 'CrelanParentHost';
    const child = 'CrelanChildOk';
    for (const [name, key] of [
      [parent, 'crelan-parent-host'],
      [child, 'crelan-child-ok'],
    ]) {
      const dir = path.join(hostDir, name);
      await mkdir(dir, { recursive: true });
      await writeFile(
        path.join(dir, `${toKebabCase(name)}.definition.ts`),
        `export const d = { definitionKey: "${key}", componentName: "${name}" };\n`,
        'utf8',
      );
    }
    const pruned = await pruneRenderingsMissingDefinitionKeys(
      [
        {
          definitionKey: 'crelan-parent-host',
          children: [
            { definitionKey: 'crelan-child-ok' },
            { definitionKey: 'crelan-ghost-child' },
          ],
        },
      ],
      HOST,
    );
    assert.equal(pruned.length, 1);
    assert.equal(pruned[0].definitionKey, 'crelan-parent-host');
    assert.equal(pruned[0].children.length, 1);
    assert.equal(pruned[0].children[0].definitionKey, 'crelan-child-ok');
  });

  it('buildPlanFromPackages does not carry enrich alternativeNames', () => {
    const plan = buildPlanFromPackages({
      sectionPkg: { componentName: 'CrelanHero', packageKind: 'default' },
      childPkgs: [
        {
          componentName: 'CrelanHeroCard',
          parentPlaceholder: 'hero-cards',
          packageKind: 'default',
          repeatHint: 2,
        },
      ],
      reason: 'test',
      alternativeNames: ['Hero', 'ImageHero', 'Banner'],
    });
    assert.deepEqual(plan.alternativeNames, []);
    assert.equal(plan.section.componentName, 'CrelanHero');
    assert.equal(plan.children[0].componentName, 'CrelanHeroCard');
  });

  it('parseDefinitionIdentityFields extracts identity', () => {
    const id = parseDefinitionIdentityFields(`
      collectionSystem: "crelan",
      definitionKey: "crelan-usp-item",
      componentName: "CrelanUspItem",
    `);
    assert.equal(id.collectionSystem, 'crelan');
    assert.equal(id.definitionKey, 'crelan-usp-item');
    assert.equal(id.componentName, 'CrelanUspItem');
  });
});
