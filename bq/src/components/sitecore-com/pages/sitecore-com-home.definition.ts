import type { PageDefinition } from "../../../../tools/definitions/types";

/** Page / (sitecore-com) — create:sectioncomponents */
export const sitecoreComHome = {
  kind: "page",
  definitionKey: "sitecore-com-home",
  name: "home",
  routePath: "/",
  siteSystem: "sitecore-com",
  collectionSystem: "sitecore",
  navigationTitle: "home",
  culture: "en",
  renderings: [
  {
    "definitionKey": "sitecore-ai-assisted-hero-banner",
    "placeholder": "headless-main",
    "role": "page",
    "datasourceItem": "AI Assisted Hero Banner"
  },
  {
    "definitionKey": "sitecore-platform-capabilities-carousel",
    "placeholder": "headless-main",
    "role": "page",
    "children": [
      {
        "definitionKey": "sitecore-platform-capability-tile",
        "datasourceItem": "AI Search",
        "placeholder": "capability-cards"
      },
      {
        "definitionKey": "sitecore-platform-capability-tile",
        "datasourceItem": "AI And Agents",
        "placeholder": "capability-cards"
      },
      {
        "definitionKey": "sitecore-platform-capability-tile",
        "datasourceItem": "Digital Asset Management",
        "placeholder": "capability-cards"
      },
      {
        "definitionKey": "sitecore-platform-capability-tile",
        "datasourceItem": "Content Management System",
        "placeholder": "capability-cards"
      },
      {
        "definitionKey": "sitecore-platform-capability-tile",
        "datasourceItem": "Content Operations",
        "placeholder": "capability-cards"
      },
      {
        "definitionKey": "sitecore-platform-capability-tile",
        "datasourceItem": "Audience And Insights",
        "placeholder": "capability-cards"
      },
      {
        "definitionKey": "sitecore-platform-capability-tile",
        "datasourceItem": "Conversion Optimization",
        "placeholder": "capability-cards"
      }
    ],
    "datasourceItem": "Platform Capabilities Carousel"
  },
  {
    "definitionKey": "sitecore-awards-logo-carousel",
    "placeholder": "headless-main",
    "role": "page",
    "children": [
      {
        "definitionKey": "sitecore-recognition-badge-item",
        "datasourceItem": "TrustRadius 2026 Buyer's Choice Badge",
        "placeholder": "badge-items"
      },
      {
        "definitionKey": "sitecore-recognition-badge-item",
        "datasourceItem": "CMS Critic Awards 2025 Best Enterprise Badge",
        "placeholder": "badge-items"
      },
      {
        "definitionKey": "sitecore-recognition-badge-item",
        "datasourceItem": "G2 Fall 2026 - Momentum Leader",
        "placeholder": "badge-items"
      },
      {
        "definitionKey": "sitecore-recognition-badge-item",
        "datasourceItem": "G2 Fall 2026 - Best Results Enterprise",
        "placeholder": "badge-items"
      },
      {
        "definitionKey": "sitecore-recognition-badge-item",
        "datasourceItem": "CMS Critic Awards 2025 Best AI Badge",
        "placeholder": "badge-items"
      },
      {
        "definitionKey": "sitecore-recognition-badge-item",
        "datasourceItem": "TrustRadius Fall 2026 Tech Cares Badge",
        "placeholder": "badge-items"
      },
      {
        "definitionKey": "sitecore-recognition-badge-item",
        "datasourceItem": "G2 Fall 2026 - Best Relationship Enterprise",
        "placeholder": "badge-items"
      },
      {
        "definitionKey": "sitecore-recognition-badge-item",
        "datasourceItem": "CMS Critic Awards 2025 Best CDP Badge",
        "placeholder": "badge-items"
      },
      {
        "definitionKey": "sitecore-recognition-badge-item",
        "datasourceItem": "G2 Fall 2026 - Best Usability Enterprise",
        "placeholder": "badge-items"
      },
      {
        "definitionKey": "sitecore-recognition-badge-item",
        "datasourceItem": "CMS Critic Awards 2025 Best DAM Badge",
        "placeholder": "badge-items"
      },
      {
        "definitionKey": "sitecore-recognition-badge-item",
        "datasourceItem": "G2 Fall 2026 - Leader",
        "placeholder": "badge-items"
      },
      {
        "definitionKey": "sitecore-recognition-badge-item",
        "datasourceItem": "CMS Critic Awards 2025 Best DXP Badge",
        "placeholder": "badge-items"
      },
      {
        "definitionKey": "sitecore-recognition-badge-item",
        "datasourceItem": "G2 2026 - Users Love Us",
        "placeholder": "badge-items"
      },
      {
        "definitionKey": "sitecore-recognition-badge-item",
        "datasourceItem": "TrustRadius 2025 Top Rated Badge",
        "placeholder": "badge-items"
      },
      {
        "definitionKey": "sitecore-recognition-badge-item",
        "datasourceItem": "CMS Critic Awards 2025 Best Headless CMS Badge",
        "placeholder": "badge-items"
      }
    ],
    "datasourceItem": "Recognition Badge Carousel"
  },
  {
    "definitionKey": "sitecore-scrunch-ai-visibility-media",
    "placeholder": "headless-main",
    "role": "page",
    "datasourceItem": "Scrunch AI Visibility Video CTA"
  },
  {
    "definitionKey": "sitecore-transform-marketing-tiles",
    "placeholder": "headless-main",
    "role": "page",
    "children": [
      {
        "definitionKey": "sitecore-trusted-answer-card",
        "datasourceItem": "Be Unmistakable",
        "placeholder": "trusted-answer-cards"
      },
      {
        "definitionKey": "sitecore-trusted-answer-card",
        "datasourceItem": "A Thriving Network of Innovators",
        "placeholder": "trusted-answer-cards"
      },
      {
        "definitionKey": "sitecore-trusted-answer-card",
        "datasourceItem": "Stay in Control",
        "placeholder": "trusted-answer-cards"
      }
    ],
    "datasourceItem": "Trusted Answer Cards"
  },
  {
    "definitionKey": "sitecore-events-webinars-carousel",
    "placeholder": "headless-main",
    "role": "page"
  },
  {
    "definitionKey": "sitecore-customer-stories-media-slider",
    "placeholder": "headless-main",
    "role": "page"
  },
  {
    "definitionKey": "sitecore-analyst-recognition-reports",
    "placeholder": "headless-main",
    "role": "page",
    "children": [
      {
        "definitionKey": "sitecore-analyst-recognition-report-card",
        "datasourceItem": "Gartner Magic Quadrant Report",
        "placeholder": "report-cards"
      },
      {
        "definitionKey": "sitecore-analyst-recognition-report-card",
        "datasourceItem": "Forrester Wave Report",
        "placeholder": "report-cards"
      }
    ],
    "datasourceItem": "Analyst Recognition Reports"
  },
  {
    "definitionKey": "sitecore-ai-visibility-snapshot-cta",
    "placeholder": "headless-main",
    "role": "page",
    "datasourceItem": "AI Visibility Snapshot CTA"
  }
],
} satisfies PageDefinition;
