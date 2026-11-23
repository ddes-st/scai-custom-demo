import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const testimonialContactGridDefinition = {
  kind: "component",
  definitionKey: "dom-security-testimonial-contact-grid",
  name: "dom-security-testimonial-contact-grid",
  displayName: "Testimonial Contact Grid",
  componentName: "DomSecurityTestimonialContactGrid",
  icon: "Office/32x32/table.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Testimonial Contact Grids"],
  },
  model: {
    folderTemplate: { name: "Testimonial Contact Grid Folder" },
    itemTemplate: {
      name: "Testimonial Contact Grid",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Testimonial", type: "Rich Text" },
            { name: "Author", type: "Single-Line Text" },
            { name: "Title", type: "Single-Line Text" },
            { name: "Contact Heading", type: "Single-Line Text" },
            { name: "Organization", type: "Single-Line Text" },
            { name: "Phone", type: "General Link" },
            { name: "Availability", type: "Single-Line Text" },
            { name: "Email", type: "General Link" },
            { name: "Organization Logo", type: "Image" },
          ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Testimonial Contact Grids"] },
    culture: "be",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Customer Service",
        displayName: "Customer Service",
        fields: {
          Testimonial: "We have always been very satisfied with DOM products, and still are today. The products offer a very high protection with an excellent price-quality ratio. It is also always a pleasure to work with the Belgian DOM team. They offer an after sales service to be proud of.",
          Author: "Roel Dhallé, R. Janssen & Zn nv",
          Title: "Customer Service",
          "Contact Heading": "Contact information",
          Organization: "HOBERG S.A.",
          Phone: { text: "+ 32 (0) 10 23 22 20", url: "tel:+ 32 (0) 10 23 22 20" },
          Availability: "08:00 - 16:30",
          Email: { text: "dom@hoberg.be", url: "mailto:dom@hoberg.be" },
          "Organization Logo": { url: "https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/DOM-BE/Logo/DOM-Hoberg_web_svg.svg?modified=20240524085418&extension=webp&modified=20240524085418", alt: "HOBERG S.A." }
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
