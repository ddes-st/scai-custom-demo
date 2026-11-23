import type { ComponentTemplateDefinition } from '../../../../tools/definitions/types';
export const menzisHeaderNavigationDefinition = {
  kind: 'component',
  collectionSystem: 'menzis',
  siteSystem: 'menzis-nl',
  definitionKey: 'menzis-header-navigation',
  name: 'menzis-header-navigation',
  componentName: 'MenzisHeaderNavigation',
  displayName: 'Header Navigation',
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Global Header Navigations'] },
  model: {
    folderTemplate: { name: 'Global Header Navigation Folder' },
    itemTemplate: {
      name: 'Global Header Navigation',
      sections: [
        {
          name: 'Content',
          fields: [
            { name: 'Logo', type: 'Image' },
            { name: 'Context Links', type: 'Multi-Line Text' },
            { name: 'Menu Groups', type: 'Multi-Line Text' },
            { name: 'Search Heading', type: 'Single-Line Text' },
            { name: 'Search Description', type: 'Multi-Line Text' },
            { name: 'Search Placeholder', type: 'Single-Line Text' },
          ],
        },
      ],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Global Header Navigations'] },
    culture: 'nl-NL',
    items: [
      {
        name: 'Global Header Navigation',
        fields: {
          Logo: {
            url: 'https://www.menzis.nl/Resources/Foundation/Branding/content/images/Menzis/logo.svg',
            alt: 'Logo Menzis',
          },
          'Context Links': JSON.stringify([
            { label: 'Consumenten', href: 'https://www.menzis.nl/' },
            {
              label: 'Ondersteuners',
              href: 'https://www.cooperatiemenzis.nl/portaal-voor-ondersteuners',
            },
            { label: 'Zakelijk', href: 'https://www.menzis.nl/zakelijk' },
            { label: 'Zorgaanbieders', href: 'https://www.menzis.nl/zorgaanbieders' },
            { label: 'Cooperatie Menzis', href: 'https://www.menzis.nl/over-menzis' },
            { label: 'Werken bij Menzis', href: 'https://www.cooperatiemenzis.nl/werkenbij' },
          ]),
          'Menu Groups': JSON.stringify([
            {
              label: 'Verzekering',
              columns: [
                {
                  title: 'Zorgverzekering',
                  links: [
                    {
                      label: 'Onze zorgverzekeringen',
                      href: 'https://www.menzis.nl/zorgverzekering',
                    },
                    {
                      label: 'Basisverzekering',
                      href: 'https://www.menzis.nl/zorgverzekering/basisverzekering',
                    },
                    {
                      label: 'Aanvullende verzekering',
                      href: 'https://www.menzis.nl/zorgverzekering/aanvullende-verzekering',
                    },
                    {
                      label: 'Tandartsverzekering',
                      href: 'https://www.menzis.nl/zorgverzekering/tandartsverzekering',
                    },
                  ],
                },
                {
                  title: 'Collectieve verzekering',
                  links: [
                    {
                      label: 'Collectieve verzekering',
                      href: 'https://www.menzis.nl/zorgverzekering/collectieve-zorgverzekering',
                    },
                    {
                      label: 'Collectieve voordelen',
                      href: 'https://www.menzis.nl/zorgverzekering/collectieve-zorgverzekering/werkgever/voordelen',
                    },
                    {
                      label: 'Reisverzekering',
                      href: 'https://www.menzis.nl/klantenservice/buitenland/reisverzekering-bij-unigarant',
                    },
                    {
                      label: 'Alarmcentrale',
                      href: 'https://www.menzis.nl/klantenservice/buitenland/reisverzekering-bij-unigarant/menzis-alarmcentrale',
                    },
                  ],
                },
                {
                  title: 'Voordelen',
                  links: [
                    {
                      label: 'Brillenvoucher tot € 75',
                      href: 'https://www.menzis.nl/extra-voordelen/brillenvoucher',
                    },
                    {
                      label: '50% korting op Strava Premium',
                      href: 'https://www.menzis.nl/extra-voordelen/strava',
                    },
                    { label: 'Extra voordelen', href: 'https://www.menzis.nl/extra-voordelen' },
                  ],
                },
              ],
            },
            {
              label: 'Zorg en vergoedingen',
              columns: [
                {
                  title: 'Ik zoek een vergoeding',
                  links: [
                    {
                      label: 'Fysiotherapie',
                      href: 'https://www.menzis.nl/zorg-en-vergoedingen/fysiotherapie-en-oefentherapie',
                    },
                    {
                      label: 'Brillen',
                      href: 'https://www.menzis.nl/zorg-en-vergoedingen/b/brillen',
                    },
                    {
                      label: 'Alternatieve zorg',
                      href: 'https://www.menzis.nl/zorg-en-vergoedingen/a/alternatieve-behandelwijzen-en-geneesmiddelen',
                    },
                    {
                      label: 'Tandarts',
                      href: 'https://www.menzis.nl/zorg-en-vergoedingen/tandarts',
                    },
                  ],
                },
                {
                  title: 'Ik heb zorg nodig',
                  links: [
                    {
                      label: 'Zorgaanbieder zoeken',
                      href: 'https://www.menzis.nl/zorg-en-vergoedingen/de-zorgvinder',
                    },
                    { label: 'Zorgwijzer', href: 'https://www.menzis.nl/zorgwijzer' },
                    { label: 'Zorgadvies', href: 'https://www.menzis.nl/zorgadvies' },
                  ],
                },
                {
                  title: 'Ik wil meer weten over',
                  links: [
                    {
                      label: 'Declareren',
                      href: 'https://www.menzis.nl/klantenservice/je-zorgkosten-declareren',
                    },
                    {
                      label: 'Betalen',
                      href: 'https://www.menzis.nl/klantenservice/premie-en-rekeningen-betalen',
                    },
                    {
                      label: 'Eigen risico',
                      href: 'https://www.menzis.nl/zorgverzekering/basisverzekering/eigen-risico',
                    },
                    {
                      label: 'Eigen bijdrage',
                      href: 'https://www.menzis.nl/zorgverzekering/basisverzekering/eigen-bijdrage',
                    },
                  ],
                },
              ],
            },
            {
              label: 'Gezondheid',
              columns: [
                {
                  title: 'Ik wil hulp bij',
                  links: [
                    { label: 'Gezonde leefstijl', href: 'https://www.menzis.nl/gezonde-leefstijl' },
                    {
                      label: 'Geestelijke gezondheid',
                      href: 'https://www.menzis.nl/zorg-en-gezondheid/geestelijke-gezondheid',
                    },
                    {
                      label: 'Mantelzorg',
                      href: 'https://www.menzis.nl/zorg-en-gezondheid/alles-over-mantelzorg',
                    },
                    {
                      label: 'De overgang',
                      href: 'https://www.menzis.nl/zorg-en-gezondheid/de-overgang',
                    },
                  ],
                },
                {
                  title: "Extra's voor Menzis leden",
                  links: [
                    {
                      label: 'Bekijk alle voordelen',
                      href: 'https://www.menzis.nl/extra-voordelen',
                    },
                    {
                      label: '50% korting op Strava',
                      href: 'https://www.menzis.nl/extra-voordelen/strava',
                    },
                    {
                      label: 'Brillenvoucher tot € 75',
                      href: 'https://www.menzis.nl/extra-voordelen/brillenvoucher',
                    },
                  ],
                },
                {
                  title: 'Inspiratie en ervaringsverhalen',
                  links: [
                    { label: 'De Menzis Zorggids Podcast', href: 'https://www.menzis.nl/podcast' },
                    { label: 'Uit Balans', href: 'https://www.menzis.nl/uit-balans' },
                  ],
                },
              ],
            },
            {
              label: 'Zelf regelen',
              columns: [
                {
                  title: 'Betalen',
                  links: [
                    {
                      label: 'Mijn rekeningen',
                      href: 'https://www.menzis.nl/mijn/geldzaken/rekeningen',
                    },
                    {
                      label: 'Betalingsregeling aanvragen',
                      href: 'https://www.menzis.nl/klantenservice/premie-en-rekeningen-betalen/betalingsregeling',
                    },
                    {
                      label: 'Gespreid betalen eigen risico',
                      href: 'https://www.menzis.nl/zorgverzekering/basisverzekering/eigen-risico/gespreid-betalen',
                    },
                    {
                      label: 'Alles over betalen',
                      href: 'https://www.menzis.nl/klantenservice/premie-en-rekeningen-betalen',
                    },
                  ],
                },
                {
                  title: 'Mijn verzekering',
                  links: [
                    {
                      label: 'Mijn verzekering bekijken',
                      href: 'https://www.menzis.nl/mijn/verzekering',
                    },
                    {
                      label: 'Machtiging controleren',
                      href: 'https://www.menzis.nl/mijn/verzekering/machtigingen',
                    },
                    { label: 'Mijn berichten', href: 'https://www.menzis.nl/mijn/berichten' },
                  ],
                },
                {
                  title: 'Mijn zorggebruik',
                  links: [
                    {
                      label: 'Mijn zorggebruik bekijken',
                      href: 'https://www.menzis.nl/mijn/mijnzorggebruik',
                    },
                    {
                      label: 'Declaratie indienen',
                      href: 'https://www.menzis.nl/mijn/geldzaken/declaraties/declaratie-indienen',
                    },
                    {
                      label: 'Eigen risico checken',
                      href: 'https://www.menzis.nl/mijn/geldzaken/eigenrisico',
                    },
                  ],
                },
                {
                  title: 'Mijn situatie verandert',
                  links: [
                    {
                      label: 'Mijn verzekering wijzigen',
                      href: 'https://www.menzis.nl/mijn/verzekering',
                    },
                    {
                      label: 'Contactgegevens wijzigen',
                      href: 'https://www.menzis.nl/mijn/gegevens',
                    },
                    {
                      label: 'Gezinslid op eigen polis',
                      href: 'https://www.menzis.nl/mijn/verzekering/verzekering-wijzigen/gezinslid-naar-eigen-polis',
                    },
                  ],
                },
              ],
            },
          ]),
          'Search Heading': 'Zoek binnen menzis.nl',
          'Search Description':
            'Je kunt ook een vraag stellen aan onze chatbot of andere contactmogelijkheden op onze service & contactpagina bekijken.',
          'Search Placeholder': 'Zoek binnen menzis.nl',
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
