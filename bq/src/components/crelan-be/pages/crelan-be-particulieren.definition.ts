import type { PageDefinition } from "../../../../tools/definitions/types";

/** Page /particulieren (crelan-be) — create:sectioncomponents */
export const crelanBeParticulieren = {
  kind: "page",
  definitionKey: "crelan-be-particulieren",
  name: "Particulieren",
  routePath: "/particulieren",
  siteSystem: "crelan-be",
  collectionSystem: "crelan",
  navigationTitle: "Particulieren",
  culture: "en",
  renderings: [
  {
    "definitionKey": "crelan-image-hero-promotions",
    "placeholder": "headless-main",
    "role": "page",
    "children": [
      {
        "definitionKey": "crelan-image-hero-promotion-card",
        "datasourceItem": "Promotion Card 2010",
        "placeholder": "hero-cards"
      },
      {
        "definitionKey": "crelan-image-hero-promotion-card",
        "datasourceItem": "Promotion Card 2026",
        "placeholder": "hero-cards"
      }
    ],
    "datasourceItem": "Image Hero Promotions"
  },
  {
    "definitionKey": "crelan-navigation-and-office-finder",
    "placeholder": "headless-main",
    "role": "page",
    "children": [
      {
        "definitionKey": "crelan-navigation-card",
        "datasourceItem": "Zichtrekeningen",
        "placeholder": "navigation-cards"
      },
      {
        "definitionKey": "crelan-navigation-card",
        "datasourceItem": "Spaarrekeningen",
        "placeholder": "navigation-cards"
      },
      {
        "definitionKey": "crelan-navigation-card",
        "datasourceItem": "Starten met beleggen",
        "placeholder": "navigation-cards"
      },
      {
        "definitionKey": "crelan-navigation-card",
        "datasourceItem": "Beleggingsadvies",
        "placeholder": "navigation-cards"
      },
      {
        "definitionKey": "crelan-navigation-card",
        "datasourceItem": "Hypothecaire lening",
        "placeholder": "navigation-cards"
      },
      {
        "definitionKey": "crelan-navigation-card",
        "datasourceItem": "Renovatielening",
        "placeholder": "navigation-cards"
      },
      {
        "definitionKey": "crelan-navigation-card",
        "datasourceItem": "Autolening",
        "placeholder": "navigation-cards"
      },
      {
        "definitionKey": "crelan-navigation-card",
        "datasourceItem": "Persoonlijke lening",
        "placeholder": "navigation-cards"
      },
      {
        "definitionKey": "crelan-usp-item",
        "datasourceItem": "Belgische bank",
        "placeholder": "usp-items"
      },
      {
        "definitionKey": "crelan-usp-item",
        "datasourceItem": "Coöperatieve bank",
        "placeholder": "usp-items"
      },
      {
        "definitionKey": "crelan-usp-item",
        "datasourceItem": "Groot kantorennetwerk",
        "placeholder": "usp-items"
      },
      {
        "definitionKey": "crelan-usp-item",
        "datasourceItem": "Steun aan projecten die ertoe doen",
        "placeholder": "usp-items"
      }
    ],
    "datasourceItem": "Navigation And Office Finder"
  }
],
} satisfies PageDefinition;
