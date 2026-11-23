import type { ComponentTemplateDefinition } from '../../../../tools/definitions/types';
export const menzisFooterSupportNavigationDefinition = {
  kind: 'component',
  collectionSystem: 'menzis',
  siteSystem: 'menzis-nl',
  definitionKey: 'menzis-footer-support-navigation',
  name: 'menzis-footer-support-navigation',
  componentName: 'MenzisFooterSupportNavigation',
  displayName: 'Footer Support Navigation',
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Footer Help And Links'] },
  model: {
    folderTemplate: { name: 'Footer Help And Links Folder' },
    itemTemplate: {
      name: 'Footer Help And Links',
      sections: [{ name: 'Content', fields: [] }],
    },
  },
  placeholders: [
    {
      key: 'footer-help-and-links-content',
      allowedControls: ['menzis-footer-help-band', 'menzis-footer-help-link-list'],
    },
  ],
  content: {
    location: { root: 'data', folder: ['Footer Help And Links'] },
    culture: 'nl-NL',
    items: [{ name: 'Footer Help And Links', fields: {} }],
  },
} satisfies ComponentTemplateDefinition;
