import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const crelanCookiePreferenceCategoryDefinition = {
  kind: "component",
  collectionSystem: "crelan",
  siteSystem: "crelan-be",
  definitionKey: "crelan-cookie-preference-category",
  name: "crelan-cookie-preference-category",
  componentName: "CrelanCookiePreferenceCategory",
  displayName: "Cookie Preference Category",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Cookie Categories'] },
  model: {
    folderTemplate: { name: 'Cookie Category Folder' },
    itemTemplate: {
      name: 'Cookie Category',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Title', type: 'Single-Line Text' },
          { name: 'Description', type: 'Multi-Line Text' },
          { name: 'Required', type: 'Checkbox' },
          { name: 'Initial Enabled', type: 'Checkbox' }
        ]
      }]
    }
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Cookie Categories'] },
    culture: "nl-BE",
    items: [
      {
        name: 'Strikt noodzakelijke cookies',
        fields: {
          Title: 'Strikt noodzakelijke cookies',
          Description: 'Deze cookies zijn nodig om de website te laten functioneren en kunnen niet worden uitgeschakeld in onze systemen.',
          Required: true,
          'Initial Enabled': false
        }
      },
      {
        name: 'Functionele cookies',
        fields: {
          Title: 'Functionele cookies',
          Description: 'Deze cookies bewaren uw keuzes en voorkeuren bij (vb. taalkeuze), zodat u die bij een volgend bezoek niet opnieuw hoeft te selecteren.',
          Required: false,
          'Initial Enabled': true
        }
      },
      {
        name: 'Prestatiecookies',
        fields: {
          Title: 'Prestatiecookies',
          Description: 'Deze cookies verzamelen informatie over het gebruik van de website (vb. bezochte pagina’s, gemiddelde duur van het bezoek, verplaatsing door de website,…), zodat we het gebruik en de prestaties van onze website kunnen meten en verbeteren. Deze cookies worden door Google Analytics geplaatst.',
          Required: false,
          'Initial Enabled': true
        }
      },
      {
        name: 'Doelgroepgerichte cookies',
        fields: {
          Title: 'Doelgroepgerichte cookies',
          Description: 'Deze cookies kunnen door onze advertentiepartners via onze website worden ingesteld. Ze verzamelen informatie over uw surfgedrag en persoonlijke interesses en kunnen worden gebruikt op externe websites en socialmediakanalen zoals Facebook om u relevante boodschappen of advertenties te tonen.',
          Required: false,
          'Initial Enabled': true
        }
      }
    ]
  }
} satisfies ComponentTemplateDefinition;
