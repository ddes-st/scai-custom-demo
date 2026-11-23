import type { SitePresentationDefinition } from "../../../tools/definitions/types";

/**
 * Presentation wiring for site "domsecurity-com" (create:sectioncomponents).
 * Emitted by definitions:generate — do not hand-edit YAML.
 * Secondary page captures merge into this file (home + prior pages are preserved).
 */
export const domsecuritycomPresentation = {
  kind: "site-presentation",
  definitionKey: "domsecurity-com-presentation",
  siteSystem: "domsecurity-com",
  collectionSystem: "domsecurity",
  cultures: ["nl-BE","fr-BE"],
  availableRenderings: {
  "Page Content": [
    "dom-security-technology-hero",
    "dom-security-company-overview",
    "dom-security-recommendation-card",
    "dom-security-recommendation-grid",
    "dom-security-testimonial-contact-grid",
    "dom-security-contact-information-section",
    "dom-security-partner-portal-card",
    "dom-security-news-teaser-card",
    "dom-security-news-teasers",
    "dom-security-news-teaser",
    "dom-security-news-grid",
    "dom-security-page-intro",
    "dom-security-dealer-finder",
    "dom-security-dealer-locator",
    "dom-security-article-header",
    "dom-security-share-bar",
    "dom-security-service-request-form",
    "dom-security-editorial-article-body",
    "dom-security-product",
    "dom-security-product-listing",
    "dom-security-product-category-header",
    "dom-security-product-detail",
    "dom-security-product-accessories",
    "dom-security-product-related-software",
    "dom-security-wildcard-experience",
    "dom-security-category-tag"
  ],
  "Navigation": [
    "dom-security-navigation",
    "dom-security-header",
    "dom-security-audience-link",
    "dom-security-header-block",
    "dom-security-footer-link-list",
    "dom-security-footer-legal-links",
    "dom-security-footer-social-links",
    "dom-security-site-footer",
    "dom-security-site-header",
    "dom-security-product-menu-column",
    "dom-security-navigation-item",
    "dom-security-product-category-column",
    "dom-security-primary-navigation",
    "dom-security-footer-link-group",
    "dom-security-footer",
    "dom-security-global-navigation-header",
    "dom-security-mega-menu-column",
    "dom-security-main-menu",
    "dom-security-global-footer"
  ],
  "Page Structure": [
    "dom-security-consent-banner",
    "dom-security-cookie-consent-dialog",
    "dom-security-cookie-consent-modal"
  ]
},
  partialDesigns: [
  {
    "signature": "cookie",
    "placeholder": "headless-cookie",
    "definitionKey": "dom-security-consent-banner"
  },
  {
    "signature": "header",
    "placeholder": "headless-header",
    "definitionKey": "dom-security-navigation",
    "children": [
      {
        "definitionKey": "dom-security-footer-link-list",
        "datasourceItem": "Door Hardware",
        "placeholder": "nav-mega-columns",
        "variant": "NavMega"
      },
      {
        "definitionKey": "dom-security-footer-link-list",
        "datasourceItem": "Access Control",
        "placeholder": "nav-mega-columns",
        "variant": "NavMega"
      },
      {
        "definitionKey": "dom-security-footer-link-list",
        "datasourceItem": "Industrial Locking Equipment",
        "placeholder": "nav-mega-columns",
        "variant": "NavMega"
      },
      {
        "definitionKey": "dom-security-global-navigation-header",
        "datasourceItem": "Global Navigation Header"
      },
      {
        "definitionKey": "dom-security-mega-menu-column",
        "datasourceItem": "Door Hardware"
      },
      {
        "definitionKey": "dom-security-mega-menu-column",
        "datasourceItem": "Access Control"
      },
      {
        "definitionKey": "dom-security-mega-menu-column",
        "datasourceItem": "Industrial Locking Equipment"
      }
    ]
  },
  {
    "signature": "footer",
    "placeholder": "headless-footer",
    "definitionKey": "dom-security-site-footer",
    "children": [
      {
        "definitionKey": "dom-security-footer-link-list",
        "datasourceItem": "Primary Links Left",
        "placeholder": "footer-nav"
      },
      {
        "definitionKey": "dom-security-footer-link-list",
        "datasourceItem": "Primary Links Right",
        "placeholder": "footer-nav"
      },
      {
        "definitionKey": "dom-security-footer-link-list",
        "datasourceItem": "Legal Links",
        "placeholder": "footer-legal",
        "variant": "Horizontal"
      },
      {
        "definitionKey": "dom-security-footer-social-links",
        "datasourceItem": "Footer Social Links",
        "placeholder": "footer-social"
      },
      {
        "definitionKey": "dom-security-global-footer",
        "datasourceItem": "Global Footer"
      }
    ]
  }
],
  pages: {
  "home": {
    "renderings": [
      {
        "definitionKey": "dom-security-technology-hero",
        "placeholder": "headless-main"
      },
      {
        "definitionKey": "dom-security-company-overview",
        "placeholder": "headless-main"
      },
      {
        "definitionKey": "dom-security-recommendation-grid",
        "placeholder": "headless-main",
        "children": [
          {
            "definitionKey": "dom-security-recommendation-card",
            "datasourceItem": "Dom Tapkey"
          },
          {
            "definitionKey": "dom-security-recommendation-card",
            "datasourceItem": "Eniq Security Ecosystem"
          },
          {
            "definitionKey": "dom-security-recommendation-card",
            "datasourceItem": "Dom Ix Twinstar"
          }
        ]
      },
      {
        "definitionKey": "dom-security-testimonial-contact-grid",
        "placeholder": "headless-main"
      },
      {
        "definitionKey": "dom-security-partner-portal-card",
        "placeholder": "headless-main"
      },
      {
        "definitionKey": "dom-security-contact-information-section",
        "placeholder": "headless-main"
      },
      {
        "definitionKey": "dom-security-news-teasers",
        "placeholder": "headless-main",
        "children": [
          {
            "definitionKey": "dom-security-news-teaser",
            "datasourceItem": "Den Dam Tapkey"
          },
          {
            "definitionKey": "dom-security-news-teaser",
            "datasourceItem": "Tapkey Premium Launch"
          },
          {
            "definitionKey": "dom-security-news-teaser",
            "datasourceItem": "Tapkey Event"
          }
        ]
      },
      {
        "definitionKey": "dom-security-dealer-finder",
        "placeholder": "headless-main"
      }
    ]
  },
  "newsroom": {
    "routePath": "/newsroom",
    "navigationTitle": "Newsroom",
    "renderings": [
      {
        "definitionKey": "dom-security-category-tag",
        "placeholder": "headless-main"
      },
      {
        "definitionKey": "dom-security-page-intro",
        "placeholder": "headless-main"
      },
      {
        "definitionKey": "dom-security-news-grid",
        "placeholder": "headless-main",
        "children": [
          {
            "definitionKey": "dom-security-news-teaser",
            "datasourceItem": "News"
          }
        ]
      }
    ]
  },
  "find-a-dom-dealer": {
    "routePath": "/find-a-dom-dealer",
    "navigationTitle": "Find a DOM dealer",
    "renderings": [
      {
        "definitionKey": "dom-security-dealer-locator",
        "placeholder": "headless-main",
        "datasourceItem": "Dealer Finder"
      }
    ]
  },
  "products": {
    "routePath": "/products",
    "navigationTitle": "Products",
    "renderings": [
      {
        "definitionKey": "dom-security-product-listing",
        "placeholder": "headless-main",
        "datasourceItem": "Product Listing"
      }
    ]
  },
  "products-categories-wildcard": {
    "routePath": "/products/categories/*",
    "navigationTitle": "Product Category",
    "renderings": [
      {
        "definitionKey": "dom-security-wildcard-experience",
        "placeholder": "headless-main",
        "datasourceItem": "Category Wildcard",
        "children": [
          {
            "definitionKey": "dom-security-product-category-header",
            "datasourceItem": "Product Category Header",
            "placeholder": "wildcard-content"
          }
        ]
      }
    ]
  },
  "products-wildcard": {
    "routePath": "/products/*",
    "navigationTitle": "Product",
    "renderings": [
      {
        "definitionKey": "dom-security-wildcard-experience",
        "placeholder": "headless-main",
        "datasourceItem": "Product Wildcard",
        "children": [
          {
            "definitionKey": "dom-security-product-detail",
            "datasourceItem": "Product Detail",
            "placeholder": "wildcard-content"
          },
          {
            "definitionKey": "dom-security-product-accessories",
            "datasourceItem": "Optional Accessories",
            "placeholder": "wildcard-content"
          },
          {
            "definitionKey": "dom-security-product-related-software",
            "datasourceItem": "Related Software",
            "placeholder": "wildcard-content"
          }
        ]
      }
    ]
  },
  "newsroom-local-news-be-tapkey-tapkey-event": {
    "routePath": "/newsroom/local-news/be-tapkey-tapkey-event",
    "navigationTitle": "BE - Tapkey Tapkey Event",
    "renderings": [
      {
        "definitionKey": "dom-security-article-header",
        "placeholder": "headless-main",
        "datasourceItem": "Tapkey Event"
      },
      {
        "definitionKey": "dom-security-share-bar",
        "placeholder": "headless-main",
        "datasourceItem": "Article Share Bar"
      },
      {
        "definitionKey": "dom-security-editorial-article-body",
        "placeholder": "headless-main",
        "datasourceItem": "Tapkey Event"
      }
    ]
  },
  "newsroom-local-news-dom-be-50-years-hoberg": {
    "routePath": "/newsroom/local-news/dom-be-50-years-hoberg",
    "navigationTitle": "DOM BE - 50 Years Hoberg",
    "renderings": [
      {
        "definitionKey": "dom-security-article-header",
        "placeholder": "headless-main",
        "datasourceItem": "Fifty Years Hoberg"
      },
      {
        "definitionKey": "dom-security-share-bar",
        "placeholder": "headless-main",
        "datasourceItem": "Article Share Bar"
      },
      {
        "definitionKey": "dom-security-editorial-article-body",
        "placeholder": "headless-main",
        "datasourceItem": "Fifty Years Hoberg"
      }
    ]
  },
  "newsroom-group-news-dom-security-joins-tapkey-as-a-new-shareholder": {
    "routePath": "/newsroom/group-news/dom-security-joins-tapkey-as-a-new-shareholder",
    "navigationTitle": "DOM Security joins Tapkey as a new shareholder",
    "renderings": [
      {
        "definitionKey": "dom-security-article-header",
        "placeholder": "headless-main",
        "datasourceItem": "Tapkey Shareholder"
      },
      {
        "definitionKey": "dom-security-share-bar",
        "placeholder": "headless-main",
        "datasourceItem": "Article Share Bar"
      },
      {
        "definitionKey": "dom-security-editorial-article-body",
        "placeholder": "headless-main",
        "datasourceItem": "Tapkey Shareholder"
      }
    ]
  },
  "newsroom-local-news-be-guard-s": {
    "routePath": "/newsroom/local-news/be-guard-s",
    "navigationTitle": "Let the Guard S handle it",
    "renderings": [
      {
        "definitionKey": "dom-security-article-header",
        "placeholder": "headless-main",
        "datasourceItem": "Guard S"
      },
      {
        "definitionKey": "dom-security-share-bar",
        "placeholder": "headless-main",
        "datasourceItem": "Article Share Bar"
      },
      {
        "definitionKey": "dom-security-editorial-article-body",
        "placeholder": "headless-main",
        "datasourceItem": "Guard S"
      }
    ]
  },
  "newsroom-group-news-new-silca-machine-dom-hoberg": {
    "routePath": "/newsroom/group-news/new-silca-machine-dom-hoberg",
    "navigationTitle": "New Silca Machine Dom Hoberg",
    "renderings": [
      {
        "definitionKey": "dom-security-article-header",
        "placeholder": "headless-main",
        "datasourceItem": "Silca Key Cutting Machine"
      },
      {
        "definitionKey": "dom-security-share-bar",
        "placeholder": "headless-main",
        "datasourceItem": "Article Share Bar"
      },
      {
        "definitionKey": "dom-security-editorial-article-body",
        "placeholder": "headless-main",
        "datasourceItem": "Silca Key Cutting Machine"
      }
    ]
  },
  "newsroom-local-news-be-oliver-hoberg-retires-from-hoberg": {
    "routePath": "/newsroom/local-news/be-oliver-hoberg-retires-from-hoberg",
    "navigationTitle": "Thank you for your leadership, Oliver!",
    "renderings": [
      {
        "definitionKey": "dom-security-article-header",
        "placeholder": "headless-main",
        "datasourceItem": "Oliver Hoberg Leadership"
      },
      {
        "definitionKey": "dom-security-share-bar",
        "placeholder": "headless-main",
        "datasourceItem": "Article Share Bar"
      },
      {
        "definitionKey": "dom-security-editorial-article-body",
        "placeholder": "headless-main",
        "datasourceItem": "Oliver Hoberg Leadership"
      }
    ]
  },
  "newsroom-group-news-de-ix-teco-patent": {
    "routePath": "/newsroom/group-news/de-ix-teco-patent",
    "navigationTitle": "European Patent Office Grants Patent to DOM ix Teco®",
    "renderings": [
      {
        "definitionKey": "dom-security-article-header",
        "placeholder": "headless-main",
        "datasourceItem": "European Patent Office"
      },
      {
        "definitionKey": "dom-security-share-bar",
        "placeholder": "headless-main",
        "datasourceItem": "Article Share Bar"
      },
      {
        "definitionKey": "dom-security-editorial-article-body",
        "placeholder": "headless-main",
        "datasourceItem": "European Patent Office"
      }
    ]
  },
  "newsroom-group-news-de-best-of-dom-volume-4-is-here": {
    "routePath": "/newsroom/group-news/de-best-of-dom-volume-4-is-here",
    "navigationTitle": "Best of DOM Volume 4 is here",
    "renderings": [
      {
        "definitionKey": "dom-security-article-header",
        "placeholder": "headless-main",
        "datasourceItem": "Best Of DOM Volume Four"
      },
      {
        "definitionKey": "dom-security-share-bar",
        "placeholder": "headless-main",
        "datasourceItem": "Article Share Bar"
      },
      {
        "definitionKey": "dom-security-editorial-article-body",
        "placeholder": "headless-main",
        "datasourceItem": "Best Of DOM Volume Four"
      }
    ]
  },
  "newsroom-group-news-data-on-card-update": {
    "routePath": "/newsroom/group-news/data-on-card-update",
    "navigationTitle": "Now available: Data on Card on ENiQ App",
    "renderings": [
      {
        "definitionKey": "dom-security-article-header",
        "placeholder": "headless-main",
        "datasourceItem": "Data On Card"
      },
      {
        "definitionKey": "dom-security-share-bar",
        "placeholder": "headless-main",
        "datasourceItem": "Article Share Bar"
      },
      {
        "definitionKey": "dom-security-editorial-article-body",
        "placeholder": "headless-main",
        "datasourceItem": "Data On Card"
      }
    ]
  },
  "newsroom-group-news-anti-microbial-products-news-update": {
    "routePath": "/newsroom/group-news/anti-microbial-products-news-update",
    "navigationTitle": "Antimicrobial Products News Update",
    "renderings": [
      {
        "definitionKey": "dom-security-article-header",
        "placeholder": "headless-main",
        "datasourceItem": "Antimicrobial Products Update"
      },
      {
        "definitionKey": "dom-security-share-bar",
        "placeholder": "headless-main",
        "datasourceItem": "Article Share Bar"
      },
      {
        "definitionKey": "dom-security-editorial-article-body",
        "placeholder": "headless-main",
        "datasourceItem": "Antimicrobial Products Update"
      }
    ]
  },
  "newsroom-group-news-dom-nl-nieuw-antibacteriele-producten": {
    "routePath": "/newsroom/group-news/dom-nl-nieuw-antibacteriele-producten",
    "navigationTitle": "New: Anti-bacterial Digital Door Handles, Cylinder, and Panic Bars",
    "renderings": [
      {
        "definitionKey": "dom-security-article-header",
        "placeholder": "headless-main",
        "datasourceItem": "Antibacterial Digital Products"
      },
      {
        "definitionKey": "dom-security-share-bar",
        "placeholder": "headless-main",
        "datasourceItem": "Article Share Bar"
      },
      {
        "definitionKey": "dom-security-editorial-article-body",
        "placeholder": "headless-main",
        "datasourceItem": "Antibacterial Digital Products"
      }
    ]
  },
  "newsroom-group-news-dom-tapkey-major-update": {
    "routePath": "/newsroom/group-news/dom-tapkey-major-update",
    "navigationTitle": "DOM Tapkey Major Update: Program your Transponders with iPhone",
    "renderings": [
      {
        "definitionKey": "dom-security-article-header",
        "placeholder": "headless-main",
        "datasourceItem": "Tapkey IPhone Transponder"
      },
      {
        "definitionKey": "dom-security-share-bar",
        "placeholder": "headless-main",
        "datasourceItem": "Article Share Bar"
      },
      {
        "definitionKey": "dom-security-editorial-article-body",
        "placeholder": "headless-main",
        "datasourceItem": "Tapkey IPhone Transponder"
      }
    ]
  },
  "newsroom-group-news-dom-security-released-new-anti-microbial-digital-door-handles-cylinder-and-panic-bars": {
    "routePath": "/newsroom/group-news/dom-security-released-new-anti-microbial-digital-door-handles-cylinder-and-panic-bars",
    "navigationTitle": "DOM Security Released New Anti-microbial Digital Door Handles, Cylinder, and Panic Bars",
    "renderings": [
      {
        "definitionKey": "dom-security-article-header",
        "placeholder": "headless-main",
        "datasourceItem": "Released Antimicrobial Products"
      },
      {
        "definitionKey": "dom-security-share-bar",
        "placeholder": "headless-main",
        "datasourceItem": "Article Share Bar"
      },
      {
        "definitionKey": "dom-security-editorial-article-body",
        "placeholder": "headless-main",
        "datasourceItem": "Released Antimicrobial Products"
      }
    ]
  },
  "newsroom-group-news-dom-eniq-guard-crowned-as-git-security-award-2020-winner": {
    "routePath": "/newsroom/group-news/dom-eniq-guard-crowned-as-git-security-award-2020-winner",
    "navigationTitle": "DOM ENiQ Guard Crowned As GIT Security Award 2020 Winner",
    "renderings": [
      {
        "definitionKey": "dom-security-article-header",
        "placeholder": "headless-main",
        "datasourceItem": "ENiQ Guard Award"
      },
      {
        "definitionKey": "dom-security-share-bar",
        "placeholder": "headless-main",
        "datasourceItem": "Article Share Bar"
      },
      {
        "definitionKey": "dom-security-editorial-article-body",
        "placeholder": "headless-main",
        "datasourceItem": "ENiQ Guard Award"
      }
    ]
  }
},
} satisfies SitePresentationDefinition;
