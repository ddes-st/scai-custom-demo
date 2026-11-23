/**
 * Generator: Dom Security dealer finder (shared DS) + thin locator rendering.
 *
 * Parent Dealer Finder item owns UI labels (+ homepage teaser fields).
 * Dealer rows are child-template subitems under Dealer Finders/Dealer Finder.
 * DomSecurityDealerLocator reuses the same datasource template/folder.
 *
 * Usage (from bq/):
 *   node tools/create-section-components/generate-dom-dealer-locator.mjs
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bqRoot, repoRoot } from '../capture/paths.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEALER_TYPE_LABELS = {
  'd26e56bf-f63b-4bfb-8ad8-d9bb13240293': 'Mechanical locking systems',
  '92898172-b659-4a4b-b839-42830abe7ef7': 'Digital locking systems',
};

const API_JSON = path.join(
  repoRoot,
  '.bq/captures/www-dom-security-com/www-dom-security-com--be-en-find-a-dom-dealer/dealers-api.json',
);

const LOCATOR_DIR = path.join(
  bqRoot,
  'src/components/dom-security-com/DomSecurityDealerLocator',
);
const FINDER_DIR = path.join(
  bqRoot,
  'src/components/dom-security-com/DomSecurityDealerFinder',
);

const SHARED_DS_TEMPLATE =
  '/sitecore/templates/Project/domsecurity/DomSecurityDealerFinder/Dealer Finder';

function sanitizeItemName(title, id) {
  const base = String(title || 'Dealer')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 80)
    .trim();
  const shortId = String(id || '').replace(/-/g, '').slice(0, 8);
  return `${base || 'Dealer'} ${shortId}`.trim();
}

function esc(s) {
  return JSON.stringify(String(s ?? ''));
}

function typesLabel(dealerTypeIds) {
  return (dealerTypeIds || [])
    .map((id) => DEALER_TYPE_LABELS[String(id).toLowerCase()] || DEALER_TYPE_LABELS[id])
    .filter(Boolean)
    .join('; ');
}

async function main() {
  const raw = JSON.parse(await readFile(API_JSON, 'utf8'));
  const dealers = (Array.isArray(raw) ? raw : [])
    .filter((d) => String(d.Country || '').toUpperCase() === 'BE')
    .filter((d) => d.Location?.latitude && d.Location?.longitude);

  const usedNames = new Set();
  const children = dealers.map((d) => {
    let name = sanitizeItemName(d.Title, d.Id);
    let n = 2;
    while (usedNames.has(name.toLowerCase())) {
      name = `${sanitizeItemName(d.Title, d.Id)} ${n++}`;
    }
    usedNames.add(name.toLowerCase());
    const types = typesLabel(d.DealerType);
    return `          {
            name: ${esc(name)},
            displayName: ${esc(String(d.Title || '').trim())},
            fields: {
              Title: ${esc(String(d.Title || '').trim())},
              Label: ${esc(String(d.Label || '').trim())},
              Address: ${esc(String(d.Address || '').trim())},
              "Address Line 2": ${esc(String(d.Address2 || '').trim())},
              Phone: ${esc(String(d.Telephone || '').trim())},
              Fax: ${esc(String(d.Fax || '').trim())},
              Email: ${esc(String(d.Email || '').trim())},
              Website: ${esc(String(d.Website || '').trim())},
              Latitude: ${esc(String(d.Location.latitude).trim())},
              Longitude: ${esc(String(d.Location.longitude).trim())},
              Types: ${esc(types)},
              "External Id": ${esc(String(d.Id || '').trim())},
            },
          }`;
  });

  // Labels only — fetching 180+ children exceeds Experience Edge query complexity.
  // Runtime loads dealers from dealers.data.ts.
  const gql = `query DomSecurityDealerLocatorQuery($datasource: String!, $language: String!) {
  datasource: item(path: $datasource, language: $language) {
    heading: field(name: "Heading") { jsonValue }
    subtitle: field(name: "Subtitle") { jsonValue }
    searchPlaceholder: field(name: "Search Placeholder") { jsonValue }
    useMyLocationLabel: field(name: "Use My Location Label") { jsonValue }
    locationError: field(name: "Location Error") { jsonValue }
    noResultsMessage: field(name: "No Results Message") { jsonValue }
    searchCriteriaLabel: field(name: "Search Criteria Label") { jsonValue }
    selectDealersLabel: field(name: "Select Dealers Label") { jsonValue }
    mechanicalLabel: field(name: "Mechanical Type Label") { jsonValue }
    digitalLabel: field(name: "Digital Type Label") { jsonValue }
    mapCookieTitle: field(name: "Map Cookie Title") { jsonValue }
    mapCookieBody: field(name: "Map Cookie Body") { jsonValue }
  }
}`;

  const dealerRecords = dealers.map((d) => ({
    id: String(d.Id || '').trim(),
    title: String(d.Title || '').trim() || 'Dealer',
    label: String(d.Label || '').trim(),
    address: String(d.Address || '').trim(),
    address2: String(d.Address2 || '').trim(),
    phone: String(d.Telephone || '').trim(),
    fax: String(d.Fax || '').trim(),
    email: String(d.Email || '').trim(),
    website: String(d.Website || '').trim(),
    latitude: Number(d.Location.latitude),
    longitude: Number(d.Location.longitude),
    types: typesLabel(d.DealerType)
      .split(/[;|]/)
      .map((t) => t.trim())
      .filter(Boolean),
  }));

  await mkdir(LOCATOR_DIR, { recursive: true });
  await mkdir(FINDER_DIR, { recursive: true });

  await writeFile(
    path.join(LOCATOR_DIR, 'dealers.data.ts'),
    `/** Auto-generated from Dom Security dealers API — do not hand-edit. */
import type { DealerRecord } from './dom-security-dealer-locator.client';

export const BELGIUM_DEALERS: DealerRecord[] = ${JSON.stringify(dealerRecords, null, 2)};
`,
    'utf8',
  );
  console.log(`[dealer-locator] wrote dealers.data.ts (${dealerRecords.length} dealers)`);

  const finderDefinitionTs = `import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

/** Generated from Dom Security dealers API — parent owns UI labels; children are Dealers. */
export const dealerFinderDefinition = {
  kind: "component",
  definitionKey: "dom-security-dealer-finder",
  name: "dom-security-dealer-finder",
  displayName: "Dealer Finder",
  componentName: "DomSecurityDealerFinder",
  icon: "Office/32x32/find_again.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Dealer Finders"],
  },
  model: {
    folderTemplate: {
      name: "Dealer Finder Folder",
    },
    itemTemplate: {
      name: "Dealer Finder",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Heading", type: "Single-Line Text" },
            { name: "Subtitle", type: "Single-Line Text" },
            { name: "Image", type: "Image" },
            { name: "Postal Code Placeholder", type: "Single-Line Text" },
            { name: "Search Link", type: "General Link" },
            { name: "Search Placeholder", type: "Single-Line Text" },
            { name: "Use My Location Label", type: "Single-Line Text" },
            { name: "Location Error", type: "Single-Line Text" },
            { name: "No Results Message", type: "Single-Line Text" },
            { name: "Search Criteria Label", type: "Single-Line Text" },
            { name: "Select Dealers Label", type: "Single-Line Text" },
            { name: "Mechanical Type Label", type: "Single-Line Text" },
            { name: "Digital Type Label", type: "Single-Line Text" },
            { name: "Map Cookie Title", type: "Single-Line Text" },
            { name: "Map Cookie Body", type: "Single-Line Text" },
          ],
        },
      ],
    },
    childItemTemplate: {
      name: "Dealer",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Title", type: "Single-Line Text" },
            { name: "Label", type: "Single-Line Text" },
            { name: "Address", type: "Single-Line Text" },
            { name: "Address Line 2", type: "Single-Line Text" },
            { name: "Phone", type: "Single-Line Text" },
            { name: "Fax", type: "Single-Line Text" },
            { name: "Email", type: "Single-Line Text" },
            { name: "Website", type: "Single-Line Text" },
            { name: "Latitude", type: "Single-Line Text", shared: true },
            { name: "Longitude", type: "Single-Line Text", shared: true },
            { name: "Types", type: "Single-Line Text" },
            { name: "External Id", type: "Single-Line Text", shared: true },
          ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: {
      root: "data",
      folder: ["Dealer Finders"],
    },
    culture: "en",
    cultures: ["nl-BE", "fr-BE"],
    items: [
      {
        name: "Dealer Finder",
        displayName: "Find a dealer",
        renderingIdentifier: "Dealer",
        fields: {
          Heading: "Find a dealer",
          Subtitle: "Enter your post code below to locate a DOM dealer near you.",
          Image: {
            url: "https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/DOM-BE/image/find-a-dealer-Belgium.jpg?h=600&iar=0&w=990&modified=20211231080627&extension=webp",
            alt: "Find a dealer Belgium",
          },
          "Postal Code Placeholder": "Postal Code",
          "Search Link": { text: "Find a dealer", url: "/find-a-dom-dealer" },
          "Search Placeholder": "Find code",
          "Use My Location Label": "Use my location",
          "Location Error": "Something went wrong",
          "No Results Message": "No Dealers Found",
          "Search Criteria Label": "Search criteria",
          "Select Dealers Label": "Select Dealers",
          "Mechanical Type Label": "Mechanical locking systems",
          "Digital Type Label": "Digital locking systems",
          "Map Cookie Title": "Cookies are disabled",
          "Map Cookie Body": "In order to use the map you need to accept the cookies.",
        },
        children: [
${children.join(',\n')}
        ],
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
`;

  await writeFile(
    path.join(FINDER_DIR, 'dom-security-dealer-finder.definition.ts'),
    finderDefinitionTs,
    'utf8',
  );
  console.log(
    `Wrote ${path.relative(repoRoot, path.join(FINDER_DIR, 'dom-security-dealer-finder.definition.ts'))} (${dealers.length} BE dealers)`,
  );

  const locatorDefinitionTs = `import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

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
  datasourceTemplate: ${esc(SHARED_DS_TEMPLATE)},
  model: {
    folderTemplate: { name: "Dealer Locator Folder" },
    itemTemplate: {
      name: "Dealer Locator",
      sections: [],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  componentGraphQLQuery: ${JSON.stringify(gql)},
} satisfies ComponentTemplateDefinition;
`;

  await writeFile(
    path.join(LOCATOR_DIR, 'dom-security-dealer-locator.definition.ts'),
    locatorDefinitionTs,
    'utf8',
  );
  console.log(
    `Wrote ${path.relative(repoRoot, path.join(LOCATOR_DIR, 'dom-security-dealer-locator.definition.ts'))} (shared DS)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
