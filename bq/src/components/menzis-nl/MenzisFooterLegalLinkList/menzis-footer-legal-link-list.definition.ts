import type { ComponentTemplateDefinition } from '../../../../tools/definitions/types';
export const menzisFooterLegalLinkListDefinition = {
  kind: 'component',
  collectionSystem: 'menzis',
  siteSystem: 'menzis-nl',
  definitionKey: 'menzis-footer-legal-link-list',
  name: 'menzis-footer-legal-link-list',
  componentName: 'MenzisFooterLegalLinkList',
  displayName: 'Footer Legal Link List',
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Link Lists'] },
  model: {
    folderTemplate: { name: 'Link List Folder' },
    itemTemplate: {
      name: 'Link List',
      sections: [{ name: 'Content', fields: [] }],
    },
    childItemTemplate: {
      name: 'Link',
      sections: [
        {
          name: 'Content',
          fields: [{ name: 'Link', type: 'General Link' }],
        },
      ],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Link Lists'] },
    culture: 'nl-NL',
    items: [
      {
        name: 'Footer Legal Links',
        fields: {},
        children: [
          {
            name: 'Cookiepolicy Cookies Aanpassen',
            fields: {
              Link: {
                text: 'Cookiepolicy & Cookies aanpassen',
                url: 'https://www.menzis.nl/cookiepolicy',
              },
            },
          },
          {
            name: 'Disclaimer',
            fields: { Link: { text: 'Disclaimer', url: 'https://www.menzis.nl/disclaimer' } },
          },
          {
            name: 'Privacy',
            fields: { Link: { text: 'Privacy', url: 'https://www.menzis.nl/privacy' } },
          },
          {
            name: 'Accessibility',
            displayName: 'Toegankelijkheid',
            fields: {
              Link: { text: 'Toegankelijkheid', url: 'https://www.menzis.nl/toegankelijkheid' },
            },
          },
        ],
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
