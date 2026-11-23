/**
 * Std-value media folders prefer content-style datasourceLocation.folder.
 * Run: node --import tsx --test tools/definitions/apply/media-folder-for-datasource-std-values.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mediaFolderForDatasourceStdValues } from './rendering.ts';
import { mapComponentToRenderingDefinition } from './component-to-rendering.ts';

describe('mediaFolderForDatasourceStdValues', () => {
  it('prefers datasourceLocation.folder when set', () => {
    const folder = mediaFolderForDatasourceStdValues(
      {
        definitionKey: 'x',
        name: 'CrelanConsentPreferencesModal',
        datasourceLocation: {
          scope: 'site',
          root: 'data',
          folder: ['Consent Preferences Modals'],
        },
      },
      'CrelanConsentPreferencesModal',
      'Crelan Consent Preferences Modal',
    );
    assert.deepEqual(folder, ['Consent Preferences Modals']);
  });

  it('falls back to branchName/itemTemplateName when folder missing', () => {
    const folder = mediaFolderForDatasourceStdValues(
      {
        definitionKey: 'x',
        name: 'CrelanConsentPreferencesModal',
        datasourceLocation: { scope: 'site', root: 'data' },
      },
      'CrelanConsentPreferencesModal',
      'Crelan Consent Preferences Modal',
    );
    assert.deepEqual(folder, [
      'CrelanConsentPreferencesModal',
      'Crelan Consent Preferences Modal',
    ]);
  });

  it('falls back when datasourceLocation omitted', () => {
    const folder = mediaFolderForDatasourceStdValues(
      { definitionKey: 'x', name: 'Branch' },
      'Branch',
      'Item Template',
    );
    assert.deepEqual(folder, ['Branch', 'Item Template']);
  });

  it('consent modal component maps to Consent Preferences Modals for std-value media', () => {
    const rendering = mapComponentToRenderingDefinition({
      kind: 'component',
      definitionKey: 'crelan-consent-preferences-modal',
      name: 'crelan-consent-preferences-modal',
      displayName: 'Crelan Consent Preferences Modal',
      componentName: 'CrelanConsentPreferencesModal',
      collectionSystem: 'crelan',
      siteSystem: 'crelan-be',
      datasourceLocation: {
        scope: 'site',
        root: 'data',
        folder: ['Consent Preferences Modals'],
      },
      model: {
        folderTemplate: { name: 'Crelan Consent Preferences Modal Folder' },
        itemTemplate: {
          name: 'Crelan Consent Preferences Modal',
          sections: [],
        },
      },
    });
    const folder = mediaFolderForDatasourceStdValues(
      rendering,
      rendering.name,
      rendering.model.itemTemplate.name,
    );
    assert.deepEqual(folder, ['Consent Preferences Modals']);
    assert.notDeepEqual(folder, [
      'CrelanConsentPreferencesModal',
      'Crelan Consent Preferences Modal',
    ]);
  });
});
