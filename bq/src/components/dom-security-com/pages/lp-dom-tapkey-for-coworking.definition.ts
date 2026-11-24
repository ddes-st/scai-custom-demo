import type { PageDefinition } from "../../../../tools/definitions/types";
import { landingPageTemplate } from "./landing-page-template.util";

/**
 * Same empty Landing Page template as Access Control, with a different
 * pre-composed page design (hero, steps, platform grid).
 */
export const lpDomTapkeyForCoworking = {
  kind: "page",
  definitionKey: "lp-dom-tapkey-for-coworking",
  name: "DOM Tapkey for Coworking",
  routePath: "/lp/dom-tapkey-for-coworking",
  siteSystem: "domsecurity-com",
  collectionSystem: "domsecurity",
  navigationTitle: "Coworking avec DOM Tapkey",
  culture: "en",
  cultures: ["nl-BE", "fr-BE"],
  pageTemplate: landingPageTemplate,
  fields: {
    Title: "Coworking avec DOM Tapkey",
  },
  renderings: [
    {
      definitionKey: "dom-security-landing-band",
      placeholder: "headless-main",
      variant: "Hero",
      datasourceItem: "Coworking Hero",
    },
    {
      definitionKey: "dom-security-landing-band",
      placeholder: "headless-main",
      datasourceItem: "Coworking Intro",
    },
    {
      definitionKey: "dom-security-landing-band",
      placeholder: "headless-main",
      variant: "CardGrid",
      datasourceItem: "Coworking Benefits",
      children: [
        { definitionKey: "dom-security-landing-card", datasourceItem: "Smooth Mobile Access" },
        { definitionKey: "dom-security-landing-card", datasourceItem: "Realtime Access Control" },
        { definitionKey: "dom-security-landing-card", datasourceItem: "Automated Access" },
      ],
    },
    {
      definitionKey: "dom-security-landing-band",
      placeholder: "headless-main",
      variant: "Steps",
      datasourceItem: "Coworking Steps",
      children: [
        { definitionKey: "dom-security-landing-card", datasourceItem: "Step Connect" },
        { definitionKey: "dom-security-landing-card", datasourceItem: "Step Reserve" },
        { definitionKey: "dom-security-landing-card", datasourceItem: "Step Unlock" },
      ],
    },
    {
      definitionKey: "dom-security-landing-band",
      placeholder: "headless-main",
      variant: "Cta",
      datasourceItem: "Coworking Demo",
    },
    {
      definitionKey: "dom-security-landing-band",
      placeholder: "headless-main",
      variant: "CardGrid",
      datasourceItem: "Coworking Platforms",
      children: [
        { definitionKey: "dom-security-landing-card", datasourceItem: "Google Calendar" },
        { definitionKey: "dom-security-landing-card", datasourceItem: "Nexudus" },
        { definitionKey: "dom-security-landing-card", datasourceItem: "Cobot" },
        { definitionKey: "dom-security-landing-card", datasourceItem: "Clock PMS" },
        { definitionKey: "dom-security-landing-card", datasourceItem: "RoomRaccoon" },
        { definitionKey: "dom-security-landing-card", datasourceItem: "Archie" },
        { definitionKey: "dom-security-landing-card", datasourceItem: "Spacebring" },
        { definitionKey: "dom-security-landing-card", datasourceItem: "Mews" },
        { definitionKey: "dom-security-landing-card", datasourceItem: "More Integrations" },
      ],
    },
    {
      definitionKey: "dom-security-contact-information-section",
      placeholder: "headless-main",
      datasourceItem: "Dom Metalux Contact",
    },
  ],
} satisfies PageDefinition;
