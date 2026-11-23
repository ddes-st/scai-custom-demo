import type { SitePresentationDefinition } from "../../../tools/definitions/types";

/**
 * Presentation wiring for site "axa-be" (create:sectioncomponents).
 * Emitted by definitions:generate — do not hand-edit YAML.
 */
export const axabePresentation = {
  kind: "site-presentation",
  definitionKey: "axa-be-presentation",
  siteSystem: "axa-be",
  collectionSystem: "axa",
  cultures: ["nl-BE","fr-BE"],
  availableRenderings: {
  "Page Content": [
    "axa-editorial-hero-banner",
    "axa-insurance-category-card",
    "axa-insurance-category-cards",
    "axa-assistance-callout",
    "axa-proof-point-stats",
    "axa-sustainability-pillar-card",
    "axa-sustainability-pillars",
    "axa-global-statistic",
    "axa-global-network-stats",
    "axa-newsroom-quote",
    "axa-recommendation-card",
    "axa-recommendation-cards",
    "axa-broker-callout",
    "axa-insurance-category",
    "axa-insurance-catalog"
  ],
  "Navigation": [
    "axa-navigation",
    "axa-header",
    "axa-footer-column",
    "axa-social-links",
    "axa-footer"
  ],
  "Page Structure": [
    "axa-consent-banner"
  ]
},
  partialDesigns: [
  {
    "signature": "cookie",
    "placeholder": "headless-cookie",
    "definitionKey": "axa-consent-banner"
  },
  {
    "signature": "header",
    "placeholder": "headless-header",
    "definitionKey": "axa-header"
  },
  {
    "signature": "footer",
    "placeholder": "headless-footer",
    "definitionKey": "axa-footer",
    "children": [
      {
        "definitionKey": "axa-footer-column",
        "datasourceItem": "AXA"
      },
      {
        "definitionKey": "axa-footer-column",
        "datasourceItem": "Important Information"
      },
      {
        "definitionKey": "axa-footer-column",
        "datasourceItem": "Contact Us"
      },
      {
        "definitionKey": "axa-social-links",
        "datasourceItem": "Follow Us"
      }
    ]
  }
],
  pages: {
    home: {
      renderings: [
  {
    "definitionKey": "axa-editorial-hero-banner",
    "placeholder": "headless-main"
  },
  {
    "definitionKey": "axa-insurance-category-cards",
    "placeholder": "headless-main",
    "children": [
      {
        "definitionKey": "axa-insurance-category-card",
        "datasourceItem": "Home",
        "variant": "Promo"
      },
      {
        "definitionKey": "axa-insurance-category-card",
        "datasourceItem": "Auto",
        "variant": "Promo"
      },
      {
        "definitionKey": "axa-insurance-category-card",
        "datasourceItem": "Travel"
      },
      {
        "definitionKey": "axa-insurance-category-card",
        "datasourceItem": "Pension"
      },
      {
        "definitionKey": "axa-insurance-category-card",
        "datasourceItem": "Family"
      },
      {
        "definitionKey": "axa-insurance-category-card",
        "datasourceItem": "Bicycles E Scooters And More"
      },
      {
        "definitionKey": "axa-insurance-category-card",
        "datasourceItem": "Investments"
      },
      {
        "definitionKey": "axa-insurance-category-card",
        "datasourceItem": "View All Products",
        "variant": "Teaser"
      }
    ]
  },
  {
    "definitionKey": "axa-assistance-callout",
    "placeholder": "headless-main"
  },
  {
    "definitionKey": "axa-proof-point-stats",
    "placeholder": "headless-main"
  },
  {
    "definitionKey": "axa-sustainability-pillars",
    "placeholder": "headless-main",
    "children": [
      {
        "definitionKey": "axa-sustainability-pillar-card",
        "datasourceItem": "Climate Change And Mobility"
      },
      {
        "definitionKey": "axa-sustainability-pillar-card",
        "datasourceItem": "Health And Disease Prevention"
      },
      {
        "definitionKey": "axa-sustainability-pillar-card",
        "datasourceItem": "Social Inclusion"
      }
    ]
  },
  {
    "definitionKey": "axa-global-network-stats",
    "placeholder": "headless-main",
    "children": [
      {
        "definitionKey": "axa-global-statistic",
        "datasourceItem": "Worldwide Customers"
      },
      {
        "definitionKey": "axa-global-statistic",
        "datasourceItem": "Countries"
      },
      {
        "definitionKey": "axa-global-statistic",
        "datasourceItem": "Employees"
      }
    ]
  },
  {
    "definitionKey": "axa-newsroom-quote",
    "placeholder": "headless-main"
  },
  {
    "definitionKey": "axa-recommendation-cards",
    "placeholder": "headless-main",
    "children": [
      {
        "definitionKey": "axa-recommendation-card",
        "datasourceItem": "Customer Reviews"
      },
      {
        "definitionKey": "axa-recommendation-card",
        "datasourceItem": "MyAXA Fidelity"
      }
    ]
  },
  {
    "definitionKey": "axa-broker-callout",
    "placeholder": "headless-main"
  },
  {
    "definitionKey": "axa-insurance-catalog",
    "placeholder": "headless-main",
    "children": [
      {
        "definitionKey": "axa-insurance-category",
        "datasourceItem": "Mobility"
      },
      {
        "definitionKey": "axa-insurance-category",
        "datasourceItem": "Home"
      },
      {
        "definitionKey": "axa-insurance-category",
        "datasourceItem": "Family"
      },
      {
        "definitionKey": "axa-insurance-category",
        "datasourceItem": "Health"
      },
      {
        "definitionKey": "axa-insurance-category",
        "datasourceItem": "Pension"
      },
      {
        "definitionKey": "axa-insurance-category",
        "datasourceItem": "Investments"
      }
    ]
  }
],
    },
  },
} satisfies SitePresentationDefinition;
