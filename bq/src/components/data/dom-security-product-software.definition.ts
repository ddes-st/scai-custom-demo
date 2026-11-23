import type { DataDefinition } from "../../../tools/definitions/types";

const cdn = (path: string) =>
  `https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/PimDam/jpg/dom/${path}`;

export const domSecurityProductSoftware = {
  kind: "data",
  definitionKey: "dom-security-product-software-items",
  name: "DomSecurityProductSoftwareItems",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  culture: "en",
  cultures: ["nl-BE", "fr-BE"],
  location: {
    root: "data",
    folder: ["Product Software"],
  },
  model: {
    folderTemplate: {
      name: "Product Software Folder",
      displayName: "Product Software",
    },
    itemTemplate: {
      name: "Product Software",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Title", type: "Single-Line Text" },
            { name: "Summary", type: "Single-Line Text" },
            { name: "Image", type: "Image" },
            { name: "Link", type: "General Link" },
          ],
        },
      ],
    },
  },
  items: [
    {
      name: "ELS Software",
      displayName: "ELS Software",
      fields: {
        Title: "ELS Software",
        Summary:
          "The ELS software manages all access control devices in the ELS world in Data on Card and online operating modes.",
        Image: {
          url: cdn("e/elssoftware/domelssoftware-main-p-p-laptop-els-software.jpg?modified=20210327100211&extension=webp"),
          alt: "ELS Software",
        },
        Link: { text: "Learn more", url: "/products/categories/apps-software" },
      },
    },
    {
      name: "ELS Mobile",
      displayName: "ELS Mobile",
      fields: {
        Title: "ELS Mobile Software",
        Summary:
          "The ELS Mobile Software manages ELS access control devices and accepts 125 kHz RFID media on the go.",
        Image: {
          url: cdn("e/elsmobilesoftware/domelsmobilesoftware-main-p-p-laptop-els-mobile-software.jpg?modified=20210327094253&extension=webp"),
          alt: "ELS Mobile Software",
        },
        Link: { text: "Learn more", url: "/products/categories/apps-software" },
      },
    },
    {
      name: "ENiQ App",
      displayName: "ENiQ App",
      fields: {
        Title: "ENiQ App",
        Summary: "Manage ENiQ access rights and media from your smartphone.",
        Image: {
          url: cdn("e/elsmobilesoftware/domelsmobilesoftware-main-p-p-laptop-els-mobile-software.jpg?modified=20210327094253&extension=webp"),
          alt: "ENiQ App",
        },
        Link: { text: "Learn more", url: "/products/categories/apps-software" },
      },
    },
    {
      name: "Tapkey App",
      displayName: "Tapkey App",
      fields: {
        Title: "Tapkey App",
        Summary: "Share digital keys and manage Tapkey-enabled locks.",
        Image: {
          url: cdn("e/elssoftware/domelssoftware-main-p-p-laptop-els-software.jpg?modified=20210327100211&extension=webp"),
          alt: "Tapkey App",
        },
        Link: { text: "Learn more", url: "/products/categories/apps-software" },
      },
    },
  ],
} satisfies DataDefinition;
