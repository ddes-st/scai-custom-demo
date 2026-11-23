/**
 * Sitecoreize child unique naming vs takenNames (same invent rule as visual).
 * Run: node --import tsx --test tools/create-section-components/sitecoreize-child-unique-names.test.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  SITECOREIZE_CHILD_UNIQUE_NAME_HARD,
  ensureUniqueChildPackageNames,
  remapLayoutSketchComponentNames,
} from './sitecoreize-child-names.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('sitecoreize child unique name HARD', () => {
  it('exports HARD constant mentioning takenNames invent rule', () => {
    assert.match(SITECOREIZE_CHILD_UNIQUE_NAME_HARD, /^HARD —/);
    assert.match(SITECOREIZE_CHILD_UNIQUE_NAME_HARD, /takenNames/);
    assert.match(SITECOREIZE_CHILD_UNIQUE_NAME_HARD, /unique/i);
    assert.match(SITECOREIZE_CHILD_UNIQUE_NAME_HARD, /not equal to the section host/i);
    assert.match(SITECOREIZE_CHILD_UNIQUE_NAME_HARD, /layoutSketch/);
    assert.match(SITECOREIZE_CHILD_UNIQUE_NAME_HARD, /Never reuse the host/i);
    assert.doesNotMatch(SITECOREIZE_CHILD_UNIQUE_NAME_HARD, /alternativeNames/);
  });

  it('system-codegen-sitecoreize.md documents unique child names vs takenNames', async () => {
    const text = await readFile(
      path.join(here, 'prompts', 'system-codegen-sitecoreize.md'),
      'utf8',
    );
    assert.match(text, /unique vs takenNames/);
    assert.match(text, /lockedSectionName/);
    assert.match(text, /Never reuse the section host/);
    assert.match(text, /layoutSketch componentName/);
    assert.doesNotMatch(text, /`alternativeNames` \(HARD\)/);
  });

  it('section-codegen project contract mentions takenNames uniqueness', async () => {
    const src = await readFile(path.join(here, 'section-codegen.mjs'), 'utf8');
    assert.match(src, /unique vs takenNames and lockedSectionName/);
    assert.match(src, /ensureUniqueChildPackageNames/);
    assert.match(src, /remapLayoutSketchComponentNames/);
  });
});

describe('remapLayoutSketchComponentNames', () => {
  it('rewrites nested host duplicate to renamed child but keeps host rendering name', () => {
    const sketch = {
      renderings: [
        {
          componentName: 'MenzisFooterSupportNavigation',
          placeholders: {
            'account-links': [
              {
                componentName: 'MenzisFooterSupportNavigation',
                datasourceName: 'Footer Support Navigation Links',
              },
            ],
          },
        },
      ],
    };
    remapLayoutSketchComponentNames(sketch, {
      MenzisFooterSupportNavigation: 'MenzisFooterAccountLinks',
    });
    assert.equal(
      sketch.renderings[0].componentName,
      'MenzisFooterSupportNavigation',
    );
    assert.equal(
      sketch.renderings[0].placeholders['account-links'][0].componentName,
      'MenzisFooterAccountLinks',
    );
  });
});

describe('ensureUniqueChildPackageNames', () => {
  it('keeps free preferred names', async () => {
    const childPkgs = [
      {
        componentName: 'SitecorePlatformCapabilityExplorerItem',
        definitionKey: 'sitecore-platform-capability-explorer-item',
        kebab: 'sitecore-platform-capability-explorer-item',
      },
    ];
    await ensureUniqueChildPackageNames({
      childPkgs,
      sectionComponentName: 'SitecorePlatformExplorerCapabilityHub',
      codePrefix: 'Sitecore',
      takenNames: ['SitecorePlatformCapabilityCard'],
      lockedChildList: [],
    });
    assert.equal(
      childPkgs[0].componentName,
      'SitecorePlatformCapabilityExplorerItem',
    );
  });

  it('repairs when preferred is taken', async () => {
    const childPkgs = [
      {
        componentName: 'SitecorePlatformCapabilityCard',
      },
    ];
    const { renames } = await ensureUniqueChildPackageNames({
      childPkgs,
      sectionComponentName: 'SitecoreHub',
      codePrefix: 'Sitecore',
      takenNames: ['SitecorePlatformCapabilityCard'],
      lockedChildList: [],
      repairChildName: async () => 'SitecorePlatformCapabilityExplorerItem',
    });
    assert.equal(
      childPkgs[0].componentName,
      'SitecorePlatformCapabilityExplorerItem',
    );
    assert.equal(
      renames.SitecorePlatformCapabilityCard,
      'SitecorePlatformCapabilityExplorerItem',
    );
  });

  it('repairs host-duplicate child and returns rename for sketch remap', async () => {
    const childPkgs = [{ componentName: 'MenzisFooterSupportNavigation' }];
    const { renames } = await ensureUniqueChildPackageNames({
      childPkgs,
      sectionComponentName: 'MenzisFooterSupportNavigation',
      codePrefix: 'Menzis',
      takenNames: [],
      lockedChildList: [],
      repairChildName: async () => 'MenzisFooterAccountLinks',
    });
    assert.equal(childPkgs[0].componentName, 'MenzisFooterAccountLinks');
    assert.equal(
      renames.MenzisFooterSupportNavigation,
      'MenzisFooterAccountLinks',
    );
  });

  it('skips locked children and still repairs later siblings', async () => {
    const childPkgs = [
      { componentName: 'SitecoreLockedChild' },
      { componentName: 'SitecorePlatformCapabilityCard' },
    ];
    await ensureUniqueChildPackageNames({
      childPkgs,
      sectionComponentName: 'SitecoreHub',
      codePrefix: 'Sitecore',
      takenNames: ['SitecorePlatformCapabilityCard'],
      lockedChildList: [
        {
          componentName: 'SitecoreLockedChild',
          definitionKey: 'sitecore-locked-child',
        },
      ],
      repairChildName: async () => 'SitecoreExplorerTabItem',
    });
    assert.equal(childPkgs[0].componentName, 'SitecoreLockedChild');
    assert.equal(childPkgs[1].componentName, 'SitecoreExplorerTabItem');
  });

  it('throws when preferred is taken and repair is missing', async () => {
    await assert.rejects(
      () =>
        ensureUniqueChildPackageNames({
          childPkgs: [{ componentName: 'SitecoreTakenA' }],
          sectionComponentName: 'SitecoreHub',
          codePrefix: 'Sitecore',
          takenNames: ['SitecoreTakenA'],
          lockedChildList: [],
        }),
      /collides with takenNames/,
    );
  });
});
