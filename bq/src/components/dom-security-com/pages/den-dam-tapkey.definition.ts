import type { PageDefinition } from "../../../../tools/definitions/types";

const ARTICLE_BODY = `
<p>With Den Dam, the municipality aims to further invest in modern sports infrastructure for local clubs. The new complex offers these clubs more space and comfort to expand their activities.</p>
<p>Den Dam is a place where people meet and where young and old alike can play sports and socialize together.</p>
<p>With various sports clubs as tenants and a large number of changing users—each with their own individual access rights—creating a secure and user-friendly access control plan is a challenging task.</p>
<p>For the operation of this sports complex, the project owner sought a system that would allow the municipality to act as the central coordinator for granting access rights, without needing to manage the clubs' individual members directly.</p>
<p>DOM Tapkey Multi-Tenant provides the key to this solution.</p>
<p>The municipality delegates management to the officials of the various sports clubs, who in turn grant tailored access rights to their members. Most users access the facilities via smartphone, while others use transponders. Access rights can be modified instantly. There is no risk of losing physical keys, and access rights can be time-restricted. As an added benefit, the administrator can consult the access log whenever necessary.</p>
<p>DOM Tapkey is cloud-based. This means administrators do not need to worry about backups or server impact, as backups are performed automatically.</p>
<p>Multifunctional sports facilities require advanced access management systems that are both flexible and secure. In a world where security and convenience must go hand in hand, DOM Tapkey introduces Multi-Tenant access management. This innovation offers convenience, control, and privacy for both facility managers and tenants.</p>
<h2>Separate access management for public and private areas</h2>
<p>Managing sports facilities involves a wide range of responsibilities. Until now, these tasks typically fell to the building owner or a central facility manager. With DOM Tapkey's new Multi-Tenant feature, management tasks are distributed, resulting in a more streamlined and specialized management process.</p>
<h2>Greater autonomy for tenants</h2>
<p>At the heart of the Multi-Tenant feature is the concept of separate management. Sports club managers gain full autonomy over access to the areas they use. They can grant access, create tags, view access logs, and perform other management tasks themselves. This gives them the freedom to manage their club spaces according to their own preferences and needs, without requiring intervention from the building owner or facility manager.</p>
<h2>Privacy and control for the manager</h2>
<p>While club representatives take over management of their specific club areas, the building owner or manager retains control over common areas. This means the building manager no longer needs to handle access for the various clubs or monitor activities within those units. This separation of responsibilities enhances privacy for tenants and owners while reducing the administrative burden on managers.</p>
<h2>How does the DOM Tapkey Multi-Tenant feature work?</h2>
<p>The new DOM Tapkey feature is intuitive to use. Once the system is set up, the manager can grant club representatives the access rights needed to effectively manage their private spaces. The DOM Tapkey software provides a clear, cloud-based interface for all users, with roles and permissions clearly defined from the start. The sports complex's main administrator retains control over the common areas.</p>
<p><img src="https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/DOM-BE/Projecten/Tapkey-Toegangsbeheer-EN.png?modified=20261012135804&amp;extension=webp" alt="DOM Tapkey Multi-Tenant diagram: the main administrator manages common areas and three club administrators each manage their own areas" /></p>
<h2>Tailored access for everyone</h2>
<p>This feature allows you to set different access levels, ensuring a tailored experience for everyone involved. Clubs can assign specific rights to staff or members and manage their own tags and mobile keys for areas such as changing rooms, the bar, and showers, while the manager oversees common areas like the entrance, elevators, bicycle storage, and utility rooms.</p>
<h2>Benefits of a smart locking solution with Multi-Tenant function</h2>
<p>DOM Tapkey's Multi-Tenant feature brings several benefits, including:</p>
<ul>
<li><strong>Efficiency in management:</strong> By dividing the responsibilities regarding access, the focus can be on better management.</li>
<li><strong>Ease of use:</strong> Easy to use for users of all levels, thanks to the user-friendly software and app interface.</li>
<li><strong>Splitting private and communal areas:</strong> The public and private areas are secured and managed without sacrificing accessibility.</li>
<li><strong>Increased security:</strong> Control over who has access to which part of the building.</li>
</ul>
<p>DOM Tapkey's Multi-Tenant feature improves the way managers and tenants work together to ensure safety and accessibility in sports complexes. This is also the perfect solution for apartments, flex offices... With this smart locking solution you can move forward with confidence, knowing that your property is optimally managed while maintaining the privacy and autonomy of your tenants and owners. Are you ready to take your complex's access management to the next level?</p>
<p><a href="https://www.dom-security.com/be/en/oplossingen/toegangscontrole-systeem/dom-tapkey-premium">Click here for more information about DOM Tapkey.</a></p>
`.trim();

/** News article /newsroom/local-news/den-dam-tapkey — News Page template. */
export const denDamTapkey = {
  kind: "page",
  definitionKey: "den-dam-tapkey",
  name: "Den Dam Tapkey",
  routePath: "/newsroom/local-news/den-dam-tapkey",
  siteSystem: "domsecurity-com",
  collectionSystem: "domsecurity",
  navigationTitle: "Management flexibility for sports complex Den Dam thanks to Tapkey",
  culture: "en",
  cultures: ["nl-BE", "fr-BE"],
  pageTemplate: {
    name: "News Page",
    insertOnlyUnder: ["/newsroom", "/newsroom/local-news", "/newsroom/group-news"],
  },
  fields: {
    Title: "Management flexibility for sports complex Den Dam thanks to Tapkey",
    Date: "7 June 2026",
    Category: "News",
    Introduction:
      "<p>On June 7, 2026, the new ‘Den Dam’ sports complex in Steenokkerzeel officially opened its doors. It now serves as the shared home base for football club PSV1820, tennis club Kasteel van Ham, and pétanque club Den Dam.</p>",
    Image: {
      url: "https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/DOM-BE/Projecten/Den-Dam-sport.jpg?modified=20261012135807&extension=webp",
      alt: "Den Dam sports complex in Steenokkerzeel, viewed from the football pitch",
    },
    "Image Caption": "",
    Heading: "",
    Body: ARTICLE_BODY,
    Label: "Share this",
    "Page Url": "https://www.dom-security.com/be/en/newsroom/local-news/den-dam-tapkey",
    Summary:
      "Den Dam sports complex in Steenokkerzeel uses DOM Tapkey Multi-Tenant for flexible, secure access management by the municipality and sports clubs.",
  },
  renderings: [
    {
      definitionKey: "dom-security-article-header",
      placeholder: "headless-main",
      role: "page",
      datasourceItem: "$page",
    },
    {
      definitionKey: "dom-security-share-bar",
      placeholder: "headless-main",
      role: "page",
      datasourceItem: "$page",
    },
    {
      definitionKey: "dom-security-editorial-article-body",
      placeholder: "headless-main",
      role: "page",
      datasourceItem: "$page",
    },
  ],
} satisfies PageDefinition;
