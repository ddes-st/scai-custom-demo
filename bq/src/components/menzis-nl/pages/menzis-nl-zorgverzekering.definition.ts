import type { PageDefinition } from "../../../../tools/definitions/types";

/** Page /zorgverzekering (menzis-nl) — create:sectioncomponents */
export const menzisNlZorgverzekering = {
  kind: "page",
  definitionKey: "menzis-nl-zorgverzekering",
  name: "Zorgverzekering",
  routePath: "/zorgverzekering",
  siteSystem: "menzis-nl",
  collectionSystem: "menzis",
  navigationTitle: "Zorgverzekering",
  culture: "en",
  renderings: [
  {
    "definitionKey": "menzis-introduction-hero",
    "placeholder": "headless-main",
    "role": "page",
    "datasourceItem": "Introduction Hero"
  },
  {
    "definitionKey": "menzis-support-and-health-content",
    "placeholder": "headless-main",
    "role": "page",
    "children": [
      {
        "definitionKey": "menzis-support-cards-band",
        "datasourceItem": "Support Cards",
        "placeholder": "support-health-content"
      },
      {
        "definitionKey": "menzis-editorial-content-band",
        "datasourceItem": "Anderzorg becomes Menzis",
        "placeholder": "support-health-content"
      },
      {
        "definitionKey": "menzis-editorial-content-band",
        "datasourceItem": "Then Menzis",
        "placeholder": "support-health-content"
      },
      {
        "definitionKey": "menzis-editorial-content-band",
        "datasourceItem": "Personal Contact",
        "placeholder": "support-health-content"
      },
      {
        "definitionKey": "menzis-health-cards-band",
        "datasourceItem": "More Health",
        "placeholder": "support-health-content"
      },
      {
        "definitionKey": "menzis-editorial-content-band",
        "datasourceItem": "Medicine Shortages",
        "placeholder": "support-health-content"
      },
      {
        "definitionKey": "menzis-editorial-content-band",
        "datasourceItem": "Waiting List Mediation",
        "placeholder": "support-health-content"
      },
      {
        "definitionKey": "menzis-app-information-band",
        "datasourceItem": "Menzis App",
        "placeholder": "support-health-content"
      },
      {
        "definitionKey": "menzis-information-band",
        "datasourceItem": "Care Budgets",
        "placeholder": "support-health-content"
      },
      {
        "definitionKey": "menzis-reasons-band",
        "datasourceItem": "Why Choose Menzis",
        "placeholder": "support-health-content"
      }
    ],
    "datasourceItem": "Support Health Content"
  }
],
} satisfies PageDefinition;
