import type { ComponentTemplateDefinition } from '../../../../tools/definitions/types';
export const menzisGlobalNavigationContextLinkListDefinition = {
  kind: 'component',
  collectionSystem: 'menzis',
  siteSystem: 'menzis-nl',
  definitionKey: 'menzis-global-navigation-context-link-list',
  name: 'menzis-global-navigation-context-link-list',
  componentName: 'MenzisGlobalNavigationContextLinkList',
  displayName: 'Global Navigation Context Link List',
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Link Lists'] },
  model: {
    folderTemplate: { name: 'Link List Folder' },
    itemTemplate: { name: 'Link List', sections: [{ name: 'Content', fields: [] }] },
    childItemTemplate: {
      name: 'Link',
      sections: [{ name: 'Content', fields: [{ name: 'Link', type: 'General Link' }] }],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Link Lists'] },
    culture: 'nl-NL',
    items: [
      {
        name: 'Global Navigation Context Links',
        fields: {},
        children: [
          {
            name: 'Consumers',
            fields: { Link: { text: 'Consumenten', url: 'https://www.menzis.nl/' } },
          },
          {
            name: 'Supporters',
            fields: {
              Link: {
                text: 'Ondersteuners',
                url: 'https://www.cooperatiemenzis.nl/portaal-voor-ondersteuners',
              },
            },
          },
          {
            name: 'Business',
            fields: { Link: { text: 'Zakelijk', url: 'https://www.menzis.nl/zakelijk' } },
          },
          {
            name: 'Healthcare Providers',
            fields: {
              Link: { text: 'Zorgaanbieders', url: 'https://www.menzis.nl/zorgaanbieders' },
            },
          },
          {
            name: 'Cooperation Menzis',
            fields: {
              Link: { text: 'Cooperatie Menzis', url: 'https://www.menzis.nl/over-menzis' },
            },
          },
          {
            name: 'Careers at Menzis',
            fields: {
              Link: { text: 'Werken bij Menzis', url: 'https://www.cooperatiemenzis.nl/werkenbij' },
            },
          },
        ],
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
