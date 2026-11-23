import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

/** Thin rendering — shares Dealer Finder datasource (UI labels + Dealer children). */
export const dealerLocatorDefinition = {
  kind: "component",
  definitionKey: "dom-security-dealer-locator",
  name: "dom-security-dealer-locator",
  displayName: "Dealer Locator",
  componentName: "DomSecurityDealerLocator",
  icon: "Office/32x32/map_pin.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Dealer Finders"],
  },
  datasourceTemplate: "/sitecore/templates/Project/domsecurity/DomSecurityDealerFinder/Dealer Finder",
  model: {
    folderTemplate: { name: "Dealer Locator Folder" },
    itemTemplate: {
      name: "Dealer Locator",
      sections: [],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  componentGraphQLQuery: "query DomSecurityDealerLocatorQuery($datasource: String!, $language: String!) {\n  datasource: item(path: $datasource, language: $language) {\n    heading: field(name: \"Heading\") { jsonValue }\n    subtitle: field(name: \"Subtitle\") { jsonValue }\n    searchPlaceholder: field(name: \"Search Placeholder\") { jsonValue }\n    useMyLocationLabel: field(name: \"Use My Location Label\") { jsonValue }\n    locationError: field(name: \"Location Error\") { jsonValue }\n    noResultsMessage: field(name: \"No Results Message\") { jsonValue }\n    searchCriteriaLabel: field(name: \"Search Criteria Label\") { jsonValue }\n    selectDealersLabel: field(name: \"Select Dealers Label\") { jsonValue }\n    mechanicalLabel: field(name: \"Mechanical Type Label\") { jsonValue }\n    digitalLabel: field(name: \"Digital Type Label\") { jsonValue }\n    mapCookieTitle: field(name: \"Map Cookie Title\") { jsonValue }\n    mapCookieBody: field(name: \"Map Cookie Body\") { jsonValue }\n  }\n}",
} satisfies ComponentTemplateDefinition;
