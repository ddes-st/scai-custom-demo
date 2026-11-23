import type { ComponentTemplateDefinition } from '../../../../tools/definitions/types';
export const menzisSupportAndHealthContentDefinition = {
  kind: 'component',
  collectionSystem: 'menzis',
  siteSystem: 'menzis-nl',
  definitionKey: 'menzis-support-and-health-content',
  name: 'menzis-support-and-health-content',
  componentName: 'MenzisSupportAndHealthContent',
  displayName: 'Support And Health Content',
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Support And Health Content'] },
  model: {
    folderTemplate: { name: 'Support And Health Content Folder' },
    itemTemplate: {
      name: 'Support And Health Content',
      sections: [{ name: 'Content', fields: [] }],
    },
  },
  placeholders: [
    {
      key: 'support-health-content',
      allowedControls: [
        'menzis-support-cards-band',
        'menzis-editorial-content-band',
        'menzis-health-cards-band',
        'menzis-app-information-band',
        'menzis-information-band',
        'menzis-reasons-band',
      ],
    },
  ],
  content: {
    location: { root: 'data', folder: ['Support And Health Content'] },
    culture: 'nl-NL',
    items: [{ name: 'Support Health Content', fields: {} }],
  },
} satisfies ComponentTemplateDefinition;
