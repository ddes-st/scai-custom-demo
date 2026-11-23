import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const insuranceCategoryMenuDefinition = {
  kind: "component",
  definitionKey: "axa-insurance-category-menu",
  name: "axa-insurance-category-menu",
  displayName: "Insurance Category Menu",
  componentName: "AxaInsuranceCategoryMenu",
  icon: "Office/32x32/table_selection_all.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Link Lists"],
  },
  model: {
    folderTemplate: { name: "Insurance Category Menu Folder" },
    itemTemplate: {
      name: "Insurance Category Menu",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [{ name: "Title", type: "Single-Line Text" }],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Link Lists"] },
    cultures: ["nl-BE", "fr-BE"],
    items: [
      {
        name: "Mobility",
        fields: { Title: "Mobility" },
        children: [
          {
            name: "Vehicle insurance",
            fields: {
              Link: {
                text: "Vehicle insurance",
                url: "https://www.axa.be/nl/particulieren/mobiliteit/auto",
              },
            },
          },
          {
            name: "Motorcycle insurance",
            fields: {
              Link: {
                text: "Motorcycle insurance",
                url: "https://www.axa.be/nl/particulieren/mobiliteit/motor",
              },
            },
          },
          {
            name: "Bicycle insurance",
            fields: {
              Link: {
                text: "Bicycle insurance",
                url: "https://www.axa.be/nl/particulieren/mobiliteit/fiets",
              },
            },
          },
          {
            name: "Van",
            fields: {
              Link: {
                text: "Van",
                url: "https://www.axa.be/nl/particulieren/mobiliteit/bestelwagen",
              },
            },
          },
          {
            name: "Travel Insurance",
            fields: {
              Link: {
                text: "Travel Insurance",
                url: "https://www.axa.be/nl/particulieren/gezin/reisverzekering",
              },
            },
          },
          {
            name: "Students Travel",
            fields: {
              Link: {
                text: "Students Travel",
                url: "https://www.axa.be/nl/particulieren/gezin/students-travel",
              },
            },
          },
          {
            name: "Boat insurance",
            fields: {
              Link: {
                text: "Boat insurance",
                url: "https://www.axa.be/nl/particulieren/gezin/bootverzekering",
              },
            },
          },
        ],
      },
      {
        name: "Home",
        fields: { Title: "Home" },
        children: [
          {
            name: "home insurance",
            fields: {
              Link: {
                text: "home insurance",
                url: "https://www.axa.be/nl/particulieren/woning/woonverzekering-brandverzekering",
              },
            },
          },
          {
            name: "Co-ownership policy",
            fields: {
              Link: {
                text: "Co-ownership policy",
                url: "https://www.axa.be/nl/particulieren/woning/blokpolis",
              },
            },
          },
          {
            name: "Debt balance insurance",
            fields: {
              Link: {
                text: "Debt balance insurance",
                url: "https://www.axa.be/nl/particulieren/woning/schuldsaldoverzekering",
              },
            },
          },
        ],
      },
      {
        name: "Family",
        fields: { Title: "Family" },
        children: [
          {
            name: "Family insurance",
            fields: {
              Link: {
                text: "Family insurance",
                url: "https://www.axa.be/nl/particulieren/gezin/familiale-verzekering",
              },
            },
          },
          {
            name: "Accidents in private life",
            fields: {
              Link: {
                text: "Accidents in private life",
                url: "https://www.axa.be/nl/particulieren/gezin/ongevallenverzekering-priveleven",
              },
            },
          },
          {
            name: "Travel Insurance",
            fields: {
              Link: {
                text: "Travel Insurance",
                url: "https://www.axa.be/nl/particulieren/gezin/reisverzekering",
              },
            },
          },
          {
            name: "Students Travel",
            fields: {
              Link: {
                text: "Students Travel",
                url: "https://www.axa.be/nl/particulieren/gezin/students-travel",
              },
            },
          },
          {
            name: "Pet insurance",
            fields: {
              Link: {
                text: "Pet insurance",
                url: "https://www.axa.be/nl/particulieren/gezin/dierenverzekering",
              },
            },
          },
          {
            name: "Boat insurance",
            fields: {
              Link: {
                text: "Boat insurance",
                url: "https://www.axa.be/nl/particulieren/gezin/bootverzekering",
              },
            },
          },
          {
            name: "Event insurance",
            fields: {
              Link: {
                text: "Event insurance",
                url: "https://www.axa.be/nl/particulieren/gezin/evenementenverzekering",
              },
            },
          },
        ],
      },
      {
        name: "Health",
        fields: { Title: "Health" },
        children: [
          {
            name: "Health insurance",
            fields: {
              Link: {
                text: "Health insurance",
                url: "https://www.axa.be/nl/particulieren/gezondheid/gezondheidsverzekering",
              },
            },
          },
          {
            name: "Accidents in the workplace",
            fields: {
              Link: {
                text: "Accidents in the workplace",
                url: "https://www.axa.be/nl/particulieren/gezondheid/arbeidsongevallen",
              },
            },
          },
          {
            name: "Incapacity for work",
            fields: {
              Link: {
                text: "Incapacity for work",
                url: "https://www.axa.be/nl/particulieren/gezondheid/arbeidsongeschiktheid",
              },
            },
          },
        ],
      },
      {
        name: "Retirement",
        fields: { Title: "Pensions" },
        children: [
          {
            name: "Pension Insurance",
            fields: {
              Link: {
                text: "Pension Insurance",
                url: "https://www.axa.be/nl/particulieren/pensioen",
              },
            },
          },
          {
            name: "Pension savings",
            fields: {
              Link: {
                text: "Pension savings",
                url: "https://www.axa.be/nl/particulieren/pensioen/pensioensparen",
              },
            },
          },
          {
            name: "Longer term saving",
            fields: {
              Link: {
                text: "Long-term savings",
                url: "https://www.axa.be/nl/particulieren/pensioen/langetermijnsparen",
              },
            },
          },
          {
            name: "Free supplementary pension",
            fields: {
              Link: {
                text: "Free supplementary pension for employees",
                url: "https://www.axa.be/nl/particulieren/pensioen/vrij-aanvullend-pensioen-werknemers",
              },
            },
          },
          {
            name: "Group insurance",
            fields: {
              Link: {
                text: "Group insurance",
                url: "https://www.axa.be/nl/particulieren/pensioen/groepsverzekering-medewerkers",
              },
            },
          },
        ],
      },
      {
        name: "Investments",
        fields: { Title: "Investments" },
        children: [
          {
            name: "Savings and investment insurance",
            fields: {
              Link: {
                text: "Savings and/or investment insurance",
                url: "https://www.axa.be/nl/particulieren/beleggingen/spaar-en-of-beleggingsverzekering",
              },
            },
          },
          {
            name: "Branch 23-life insurances",
            fields: {
              Link: {
                text: "Branch 23 investment insurance",
                url: "https://www.axa.be/nl/particulieren/beleggingen/beleggingsverzekering-tak-23",
              },
            },
          },
        ],
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
