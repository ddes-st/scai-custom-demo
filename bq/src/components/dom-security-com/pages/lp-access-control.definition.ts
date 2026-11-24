import type { PageDefinition } from "../../../../tools/definitions/types";
import { landingPageTemplate } from "./landing-page-template.util";

/**
 * One Access Control Page rendering. Each section is a Landing Band variant
 * (same Title / Body / Image / Link / cards schema) except the contact block,
 * which reuses Contact Information Section.
 */
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
      definitionKey: "dom-security-access-control-page",
      placeholder: "headless-main",
      children: [
        {
          definitionKey: "dom-security-landing-band",
          placeholder: "access-hero",
          variant: "FullscreenHero",
          renderingIdentifier: "access-hero",
          datasourceItem: "Access Control Hero",
        },
        {
          definitionKey: "dom-security-landing-band",
          placeholder: "access-intro",
          variant: "SplitCopy",
          renderingIdentifier: "access-intro",
          datasourceItem: "Access Control Intro",
        },
        {
          definitionKey: "dom-security-landing-band",
          placeholder: "access-icons",
          variant: "IconRow",
          renderingIdentifier: "access-icons",
          datasourceItem: "Access Control Icons",
          children: [
            { definitionKey: "dom-security-landing-card", datasourceItem: "Icon Performance" },
            { definitionKey: "dom-security-landing-card", datasourceItem: "Icon Cyber" },
            { definitionKey: "dom-security-landing-card", datasourceItem: "Icon Hardware" },
            { definitionKey: "dom-security-landing-card", datasourceItem: "Icon Design" },
          ],
        },
        {
          definitionKey: "dom-security-landing-band",
          placeholder: "access-benefits",
          variant: "Zigzag",
          renderingIdentifier: "access-benefits",
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
          placeholder: "access-logos",
          variant: "LogoStrip",
          renderingIdentifier: "access-logos",
          datasourceItem: "Access Control Logos",
          children: [
            { definitionKey: "dom-security-landing-card", datasourceItem: "Logo France Tv" },
            { definitionKey: "dom-security-landing-card", datasourceItem: "Logo Chu" },
            { definitionKey: "dom-security-landing-card", datasourceItem: "Logo Framatome" },
            { definitionKey: "dom-security-landing-card", datasourceItem: "Logo Port Rochelle" },
            { definitionKey: "dom-security-landing-card", datasourceItem: "Logo Ratp" },
            { definitionKey: "dom-security-landing-card", datasourceItem: "Logo Total" },
          ],
        },
        {
          definitionKey: "dom-security-landing-band",
          placeholder: "access-manage",
          variant: "OptionRow",
          renderingIdentifier: "access-manage",
          datasourceItem: "Access Control Manage",
          children: [
            { definitionKey: "dom-security-landing-card", datasourceItem: "Eniq Software Option" },
            { definitionKey: "dom-security-landing-card", datasourceItem: "Eniq App Option" },
            { definitionKey: "dom-security-landing-card", datasourceItem: "Dom Tapkey Option" },
          ],
        },
        {
          definitionKey: "dom-security-landing-band",
          placeholder: "access-compare",
          variant: "Comparison",
          renderingIdentifier: "access-compare",
          datasourceItem: "Access Control Compare",
        },
        {
          definitionKey: "dom-security-landing-band",
          placeholder: "access-chooser",
          variant: "OverlayCta",
          renderingIdentifier: "access-chooser",
          datasourceItem: "Access Control Chooser",
        },
        {
          definitionKey: "dom-security-landing-band",
          placeholder: "access-integrate",
          variant: "MediaSplit",
          renderingIdentifier: "access-integrate",
          datasourceItem: "Access Control Integrate",
        },
        {
          definitionKey: "dom-security-landing-band",
          placeholder: "access-products",
          variant: "ProductCards",
          renderingIdentifier: "access-products",
          datasourceItem: "Access Control Products",
          children: [
            { definitionKey: "dom-security-landing-card", datasourceItem: "Product Guard" },
            { definitionKey: "dom-security-landing-card", datasourceItem: "Product Pro" },
            { definitionKey: "dom-security-landing-card", datasourceItem: "Product Loq" },
            { definitionKey: "dom-security-landing-card", datasourceItem: "Product Wallreader" },
          ],
        },
        {
          definitionKey: "dom-security-landing-band",
          placeholder: "access-brochure",
          variant: "Brochure",
          renderingIdentifier: "access-brochure",
          datasourceItem: "Access Control Brochure",
        },
        {
          definitionKey: "dom-security-contact-information-section",
          placeholder: "access-contact",
          renderingIdentifier: "contact",
          datasourceItem: "Dom Metalux Contact",
        },
      ],
    },
  ],
} satisfies PageDefinition;
