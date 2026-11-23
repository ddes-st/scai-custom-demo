import type { SitePresentationDefinition } from "../../../tools/definitions/types";

/**
 * Presentation wiring for site "menzis-nl" (create:sectioncomponents).
 * Available renderings + partial designs only — page layouts are kind: "page" under pages/.
 * Emitted by definitions:generate — do not hand-edit YAML.
 */
export const menzisnlPresentation = {
  kind: "site-presentation",
  definitionKey: "menzis-nl-presentation",
  siteSystem: "menzis-nl",
  collectionSystem: "menzis",
  availableRenderings: {
  "Page Content": [
    "menzis-cookie-preference-modal",
    "menzis-introduction-hero",
    "menzis-support-and-health-content",
    "menzis-support-feature-card",
    "menzis-footer-support-navigation",
    "menzis-footer-info-links",
    "menzis-cookie-option",
    "menzis-support-cards-band",
    "menzis-editorial-content-band",
    "menzis-health-cards-band",
    "menzis-app-information-band",
    "menzis-information-band",
    "menzis-reasons-band",
    "menzis-footer-help-band",
    "menzis-footer-help-link-list",
    "menzis-footer-legal-link-list"
  ],
  "Navigation": [
    "menzis-global-header",
    "menzis-footer-support-navigation",
    "menzis-footer-info-links",
    "menzis-header-navigation",
    "menzis-global-navigation-context-link-list",
    "menzis-footer-help-band",
    "menzis-footer-help-link-list",
    "menzis-footer-legal-link-list"
  ],
  "Page Structure": []
},
  partialDesigns: [
  {
    "signature": "header",
    "placeholder": "headless-header",
    "definitionKey": "menzis-global-header",
    "canHostChildren": false,
    "sectionIndex": 2,
    "datasourceItem": "Global Header Navigation",
    "children": [],
    "thumbnail": {
      "path": "sections/section-02/section-02-desktop.png"
    }
  },
  {
    "signature": "footer",
    "placeholder": "headless-footer",
    "definitionKey": "menzis-footer-info-links",
    "canHostChildren": true,
    "sectionIndex": 6,
    "children": [
      {
        "definitionKey": "menzis-footer-legal-link-list",
        "datasourceItem": "Footer Legal Links",
        "placeholder": "footer-legal-links",
        "children": []
      }
    ],
    "siblingsBefore": [
      {
        "definitionKey": "menzis-footer-support-navigation",
        "datasourceItem": "Footer Help And Links",
        "sectionIndex": 5,
        "children": [
          {
            "definitionKey": "menzis-footer-help-band",
            "datasourceItem": "Help Band",
            "placeholder": "footer-help-and-links-content",
            "children": []
          },
          {
            "definitionKey": "menzis-footer-help-link-list",
            "datasourceItem": "Snel naar",
            "placeholder": "footer-help-and-links-content",
            "children": []
          },
          {
            "definitionKey": "menzis-footer-help-link-list",
            "datasourceItem": "Mijn Menzis",
            "placeholder": "footer-help-and-links-content",
            "children": []
          }
        ]
      }
    ],
    "datasourceItem": "Footer Legal Links Band",
    "thumbnail": {
      "path": "sections/section-06/section-06-desktop.png"
    }
  }
],
} satisfies SitePresentationDefinition;
