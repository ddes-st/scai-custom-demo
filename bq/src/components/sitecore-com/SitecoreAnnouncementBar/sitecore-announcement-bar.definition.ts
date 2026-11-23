import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecoreAnnouncementBarDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-announcement-bar",
  name: "sitecore-announcement-bar",
  componentName: "SitecoreAnnouncementBar",
  displayName: "Announcement Bar",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Announcement Marquees'] },
  model: {
    folderTemplate: { name: 'Announcement Marquee Folder' },
    itemTemplate: {
      name: 'Announcement Marquee',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Announcement Prefix', type: 'Single-Line Text' },
          { name: 'CTA Label', type: 'Single-Line Text' },
          { name: 'CTA', type: 'General Link' },
          { name: 'Announcement Suffix', type: 'Single-Line Text' },
        ],
      }],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Announcement Marquees'] },
    culture: "en",
    items: [{
      name: 'Announcement Marquee',
      fields: {
        'Announcement Prefix': 'AI is rewiring the rules of marketing.',
        'CTA Label': 'Join us at Symposium 2026',
        CTA: {
          text: 'Join us at Symposium 2026',
          url: 'https://symposium.sitecore.com/?utm_source=Sitecore_Banner&utm_campaign=Symposium_26',
        },
        'Announcement Suffix': ', our annual global conference for digital leaders.',
      },
    }],
  },
} satisfies ComponentTemplateDefinition;
