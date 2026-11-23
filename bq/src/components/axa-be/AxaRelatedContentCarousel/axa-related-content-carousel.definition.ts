import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const relatedContentCarouselDefinition = {
  kind: "component",
  definitionKey: "axa-related-content-carousel",
  name: "axa-related-content-carousel",
  displayName: "Related Content Carousel",
  componentName: "AxaRelatedContentCarousel",
  icon: "Office/32x32/hand_offer.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Related Content Carousels"],
  },
  model: {
    folderTemplate: {
      name: "Related Content Carousel Folder",
    },
    itemTemplate: {
      name: "Related Content Carousel",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [{ name: "Heading", type: "Single-Line Text" }],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [
    {
      key: "related-content-cards",
      allowedControls: ["axa-related-content-card"],
    },
  ],
  content: {
    location: {
      root: "data",
      folder: ["Related Content Carousels"],
    },
    culture: "nl-BE",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Related Content Carousel",
        displayName: "Interessant voor jou",
        fields: {
          Heading: "Interessant voor jou",
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
