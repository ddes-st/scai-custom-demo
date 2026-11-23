import type { ComponentTemplateDefinition } from '../../../../tools/definitions/types';
export const menzisFooterInfoLinksDefinition = {
  kind: 'component',
  collectionSystem: 'menzis',
  siteSystem: 'menzis-nl',
  definitionKey: 'menzis-footer-info-links',
  name: 'menzis-footer-info-links',
  componentName: 'MenzisFooterInfoLinks',
  displayName: 'Footer Info Links',
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Footer Legal Links Bands'] },
  model: {
    folderTemplate: { name: 'Footer Legal Links Band Folder' },
    itemTemplate: {
      name: 'Footer Legal Links Band',
      sections: [
        {
          name: 'Content',
          fields: [
            { name: 'Heading', type: 'Single-Line Text' },
            { name: 'Logo', type: 'Image' },
            { name: 'Logo Link', type: 'General Link' },
          ],
        },
      ],
    },
  },
  placeholders: [{ key: 'footer-legal-links', allowedControls: ['menzis-footer-legal-link-list'] }],
  content: {
    location: { root: 'data', folder: ['Footer Legal Links Bands'] },
    culture: 'nl-NL',
    items: [
      {
        name: 'Footer Legal Links Band',
        fields: {
          Heading: 'Dan is er Menzis.',
          Logo: {
            url: '/Resources/Foundation/Branding/content/images/Menzis/logo-small.svg',
            alt: 'Logo Menzis',
          },
          'Logo Link': { text: 'Menzis', url: 'https://www.menzis.nl/' },
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
