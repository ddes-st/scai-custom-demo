/**
 * Host component-inventory build / paths.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildComponentInventory,
  listInventoryFoldersNeedingCodegen,
} from './component-inventory.mjs';

describe('buildComponentInventory', () => {
  it('maps manifest components to inventory entries', () => {
    const inventory = buildComponentInventory({
      projectRoot: '/captures/www-crelan-be',
      globalManifest: {
        host: 'www-crelan-be',
        components: {
          a: {
            folderName: 'header',
            pageRole: 'partial-header',
            definitionKey: 'crelan-header',
            componentName: 'CrelanHeader',
            contentHash: 'abc',
            instances: [
              {
                pageSlug: 'www-crelan-be--nl-particulieren',
                sectionFolder: 'section-02',
                contentHash: 'abc',
                sourcePath:
                  'www-crelan-be--nl-particulieren/sections/section-02',
              },
            ],
            canonicalRef: {
              pageSlug: 'www-crelan-be--nl-particulieren',
              sectionFolder: 'section-02',
            },
          },
          b: {
            folderName: 'welcome-hero',
            pageRole: 'page',
            instances: [],
          },
        },
      },
    });
    assert.equal(inventory.stats.uniqueComponents, 2);
    assert.equal(inventory.stats.packageExists, 1);
    assert.equal(inventory.stats.needsCodegen, 1);
    const header = inventory.components.find((c) => c.folderName === 'header');
    assert.equal(header.status, 'package-exists');
    assert.equal(header.pageRole, 'partial-header');
    assert.equal(
      header.canonicalEvidence.sectionFolder,
      'section-02',
    );
  });
});

describe('listInventoryFoldersNeedingCodegen', () => {
  it('returns needs-codegen folders', () => {
    const folders = listInventoryFoldersNeedingCodegen({
      components: [
        { folderName: 'a', status: 'needs-codegen' },
        { folderName: 'b', status: 'package-exists', definitionKey: 'x' },
      ],
    });
    assert.deepEqual(folders, ['a']);
  });
});
