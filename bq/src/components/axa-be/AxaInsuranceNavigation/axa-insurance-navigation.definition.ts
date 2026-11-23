import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const insuranceNavigationDefinition = {
  kind: "component",
  definitionKey: "axa-insurance-navigation",
  name: "axa-insurance-navigation",
  displayName: "Insurance Navigation",
  componentName: "AxaInsuranceNavigation",
  icon: "Office/32x32/window_dialog.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: { scope: "site", root: "data", folder: ["Insurance Navigations"] },
  model: {
    folderTemplate: { name: "Insurance Navigation Folder" },
    itemTemplate: {
      name: "Insurance Navigation",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Title", type: "Single-Line Text" },
            { name: "Menu Content", type: "Rich Text" },
            { name: "Expandable", type: "Checkbox", default: true },
          ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Insurance Navigations"] },
    cultures: ["nl-BE", "fr-BE"],
    items: [
      {
        name: "Insurance",
        fields: {
          Title: "Insurance",
          Expandable: true,
          "Menu Content":
            "<div class=\"grid gap-8 md:grid-cols-2\"><div><ul><li><a href=\"/nl/particulieren/mobiliteit/auto\">Car</a></li><li><a href=\"/nl/particulieren/mobiliteit/motor\">Motorcycle</a></li><li><a href=\"/nl/particulieren/mobiliteit/fiets\">(e-)Bike, e-scooter &amp; co</a></li><li><a href=\"/nl/particulieren/mobiliteit/bestelwagen\">Van</a></li><li><a href=\"/nl/particulieren/gezin/reisverzekering\">Travel</a></li><li><a href=\"/nl/particulieren/gezin/students-travel\">Students Travel</a></li><li><a href=\"/nl/particulieren/gezin/bootverzekering\">Boat</a></li></ul></div><div><h3>Available services and benefits</h3><ul><li><a href=\"/nl/particulieren/services/bijstand/bijstand-auto\">Car assistance</a></li><li><a href=\"/nl/particulieren/services/bijstand/bijstand-fiets\">Bicycle assistance</a></li><li><a href=\"/nl/netwerk/erkende-garages\">Partner garages</a></li><li><a href=\"/nl/particulieren/services/fixico\">Vehicle repair when not covered (Fixico)</a></li></ul><h3>AXA stands by your side</h3><a href=\"/nl/particulieren/services/schadegeval-auto/auto-ongeval\"><img src=\"https://cdn.website.axa.be/-/media/projects/axabe/axabeweb/illustrations/mainnav/all-insurances/img_inform/inform_mobility.svg?savif=1&amp;swebp=1&amp;mh=240&amp;la=nl-BE&amp;h=240&amp;mw=600&amp;w=360&amp;hash=24AD37083717D98759EA3CC09264ED64\" alt=\"\" /><span>What to do in case of an accident or collision?</span></a></div></div>",
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
