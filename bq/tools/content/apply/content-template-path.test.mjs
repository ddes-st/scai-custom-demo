/**
 * Content apply must resolve templates under the same branch as rendering emit
 * (unbranded spaced Title Case), not Pascal componentName.
 *
 * Run: node --import tsx --test tools/content/apply/content-template-path.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mapComponentToRenderingDefinition } from '../../definitions/apply/component-to-rendering.ts';

describe('content template path aligns with rendering branch', () => {
  it('MenzisContentBlock → Project/menzis/Content Block/Content Block Folder', () => {
    const rendering = mapComponentToRenderingDefinition({
      kind: 'component',
      definitionKey: 'menzis-content-block',
      name: 'menzis-content-block',
      componentName: 'MenzisContentBlock',
      displayName: 'Content Block',
      collectionSystem: 'menzis',
      siteSystem: 'menzis-nl',
      datasourceLocation: {
        scope: 'site',
        root: 'data',
        folder: ['Content Blocks'],
      },
      model: {
        folderTemplate: { name: 'Content Block Folder' },
        itemTemplate: {
          name: 'Content Block',
          sections: [{ name: 'Content', fields: [] }],
        },
      },
      placeholders: [],
    });

    assert.equal(rendering.name, 'Content Block');
    assert.equal(rendering.model.folderTemplate.name, 'Content Block Folder');
    assert.equal(rendering.model.itemTemplate.name, 'Content Block');
    // Must NOT be Pascal componentName — that was the broken content-apply lookup.
    assert.notEqual(rendering.name, 'MenzisContentBlock');

    const folderPath = `/sitecore/templates/Project/menzis/${rendering.name}/${rendering.model.folderTemplate.name}`;
    assert.equal(
      folderPath,
      '/sitecore/templates/Project/menzis/Content Block/Content Block Folder',
    );
  });
});
