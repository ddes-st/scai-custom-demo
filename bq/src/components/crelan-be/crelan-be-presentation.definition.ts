import type { SitePresentationDefinition } from "../../../tools/definitions/types";

/**
 * Presentation wiring for site "crelan-be" (create:sectioncomponents).
 * Available renderings + partial designs only — page layouts are kind: "page" under pages/.
 * Emitted by definitions:generate — do not hand-edit YAML.
 */
export const crelanbePresentation = {
  kind: "site-presentation",
  definitionKey: "crelan-be-presentation",
  siteSystem: "crelan-be",
  collectionSystem: "crelan",
  availableRenderings: {
  "Page Content": [
    "crelan-cookie-preference-category",
    "crelan-cookie-consent-preferences",
    "crelan-image-hero-promotion-card",
    "crelan-image-hero-promotions",
    "crelan-navigation-card",
    "crelan-usp-item",
    "crelan-navigation-and-office-finder"
  ],
  "Navigation": [
    "crelan-site-header",
    "crelan-footer-column",
    "crelan-footer-links"
  ],
  "Page Structure": []
},
  partialDesigns: [
  {
    "signature": "header",
    "placeholder": "headless-header",
    "definitionKey": "crelan-site-header",
    "canHostChildren": false,
    "sectionIndex": 2,
    "datasourceItem": "Site Header"
  },
  {
    "signature": "footer",
    "placeholder": "headless-footer",
    "definitionKey": "crelan-footer-links",
    "canHostChildren": true,
    "children": [
      {
        "definitionKey": "crelan-footer-column",
        "datasourceItem": "Thema's",
        "placeholder": "footer-columns"
      },
      {
        "definitionKey": "crelan-footer-column",
        "datasourceItem": "Ons aanbod",
        "placeholder": "footer-columns"
      },
      {
        "definitionKey": "crelan-footer-column",
        "datasourceItem": "Directe links",
        "placeholder": "footer-columns"
      },
      {
        "definitionKey": "crelan-footer-column",
        "datasourceItem": "Contacteer ons",
        "placeholder": "footer-columns"
      }
    ],
    "datasourceItem": "Footer Links"
  }
],
} satisfies SitePresentationDefinition;
