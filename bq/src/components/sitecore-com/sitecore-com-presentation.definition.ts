import type { SitePresentationDefinition } from "../../../tools/definitions/types";

/**
 * Presentation wiring for site "sitecore-com" (create:sectioncomponents).
 * Available renderings + partial designs only — page layouts are kind: "page" under pages/.
 * Emitted by definitions:generate — do not hand-edit YAML.
 */
export const sitecorecomPresentation = {
  kind: "site-presentation",
  definitionKey: "sitecore-com-presentation",
  siteSystem: "sitecore-com",
  collectionSystem: "sitecore",
  availableRenderings: {
  "Page Content": [
    "sitecore-cookie-consent-category",
    "sitecore-cookie-consent-banner",
    "sitecore-platform-capabilities-carousel",
    "sitecore-awards-logo-carousel",
    "sitecore-scrunch-ai-visibility-media",
    "sitecore-transform-marketing-tiles",
    "sitecore-events-webinars-carousel",
    "sitecore-customer-story-item",
    "sitecore-customer-stories-media-slider",
    "sitecore-analyst-recognition-reports",
    "sitecore-ai-visibility-snapshot-cta",
    "sitecore-cookie-consent-preferences",
    "sitecore-product-wide-video-hero",
    "sitecore-customer-logo-marquee",
    "sitecore-workflow-ai-cards-carousel",
    "sitecore-platform-capability-explorer",
    "sitecore-studio-extensibility-tabs",
    "sitecore-customer-story-card",
    "sitecore-built-by-you-customer-stories-carousel",
    "sitecore-analyst-recognition-signposts",
    "sitecore-frequently-asked-question-item",
    "sitecore-frequently-asked-questions-accordion",
    "sitecore-speed-of-ambition-demo-cta",
    "sitecore-trusted-answer-card",
    "sitecore-events-webinars-carousel-item",
    "sitecore-analyst-recognition-report-card",
    "sitecore-ai-workflow-card",
    "sitecore-ai-assisted-hero-banner",
    "sitecore-platform-capability-tile",
    "sitecore-recognition-badge-item",
    "sitecore-cookie-preference-toggle",
    "sitecore-customer-logo-item",
    "sitecore-platform-capability-panel",
    "sitecore-studio-extension-tab",
    "sitecore-analyst-recognition-report-signpost"
  ],
  "Navigation": [
    "sitecore-announcement-bar",
    "sitecore-main-navigation",
    "sitecore-footer-signpost-and-legal",
    "sitecore-global-footer-signpost",
    "sitecore-global-footer-link-column",
    "sitecore-global-footer-social-link"
  ],
  "Page Structure": []
},
  partialDesigns: [
  {
    "signature": "header",
    "placeholder": "headless-header",
    "definitionKey": "sitecore-main-navigation",
    "canHostChildren": false,
    "sectionIndex": 3,
    "children": [],
    "siblingsBefore": [
      {
        "definitionKey": "sitecore-announcement-bar",
        "sectionIndex": 2,
        "datasourceItem": "Announcement Marquee"
      }
    ],
    "datasourceItem": "Main Navigation"
  },
  {
    "signature": "footer",
    "placeholder": "headless-footer",
    "definitionKey": "sitecore-footer-signpost-and-legal",
    "canHostChildren": true,
    "children": [
      {
        "definitionKey": "sitecore-global-footer-signpost",
        "datasourceItem": "Explore Use Cases",
        "placeholder": "signposts"
      },
      {
        "definitionKey": "sitecore-global-footer-signpost",
        "datasourceItem": "Learn With Sitecore",
        "placeholder": "signposts"
      },
      {
        "definitionKey": "sitecore-global-footer-signpost",
        "datasourceItem": "Expert Guides And Reports",
        "placeholder": "signposts"
      },
      {
        "definitionKey": "sitecore-global-footer-signpost",
        "datasourceItem": "Sitecore Symposium 2026",
        "placeholder": "signposts"
      },
      {
        "definitionKey": "sitecore-global-footer-link-column",
        "datasourceItem": "Platform",
        "placeholder": "link-columns"
      },
      {
        "definitionKey": "sitecore-global-footer-link-column",
        "datasourceItem": "Solutions",
        "placeholder": "link-columns"
      },
      {
        "definitionKey": "sitecore-global-footer-link-column",
        "datasourceItem": "Resources",
        "placeholder": "link-columns"
      },
      {
        "definitionKey": "sitecore-global-footer-link-column",
        "datasourceItem": "Services",
        "placeholder": "link-columns"
      },
      {
        "definitionKey": "sitecore-global-footer-link-column",
        "datasourceItem": "Company",
        "placeholder": "link-columns"
      },
      {
        "definitionKey": "sitecore-global-footer-social-link",
        "datasourceItem": "Email",
        "placeholder": "social-links"
      },
      {
        "definitionKey": "sitecore-global-footer-social-link",
        "datasourceItem": "LinkedIn",
        "placeholder": "social-links"
      },
      {
        "definitionKey": "sitecore-global-footer-social-link",
        "datasourceItem": "X",
        "placeholder": "social-links"
      },
      {
        "definitionKey": "sitecore-global-footer-social-link",
        "datasourceItem": "Facebook",
        "placeholder": "social-links"
      },
      {
        "definitionKey": "sitecore-global-footer-social-link",
        "datasourceItem": "Instagram",
        "placeholder": "social-links"
      },
      {
        "definitionKey": "sitecore-global-footer-social-link",
        "datasourceItem": "YouTube",
        "placeholder": "social-links"
      }
    ],
    "datasourceItem": "Global Footer Signposts"
  }
],
} satisfies SitePresentationDefinition;
