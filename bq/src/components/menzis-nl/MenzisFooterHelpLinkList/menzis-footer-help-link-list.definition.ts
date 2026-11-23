import type { ComponentTemplateDefinition } from '../../../../tools/definitions/types';
export const menzisFooterHelpLinkListDefinition = {
  kind: 'component',
  collectionSystem: 'menzis',
  siteSystem: 'menzis-nl',
  definitionKey: 'menzis-footer-help-link-list',
  name: 'menzis-footer-help-link-list',
  componentName: 'MenzisFooterHelpLinkList',
  displayName: 'Footer Help Link List',
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Link Lists'] },
  model: {
    folderTemplate: { name: 'Link List Folder' },
    itemTemplate: {
      name: 'Link List',
      sections: [
        {
          name: 'Content',
          fields: [{ name: 'Title', type: 'Single-Line Text' }],
        },
      ],
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
        name: 'Snel naar',
        fields: { Title: 'Snel naar' },
        children: [
          {
            name: 'Service en contact',
            fields: {
              Link: {
                text: 'bekijk onze contactmogelijkheden',
                url: 'https://www.menzis.nl/klantenservice',
              },
            },
          },
          {
            name: 'Zorgverzekeringen',
            fields: {
              Link: { text: 'Zorgverzekeringen', url: 'https://www.menzis.nl/zorgverzekering' },
            },
          },
          {
            name: 'Our reimbursements',
            displayName: 'Onze vergoedingen',
            fields: {
              Link: {
                text: 'Onze vergoedingen',
                url: 'https://www.menzis.nl/zorg-en-vergoedingen',
              },
            },
          },
          {
            name: 'Working at Menzis',
            displayName: 'Werken bij Menzis',
            fields: {
              Link: { text: 'Werken bij Menzis', url: 'https://www.cooperatiemenzis.nl/werkenbij' },
            },
          },
        ],
      },
      {
        name: 'Mijn Menzis',
        fields: { Title: 'Mijn Menzis' },
        children: [
          {
            name: 'Inloggen',
            fields: { Link: { text: 'Inloggen', url: 'https://inlog.menzis.nl/login' } },
          },
          {
            name: 'Declaratie indienen',
            fields: {
              Link: {
                text: 'Declaratie indienen',
                url: 'https://www.menzis.nl/mijn/geldzaken/declaraties/declaratie-indienen',
              },
            },
          },
          {
            name: 'Toestemmingen beheren',
            fields: {
              Link: {
                text: 'Toestemmingen beheren',
                url: 'https://www.menzis.nl/mijn/gegevens/consent-wijzigen',
              },
            },
          },
          {
            name: 'Wijziging doorgeven',
            fields: {
              Link: { text: 'Wijziging doorgeven', url: 'https://www.menzis.nl/mijn/gegevens' },
            },
          },
        ],
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
