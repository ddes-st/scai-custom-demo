import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const insuranceCategoryDefinition = {
  kind: "component",
  definitionKey: "axa-insurance-category",
  name: "axa-insurance-category",
  displayName: "Insurance Category",
  componentName: "AxaInsuranceCategory",
  icon: "Office/32x32/shopping_cart_full.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Link Lists"],
  },
  model: {
    folderTemplate: {
      name: "Insurance Category Folder",
      displayName: "Insurance Category Folder",
    },
    itemTemplate: {
      name: "Insurance Category",
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
    location: {
      root: "data",
      folder: ["Link Lists"],
    },
    culture: "nl-BE",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Mobility",
        displayName: "Mobiliteit",
        fields: {
          Title: "Mobiliteit"
        },
        children: [
          { name: "Car Insurance", displayName: "Autoverzekering", fields: { Link: { text: "Autoverzekering", url: "https://www.axa.be/nl/particulieren/mobiliteit/auto" } } },
          { name: "Motorcycle Insurance", displayName: "Motorverzekering", fields: { Link: { text: "Motorverzekering", url: "https://www.axa.be/nl/particulieren/mobiliteit/motor" } } },
          { name: "Bicycle Insurance", displayName: "Fietsverzekering", fields: { Link: { text: "Fietsverzekering", url: "https://www.axa.be/nl/particulieren/mobiliteit/fiets" } } },
          { name: "Van Insurance", displayName: "Bestelwagen", fields: { Link: { text: "Bestelwagen", url: "https://www.axa.be/nl/particulieren/mobiliteit/bestelwagen" } } },
          { name: "Travel Insurance", displayName: "Reisverzekering", fields: { Link: { text: "Reisverzekering", url: "https://www.axa.be/nl/particulieren/gezin/reisverzekering" } } },
          { name: "Students Travel", displayName: "Students Travel", fields: { Link: { text: "Students Travel", url: "https://www.axa.be/nl/particulieren/gezin/students-travel" } } },
          { name: "Boat Insurance", displayName: "Bootverzekering", fields: { Link: { text: "Bootverzekering", url: "https://www.axa.be/nl/particulieren/gezin/bootverzekering" } } },
        ],
      },
      {
        name: "Home",
        displayName: "Woning",
        fields: { Title: "Woning" },
        children: [
          { name: "Home Insurance", displayName: "Woonverzekering", fields: { Link: { text: "Woonverzekering", url: "https://www.axa.be/nl/particulieren/woning/woonverzekering-brandverzekering" } } },
          { name: "Block Policy", displayName: "Blokpolis", fields: { Link: { text: "Blokpolis", url: "https://www.axa.be/nl/particulieren/woning/blokpolis" } } },
          { name: "Balance Insurance", displayName: "Schuldsaldoverzekering", fields: { Link: { text: "Schuldsaldoverzekering", url: "https://www.axa.be/nl/particulieren/woning/schuldsaldoverzekering" } } },
        ],
      },
      {
        name: "Family",
        displayName: "Gezin",
        fields: { Title: "Gezin" },
        children: [
          { name: "Family Insurance", displayName: "Familiale verzekering", fields: { Link: { text: "Familiale verzekering", url: "https://www.axa.be/nl/particulieren/gezin/familiale-verzekering" } } },
          { name: "Private Life Accidents", displayName: "Ongevallen privéleven", fields: { Link: { text: "Ongevallen privéleven", url: "https://www.axa.be/nl/particulieren/gezin/ongevallenverzekering-priveleven" } } },
          { name: "Family Travel Insurance", displayName: "Reisverzekering", fields: { Link: { text: "Reisverzekering", url: "https://www.axa.be/nl/particulieren/gezin/reisverzekering" } } },
          { name: "Family Students Travel", displayName: "Students Travel", fields: { Link: { text: "Students Travel", url: "https://www.axa.be/nl/particulieren/gezin/students-travel" } } },
          { name: "Animal Insurance", displayName: "Dierenverzekering", fields: { Link: { text: "Dierenverzekering", url: "https://www.axa.be/nl/particulieren/gezin/dierenverzekering" } } },
          { name: "Family Boat Insurance", displayName: "Bootverzekering", fields: { Link: { text: "Bootverzekering", url: "https://www.axa.be/nl/particulieren/gezin/bootverzekering" } } },
          { name: "Event Insurance", displayName: "Evenementenverzekering", fields: { Link: { text: "Evenementenverzekering", url: "https://www.axa.be/nl/particulieren/gezin/evenementenverzekering" } } },
        ],
      },
      {
        name: "Health",
        displayName: "Gezondheid",
        fields: { Title: "Gezondheid" },
        children: [
          { name: "Health Insurance", displayName: "Gezondheidsverzekering", fields: { Link: { text: "Gezondheidsverzekering", url: "https://www.axa.be/nl/particulieren/gezondheid/gezondheidsverzekering" } } },
          { name: "Work Accident Insurance", displayName: "Arbeidsongevallen", fields: { Link: { text: "Arbeidsongevallen", url: "https://www.axa.be/nl/particulieren/gezondheid/arbeidsongevallen" } } },
          { name: "Incapacity Insurance", displayName: "Arbeidsongeschiktheid", fields: { Link: { text: "Arbeidsongeschiktheid", url: "https://www.axa.be/nl/particulieren/gezondheid/arbeidsongeschiktheid" } } },
        ],
      },
      {
        name: "Pension",
        displayName: "Pensioen",
        fields: { Title: "Pensioen" },
        children: [
          { name: "Pension Insurance", displayName: "Pensioenverzekering", fields: { Link: { text: "Pensioenverzekering", url: "https://www.axa.be/nl/particulieren/pensioen" } } },
          { name: "Pension Savings", displayName: "Pensioensparen", fields: { Link: { text: "Pensioensparen", url: "https://www.axa.be/nl/particulieren/pensioen/pensioensparen" } } },
          { name: "Long Term Savings", displayName: "Langetermijnsparen", fields: { Link: { text: "Langetermijnsparen", url: "https://www.axa.be/nl/particulieren/pensioen/langetermijnsparen" } } },
          { name: "Employee Supplementary Pension", displayName: "Vrij aanvullend pensioen voor werknemers", fields: { Link: { text: "Vrij aanvullend pensioen voor werknemers", url: "https://www.axa.be/nl/particulieren/pensioen/vrij-aanvullend-pensioen-werknemers" } } },
          { name: "Group Insurance", displayName: "Groepsverzekering", fields: { Link: { text: "Groepsverzekering", url: "https://www.axa.be/nl/particulieren/pensioen/groepsverzekering-medewerkers" } } },
        ],
      },
      {
        name: "Investments",
        displayName: "Beleggingen",
        fields: { Title: "Beleggingen" },
        children: [
          { name: "Savings Investment Insurance", displayName: "Spaar- en/of beleggingsverzekering", fields: { Link: { text: "Spaar- en/of beleggingsverzekering", url: "https://www.axa.be/nl/particulieren/beleggingen/spaar-en-of-beleggingsverzekering" } } },
          { name: "Investment Insurance Type Twenty Three", displayName: "Beleggingsverzekering tak 23", fields: { Link: { text: "Beleggingsverzekering tak 23", url: "https://www.axa.be/nl/particulieren/beleggingen/beleggingsverzekering-tak-23" } } },
        ],
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
