import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const insuranceCategoryGroupDefinition = {
  kind: "component",
  definitionKey: "axa-insurance-category-group",
  name: "axa-insurance-category-group",
  displayName: "Insurance Category Group",
  componentName: "AxaInsuranceCategoryGroup",
  icon: "Office/32x32/table_selection_all.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: { scope: "site", root: "data", folder: ["Insurance Category Groups"] },
  model: {
    folderTemplate: { name: "Insurance Category Group Folder" },
    itemTemplate: {
      name: "Insurance Category Group",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Heading", type: "Single-Line Text" },
            { name: "Products", type: "Rich Text" }
          ]
        }
      ]
    }
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Insurance Category Groups"] },
    cultures: ["nl-BE", "fr-BE"],
    items: [
      {
        name: "Mobility",
        fields: {
          Heading: "Mobility",
          Products: "<ul><li><a href=\"https://www.axa.be/nl/particulieren/mobiliteit/auto\">Vehicle insurance</a></li><li><a href=\"https://www.axa.be/nl/particulieren/mobiliteit/motor\">Motorcycle insurance</a></li><li><a href=\"https://www.axa.be/nl/particulieren/mobiliteit/fiets\">Bicycle insurance</a></li><li><a href=\"https://www.axa.be/nl/particulieren/mobiliteit/bestelwagen\">Van</a></li><li><a href=\"https://www.axa.be/nl/particulieren/gezin/reisverzekering\">Travel insurance</a></li><li><a href=\"https://www.axa.be/nl/particulieren/gezin/students-travel\">Students Travel</a></li><li><a href=\"https://www.axa.be/nl/particulieren/gezin/bootverzekering\">Boat insurance</a></li></ul>"
        }
      },
      {
        name: "Home",
        fields: {
          Heading: "Home",
          Products: "<ul><li><a href=\"https://www.axa.be/nl/particulieren/woning/woonverzekering-brandverzekering\">Home insurance</a></li><li><a href=\"https://www.axa.be/nl/particulieren/woning/blokpolis\">Co-ownership policy</a></li><li><a href=\"https://www.axa.be/nl/particulieren/woning/schuldsaldoverzekering\">Debt balance insurance</a></li></ul>"
        }
      },
      {
        name: "Family",
        fields: {
          Heading: "Family",
          Products: "<ul><li><a href=\"https://www.axa.be/nl/particulieren/gezin/familiale-verzekering\">Family insurance</a></li><li><a href=\"https://www.axa.be/nl/particulieren/gezin/ongevallenverzekering-priveleven\">Accidents in private life</a></li><li><a href=\"https://www.axa.be/nl/particulieren/gezin/reisverzekering\">Travel insurance</a></li><li><a href=\"https://www.axa.be/nl/particulieren/gezin/students-travel\">Students Travel</a></li><li><a href=\"https://www.axa.be/nl/particulieren/gezin/dierenverzekering\">Pet insurance</a></li><li><a href=\"https://www.axa.be/nl/particulieren/gezin/bootverzekering\">Boat insurance</a></li><li><a href=\"https://www.axa.be/nl/particulieren/gezin/evenementenverzekering\">Event insurance</a></li></ul>"
        }
      },
      {
        name: "Health",
        fields: {
          Heading: "Health",
          Products: "<ul><li><a href=\"https://www.axa.be/nl/particulieren/gezondheid/gezondheidsverzekering\">Health insurance</a></li><li><a href=\"https://www.axa.be/nl/particulieren/gezondheid/arbeidsongevallen\">Accidents in the workplace</a></li><li><a href=\"https://www.axa.be/nl/particulieren/gezondheid/arbeidsongeschiktheid\">Incapacity for work</a></li></ul>"
        }
      },
      {
        name: "Pension",
        fields: {
          Heading: "Pension",
          Products: "<ul><li><a href=\"https://www.axa.be/nl/particulieren/pensioen\">Pension insurance</a></li><li><a href=\"https://www.axa.be/nl/particulieren/pensioen/pensioensparen\">Pension savings</a></li><li><a href=\"https://www.axa.be/nl/particulieren/pensioen/langetermijnsparen\">Long-term savings</a></li><li><a href=\"https://www.axa.be/nl/particulieren/pensioen/vrij-aanvullend-pensioen-werknemers\">Free supplementary pension for employees</a></li><li><a href=\"https://www.axa.be/nl/particulieren/pensioen/groepsverzekering-medewerkers\">Group insurance</a></li></ul>"
        }
      },
      {
        name: "Investments",
        fields: {
          Heading: "Investments",
          Products: "<ul><li><a href=\"https://www.axa.be/nl/particulieren/beleggingen/spaar-en-of-beleggingsverzekering\">Savings and/or investment insurance</a></li><li><a href=\"https://www.axa.be/nl/particulieren/beleggingen/beleggingsverzekering-tak-23\">Branch 23 investment insurance</a></li></ul>"
        }
      }
    ]
  }
} satisfies ComponentTemplateDefinition;
