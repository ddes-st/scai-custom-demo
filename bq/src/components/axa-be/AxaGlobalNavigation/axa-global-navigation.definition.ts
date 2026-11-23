import type { ComponentTemplateDefinition } from '../../../../tools/definitions/types';

const panels = [
  {
    category: 'Mobility',
    products: [
      ['Car', 'https://www.axa.be/nl/particulieren/mobiliteit/auto'],
      ['Motorcycle', 'https://www.axa.be/nl/particulieren/mobiliteit/motor'],
      ['(e-)Bike, e-scooter & Co', 'https://www.axa.be/nl/particulieren/mobiliteit/fiets'],
      ['Van', 'https://www.axa.be/nl/particulieren/mobiliteit/bestelwagen'],
      ['Travel', 'https://www.axa.be/nl/particulieren/gezin/reisverzekering'],
      ['Students Travel', 'https://www.axa.be/nl/particulieren/gezin/students-travel'],
      ['Boat', 'https://www.axa.be/nl/particulieren/gezin/bootverzekering'],
    ],
    services: [
      ['Car assistance', 'https://www.axa.be/nl/particulieren/services/bijstand/bijstand-auto'],
      ['Bicycle assistance', 'https://www.axa.be/nl/particulieren/services/bijstand/bijstand-fiets'],
      ['Partner garages', 'https://www.axa.be/nl/netwerk/erkende-garages'],
      ['Vehicle repair when not covered (Fixico)', 'https://www.axa.be/nl/particulieren/services/fixico'],
    ],
    feature: [
      'What to do in case of an accident or collision?',
      'https://www.axa.be/nl/particulieren/services/schadegeval-auto/auto-ongeval',
      'https://cdn.website.axa.be/-/media/projects/axabe/axabeweb/illustrations/mainnav/all-insurances/img_inform/inform_mobility.svg?savif=1&swebp=1&mh=240&la=nl-BE&h=240&mw=600&w=360&hash=24AD37083717D98759EA3CC09264ED64',
    ],
  },
  {
    category: 'Home',
    products: [
      ['Home insurance', 'https://www.axa.be/nl/particulieren/woning/woonverzekering-brandverzekering'],
      ['Co-ownership policy', 'https://www.axa.be/nl/particulieren/woning/blokpolis'],
      ['Debt balance insurance', 'https://www.axa.be/nl/particulieren/woning/schuldsaldoverzekering'],
    ],
    services: [
      ['Home assistance', 'https://www.axa.be/nl/particulieren/services/bijstand/bijstand-woning'],
      ['Odd jobs and repairs (AXA Homecare)', 'https://www.axa.be/nl/particulieren/services/axa-homecare'],
    ],
    feature: [
      'What to do in case of a storm?',
      'https://www.axa.be/nl/particulieren/services/schadegeval-woning/storm',
      'https://cdn.website.axa.be/-/media/projects/axabe/axabeweb/illustrations/mainnav/all-insurances/img_inform/Banner%20card.svg?savif=1&swebp=1&mh=240&la=nl-BE&h=240&mw=600&w=360&hash=7DEDE9CCA60558F5A45F43C1786181BD',
    ],
  },
  {
    category: 'Family',
    products: [
      ['Family insurance', 'https://www.axa.be/nl/particulieren/gezin/familiale-verzekering'],
      ['Accidents in private life', 'https://www.axa.be/nl/particulieren/gezin/ongevallenverzekering-priveleven'],
      ['Travel', 'https://www.axa.be/nl/particulieren/gezin/reisverzekering'],
      ['Students Travel', 'https://www.axa.be/nl/particulieren/gezin/students-travel'],
      ['Pets', 'https://www.axa.be/nl/particulieren/gezin/dierenverzekering'],
      ['Boat', 'https://www.axa.be/nl/particulieren/gezin/bootverzekering'],
      ['Events', 'https://www.axa.be/nl/particulieren/gezin/evenementenverzekering'],
    ],
    services: [['Travel assistance', 'https://www.axa.be/nl/particulieren/services/bijstand/bijstand-reis']],
    feature: [
      'Travel insurance in Belgium or abroad',
      'https://www.axa.be/nl/blog/gezin/reisverzekering-belgie-en-buitenland',
      'https://cdn.website.axa.be/-/media/projects/axabe/axabeweb/banner-images/blog/testimonial%20travel.jpg?rev=2b0080a879264f1a8b7dce8c12d7935c&savif=1&swebp=1&ch=240&cx=0.32&la=nl-BE&cy=0.46&cw=600&hash=B6C0A53A15D04CABF0D55BECC1A01D68',
    ],
  },
  {
    category: 'Health',
    products: [
      ['Health insurance', 'https://www.axa.be/nl/particulieren/gezondheid/gezondheidsverzekering'],
      ['Workplace accidents', 'https://www.axa.be/nl/particulieren/gezondheid/arbeidsongevallen'],
      ['Incapacity for work', 'https://www.axa.be/nl/particulieren/gezondheid/arbeidsongeschiktheid'],
    ],
    services: [
      ['Online doctor consultation (Doctors Online)', 'https://www.axa.be/nl/particulieren/gezondheid/gezondheidsverzekering/doctors-online'],
      ['Second medical opinion', 'https://www.axa.be/nl/particulieren/gezondheid/gezondheidsverzekering/tweede-medisch-advies'],
      ['Doctor appointment (Doctena)', 'https://www.axa.be/nl/particulieren/gezondheid/gezondheidsverzekering/doctena'],
      ['Analyze your symptoms online (SymptomZoom)', 'https://www.axa.be/nl/particulieren/gezondheid/gezondheidsverzekering/symptomzoom'],
    ],
  },
] as const;

const anchors = (links: readonly (readonly [string, string])[]) =>
  links.map(([label, url]) => `<li><a href="${url}">${label.replaceAll('&', '&amp;')}</a></li>`).join('');
const categoryNavigation =
  panels
    .map(
      (panel) =>
        `<details><summary>${panel.category}<span aria-hidden="true">⌄</span></summary><div class="nav-panel"><div class="nav-panel-grid"><ul>${anchors(panel.products)}</ul><div><h3>Available services and benefits</h3><ul>${anchors(panel.services)}</ul></div>${
          'feature' in panel && panel.feature
            ? `<div><h3>AXA stands by your side</h3><div class="nav-feature"><img src="${panel.feature[2]}" alt="" /><a href="${panel.feature[1]}">${panel.feature[0]} →</a></div></div>`
            : ''
        }</div></div></details>`,
    )
    .join('') +
  '<details><summary>Pension<span aria-hidden="true">⌄</span></summary></details><details><summary>Investments<span aria-hidden="true">⌄</span></summary></details>';

export const globalNavigationDefinition = {
  kind: 'component',
  definitionKey: "axa-global-navigation",
  name: "axa-global-navigation",
  displayName: 'Global Navigation',
  componentName: "AxaGlobalNavigation",
  icon: "Office/32x32/sign_warning_voltage.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Global Navigation'] },
  model: {
    folderTemplate: { name: 'Global Navigation Folder' },
    itemTemplate: {
      name: 'Global Navigation',
      sections: [
        {
          name: 'Data',
          sortOrder: 100,
          fields: [
            { name: 'Logo', type: 'Image' },
            { name: 'Logo Link', type: 'General Link' },
            { name: 'Audience Segments', type: 'Rich Text' },
            { name: 'Utility Links', type: 'Rich Text' },
            { name: 'Insurance Tab', type: 'Single-Line Text' },
            { name: 'Claims Tab', type: 'Single-Line Text' },
            { name: 'Category Navigation', type: 'Rich Text' },
            { name: 'All Insurance Link', type: 'General Link' },
            { name: 'Search', type: 'Single-Line Text' },
            { name: 'Search Results Link', type: 'General Link' },
            { name: 'Login Link', type: 'General Link' },
          ],
        },
      ],
    },
  },
  variants: [{ name: 'Default' }],
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Global Navigation'] },
    cultures: ['nl-BE', 'fr-BE'],
    items: [
      {
        name: 'AXA Belgium Global Navigation',
        fields: {
          Logo: {
            url: 'https://cdn.website.axa.be/-/media/shared/logos/axa%20logo%20solid%20rgb.svg?rev=4f6cb760a2cd42329840b9b2bc216240&savif=1&swebp=1&mh=0&la=nl-BE&h=48&mw=0&w=48&hash=AC1288D9BFFA11B7B02724420516B50B',
            alt: 'AXA Insurance, homepage',
          },
          'Logo Link': { text: 'Home', url: 'https://www.axa.be/' },
          'Audience Segments':
            '<ul><li><a class="active" href="https://www.axa.be/nl/particulieren">Individuals</a></li><li><a href="https://www.axa.be/nl/ondernemers-kmo">Entrepreneurs &amp; SMEs</a></li><li><a href="https://www.axa.be/nl/grote-ondernemingen">Large companies</a></li><li><a href="https://www.axa.be/nl/publieke-sector">Public sector</a></li></ul>',
          'Utility Links':
            '<ul><li><a class="urgent" href="https://www.axa.be/nl/particulieren/services/bijstand/bijstand-auto">⚡ Urgent assistance</a></li><li><a href="https://www.axa.be/nl/particulieren/contact">Help and contact</a></li><li><a href="https://www.axa.be/fr/particuliers">Français</a></li></ul>',
          'Insurance Tab': 'Insurance',
          'Claims Tab': 'Claims',
          'Category Navigation': categoryNavigation,
          'All Insurance Link': { text: 'All our insurance', url: 'https://www.axa.be/nl/particulieren' },
          Search: 'I am looking for...',
          'Search Results Link': { text: 'Search results', url: 'https://www.axa.be/nl/zoekresultaten' },
          'Login Link': { text: 'Sign in', url: 'https://www.axa.be/nl/particulieren' },
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
