import type { PageDefinition } from "../../../../tools/definitions/types";
import { landingPageTemplate } from "./landing-page-template.util";

/** Built by stacking Landing Band components on the empty Landing Page template. */
export const lpAccessControl = {
  kind: "page",
  definitionKey: "lp-access-control",
  name: "Access Control",
  routePath: "/lp/access-control",
  siteSystem: "domsecurity-com",
  collectionSystem: "domsecurity",
  navigationTitle: "Contrôle d'accès : Un verrouillage connecté qui s'adapte à vous",
  culture: "en",
  cultures: ["nl-BE", "fr-BE"],
  pageTemplate: landingPageTemplate,
  fields: {
    Title: "Contrôle d'accès : Un verrouillage connecté qui s'adapte à vous",
  },
  renderings: [
    {
      definitionKey: "dom-security-landing-band",
      placeholder: "headless-main",
      variant: "Hero",
      datasourceItem: "Access Control Hero",
    },
    {
      definitionKey: "dom-security-landing-band",
      placeholder: "headless-main",
      datasourceItem: "Access Control Intro",
    },
    {
      definitionKey: "dom-security-landing-band",
      placeholder: "headless-main",
      variant: "CardGrid",
      datasourceItem: "Access Control Benefits",
      children: [
        { definitionKey: "dom-security-landing-card", datasourceItem: "Access History" },
        { definitionKey: "dom-security-landing-card", datasourceItem: "Flexible Permissions" },
        { definitionKey: "dom-security-landing-card", datasourceItem: "High Security Encryption" },
        { definitionKey: "dom-security-landing-card", datasourceItem: "Minimal Risk" },
      ],
    },
    {
      definitionKey: "dom-security-landing-band",
      placeholder: "headless-main",
      variant: "CardGrid",
      datasourceItem: "Access Control Manage",
      children: [
        { definitionKey: "dom-security-landing-card", datasourceItem: "Eniq Software Option" },
        { definitionKey: "dom-security-landing-card", datasourceItem: "Eniq App Option" },
        { definitionKey: "dom-security-landing-card", datasourceItem: "Dom Tapkey Option" },
      ],
    },
    {
      definitionKey: "dom-security-landing-band",
      placeholder: "headless-main",
      datasourceItem: "Access Control Compare",
    },
    {
      definitionKey: "dom-security-landing-band",
      placeholder: "headless-main",
      variant: "Cta",
      datasourceItem: "Access Control Chooser",
    },
    {
      definitionKey: "dom-security-landing-band",
      placeholder: "headless-main",
      variant: "Cta",
      datasourceItem: "Access Control Brochure",
    },
    {
      definitionKey: "dom-security-contact-information-section",
      placeholder: "headless-main",
      datasourceItem: "Dom Metalux Contact",
    },
  ],
} satisfies PageDefinition;
