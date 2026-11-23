import type { DataDefinition } from "../../../tools/definitions/types";

const categories = [
  {
    name: "mechanical-cylinders",
    title: "Mechanical cylinders",
    theme: "door-hardware",
    description: "<p>Mechanical cylinder solutions for residential and commercial doors.</p>",
  },
  {
    name: "mechanical-locks",
    title: "Mechanical Locks",
    theme: "door-hardware",
    description: "<p>Mechanical lock cases and multipoint locking systems.</p>",
  },
  {
    name: "digital-cylinders",
    title: "Digital Cylinders",
    theme: "access-control-solutions",
    description: "<p>Electronic cylinders for flexible, scalable access control.</p>",
  },
  {
    name: "digital-handles",
    title: "Digital Handles",
    theme: "access-control-solutions",
    description: "<p>Digital door handles combining design and electronic access.</p>",
  },
  {
    name: "wall-readers-and-terminals",
    title: "Wall Readers and Terminals",
    theme: "access-control-solutions",
    description: "<p>Wall readers and terminals for online and offline access points.</p>",
  },
  {
    name: "apps-software",
    title: "Apps & Software",
    theme: "access-control-solutions",
    description: "<p>Apps and software to manage credentials and access rights.</p>",
  },
  {
    name: "transponders",
    title: "Transponders",
    theme: "access-control-solutions",
    description: "<p>Cards, tags and transponders for electronic locking systems.</p>",
  },
  {
    name: "digital-furniture-locks",
    title: "Digital Furniture Locks",
    theme: "industrial-locking-equipment",
    description: "<p>Electronic locks for lockers, cabinets and furniture.</p>",
  },
  {
    name: "furniture-locks",
    title: "Furniture Locks",
    theme: "industrial-locking-equipment",
    description: "<p>Mechanical furniture locking solutions for industrial use.</p>",
  },
  {
    name: "trapped-key-interlocking-systems",
    title: "Trapped Key Interlocking Systems",
    theme: "industrial-locking-equipment",
    description: "<p>Trapped key systems for safe industrial process control.</p>",
  },
] as const;

export const domSecurityProductCategories = {
  kind: "data",
  definitionKey: "dom-security-product-category-items",
  name: "DomSecurityProductCategoryItems",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  culture: "en",
  cultures: ["nl-BE", "fr-BE"],
  location: {
    root: "data",
    folder: ["Product Categories"],
  },
  model: {
    folderTemplate: {
      name: "Product Category Folder",
      displayName: "Product Categories",
    },
    itemTemplate: {
      name: "Product Category",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Title", type: "Single-Line Text" },
            { name: "Theme Slug", type: "Single-Line Text", shared: true },
            { name: "Category1 Slug", type: "Single-Line Text", shared: true },
            { name: "Description", type: "Rich Text" },
            { name: "Image", type: "Image" },
          ],
        },
      ],
    },
  },
  items: categories.map((category) => ({
    name: category.name,
    displayName: category.title,
    fields: {
      Title: category.title,
      "Theme Slug": category.theme,
      "Category1 Slug": category.name,
      Description: category.description,
    },
  })),
} satisfies DataDefinition;
