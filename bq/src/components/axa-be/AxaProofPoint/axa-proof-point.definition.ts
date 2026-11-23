import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const proofPointDefinition = {
  kind: "component",
  definitionKey: "axa-proof-point",
  name: "axa-proof-point",
  displayName: "Proof Point",
  componentName: "AxaProofPoint",
  icon: "Office/32x32/layout_northeast.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: { scope: "site", root: "data", folder: ["Proof Points"] },
  model: {
    folderTemplate: { name: "Proof Point Folder" },
    itemTemplate: {
      name: "Proof Point",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Number", type: "Single-Line Text" },
            { name: "Unit", type: "Single-Line Text" },
            { name: "Label", type: "Single-Line Text" }
          ]
        }
      ]
    }
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Proof Points"] },
    culture: "nl-BE",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Loyal Customers",
        displayName: "Trouwe klanten",
        fields: {
          Number: "3",
          Unit: "miljoen",
          Label: "Trouwe klanten"
        }
      },
      {
        name: "Brokers by Your Side",
        displayName: "Makelaars aan je zijde",
        fields: {
          Number: "3 200",
          Label: "Makelaars aan je zijde"
        }
      },
      {
        name: "Engaged Employees",
        displayName: "Geëngageerde medewerkers",
        fields: {
          Number: "3 000",
          Label: "Geëngageerde medewerkers"
        }
      }
    ]
  }
} satisfies ComponentTemplateDefinition;
