import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const domSecurityNewsTeaserDefinition = {
  kind: "component",
  definitionKey: "dom-security-news-teaser",
  name: "dom-security-news-teaser",
  displayName: "Dom Security News Teaser",
  componentName: "DomSecurityNewsTeaser",
  icon: "Office/32x32/table.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: { scope: "site", root: "data", folder: ["Dom Security News Teasers"] },
  model: {
    folderTemplate: { name: "Dom Security News Teaser Folder", displayName: "Dom Security News Teasers" },
    itemTemplate: {
      name: "Dom Security News Teaser",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
              { name: "Title", type: "Single-Line Text" },
              { name: "Date", type: "Single-Line Text" },
              { name: "Image", type: "Image" },
              { name: "Link", type: "General Link" },
            ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    culture: "be",
    cultures: ["nl-BE","fr-BE"],
    location: { root: "data", folder: ["Dom Security News Teasers"] },
    items: [
      {
        name: "Den Dam Tapkey",
        displayName: "Management flexibility for sports complex Den Dam thanks to Tapkey",
        fields: {
          Title: "Management flexibility for sports complex Den Dam thanks to Tapkey",
          Date: "7 Jun 2026",
          Image: {
            url: "https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/DOM-BE/Projecten/Den-Dam-sport.jpg?h=339&iar=0&w=451&modified=20261012135807&extension=webp",
            alt: "Den Dam sports complex, Steenokkerzeel",
          },
          Link: { text: "Read article", url: "/be/en/newsroom/local-news/den-dam-tapkey" },
        },
      },
      {
        name: "Tapkey Premium Launch",
        displayName: "DOM Tapkey Premium has been launched!",
        fields: {
          Title: "DOM Tapkey Premium has been launched!",
          Date: "17 Nov 2025",
          Image: {
            url: "https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/DOM-NL/Nieuwsberichten-2025/DOM-Tapkey-Premium/Teaser.jpg?h=600&iar=0&w=900&modified=20251114110726&extension=webp",
            alt: "Woman managing Tapkey Premium Software on computer",
          },
          Link: { text: "Read article", url: "/be/en/newsroom/local-news/dom-tapkey-premium-be" },
        },
      },
      {
        name: "Tapkey Event",
        displayName: "BE - Tapkey Tapkey Event",
        fields: {
          Title: "BE - Tapkey Tapkey Event",
          Date: "24 May 2024",
          Image: {
            url: "https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/DOM-BE/Newsletter/Tapkey-Event-handtekening-News.jpg?h=260&iar=0&w=760&modified=20240524111847&extension=webp",
            alt: "Tapkey Event News",
          },
          Link: { text: "Read article", url: "/be/en/newsroom/local-news/be---tapkey-tapkey-event" },
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
