import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const insuranceMenuDefinition = {
  kind: "component",
  definitionKey: "axa-insurance-menu",
  name: "axa-insurance-menu",
  displayName: "Insurance Menu",
  componentName: "AxaInsuranceMenu",
  icon: "Office/32x32/sign_warning_voltage.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: { scope: "site", root: "data", folder: ["Insurance Menus"] },
  model: {
    folderTemplate: { name: "Insurance Menu Folder" },
    itemTemplate: {
      name: "Insurance Menu",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Category", type: "Single-Line Text" },
            { name: "Product Links", type: "Rich Text" },
            { name: "Service Links", type: "Rich Text" },
            { name: "Feature Title", type: "Single-Line Text" },
            { name: "Feature Link", type: "General Link" },
            { name: "Feature Image", type: "Image" }
          ]
        }
      ]
    }
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Insurance Menus"] },
    cultures: ["nl-BE", "fr-BE"],
    items: [
      {
        name: "Mobility",
        fields: {
          Category: "Mobility",
          "Product Links": "<ul><li><a href=\"https://www.axa.be/nl/particulieren/mobiliteit/auto\">Car</a></li><li><a href=\"https://www.axa.be/nl/particulieren/mobiliteit/motor\">Motorcycle</a></li><li><a href=\"https://www.axa.be/nl/particulieren/mobiliteit/fiets\">(e-)Bike, e-scooter &amp; co</a></li><li><a href=\"https://www.axa.be/nl/particulieren/mobiliteit/bestelwagen\">Van</a></li><li><a href=\"https://www.axa.be/nl/particulieren/gezin/reisverzekering\">Travel</a></li><li><a href=\"https://www.axa.be/nl/particulieren/gezin/students-travel\">Students Travel</a></li><li><a href=\"https://www.axa.be/nl/particulieren/gezin/bootverzekering\">Boat</a></li></ul>",
          "Service Links": "<ul><li><a href=\"https://www.axa.be/nl/particulieren/services/bijstand/bijstand-auto\">Car assistance</a></li><li><a href=\"https://www.axa.be/nl/particulieren/services/bijstand/bijstand-fiets\">Bicycle assistance</a></li><li><a href=\"https://www.axa.be/nl/netwerk/erkende-garages\">Partner garages</a></li><li><a href=\"https://www.axa.be/nl/particulieren/services/fixico\">Vehicle repair when not covered (Fixico)</a></li></ul>",
          "Feature Title": "What to do in case of an accident or collision?",
          "Feature Link": { text: "What to do in case of an accident or collision?", url: "https://www.axa.be/nl/particulieren/services/schadegeval-auto/auto-ongeval" },
          "Feature Image": { url: "https://cdn.website.axa.be/-/media/projects/axabe/axabeweb/illustrations/mainnav/all-insurances/img_inform/inform_mobility.svg?savif=1&swebp=1&mh=240&la=nl-BE&h=240&mw=600&w=360&hash=24AD37083717D98759EA3CC09264ED64", alt: "Mobility information" }
        }
      },
      {
        name: "Home",
        fields: {
          Category: "Home",
          "Product Links": "<ul><li><a href=\"https://www.axa.be/nl/particulieren/woning/woonverzekering-brandverzekering\">Home insurance</a></li><li><a href=\"https://www.axa.be/nl/particulieren/woning/blokpolis\">Co-ownership policy</a></li><li><a href=\"https://www.axa.be/nl/particulieren/woning/schuldsaldoverzekering\">Debt balance insurance</a></li></ul>",
          "Service Links": "<ul><li><a href=\"https://www.axa.be/nl/particulieren/services/bijstand/bijstand-woning\">Home assistance</a></li><li><a href=\"https://www.axa.be/nl/particulieren/services/axa-homecare\">Odd jobs and repairs (AXA Homecare)</a></li></ul>",
          "Feature Title": "What to do in case of a storm?",
          "Feature Link": { text: "What to do in case of a storm?", url: "https://www.axa.be/nl/particulieren/services/schadegeval-woning/storm" },
          "Feature Image": { url: "https://cdn.website.axa.be/-/media/projects/axabe/axabeweb/illustrations/mainnav/all-insurances/img_inform/Banner%20card.svg?savif=1&swebp=1&mh=240&la=nl-BE&h=240&mw=600&w=360&hash=7DEDE9CCA60558F5A45F43C1786181BD", alt: "Home information" }
        }
      },
      {
        name: "Family",
        fields: {
          Category: "Family",
          "Product Links": "<ul><li><a href=\"https://www.axa.be/nl/particulieren/gezin/familiale-verzekering\">Family insurance</a></li><li><a href=\"https://www.axa.be/nl/particulieren/gezin/ongevallenverzekering-priveleven\">Accidents in private life</a></li><li><a href=\"https://www.axa.be/nl/particulieren/gezin/reisverzekering\">Travel</a></li><li><a href=\"https://www.axa.be/nl/particulieren/gezin/students-travel\">Students Travel</a></li><li><a href=\"https://www.axa.be/nl/particulieren/gezin/dierenverzekering\">Pets</a></li><li><a href=\"https://www.axa.be/nl/particulieren/gezin/bootverzekering\">Boat</a></li><li><a href=\"https://www.axa.be/nl/particulieren/gezin/evenementenverzekering\">Events</a></li></ul>",
          "Service Links": "<ul><li><a href=\"https://www.axa.be/nl/particulieren/services/bijstand/bijstand-reis\">Travel assistance</a></li></ul>",
          "Feature Title": "Travel insurance in Belgium or abroad",
          "Feature Link": { text: "Travel insurance in Belgium or abroad", url: "https://www.axa.be/nl/blog/gezin/reisverzekering-belgie-en-buitenland" },
          "Feature Image": { url: "https://cdn.website.axa.be/-/media/projects/axabe/axabeweb/banner-images/blog/testimonial%20travel.jpg?rev=2b0080a879264f1a8b7dce8c12d7935c&savif=1&swebp=1&ch=240&cx=0.32&la=nl-BE&cy=0.46&cw=600&hash=B6C0A53A15D04CABF0D55BECC1A01D68", alt: "Thanks to suitable travel insurance, a man plays relaxed with his child on the beach." }
        }
      },
      {
        name: "Health",
        fields: {
          Category: "Health",
          "Product Links": "<ul><li><a href=\"https://www.axa.be/nl/particulieren/gezondheid/gezondheidsverzekering\">Health insurance</a></li><li><a href=\"https://www.axa.be/nl/particulieren/gezondheid/arbeidsongevallen\">Workplace accidents</a></li><li><a href=\"https://www.axa.be/nl/particulieren/gezondheid/arbeidsongeschiktheid\">Incapacity for work</a></li></ul>",
          "Service Links": "<ul><li><a href=\"https://www.axa.be/nl/particulieren/gezondheid/gezondheidsverzekering/doctors-online\">Online doctor consultation (Doctors Online)</a></li><li><a href=\"https://www.axa.be/nl/particulieren/gezondheid/gezondheidsverzekering/tweede-medisch-advies\">Second medical opinion</a></li><li><a href=\"https://www.axa.be/nl/particulieren/gezondheid/gezondheidsverzekering/doctena\">Doctor appointment (Doctena)</a></li><li><a href=\"https://www.axa.be/nl/particulieren/gezondheid/gezondheidsverzekering/symptomzoom\">Analyze your symptoms online (SymptomZoom)</a></li></ul>"
        }
      }
    ]
  }
} satisfies ComponentTemplateDefinition;
