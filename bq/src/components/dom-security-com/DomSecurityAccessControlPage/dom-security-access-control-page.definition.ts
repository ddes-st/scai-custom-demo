import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const accessControlPageDefinition = {
  kind: "component",
  definitionKey: "dom-security-access-control-page",
  name: "dom-security-access-control-page",
  displayName: "Access Control Page",
  componentName: "DomSecurityAccessControlPage",
  icon: "Office/32x32/layout.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Access Control Pages"],
  },
  model: {
    folderTemplate: { name: "Access Control Page Folder" },
    itemTemplate: {
      name: "Access Control Page",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [
    { key: "access-hero", allowedControls: ["dom-security-landing-band"] },
    { key: "access-intro", allowedControls: ["dom-security-landing-band"] },
    { key: "access-icons", allowedControls: ["dom-security-landing-band"] },
    { key: "access-benefits", allowedControls: ["dom-security-landing-band"] },
    { key: "access-logos", allowedControls: ["dom-security-landing-band"] },
    { key: "access-manage", allowedControls: ["dom-security-landing-band"] },
    { key: "access-compare", allowedControls: ["dom-security-landing-band"] },
    { key: "access-chooser", allowedControls: ["dom-security-landing-band"] },
    { key: "access-integrate", allowedControls: ["dom-security-landing-band"] },
    { key: "access-products", allowedControls: ["dom-security-landing-band"] },
    { key: "access-brochure", allowedControls: ["dom-security-landing-band"] },
    { key: "access-contact", allowedControls: ["dom-security-contact-information-section"] },
  ],
} satisfies ComponentTemplateDefinition;
