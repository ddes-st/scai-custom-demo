/**
 * Codegen: visual-only TSX → Sitecoreize into molecule packages.
 * Evidence-only (no ai-derived-design / content-families).
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { azureChatCompletion } from '../capture/lib/design-system/ai/azure-chat.mjs';
import {
  aiDebugStem,
  writeAiDebugDump,
  writeDefinitionSanitizeDump,
} from './ai-debug-dump.mjs';
import { sanitizeDefinitionStringSeedsDetailed } from './definition-seed-sanitize.mjs';
import {
  normalizeSitecoreizePathNames,
  writeDefinitionNameNormalizeDump,
} from './definition-path-name-normalize.mjs';
import {
  applyContentSdkVersionToPrompt,
  buildPageSharedDesignPrefixV2,
  buildSectionEvidenceParts,
  formatCodegenReferenceExamplesForPrompt,
  formatInteractionContractForPrompt,
  formatUiIconLibraryForPrompt,
  resolveCodegenEvidenceMode,
  resolveCodegenInferResponsive,
  resolveCodegenMaxDepth,
  resolveContentSdkNextjsVersion,
  screenshotConversionModel,
  sharedDesignPrefixMessage,
  sharedSystemStubMessage,
} from './ai-codegen.mjs';
import {
  ensureBrandComponentPrefix,
  ensureBrandDefinitionKeyPrefix,
  toPascalCase,
  toDefinitionKey,
  toKebabCase,
} from './naming.mjs';
import { normalizeAiSource } from './source-text.mjs';
import { getRegistrySection } from '../capture/lib/section-registry-paths.mjs';
import {
  normalizeIndexChildren,
  normalizeProposedComponentName,
  validateProposedComponentName,
} from './early-naming.mjs';
import {
  isLinkListAsCompositeEnabled,
  linkListAsCompositePromptOverride,
} from '../shared/bq-env.mjs';
import {
  catalogueToProvisionalRole,
  normalizeChromeCatalogue,
} from './chrome-bands.mjs';
import {
  collectHtmlMultiBandEmitDiagnostics,
  collectLayoutSketchInstancePlan,
  countDefinitionTsContentItems,
} from './html-multi-band-contract.mjs';
import {
  SITECOREIZE_CHILD_UNIQUE_NAME_HARD,
  ensureUniqueChildPackageNames,
  remapLayoutSketchComponentNames,
} from './sitecoreize-child-names.mjs';
import { parseSitecoreizeJsonContent } from './collapse-sitecoreize-package-singletons.mjs';
import { formatInlineSvgInventoryForPrompt } from './inline-svg-inventory.mjs';
import { noteFixup } from './create-log.mjs';

export {
  SITECOREIZE_CHILD_UNIQUE_NAME_HARD,
  ensureUniqueChildPackageNames,
  remapLayoutSketchComponentNames,
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = path.join(__dirname, 'prompts');

/**
 * Sitecoreize task HARD — seed only from visual evidence; empty → omit (no invent).
 * Exported for prompt-source regression tests.
 */
export const SITECOREIZE_NO_INVENT_SEED_HARD =
  'HARD — seed values only from visual TSX peer fields (and HTML for that same node); empty visual string/null → omit/empty seed; never invent favicon.ico or placeholder media/URLs/titles/hrefs.';

/**
 * Sitecoreize HARD — AppPlaceholder server-only + definition placeholders parity.
 * Exported for prompt-source regression tests.
 */
export const SITECOREIZE_APPPLACEHOLDER_DEF_PARITY_HARD =
  'HARD — AppPlaceholder + componentMap ONLY on server map-entry tsx (never clientTsx; never import .sitecore/component-map in client — component-map.client is Providers-only). Interactive chrome that shows a PH slot receives already-rendered PH markup as children from the server (<Chrome fields={…}>{AppPlaceholder…}</Chrome>). Definition parity: every AppPlaceholder base (and any role:"child" / parentPlaceholder) ⇒ section definitionTs MUST declare matching placeholders[].key with non-empty allowedControls. A client host does NOT make the parent a leaf — forbidden: placeholders: [] when AppPlaceholder exists or when sibling packages have role:"child"/parentPlaceholder. Empty parent placeholders + nested presentation children → apply fails (requireParentPlaceholderHost / sanitizePartialNesting). React Server Components (RSC) crash if client imports server component-map / mounts AppPlaceholder ({Default: function Default}).';

/**
 * Sitecoreize HARD — AppPlaceholder name must include DynamicPlaceholderId.
 * Bare name="support-content" resolves empty when Edge children live under support-content-1 / support-content-{*}.
 * Exported for prompt-source regression tests.
 */
export const SITECOREIZE_DYNAMIC_PLACEHOLDER_NAME_HARD =
  "HARD — AppPlaceholder name MUST use DynamicPlaceholderId: const placeholderBase = '<placeholders[].key>'; const dynId = props.params?.DynamicPlaceholderId ?? props.rendering?.params?.DynamicPlaceholderId; const phName = dynId ? `${placeholderBase}-${dynId}` : placeholderBase; <AppPlaceholder name={phName} rendering={…} page={…} componentMap={componentMap} />. Multi-slot hosts: one Base+Ph per key (same dynId). Forbidden: bare string name=\"kebab-base\" / name={'kebab-base'} — Content SDK will not match layout children under base-{*} / base-N (empty header/footer/body placeholders).";

/**
 * Sitecoreize HARD — TS-safe Field / Link / definition shapes (avoids next:build TS2322/TS2353).
 * Exported for prompt-source regression tests.
 */
export const SITECOREIZE_TSX_FIELD_USAGE_HARD =
  'HARD — TS Field usage: never put Field / LinkField / ImageField objects in DOM string attrs (aria-label, title, placeholder) or as React text children — including nested map rows (`{card.fields.Title}`, `{item.fields.Body}`) — use <Text field={…} /> or String(field?.value ?? \'\') (coerce value; Field.value may be string|number). Link destinations: field.value?.href or getFieldValue(link)?.href — never linkField.url / never flat card.href after childItemTemplate promote. <Link field={x}> requires a defined LinkField — guard, early continue, or ?? emptyLinkField (never field={item.fields?.Link} bare). Nested content templates: model.childItemTemplate as sibling of itemTemplate — NEVER itemTemplate.children. LinkList packages: placeholders: []. HARD — bind map-entry and clientTsx as (props: Props) — forbid ({ fields }) chrome (TS2304 when mixed with props.). Map-entry unwraps: const datasource = getDatasource(props.fields) then pass flat fields={datasource} into .client; clientTsx never calls getDatasource — only props.fields / props.fields.children. Client Props stay narrow { fields; children? } / data-DTO { data } — never ComponentWithContextProps on companion. Serializable data-DTO chrome must NOT also pass fields=. HARD — do not copy capture HTML data-* into TSX (except BQ allowlist data-bq-* / data-media-tab-* / data-story-* / data-mobile-menu(-toggle) when layoutMode needs them). If Default/client can `return null` (dismissed overlays, closed menus), annotate `JSX.Element | null` — bare `JSX.Element` is TS2322.';

/**
 * Sitecoreize HARD — no self-nest in allowedControls; LinkList leaves stay placeholders: [].
 * Exported for prompt-source regression tests.
 */
export const SITECOREIZE_NO_SELF_ALLOWED_CONTROLS_HARD =
  'HARD — Never put a package\'s own definitionKey in placeholders[].allowedControls (self-nest forbidden). Host slots list distinct child keys only. LinkList / platform Link|Icon|Image Link Lists packages are leaves: emit exactly placeholders: [] — do not copy the parent host placeholder map onto the list package.';

/**
 * Sitecoreize HARD — runtime TSX must not hardcode capture/CDN image URLs.
 * Seeds may keep capture URLs as apply ingest sources; browsers must load Sitecore media only.
 * Exported for prompt-source regression tests.
 */
export const SITECOREIZE_NO_CAPTURE_IMAGE_URLS_HARD =
  'HARD — Runtime tsx/clientTsx must NOT hardcode absolute capture/CDN image URLs (http/https). Every visible image asset from HTML/crops — <img>, CSS mask-image / -webkit-mask-image / maskImage / WebkitMaskImage, primary background-image / bg-[url(https://…)] — becomes a Sitecore Image field + content seed. Prefer { svgMarkup, alt } for SVG chrome/masks when markup is available; else { url, alt }. Paint photos with <Image field={…} />. Prefer Content SDK <Image> over native <picture>/<source srcSet={rawUrl}>; art-direction = multiple Image fields + CSS show/hide (not raw srcSet). CSS mask-image CORS: do NOT rely on mask-image: url(${fields[\'…\']?.value?.src}) when src may be cross-origin (blank photo) — prefer data-URI from svgMarkup, clip-path/radius, or background-image for decorative pebbles (background-image ≠ mask-image for CORS). Desktop mask at md+ only; never always-mask with the mobile SVG. Seeds MAY keep capture URL as apply ingest; browsers load Sitecore /-/media/… for <Image>/bg. Forbidden: absolute http(s) in runtime styles/img src; mask-image with remote absolute URLs. Carve-out: sc-cta-after-arrow shared CTA utility only.';

/**
 * Sitecoreize HARD — multi-band HTML ⇒ composite packages + layoutSketch (any section).
 * Exported for prompt-source regression tests. No planMode / enrich-hint gate.
 */
export const SITECOREIZE_MULTI_BAND_COMPOSITE_HARD =
  'HARD — Stacked peer bands (grid-section / HelpAndHealth / Support+Health body) ⇒ composite: one role:"section" host + one role:"child" package per DISTINCT band type (not per peer instance) + top-level layoutSketch nesting every peer (datasourceName). Host definitionTs MUST declare placeholders[].key with non-empty allowedControls listing every child definitionKey (never "unused", never placeholders: []). Same child componentName repeating in layoutSketch ⇒ that package content.items.length === peer count === repeatHint (each item.name matches datasourceName) with VF-ready Image { url|src, alt } / Link { text, url } seeds where the visual has media/CTAs. Mixed once-only bands (help/health/benefits) still get their own child package with repeatHint:1. Forbidden: host-only packages[] + rich layoutSketch; one package per peer; under-seeded content.items; peer bands as host Multi-LineText/JSON bags; hollow allowedControls; PH key drift across AppPlaceholder/definition/sketch. Follow MULTI_BAND_COMPOSITE_EXAMPLE in the project contract. Structure is packages + layoutSketch + definitionTs + tsx only — no methodology essay.';

/** Sitecoreize HARD — Multi-LineText JSON bags are Fields, not arrays. */
export const SITECOREIZE_JSON_BAG_ARRAY_MAP_HARD =
  "HARD — Never type a Multi-LineText bag as Cards: Card[] (or any T[]) and call fields.Cards.map(...). Field objects are not arrays — that crashes preview (map is not a function) and blanks sitecoreize-proof shots. Prefer childItemTemplate + getDatasource().children.results. If a JSON Multi-LineText bag is unavoidable: type Cards: Field<string>, JSON.parse(String(fields.Cards?.value || '[]')), then map.";

/**
 * Sitecoreize HARD — leaf map-entry with hooks must be a Client Component.
 * Exported for prompt-source regression tests.
 */
export const SITECOREIZE_LEAF_USE_CLIENT_HARD =
  "HARD — Leaf map-entry (no AppPlaceholder) that uses client hooks/handlers (useState, useEffect, onClick, …) MUST start with 'use client'. Composite hosts with AppPlaceholder stay Server Components: put hooks/handlers only in clientTsx ('use client' companion) and pass PH markup as children. Forbidden: useState/onClick on a server map-entry without 'use client' (Turbopack RSC build fail).";

/**
 * Sitecoreize / visual HARD — no `: any` / bare untyped map callbacks.
 * Exported for prompt-source regression tests.
 */
export const SITECOREIZE_NO_ANY_CALLBACKS_HARD =
  "HARD — Runtime tsx/clientTsx must NOT use `: any` or `as any`. Every `.map` / `.filter` / `.forEach` / `.flatMap` callback param must be parenthesized and typed with a named interface/type declared in the file (e.g. columns.map((column: MenuColumn) => …)). Index params may be `number`. Forbidden: bare `.map(column =>`, `(x: any)`, `(item: any, index: number)`, untyped single-param arrows (TS7006).";

/**
 * Sitecoreize task HARD when lockedChildren is non-empty.
 * Exported for prompt-source regression tests.
 * @param {Array<object|string>} lockedChildList
 * @returns {string[]}
 */
export function formatLockedChildrenSitecoreizeHardLines(lockedChildList) {
  const list = Array.isArray(lockedChildList) ? lockedChildList : [];
  if (!list.length) return [];
  const keys = [
    ...new Set(
      list
        .map((c) =>
          String(
            (c && typeof c === 'object'
              ? c.placeholderKey || c.placeholder
              : '') || '',
          ).trim(),
        )
        .filter(Boolean),
    ),
  ];
  const keyHint = keys.length ? keys.join(', ') : '(each locked placeholderKey)';
  return [
    `HARD — lockedChildren non-empty ⇒ composite parent: declare placeholders[] for each distinct placeholderKey (${keyHint}); mount AppPlaceholder on server map-entry tsx (pass as children into client chrome — never AppPlaceholder in clientTsx); definitionTs must still declare the same keys; emit one child package per locked child kind (parentPlaceholder = that key).`,
    'HARD — Forbidden when lockedChildren non-empty: section placeholders: [] ; collapsing locked slots into parent Multi-LineText/JSON bags (Links, card arrays); inventing alternate PH keys or merging locked slots. Empty parent placeholders + nested presentation children → apply fails (requireParentPlaceholderHost).',
  ];
}

async function loadPrompt(name) {
  return readFile(path.join(PROMPTS_DIR, name), 'utf8');
}

/** Compact definition shape example for sitecoreize (patterns only). */
const DEFINITION_SCHEMA_SNIPPET = `
=== DEFINITION SCHEMA (working example — BQ ComponentTemplateDefinition) ===
NOTE: definitionTs / repeatHint / layoutSketch are the BQ codegen contract and emitter
input — not Sitecore-native YAML. Match tools/definitions/types ComponentTemplateDefinition.

import type { ComponentTemplateDefinition } from '…/tools/definitions/types';

export const ExampleSectionDefinition = {
  kind: 'component',
  definitionKey: 'example-section',
  name: 'example-section',
  componentName: 'ExampleSection',
  displayName: 'Example Section',
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Example Sections'] },
  model: {
    folderTemplate: { name: 'Example Section Folder' },
    itemTemplate: {
      name: 'Example Section',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Office Map', type: 'Image' },
          { name: 'Heading', type: 'Single-Line Text' },
          { name: 'Body', type: 'Rich Text' },
          { name: 'CTA', type: 'General Link' },
        ],
      }],
    },
  },
  placeholders: [
    { key: 'navigation-cards', allowedControls: ['example-navigation-card'] },
    { key: 'usp-items', allowedControls: ['example-usp-item'] },
  ],
  content: {
    location: { root: 'data', folder: ['Example Sections'] },
    culture: 'nl-BE',
    items: [{
      name: 'Example Section',
      fields: {
        'Office Map': { url: 'https://example.com/map.png', alt: 'map' },
        Heading: 'Title',
        Body: '<p>Body</p>',
        CTA: { text: 'CTA', url: 'https://example.com' },
      },
    }],
  },
  // Flat link lists → placeholders + separate LinkList package (not JSON bags).
  placeholders: [{ key: 'context-links', allowedControls: ['example-context-link-list'] }],
} satisfies ComponentTemplateDefinition;

Rules:
- Top-level name required (same kebab string as definitionKey).
- model.folderTemplate.name + model.itemTemplate.name required (spaced Title Case; do NOT start with codePrefix — brand lives only on componentName / definitionKey). Shared data architecture may reuse the same itemTemplate.name across packages (e.g. several Link List packages all use itemTemplate.name 'Link List' under folder: ['Link Lists']). Project rendering Path leaf is derived from componentName (unique per distinct TSX/display) — NEVER collapse different displays onto one rendering name via a shared template leaf.
- HARD — different visual/TSX ⇒ different componentName + definitionKey (unique Project rendering). OK to reuse the same itemTemplate / childItemTemplate / data folder when the field architecture matches.
- content.location required ({ root: 'data', folder: […] } — mirrors datasourceLocation without scope).
- sections[].fields MUST be an array of { name, type } — NEVER a map/object of fieldName → { type, title, default }.
- Definition seeds ≠ runtime Field shapes: Text = plain string; Image = { url, alt } or { svgMarkup, alt }; Link = { text, url }.
- FORBIDDEN in content.items[].fields: { value: … }, Image { src }, Link { href } as primary key, bare identifiers.
- One placeholders[] entry per AppPlaceholder base (server map-entry tsx); allowedControls use child definitionKeys.
- HARD — Never put a package's own definitionKey in placeholders[].allowedControls (self-nest forbidden). Host slots list distinct child keys only.
- HARD — AppPlaceholder + componentMap ONLY on server map-entry tsx; clientTsx takes children (never AppPlaceholder / .sitecore/component-map). definitionTs placeholders[] must declare those keys (non-empty allowedControls). Client chrome does not make the parent a leaf — never emit placeholders: [] when AppPlaceholder exists or when role:"child" packages nest under this section.
- Child packages: placeholders: [], own fields + content.items seeds.
- Nested content / LinkList templates: model.childItemTemplate (sibling of itemTemplate) — NEVER itemTemplate.children: { itemTemplate: … }. LinkList / platform Link|Icon|Image Link Lists packages keep placeholders: [] — never copy the parent host placeholder map onto the list package.
- HARD — seed string quoting: every Single-Line / Multi-Line / Rich Text / displayName / plain string field seed must be JSON.stringify("…") (or an equivalent double-quoted JSON string). Forbidden: raw '…' for natural-language or HTML copy (apostrophes / ? / newlines break TS parse). No C0/non-printable controls (no \\f/\\b/\\0); no CSS/<style> bleed into prose.
  - Bad: Body: '<p>Met de online programma's van Therapieland…</p>'
  - Good: Body: JSON.stringify("<p>Met de online programma's van Therapieland…</p>")
- HARD — content.items element close: each item is \`{ name, fields: { … } }\` — close **fields then item** before the next \`, { name\`. When the last field is a nested object (\`CTA: { text, url }\` / Image) you need \` } } }, { name\` (fields + item), not \` } }, { name\` (fields only). Ban \`JSON.stringify(JSON.stringify(…))\`.
  - Bad: \`CTA: { text: '…', url: '…' } }, { name: 'Next'\`
  - Good: \`CTA: { text: '…', url: '…' } } }, { name: 'Next'\`
- Omit child packages / placeholder bands with zero visual peers. Never emit \`items: []\` when \`repeatHint >= 1\`.
- LANGUAGE: AI-invented identities (definitionKey, componentName, displayName, template/folder names, field names/types, placeholder keys) are always English — even when HTML is Dutch (or other). Field seed VALUES and content.culture follow the capture/HTML language. content.items[].name may copy HTML labels (capture lang); tooling EN-normalizes Path names and keeps the original as displayName, and remaps layoutSketch datasourceName to match.
- HARD — Sitecore Path safety: content.items[].name AND children[].name must be ItemNameValidation-safe (letters/digits/spaces/hyphens only). Forbidden in Path names: ? / \\ % * : | " < > ' and other punctuation (e.g. "Kan het lekkerder? Slapen..." is INVALID as name). Natural copy with ?/apostrophes belongs in Title / displayName / field values — never in Path name. JSON-bag row title may keep punctuation for Title seed, but Path name must strip it. Tooling sanitizes Path names as a last resort; do not rely on that alone.
- Sitecore authoring names (template / folder / rendering Path / content Path / field names) are spaced Title Case and must NOT start with codePrefix. Only componentName (Pascal) and definitionKey (kebab) are brand-prefixed for FE / Component Name [shared]. Field VALUES may still mention the brand in prose.
- PLACEHOLDER LinkList (flat link lists): when UI is a flat list of links (footer legal/info, context/utility strips, footer column links — NOT nested mega-menu), do NOT seed Multi-LineText JSON { text, url }[] on the parent and do NOT emit content.linkLists. Instead: (1) parent non-list fields only + placeholders: [{ key, allowedControls: ['{link-list-definition-key}'] }] + AppPlaceholder in TSX; (2) separate LinkList package with folder: ['Link Lists'], content.items = one group (optional Title) + children { name, fields: { Link: { text, url } } }; (3) layoutSketch places ONE LinkList rendering in that PH with datasourceName = the group name. Nested mega-menu JSON stays FE-only — never Link Lists / never content.linkLists.
=== END DEFINITION SCHEMA ===
`.trim();

/** Compact output contract for sitecoreize JSON (emit reads this shape). */
export const SITECOREIZE_OUTPUT_JSON_SCHEMA = `
=== OUTPUT JSON SCHEMA ===
{
  "packages": [
    {
      "componentName": "PascalCase",
      "role": "section" | "child",
      "parentPlaceholder": "kebab-key-or-null",
      "packageKind": "default" | "navigation",
      "repeatHint": 1,
      "tsx": "/* complete map-entry .tsx source */",
      "clientTsx": "/* complete .client.tsx source, or null / omit */",
      "definitionTs": "/* complete .definition.ts source */"
    }
  ],
  "layoutSketch": {
    "target": "page" | "partial-header" | "partial-footer",
    "rootPlaceholder": "main",
    "renderings": [
      {
        "componentName": "PascalCase",
        "datasourceName": "Item Name",
        "placeholders": {
          "kebab-key": [
            { "componentName": "ChildPascal", "datasourceName": "Child 1" }
          ]
        }
      }
    ]
  },
  "reason": "Brief design decisions, ambiguities and any trade-offs"
}
Rules:
- One packages[] object per component *type* (not per content instance).
- role "section": parentPlaceholder null; use lockedSectionName when supplied.
- role "child": non-null parentPlaceholder matching parent placeholders[].key / AppPlaceholder base / layoutSketch key.
- HARD: If any package has role "child" and/or a non-null parentPlaceholder, packages[] MUST also include exactly one role "section" parent with matching placeholders[].key and that child in allowedControls. Child-only responses are invalid. layoutSketch must be top-level (not nested only under a child).
- HARD: AppPlaceholder + componentMap ONLY on server map-entry tsx (pass as children into client chrome). Section definitionTs must NOT use placeholders: [] — declare every AppPlaceholder base with allowedControls. Interactive UI may live in clientTsx; placeholder declaration always on definitionTs.
- repeatHint === content.items.length === count of layoutSketch entries under that PH for peer repeats.
- Unique JSON keys per object (no duplicate tsx/definitionTs/clientTsx). Unused companion → null or omit — never "".
=== END OUTPUT JSON SCHEMA ===
`.trim();

/**
 * Worked multi-band composite example (section-04 / Support+Health topology).
 * Teaches mixed child types + repeated split peers ↔ content.items for VF render.
 * Exported for prompt-source regression tests.
 */
export const MULTI_BAND_COMPOSITE_EXAMPLE_SNIPPET = `
=== MULTI-BAND COMPOSITE EXAMPLE (structure + VF seeds — copy this topology) ===
Stacked peer bands (HelpAndHealth / Support+Health page body): ONE host PH, mixed
child TYPES, and the SAME split type repeated as many layoutSketch peers.

packages[] length === number of DISTINCT componentName types (here 5), NOT peer count.

{
  "packages": [
    {
      "componentName": "ExampleSupportHealthStack",
      "role": "section",
      "parentPlaceholder": null,
      "packageKind": "default",
      "repeatHint": 1,
      "tsx": "/* map-entry: placeholderBase='support-health-content'; dynId phName; <AppPlaceholder name={phName} … /> only — never definitionTs:\\"unused\\" */",
      "clientTsx": null,
      "definitionTs": "/* FULL source: placeholders: [{ key: 'support-health-content', allowedControls: ['example-help-cards-band','example-split-content-band','example-health-cards-band','example-benefits-band'] }], content.items: [{ name: 'Support Health Stack', fields: {} }] */"
    },
    {
      "componentName": "ExampleHelpCardsBand",
      "role": "child",
      "parentPlaceholder": "support-health-content",
      "packageKind": "default",
      "repeatHint": 1,
      "tsx": "/* leaf band TSX; placeholders: [] */",
      "clientTsx": null,
      "definitionTs": "/* content.items: [{ name: 'Help Cards', fields: { Heading: 'We helpen je graag verder' } }] — ONE sketch peer */"
    },
    {
      "componentName": "ExampleSplitContentBand",
      "role": "child",
      "parentPlaceholder": "support-health-content",
      "packageKind": "default",
      "repeatHint": 3,
      "tsx": "/* ONE package for ALL split peers; Image + Text + Link fields */",
      "clientTsx": null,
      "definitionTs": "/* content.items MUST list EVERY sketch peer (names === datasourceName):\\n[{ name: 'Band One', fields: { Heading: 'One', Body: '<p>…</p>', Image: { url: 'https://cdn.example/a.jpg', alt: 'a' }, CTA: { text: 'Meer', url: 'https://example.com/a' } } },\\n { name: 'Band Two', fields: { Heading: 'Two', Body: '<p>…</p>', Image: { url: 'https://cdn.example/b.jpg', alt: 'b' }, CTA: { text: 'Meer', url: 'https://example.com/b' } } },\\n { name: 'Band Three', fields: { Heading: 'Three', Body: '<p>…</p>' } }]  // text-only peer: omit Image */"
    },
    {
      "componentName": "ExampleHealthCardsBand",
      "role": "child",
      "parentPlaceholder": "support-health-content",
      "packageKind": "default",
      "repeatHint": 1,
      "tsx": "/* card grid; prefer childItemTemplate + children.results over JSON bags */",
      "clientTsx": null,
      "definitionTs": "/* content.items: [{ name: 'Meer gezondheid', fields: { Heading: 'Meer gezondheid' }, children: [{ name: 'Card A', fields: { Title: 'A', Image: { url: 'https://cdn.example/c.jpg', alt: 'c' }, Link: { text: 'Lees', url: 'https://example.com/c' } } }] }] */"
    },
    {
      "componentName": "ExampleBenefitsBand",
      "role": "child",
      "parentPlaceholder": "support-health-content",
      "packageKind": "default",
      "repeatHint": 1,
      "tsx": "/* icon/feature row */",
      "clientTsx": null,
      "definitionTs": "/* content.items: [{ name: 'Benefits', fields: { Heading: 'Daarom' }, children: [{ name: 'Benefit 1', fields: { Title: 'One', Image: { svgMarkup: '<svg/>', alt: '' } } }] }] */"
    }
  ],
  "layoutSketch": {
    "target": "page",
    "rootPlaceholder": "main",
    "renderings": [{
      "componentName": "ExampleSupportHealthStack",
      "datasourceName": "Support Health Stack",
      "placeholders": {
        "support-health-content": [
          { "componentName": "ExampleHelpCardsBand", "datasourceName": "Help Cards" },
          { "componentName": "ExampleSplitContentBand", "datasourceName": "Band One" },
          { "componentName": "ExampleSplitContentBand", "datasourceName": "Band Two" },
          { "componentName": "ExampleSplitContentBand", "datasourceName": "Band Three" },
          { "componentName": "ExampleHealthCardsBand", "datasourceName": "Meer gezondheid" },
          { "componentName": "ExampleBenefitsBand", "datasourceName": "Benefits" }
        ]
      }
    }]
  },
  "reason": "Mixed once-only bands + repeated split type; seeds paint sitecoreize-proof."
}

IDENTITY (count before emit):
- packages.length === distinct types (host + each band type)
- For ExampleSplitContentBand: layoutSketch peers (3) === content.items.length (3) === repeatHint (3)
- Every layoutSketch.componentName exists in packages[]; every child definitionKey is in host allowedControls
- definitionTs is FULL source on every package — never the literal string "unused"
- Image seeds use { url|src, alt } or { svgMarkup, alt }; Link seeds use { text, url } — required for VF/sitecoreize-proof

FORBIDDEN (multi-band CONTRACT / blank proof shots):
- packages: [host only] while layoutSketch lists child peers
- One packages[] entry per sketch peer (3 Split packages for 3 splits)
- content.items.length=0 or 1 when layoutSketch has 3× ExampleSplitContentBand
- Host Multi-LineText/JSON bags for peer bands; hollow allowedControls: []; placeholders: []
- PH key mismatch across AppPlaceholder base / placeholders[].key / layoutSketch / parentPlaceholder
- Nesting the host componentName under its own placeholders
=== END MULTI-BAND COMPOSITE EXAMPLE ===
`.trim();

/** Max sitecoreize retries after orphan-child topology (separate from multi-band). */
export const SITECOREIZE_ORPHAN_CHILD_MAX_RETRIES = 2;

/** Max sitecoreize retries for HTML multi-band CONTRACT (0 = fail first emit, no AI regen). */
export const SITECOREIZE_MULTI_BAND_MAX_RETRIES = 0;

/** Cap for previous packages/layoutSketch attached on sitecoreize CONTRACT retries. */
export const SITECOREIZE_RETRY_PREVIOUS_JSON_MAX_CHARS = 100_000;

/**
 * True when packages imply composite children but have no role:"section" parent.
 * @param {Array<{ role?: string, parentPlaceholder?: string|null, componentName?: string }>|null|undefined} packages
 */
export function isOrphanChildPackageList(packages) {
  const list = Array.isArray(packages) ? packages : [];
  if (!list.length) return false;
  const hasSection = list.some(
    (p) => String(p?.role || '').toLowerCase() === 'section',
  );
  if (hasSection) return false;
  return list.some((p) => {
    const role = String(p?.role || '').toLowerCase();
    const ph = String(p?.parentPlaceholder || '').trim();
    return role === 'child' || Boolean(ph);
  });
}

/**
 * Collect AppPlaceholder / placeholder keys referenced by children or layoutSketch.
 * @param {object[]} packages
 * @param {object|null|undefined} layoutSketch
 * @returns {string[]}
 */
export function collectOrphanHostPlaceholderKeys(packages, layoutSketch) {
  /** @type {string[]} */
  const keys = [];
  const push = (k) => {
    const key = String(k || '').trim();
    if (key && !keys.includes(key)) keys.push(key);
  };
  for (const p of Array.isArray(packages) ? packages : []) {
    push(p?.parentPlaceholder);
  }
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    const phs = node.placeholders;
    if (phs && typeof phs === 'object') {
      for (const [k, kids] of Object.entries(phs)) {
        push(k);
        if (Array.isArray(kids)) for (const kid of kids) walk(kid);
      }
    }
  };
  const roots = Array.isArray(layoutSketch?.renderings) ? layoutSketch.renderings : [];
  for (const r of roots) walk(r);
  return keys;
}

/**
 * When AI returns child-only packages but layoutSketch names the locked section host,
 * synthesize a minimal role:"section" package so wiring can continue.
 *
 * @param {object[]} packages
 * @param {object|null|undefined} layoutSketch
 * @param {{ sectionComponentName: string, sectionDefinitionKey: string, sectionTsx?: string|null, sectionDefinitionTs?: string|null, sectionClientTsx?: string|null }} opts
 * @returns {{ packages: object[], repaired: boolean }}
 */
export function repairOrphanChildPackagesWithSketchHost(packages, layoutSketch, opts) {
  const list = Array.isArray(packages) ? [...packages] : [];
  if (!isOrphanChildPackageList(list)) {
    return { packages: list, repaired: false };
  }
  const sectionName = String(opts.sectionComponentName || '').trim();
  const sectionKey = String(opts.sectionDefinitionKey || '').trim();
  if (!sectionName || !sectionKey) {
    return { packages: list, repaired: false };
  }
  const sketchHost = Array.isArray(layoutSketch?.renderings)
    ? layoutSketch.renderings.find(
        (r) =>
          String(r?.componentName || '').trim() === sectionName ||
          String(r?.definitionKey || '').trim() === sectionKey,
      )
    : null;
  if (!sketchHost && !collectOrphanHostPlaceholderKeys(list, layoutSketch).length) {
    return { packages: list, repaired: false };
  }

  const phKeys = collectOrphanHostPlaceholderKeys(list, layoutSketch);
  if (!phKeys.length) {
    return { packages: list, repaired: false };
  }

  /** @type {Map<string, string[]>} */
  const allowedByPh = new Map();
  for (const p of list) {
    const ph = String(p?.parentPlaceholder || '').trim();
    const childKey = String(p?.definitionKey || '').trim();
    if (!ph || !childKey) continue;
    const arr = allowedByPh.get(ph) || [];
    if (!arr.includes(childKey)) arr.push(childKey);
    allowedByPh.set(ph, arr);
  }

  const placeholdersLiteral = phKeys
    .map((k) => {
      const allowed = allowedByPh.get(k) || [];
      const allowedLit = allowed.length
        ? `[${allowed.map((a) => `'${a}'`).join(', ')}]`
        : '[]';
      return `{ key: '${k}', allowedControls: ${allowedLit} }`;
    })
    .join(',\n    ');

  const appPhJsx = phKeys
    .map(
      (k) =>
        `      <AppPlaceholder name={dynId ? \`${k}-\${dynId}\` : '${k}'} rendering={rendering} page={page} componentMap={componentMap} />`,
    )
    .join('\n');

  const synthesizedTsx =
    String(opts.sectionTsx || '').trim() ||
    `import React, { JSX } from 'react';
import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import componentMap from '.sitecore/component-map';

type Props = ComponentWithContextProps;

export const Default = (props: Props): JSX.Element => {
  const { rendering, page } = props;
  const dynId = props.params?.DynamicPlaceholderId ?? props.rendering?.params?.DynamicPlaceholderId;
  return (
    <>
${appPhJsx}
    </>
  );
};

export default Default;`;

  const synthesizedDef =
    String(opts.sectionDefinitionTs || '').trim() ||
    `import type { ComponentTemplateDefinition } from '../../../../tools/definitions/types';
export const ${sectionName}Definition = {
  kind: 'component',
  definitionKey: '${sectionKey}',
  name: '${sectionKey}',
  componentName: '${sectionName}',
  displayName: '${sectionName}',
  datasourceLocation: { scope: 'site', root: 'data', folder: ['${sectionName}s'] },
  model: {
    folderTemplate: { name: '${sectionName} Folder' },
    itemTemplate: { name: '${sectionName}', sections: [{ name: 'Content', fields: [] }] },
  },
  placeholders: [
    ${placeholdersLiteral}
  ],
  content: {
    location: { root: 'data', folder: ['${sectionName}s'] },
    culture: 'en',
    items: [{ name: '${sectionName}', fields: {} }],
  },
} satisfies ComponentTemplateDefinition;`;

  const sectionPkg = {
    componentName: sectionName,
    definitionKey: sectionKey,
    kebab: toKebabCase(sectionName),
    role: 'section',
    parentPlaceholder: null,
    packageKind: 'default',
    repeatHint: 1,
    tsx: synthesizedTsx,
    definitionTs: synthesizedDef,
    clientTsx: opts.sectionClientTsx ? String(opts.sectionClientTsx) : null,
  };

  console.warn(
    `  ⚠ Sitecoreize orphan-child repair: synthesized role:"section" "${sectionName}" from layoutSketch (${phKeys.join(', ')})`,
  );
  return { packages: [sectionPkg, ...list], repaired: true };
}

/**
 * Build revisionBrief.changes for an orphan-child sitecoreize retry.
 * @param {Array<{ role?: string, parentPlaceholder?: string|null, componentName?: string, definitionKey?: string }>|null|undefined} packages
 * @param {{ sectionComponentName?: string, sectionDefinitionKey?: string }} [opts]
 * @returns {string[]}
 */
export function buildOrphanChildRetryChanges(packages, opts = {}) {
  const list = Array.isArray(packages) ? packages : [];
  const sectionName =
    String(opts.sectionComponentName || '').trim() || 'Section';
  const sectionKey =
    String(opts.sectionDefinitionKey || '').trim() ||
    toDefinitionKey(sectionName);
  const child = list.find((p) => {
    const role = String(p?.role || '').toLowerCase();
    return role === 'child' || Boolean(String(p?.parentPlaceholder || '').trim());
  });
  const childName = String(child?.componentName || 'Child').trim();
  const childKey =
    String(child?.definitionKey || '').trim() || toDefinitionKey(childName);
  const ph =
    String(child?.parentPlaceholder || '').trim() || 'child-placeholder';
  return [
    `INVALID PACKAGES: child-only response. Found child "${childName}" with parentPlaceholder "${ph}" but no role:"section" package.`,
    `Emit BOTH: (1) role:"section" lockedSectionName "${sectionName}" / lockedDefinitionKey "${sectionKey}" with AppPlaceholder base ${ph} and placeholders:[{ key:"${ph}", allowedControls:["${childKey}"] }]; (2) keep ${childName} as role:"child" with parentPlaceholder "${ph}".`,
    `packages[] must include exactly one role:"section" (${sectionName}) AND every child named in layoutSketch — host-only / child-only / patch delta = INVALID.`,
    'layoutSketch must be top-level (not nested only under the child).',
  ];
}

/**
 * Count role:"child" (or parentPlaceholder) packages.
 * @param {Array<{ role?: string, parentPlaceholder?: string|null }>|null|undefined} packages
 * @returns {number}
 */
export function countSitecoreizeChildPackages(packages) {
  const list = Array.isArray(packages) ? packages : [];
  return list.filter((p) => {
    const role = String(p?.role || '').toLowerCase();
    return role === 'child' || Boolean(String(p?.parentPlaceholder || '').trim());
  }).length;
}

/**
 * True when a retry collapsed a composite into a host-only / tiny stub.
 * @param {Array<object>|null|undefined} previousPackages
 * @param {Array<object>|null|undefined} nextPackages
 * @returns {boolean}
 */
export function isSitecoreizeRetryCollapse(previousPackages, nextPackages) {
  const prev = Array.isArray(previousPackages) ? previousPackages : [];
  const next = Array.isArray(nextPackages) ? nextPackages : [];
  if (!prev.length || !next.length) return false;
  const prevChildren = countSitecoreizeChildPackages(prev);
  const nextChildren = countSitecoreizeChildPackages(next);
  if (prevChildren >= 1 && nextChildren === 0) return true;
  if (prev.length >= 3 && next.length === 1) return true;
  const prevBytes = prev.reduce(
    (n, p) =>
      n +
      String(p?.tsx || '').length +
      String(p?.definitionTs || '').length +
      String(p?.clientTsx || '').length,
    0,
  );
  const nextBytes = next.reduce(
    (n, p) =>
      n +
      String(p?.tsx || '').length +
      String(p?.definitionTs || '').length +
      String(p?.clientTsx || '').length,
    0,
  );
  return prevBytes >= 8000 && nextBytes > 0 && nextBytes < prevBytes * 0.25;
}

/**
 * Concrete seed checklist from layoutSketch peers vs package content.items.
 * @param {object|null|undefined} layoutSketch
 * @param {Array<{ role?: string, parentPlaceholder?: string|null, componentName?: string, definitionTs?: string }>|null|undefined} packages
 * @returns {string[]}
 */
export function buildMultiBandSeedChecklist(layoutSketch, packages) {
  const plan = collectLayoutSketchInstancePlan(layoutSketch);
  if (!plan.length) return [];
  /** @type {Map<string, string[]>} */
  const byName = new Map();
  for (const row of plan) {
    const name = String(row.componentName || '').trim();
    if (!name) continue;
    const list = byName.get(name) || [];
    const ds = String(row.datasourceItem || '').trim() || '(unnamed)';
    list.push(ds);
    byName.set(name, list);
  }
  const pkgList = Array.isArray(packages) ? packages : [];
  /** @type {string[]} */
  const lines = [];
  for (const [name, datasourceNames] of byName) {
    if (datasourceNames.length < 2) continue;
    const pkg = pkgList.find(
      (p) =>
        String(p?.componentName || '').trim().toLowerCase() ===
        name.toLowerCase(),
    );
    const actual = pkg
      ? countDefinitionTsContentItems(String(pkg.definitionTs || ''))
      : 0;
    lines.push(
      `${name}: need content.items.length=${datasourceNames.length} ` +
        `(have ${actual}); datasourceName order: ${datasourceNames.join(', ')}`,
    );
  }
  return lines;
}

/**
 * Compact previous packages JSON for retry feedback (prefer definitionTs).
 * @param {Array<object>|null|undefined} packages
 * @param {object|null|undefined} layoutSketch
 * @param {{ maxChars?: number }} [opts]
 * @returns {{ packagesJson: string, layoutSketchJson: string }}
 */
export function serializeSitecoreizePreviousForFeedback(
  packages,
  layoutSketch,
  opts = {},
) {
  const maxChars = Math.max(
    20_000,
    Number(opts.maxChars) || SITECOREIZE_RETRY_PREVIOUS_JSON_MAX_CHARS,
  );
  const list = Array.isArray(packages) ? packages : [];
  const compactPkg = (p, bodyMax) => {
    const role = String(p?.role || '').toLowerCase() === 'child' ? 'child' : 'section';
    const trimBody = (s, n) => {
      const t = String(s || '');
      if (t.length <= n) return t;
      return `${t.slice(0, n)}\n/* …truncated ${t.length - n} chars… */`;
    };
    return {
      componentName: p?.componentName || null,
      definitionKey: p?.definitionKey || null,
      role,
      parentPlaceholder: p?.parentPlaceholder ?? null,
      packageKind: p?.packageKind || 'default',
      repeatHint: Number(p?.repeatHint) > 0 ? Number(p.repeatHint) : 1,
      // Prefer definitionTs (seeds) over tsx when budget is tight.
      definitionTs: trimBody(p?.definitionTs, bodyMax),
      tsx: trimBody(p?.tsx, Math.floor(bodyMax * 0.6)),
      clientTsx: p?.clientTsx
        ? trimBody(p.clientTsx, Math.floor(bodyMax * 0.35))
        : null,
    };
  };

  let bodyMax = 24_000;
  let packagesJson = '';
  let layoutSketchJson = JSON.stringify(layoutSketch ?? null, null, 2);
  if (layoutSketchJson.length > Math.floor(maxChars * 0.2)) {
    layoutSketchJson = `${layoutSketchJson.slice(0, Math.floor(maxChars * 0.2))}\n/* …truncated… */`;
  }
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const payload = list.map((p) => compactPkg(p, bodyMax));
    packagesJson = JSON.stringify(payload, null, 2);
    if (packagesJson.length + layoutSketchJson.length <= maxChars) break;
    bodyMax = Math.max(2_000, Math.floor(bodyMax * 0.55));
  }
  if (packagesJson.length + layoutSketchJson.length > maxChars) {
    const room = Math.max(
      4_000,
      maxChars - layoutSketchJson.length - 80,
    );
    packagesJson = `${packagesJson.slice(0, room)}\n/* …truncated… */`;
  }
  return { packagesJson, layoutSketchJson };
}

/**
 * Build revisionBrief for a sitecoreize CONTRACT retry (always attach prior emit).
 * @param {{
 *   changes: string[],
 *   packages?: Array<object>|null,
 *   layoutSketch?: object|null,
 *   previousDefinitionTs?: string|null,
 *   kind?: 'orphan'|'multi-band'|'collapse',
 * }} opts
 * @returns {object}
 */
export function buildSitecoreizeRetryRevisionBrief(opts = {}) {
  const changes = Array.isArray(opts.changes)
    ? opts.changes.map((c) => String(c || '').trim()).filter(Boolean)
    : [];
  const packages = Array.isArray(opts.packages) ? opts.packages : [];
  const layoutSketch =
    opts.layoutSketch && typeof opts.layoutSketch === 'object'
      ? opts.layoutSketch
      : null;
  const serialized = serializeSitecoreizePreviousForFeedback(
    packages,
    layoutSketch,
  );
  return {
    kind: String(opts.kind || 'retry').trim() || 'retry',
    changes,
    previousPackagesJson: serialized.packagesJson,
    previousLayoutSketchJson: serialized.layoutSketchJson,
    previousDefinitionTs: String(opts.previousDefinitionTs || '').trim() || null,
    previousPackageCount: packages.length,
    previousChildCount: countSitecoreizeChildPackages(packages),
  };
}

/**
 * Multi-band retry changes: diagnostics + concrete seed checklist (no HARD re-paste).
 * @param {string[]} diagnostics
 * @param {object|null|undefined} layoutSketch
 * @param {Array<object>|null|undefined} packages
 * @param {{ sectionComponentName?: string }} [opts]
 * @returns {string[]}
 */
export function buildMultiBandRetryChanges(
  diagnostics,
  layoutSketch,
  packages,
  opts = {},
) {
  const sectionName =
    String(opts.sectionComponentName || '').trim() || 'Section';
  const diags = Array.isArray(diagnostics)
    ? diagnostics.map((d) => String(d || '').trim()).filter(Boolean)
    : [];
  const checklist = buildMultiBandSeedChecklist(layoutSketch, packages);
  /** @type {string[]} */
  const changes = [...diags];
  if (checklist.length) {
    changes.push(
      [
        'SEED CHECKLIST (must match layoutSketch peers — expand content.items, do not drop children):',
        ...checklist.map((l) => `  - ${l}`),
      ].join('\n'),
    );
  }
  changes.push(
    `FULL RE-EMIT: packages[] must keep exactly one role:"section" (${sectionName}) AND every prior role:"child" — host-only / child-only / patch delta = INVALID.`,
  );
  return changes;
}

/**
 * Debug/ledger purpose label for a sitecoreize attempt.
 * @param {{ attempt: number, orphanRetries: number, multiBandRetries: number, collapseRetries?: number }} state
 * @returns {string}
 */
export function sitecoreizeRetryPurposeLabel(state) {
  const attempt = Number(state?.attempt) || 0;
  if (attempt <= 0) return 'codegen-sitecoreize';
  if ((Number(state?.collapseRetries) || 0) > 0 &&
      (Number(state?.orphanRetries) || 0) === 0 &&
      (Number(state?.multiBandRetries) || 0) === 0) {
    return `codegen-sitecoreize-collapse-retry-${attempt}`;
  }
  if ((Number(state?.multiBandRetries) || 0) > 0) {
    return `codegen-sitecoreize-multi-band-retry-${state.multiBandRetries}`;
  }
  if ((Number(state?.orphanRetries) || 0) > 0) {
    return `codegen-sitecoreize-orphan-retry-${state.orphanRetries}`;
  }
  return `codegen-sitecoreize-retry-${attempt}`;
}

/**
 * VALIDATION FEEDBACK user message when a prior generation failed parse/integrity.
 * Attaches previous packages + layoutSketch so the model can patch then FULL re-emit.
 * @param {object|null|undefined} revisionBrief
 * @returns {{ role: 'user', content: string }|null}
 */
export function formatSitecoreizeValidationFeedbackMessage(revisionBrief) {
  if (!revisionBrief || typeof revisionBrief !== 'object') return null;
  const changes = Array.isArray(revisionBrief.changes)
    ? revisionBrief.changes.map((c) => String(c || '').trim()).filter(Boolean)
    : [];
  const prev = String(revisionBrief.previousDefinitionTs || '').trim();
  const prevPackages = String(revisionBrief.previousPackagesJson || '').trim();
  const prevSketch = String(revisionBrief.previousLayoutSketchJson || '').trim();
  if (!changes.length && !prev && !prevPackages) return null;
  return {
    role: 'user',
    content: [
      '=== VALIDATION FEEDBACK (prior generation failed — FULL RE-EMIT REQUIRED) ===',
      'Do NOT return a host-only stub, child-only delta, or partial packages[] patch.',
      'Return the COMPLETE corrected JSON { packages, layoutSketch, reason } with every prior package (section + all children), fixing the CONTRACT below.',
      changes.length ? changes.join('\n\n') : '(see previous packages)',
      prevPackages
        ? [
            '',
            '=== PREVIOUS PACKAGES JSON (patch from this — then re-emit ALL packages) ===',
            prevPackages,
          ].join('\n')
        : '',
      prevSketch
        ? [
            '',
            '=== PREVIOUS LAYOUT SKETCH (keep every peer datasourceName) ===',
            prevSketch,
          ].join('\n')
        : '',
      prev
        ? [
            '',
            '=== PREVIOUS DEFINITION TS ===',
            prev.slice(0, 50000),
          ].join('\n')
        : '',
      '',
      'Return complete JSON { packages, layoutSketch, reason } only — full packages[] (section + every child), never a delta.',
    ]
      .filter((line) => line !== '')
      .join('\n'),
  };
}

function parseJsonContent(content) {
  // Sitecoreize packages: collapse duplicate clientTsx/tsx/definitionTs before
  // JSON.parse last-wins can wipe a non-null body with a later null.
  return parseSitecoreizeJsonContent(content);
}

const COMPONENT_DEF_IMPORT =
  `import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";\n`;

/**
 * AI often emits placeholder import paths (`…/tools/...`, `lib/tools/...`).
 * Force the repo-relative import used by written packages.
 * @param {string} definitionTs
 * @returns {string}
 */
export function sanitizeDefinitionTsImport(definitionTs) {
  let src = String(definitionTs || '');
  if (!src.trim()) return src;
  src = src.replace(
    /import\s+type\s+\{\s*ComponentTemplateDefinition\s*\}\s+from\s+['"][^'"]+['"]\s*;?\s*/g,
    COMPONENT_DEF_IMPORT,
  );
  if (!/ComponentTemplateDefinition/.test(src)) {
    src = `${COMPONENT_DEF_IMPORT}\n${src}`;
  }
  // definitionKey must be kebab (no collection slash)
  src = src.replace(
    /definitionKey:\s*['"]([^'"]+)['"]/g,
    (_m, key) => `definitionKey: '${String(key).replace(/\//g, '-')}'`,
  );
  return src;
}

/**
 * Count top-level content.items objects in definitionTs (brace-depth scan).
 * @param {string} definitionTs
 * @returns {number}
 */
function countDefinitionContentItems(definitionTs) {
  const src = String(definitionTs || '');
  const itemsStart = src.search(/\bitems\s*:\s*\[/);
  if (itemsStart < 0) return 0;
  const after = src.slice(itemsStart);
  const openIdx = after.indexOf('[');
  if (openIdx < 0) return 0;
  let depth = 0;
  let end = -1;
  for (let i = openIdx; i < after.length; i++) {
    const ch = after[i];
    if (ch === '[') depth += 1;
    else if (ch === ']') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return 0;
  const arrBody = after.slice(openIdx + 1, end);
  let count = 0;
  let brace = 0;
  for (let i = 0; i < arrBody.length; i++) {
    const ch = arrBody[i];
    if (ch === '{') {
      if (brace === 0) count += 1;
      brace += 1;
    } else if (ch === '}') {
      brace = Math.max(0, brace - 1);
    }
  }
  return count;
}

/**
 * Non-breaking validation: warn when content.items.length is below expected
 * repeatHint. Does **not** clone or invent seeds (sitecoreize must emit all rows).
 *
 * @param {string} definitionTs
 * @param {number} count expected minimum item count (repeatHint)
 * @param {string} [label] log label (component / seed base name)
 * @returns {{ ok: boolean, actual: number, expected: number, definitionTs: string }}
 */
export function warnIfContentItemCountBelowHint(
  definitionTs,
  count,
  label = 'Item',
) {
  const expected = Math.max(1, Math.trunc(Number(count) || 1));
  const src = String(definitionTs || '');
  const actual = countDefinitionContentItems(src);
  const ok = actual >= expected;
  if (!ok) {
    noteFixup(
      process.env.BQ_CREATE_SECTION || label || '_run',
      `content.items under-seeded for ${label}: got ${actual}, expected ≥ ${expected} (repeatHint). ` +
        `Leaving definition unchanged — sitecoreize must seed every visual peer row.`,
    );
  }
  return { ok, actual, expected, definitionTs: src };
}

/**
 * Hard-fail when content.items under-seed vs layoutSketch peer count / repeatHint.
 * Does **not** clone or invent seeds.
 *
 * @param {string} definitionTs
 * @param {number} expectedPeerCount
 * @param {string} [label]
 * @returns {string} definitionTs unchanged
 */
export function assertContentItemsMatchPeerCount(
  definitionTs,
  expectedPeerCount,
  label = 'Item',
) {
  const expected = Math.max(0, Math.trunc(Number(expectedPeerCount) || 0));
  if (expected < 2) return String(definitionTs || '');
  const src = String(definitionTs || '');
  const actual = countDefinitionContentItems(src);
  if (actual < expected) {
    throw new Error(
      `CONTRACT: content.items under-seeded for ${label}: got ${actual}, expected ≥ ${expected} ` +
        `(layoutSketch peers / repeatHint). Sitecoreize must seed every peer instance — tooling never clones seeds.`,
    );
  }
  return src;
}

/**
 * Count layoutSketch peers for a componentName (case-insensitive).
 * @param {object|null|undefined} layoutSketch
 * @param {string} componentName
 * @returns {number}
 */
export function countSketchPeersForComponent(layoutSketch, componentName) {
  const want = String(componentName || '').trim().toLowerCase();
  if (!want || !layoutSketch) return 0;
  let count = 0;
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const n of node) visit(n);
      return;
    }
    const ph = node.placeholders;
    if (ph && typeof ph === 'object' && !Array.isArray(ph)) {
      for (const list of Object.values(ph)) {
        if (!Array.isArray(list)) continue;
        for (const child of list) {
          const name = String(child?.componentName || '').trim().toLowerCase();
          if (name && name === want) count += 1;
          visit(child);
        }
      }
    }
    if (Array.isArray(node.renderings)) {
      for (const r of node.renderings) visit(r);
    }
  };
  visit(layoutSketch);
  return count;
}

/**
 * Ghost empty-band child: no content.items and layoutSketch PH has zero peers
 * (or template fields are empty). These should be dropped, not written.
 * @param {{ definitionTs?: string, parentPlaceholder?: string|null, repeatHint?: number, componentName?: string }} pkg
 * @param {object|null|undefined} layoutSketch
 * @returns {boolean}
 */
export function isGhostEmptyBandChildPackage(pkg, layoutSketch = null) {
  const def = String(pkg?.definitionTs || '');
  if (!def.trim()) return true;
  const actual = countDefinitionContentItems(def);
  if (actual > 0) return false;

  const ph = String(pkg?.parentPlaceholder || '').trim();
  if (ph && layoutSketch && typeof layoutSketch === 'object') {
    const entries = collectLayoutSketchPhEntries(layoutSketch, ph);
    if (entries.length === 0) return true;
  }

  // Fieldless template + empty items (HelpAdditional-style)
  if (
    /itemTemplate\s*:\s*\{[\s\S]*?fields\s*:\s*\[\s*\]/.test(def) &&
    /items\s*:\s*\[\s*\]/.test(def)
  ) {
    return true;
  }
  return false;
}

/**
 * @param {object} layoutSketch
 * @param {string} placeholderKey
 * @returns {object[]}
 */
function collectLayoutSketchPhEntries(layoutSketch, placeholderKey) {
  const key = String(placeholderKey || '').trim();
  if (!key || !layoutSketch) return [];
  const out = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const n of node) visit(n);
      return;
    }
    const placeholders = node.placeholders;
    if (placeholders && typeof placeholders === 'object') {
      for (const [k, v] of Object.entries(placeholders)) {
        if (k === key && Array.isArray(v)) out.push(...v);
        visit(v);
      }
    }
    for (const v of Object.values(node)) {
      if (v && typeof v === 'object' && v !== placeholders) visit(v);
    }
  };
  visit(layoutSketch);
  return out;
}

/**
 * Remove dropped child definitionKeys from a section definition's placeholders.
 * @param {string} definitionTs
 * @param {Set<string>|string[]} droppedKeys
 * @returns {string}
 */
export function stripDroppedChildrenFromSectionDefinition(
  definitionTs,
  droppedKeys,
) {
  let text = String(definitionTs || '');
  const keys = [...(droppedKeys instanceof Set ? droppedKeys : droppedKeys || [])]
    .map((k) => String(k || '').trim())
    .filter(Boolean);
  if (!text || !keys.length) return text;

  for (const key of keys) {
    const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(
      new RegExp(`(['"])${esc}\\1\\s*,?\\s*`, 'g'),
      '',
    );
  }
  // Drop placeholder objects whose allowedControls became empty
  text = text.replace(
    /\{\s*key:\s*['"][^'"]+['"]\s*,\s*allowedControls:\s*\[\s*\]\s*\}\s*,?/g,
    '',
  );
  text = text.replace(/,\s*([}\]])/g, '$1');
  return text;
}

/**
 * @deprecated Use {@link warnIfContentItemCountBelowHint}. Kept as a no-op
 * passthrough (returns source unchanged) so older call sites do not clone seeds.
 * @param {string} definitionTs
 * @param {number} count
 * @param {string} [baseName]
 * @returns {string}
 */
export function ensureDefinitionContentItemCount(
  definitionTs,
  count,
  baseName = 'Item',
) {
  return warnIfContentItemCountBelowHint(definitionTs, count, baseName)
    .definitionTs;
}

/**
 * Build the post-sitecoreize plan from normalized packages.
 * Placeholder keys come **only** from child `parentPlaceholder` — never from
 * layoutSketch alone (that left mode=single with a stale placeholderKey).
 *
 * @param {{
 *   sectionPkg: object,
 *   childPkgs: object[],
 *   layoutSketch?: object|null,
 *   reason?: string|null,
 * }} opts
 * @returns {object}
 */
export function buildPlanFromPackages(opts = {}) {
  const sectionPkg = opts.sectionPkg || {};
  const childPkgs = Array.isArray(opts.childPkgs) ? opts.childPkgs : [];
  const layoutSketch = opts.layoutSketch || null;

  /** @type {string[]} */
  const placeholderKeys = [];
  for (const c of childPkgs) {
    const ph = String(c?.parentPlaceholder || '').trim();
    if (ph && !placeholderKeys.includes(ph)) placeholderKeys.push(ph);
  }

  const catalogueRole = opts.chromeCatalogue
    ? catalogueToProvisionalRole(opts.chromeCatalogue)
    : null;
  const sketchTarget = String(layoutSketch?.target || '').trim();
  const role =
    catalogueRole ||
    (sketchTarget === 'partial-header' || sketchTarget === 'partial-footer'
      ? sketchTarget
      : sketchTarget === 'partial-cookie'
        ? 'page'
        : 'page');

  return {
    mode: childPkgs.length ? 'composite' : 'single',
    reason: opts.reason || 'codegen',
    role,
    chromeCatalogue: normalizeChromeCatalogue(
      opts.chromeCatalogue ||
        (role === 'partial-header'
          ? 'header'
          : role === 'partial-footer'
            ? 'footer'
            : 'other'),
    ),
    packageKind: sectionPkg.packageKind,
    placeholderKeys,
    section: {
      componentName: sectionPkg.componentName,
      placeholderKey:
        placeholderKeys[0] ||
        (childPkgs.length
          ? String(childPkgs[0]?.parentPlaceholder || '').trim() ||
            toKebabCase(`${sectionPkg.componentName}-items`)
          : null),
      placeholderKeys,
      packageKind: sectionPkg.packageKind,
    },
    children: childPkgs.map((c) => ({
      componentName: c.componentName,
      mode: 'single',
      packageKind: c.packageKind,
      repeatHint: c.repeatHint,
      placeholder: c.parentPlaceholder,
      placeholderKey: c.parentPlaceholder,
    })),
    layoutSketch,
    // Enrich alternativeNames intentionally omitted — FE naming is visual/sitecoreize + lock only.
    alternativeNames: [],
  };
}

/**
 * @param {string[]} takenNames
 * @returns {Set<string>}
 */
function takenLowerSet(takenNames) {
  return new Set(
    (takenNames || []).map((n) => String(n || '').trim().toLowerCase()).filter(Boolean),
  );
}

/**
 * One AI repair when visual proposed a taken / invalid name.
 * @param {object} opts
 */
async function repairVisualComponentName(opts) {
  const {
    visualMessages,
    badName,
    reason,
    codePrefix,
    takenNames,
    lockedName,
    ledger,
    sectionFolder,
    aiDebugRoot,
    projectRoot,
    pageDir,
    registryComponentFolder,
    info,
    evidenceAttachments,
    evidenceImageRelsInOrder,
  } = opts;
  const repairTask = {
    role: 'user',
    content: [
      '=== REPAIR: componentName collision / invalid ===',
      `Previous componentName "${badName}" was rejected: ${reason}`,
      `codePrefix: ${codePrefix || '(none)'}`,
      lockedName
        ? `lockedName (MUST use exactly): ${lockedName}`
        : `takenNames (do not reuse): ${JSON.stringify(takenNames || [])}`,
      'Return JSON { componentName, reason } only (no tsx).',
    ].join('\n'),
  };
  const messages = [...visualMessages, repairTask];
  const result = await azureChatCompletion({
    messages,
    responseFormat: { type: 'json_object' },
    model: screenshotConversionModel(),
  });
  await writeAiDebugDump({
    aiDebugRoot,
    pageDir: pageDir || null,
    projectRoot: projectRoot || (pageDir ? path.dirname(pageDir) : null),
    componentFolder:
      registryComponentFolder ||
      getRegistrySection(info)?.componentFolder ||
      null,
    sectionFolder,
    purpose: 'codegen-visual-name-repair',
    componentName: badName,
    messages,
    result,
    attachments: evidenceAttachments,
    imageRelsInOrder: evidenceImageRelsInOrder,
    evidenceMode: resolveCodegenEvidenceMode(),
    clearBeforeWrite: false,
  });
  ledger?.record({
    purpose: 'codegen-visual-name-repair',
    section: sectionFolder,
    componentName: badName,
    ok: result.ok,
    model: result.model,
    usage: result.usage,
    costEstimate: result.costEstimate,
    skipReason: result.skipReason,
  });
  if (!result.ok) {
    throw new Error(
      `visual name repair failed: ${result.skipReason || 'unknown'}`,
    );
  }
  const parsed = parseJsonContent(result.content);
  return String(parsed.componentName || '').trim();
}

/**
 * One AI repair when sitecoreize child preferred + alternatives are all taken.
 * @param {object} opts
 */
async function repairSitecoreizeChildComponentName(opts) {
  const {
    sitecoreMessages,
    badName,
    reason,
    codePrefix,
    takenNames,
    sectionFolder,
    aiDebugRoot,
    projectRoot,
    pageDir,
    registryComponentFolder,
    info,
    ledger,
  } = opts;
  const repairTask = {
    role: 'user',
    content: [
      '=== REPAIR: child componentName collision / invalid ===',
      `Previous child componentName "${badName}" was rejected: ${reason}`,
      `codePrefix: ${codePrefix || '(none)'}`,
      `takenNames (do not reuse): ${JSON.stringify(takenNames || [])}`,
      'Invent one brand-prefixed PascalCase child name that is NOT in takenNames.',
      'No numeric suffix twins (Foo2). Distinctive molecule name for this child slot.',
      'Return JSON { componentName, reason } only.',
    ].join('\n'),
  };
  const messages = [...(sitecoreMessages || []), repairTask];
  const result = await azureChatCompletion({
    messages,
    responseFormat: { type: 'json_object' },
    model: screenshotConversionModel(),
  });
  await writeAiDebugDump({
    aiDebugRoot,
    pageDir: pageDir || null,
    projectRoot: projectRoot || (pageDir ? path.dirname(pageDir) : null),
    componentFolder:
      registryComponentFolder ||
      getRegistrySection(info)?.componentFolder ||
      null,
    sectionFolder,
    purpose: 'codegen-sitecoreize-child-name-repair',
    componentName: badName,
    messages,
    result,
    clearBeforeWrite: false,
  });
  ledger?.record({
    purpose: 'codegen-sitecoreize-child-name-repair',
    section: sectionFolder,
    componentName: badName,
    ok: result.ok,
    model: result.model,
    usage: result.usage,
    costEstimate: result.costEstimate,
    skipReason: result.skipReason,
  });
  if (!result.ok) {
    throw new Error(
      `sitecoreize child name repair failed: ${result.skipReason || 'unknown'}`,
    );
  }
  const parsed = parseJsonContent(result.content);
  return String(parsed.componentName || '').trim();
}

function formatChromeEvidenceForPrompt(evidence) {
  if (!evidence || typeof evidence !== 'object') return '';
  return [
    '=== CHROME EVIDENCE (hints only — catalogue from the visual) ===',
    `sharedAcrossPages: ${evidence.sharedAcrossPages ? 'true' : 'false'}`,
    `pageCount: ${evidence.pageCount ?? ''}`,
    `sectionIndex: ${evidence.sectionIndex ?? ''}`,
    `sectionCount: ${evidence.sectionCount ?? ''}`,
    `positionBand: ${evidence.positionBand || 'mid'}`,
    'Return chromeCatalogue: header | footer | breadcrumb | other (never cookie).',
  ].join('\n');
}

/**
 * Run visual + sitecoreize for one section.
 *
 * @param {object} opts
 * @param {string} [opts.codePrefix] Brand Pascal prefix (e.g. Crelan)
 * @param {string[]} [opts.takenNames] Collection-scoped taken component names / keys
 * @param {string|null} [opts.lockedName] Locked section componentName for this sectionDir
 * @param {string|null} [opts.lockedDefinitionKey]
 * @param {Array<object|string>|null} [opts.lockedChildren] Index child locks
 * @param {(ctx: { componentName: string, definitionKey: string, visualTsx: string }) => Promise<void>|void} [opts.beforeSitecoreize]
 * @param {object|null} [opts.revisionBrief] Prior validate failure — adds VALIDATION FEEDBACK message
 * @returns {Promise<{
 *   visualTsx: string,
 *   packages: object[],
 *   layoutSketch: object|null,
 *   reason: string,
 *   plan: object,
 *   lockedSectionName: string,
 *   lockedDefinitionKey: string,
 * }>}
 */
export async function codegenSection({
  pageDir,
  sectionFolder,
  info,
  ledger,
  collectionSystem,
  hostSlug,
  siteUrl = '',
  sectionEvidenceMessage = null,
  evidenceAttachments = [],
  evidenceImageRelsInOrder = [],
  aiDebugRoot = null,
  projectRoot = null,
  registryComponentFolder = null,
  sectionHtml = '',
  codePrefix = '',
  takenNames = [],
  lockedName = null,
  lockedDefinitionKey = null,
  lockedChildren = null,
  beforeSitecoreize = null,
  chromeEvidence = null,
  revisionBrief = null,
}) {
  const maxDepth = resolveCodegenMaxDepth();
  const inferResponsive = resolveCodegenInferResponsive();
  const evidenceMode = resolveCodegenEvidenceMode();
  const prefix = toPascalCase(codePrefix);
  const locked =
    lockedName
      ? normalizeProposedComponentName(lockedName, prefix)
      : '';
  // Log label only — not an FE invent hint.
  const sectionLabel = String(info?.folderName || sectionFolder);
  const identityPrefix = buildPageSharedDesignPrefixV2({
    collectionSystem,
    hostSlug,
    siteUrl: siteUrl || undefined,
  });

  const visualSystem = applyContentSdkVersionToPrompt(
    await loadPrompt('system-codegen-visual.md'),
    await resolveContentSdkNextjsVersion(),
  );

  const interactionContract = formatInteractionContractForPrompt(info);
  const svgInventoryBlock = formatInlineSvgInventoryForPrompt(sectionHtml);
  const visualTask = {
    role: 'user',
    content: [
      '=== TASK: CODEGEN VISUAL (system rules follow) ===',
      visualSystem,
      '',
      '=== SECTION IDENTITY ===',
      `sectionFolder: ${sectionFolder}`,
      `sectionLabel: ${sectionLabel}`,
      `codePrefix: ${prefix || '(none)'}`,
      locked
        ? `lockedName: ${locked}`
        : `lockedName: (none — propose a unique componentName)`,
      `takenNames: ${JSON.stringify(takenNames || [])}`,
      `BQ_CODEGEN_EVIDENCE_MODE: ${evidenceMode}`,
      `BQ_CODEGEN_INFER_RESPONSIVE: ${inferResponsive ? '1' : '0'}`,
      formatChromeEvidenceForPrompt(chromeEvidence),
      interactionContract,
      svgInventoryBlock,
      '',
      'HARD — className: static → className="…"; conditional with ${…} / nested "opacity-0" → className={`… ${cond ? "a" : "b"}`} only. Forbidden: className="… ${cond ? "a" : "b"}" (breaks JSX parse).',
      '',
      'Return JSON { tsx, componentName, reason, chromeCatalogue } only.',
    ]
      .filter(Boolean)
      .join('\n'),
  };

  if (!sectionEvidenceMessage) {
    throw new Error('codegenSection requires sectionEvidenceMessage');
  }

  const visualMessages = [
    sharedSystemStubMessage(),
    sharedDesignPrefixMessage(identityPrefix),
    sectionEvidenceMessage,
    visualTask,
  ];

  console.log(
    `  · visual: ${sectionFolder}${locked ? ` (locked ${locked})` : ' (propose name)'}…`,
  );
  const visualResult = await azureChatCompletion({
    messages: visualMessages,
    responseFormat: { type: 'json_object' },
    model: screenshotConversionModel(),
  });

  await writeAiDebugDump({
    aiDebugRoot,
    pageDir: pageDir || null,
    projectRoot: projectRoot || (pageDir ? path.dirname(pageDir) : null),
    componentFolder:
      registryComponentFolder ||
      getRegistrySection(info)?.componentFolder ||
      null,
    sectionFolder,
    purpose: 'codegen-visual',
    componentName: locked || sectionLabel,
    messages: visualMessages,
    result: visualResult,
    attachments: evidenceAttachments,
    imageRelsInOrder: evidenceImageRelsInOrder,
    evidenceMode,
    sources: [
      `sections/${sectionFolder}/${
        evidenceMode === 'png' ? 'original-section.html' : 'section.html'
      }`,
      'prompts/system-codegen-visual.md',
    ],
  });

  ledger.record({
    purpose: 'codegen-visual',
    section: sectionFolder,
    componentName: locked || sectionLabel,
    ok: visualResult.ok,
    model: visualResult.model,
    usage: visualResult.usage,
    costEstimate: visualResult.costEstimate,
    skipReason: visualResult.skipReason,
  });

  if (!visualResult.ok) {
    throw new Error(
      `visual failed for ${sectionFolder}: ${visualResult.skipReason || 'unknown'}`,
    );
  }

  let visualTsx = '';
  let visualReason = '';
  let proposedName = '';
  let chromeCatalogue = 'other';
  try {
    const parsed = parseJsonContent(visualResult.content);
    visualTsx = normalizeAiSource(String(parsed.tsx || ''));
    visualReason = String(parsed.reason || '');
    proposedName = String(parsed.componentName || '').trim();
    chromeCatalogue = normalizeChromeCatalogue(parsed.chromeCatalogue);
  } catch (err) {
    throw new Error(`visual JSON parse failed: ${err.message}`);
  }
  // Persist on info for wiring this run.
  if (info && typeof info === 'object') {
    info.chromeCatalogue = chromeCatalogue;
  }
  console.log(`  · chromeCatalogue: ${chromeCatalogue}`);
  if (!visualTsx.trim()) {
    throw new Error('visual returned empty tsx');
  }

  // Resolve section FE name: locked wins; else validate AI proposal (+ one repair).
  const takenForSection = takenLowerSet(takenNames);
  // Locked name is allowed even if present in takenNames (it is this section).
  if (locked) {
    proposedName = locked;
  } else {
    if (!proposedName) {
      proposedName = prefix
        ? ensureBrandComponentPrefix('Section', prefix)
        : 'Section';
    }
    let check = validateProposedComponentName(
      proposedName,
      prefix,
      takenForSection,
    );
    if (!check.ok) {
      console.warn(
        `  ⚠ visual name rejected (${check.reason}) — one repair…`,
      );
      const repaired = await repairVisualComponentName({
        visualMessages,
        badName: check.componentName || proposedName,
        reason: check.reason,
        codePrefix: prefix,
        takenNames,
        lockedName: locked || null,
        ledger,
        sectionFolder,
        aiDebugRoot,
        projectRoot,
        pageDir,
        registryComponentFolder,
        info,
        evidenceAttachments,
        evidenceImageRelsInOrder,
      });
      check = validateProposedComponentName(repaired, prefix, takenForSection);
      if (!check.ok) {
        throw new Error(
          `visual could not propose a free componentName (${check.reason})`,
        );
      }
    }
    proposedName = check.componentName;
  }

  const sectionComponentName = normalizeProposedComponentName(
    proposedName,
    prefix,
  );
  const sectionDefinitionKey = lockedDefinitionKey
    ? String(lockedDefinitionKey).trim()
    : prefix
      ? ensureBrandDefinitionKeyPrefix(
          toDefinitionKey(sectionComponentName),
          prefix,
        )
      : toDefinitionKey(sectionComponentName);

  console.log(
    `  · section name: ${sectionComponentName} (${sectionDefinitionKey})`,
  );

  if (aiDebugRoot) {
    try {
      await mkdir(aiDebugRoot, { recursive: true });
      await writeFile(
        path.join(aiDebugRoot, `visual-${sectionComponentName}.tsx.ai`),
        visualTsx.endsWith('\n') ? visualTsx : `${visualTsx}\n`,
        'utf8',
      );
    } catch {
      /* non-fatal */
    }
  }

  if (pageDir && sectionFolder) {
    try {
      const {
        fidelityMaxItersForMode,
        isFidelityModeEnabled,
        isVisualFidelityEnvEnabled,
      } = await import('./fidelity-iters.mjs');
      const { shouldSkipVisualFidelity } = await import(
        './visual-fidelity/run-visual-fidelity.mjs'
      );
      const visualMax = fidelityMaxItersForMode('visual');
      const visualEnabled = isFidelityModeEnabled({
        maxIters: visualMax,
        cliOrEnvEnable: isVisualFidelityEnvEnabled(),
        skip: false,
      });

      if (visualEnabled && !shouldSkipVisualFidelity()) {
        const { runVisualTsxFidelityLoop } = await import(
          './visual-fidelity/run-visual-tsx-fidelity.mjs'
        );
        console.log(
          `  · visual TSX fidelity: scoring/repairing ${sectionComponentName} (pre-sitecoreize)…`,
        );
        const fidelity = await runVisualTsxFidelityLoop({
          pageDir,
          sectionFolder,
          info,
          componentName: sectionComponentName,
          visualTsx,
          ledger,
          aiDebugRoot,
        });
        visualTsx = fidelity.visualTsx || visualTsx;
        if (fidelity.notes) {
          console.log(
            `  · visual TSX fidelity: score=${fidelity.percent ?? fidelity.score ?? 'n/a'} pass=${fidelity.pass} — ${fidelity.notes}`,
          );
        }
      } else {
        const { captureVisualTsxShots } = await import(
          './visual-fidelity/capture-visual-tsx-shots.mjs'
        );
        await captureVisualTsxShots({
          pageDir,
          sectionFolder,
          visualTsx,
          componentName: sectionComponentName,
          info,
          aiDebugRoot,
        });
      }
    } catch (err) {
      console.warn(
        `  ⚠ visual TSX fidelity/shots skipped: ${err?.message || err}`,
      );
    }
  }

  if (typeof beforeSitecoreize === 'function') {
    await beforeSitecoreize({
      componentName: sectionComponentName,
      definitionKey: sectionDefinitionKey,
      visualTsx,
    });
  }

  const lockedChildList = normalizeIndexChildren(lockedChildren);
  const takenForSitecoreize = [
    ...(takenNames || []),
    sectionComponentName,
    sectionDefinitionKey,
  ];

  const sdkVersion = await resolveContentSdkNextjsVersion();
  const sitecoreSystem = applyContentSdkVersionToPrompt(
    await loadPrompt('system-codegen-sitecoreize.md'),
    sdkVersion,
  );
  const fieldCatalog = await formatCodegenReferenceExamplesForPrompt({
    packageKind: 'default',
    componentName: sectionComponentName,
    cmsName: sectionComponentName,
    purpose: info?.purpose || '',
    role: 'section',
  });

  const htmlExcerpt = String(sectionHtml || '')
    .trim()
    .slice(0, 120_000);

  const sitecoreInteractionContract = formatInteractionContractForPrompt(info);
  const sitecoreSvgInventory = formatInlineSvgInventoryForPrompt(sectionHtml);

  // Layered sitecoreize: compact system + project contract + section input
  // (+ validation feedback only on retry). No bridge / HARD flood.
  const projectContractMessage = {
    role: 'user',
    content: [
      '=== PROJECT CONTRACT ===',
      identityPrefix,
      `Content SDK (@sitecore-content-sdk/nextjs): ${sdkVersion}`,
      'Allowed SDK value imports: Text, RichText, Image, Link, AppPlaceholder, Placeholder, NextImage, useSitecore.',
      'Field types via import type only from @sitecore-content-sdk/nextjs: Field, TextField, RichTextField, ImageField, LinkField.',
      'HARD: NEVER import Field / TextField / RichTextField / ImageField / LinkField from lib/component-props (not re-exported — TS2459). Split: import type { Field, … } from SDK; import type { ComponentWithContextProps } from lib/component-props.',
      'Helpers only from lib/component-props: ComponentWithContextProps, ComponentProps, getDatasource, getFieldValue. FaIcon from components/icons/fa-icon when brand glyphs are needed.',
      'clientTsx that can return null: JSX.Element | null. Map-entry default-import of ./….client requires companion export default.',
      SITECOREIZE_APPPLACEHOLDER_DEF_PARITY_HARD,
      SITECOREIZE_DYNAMIC_PLACEHOLDER_NAME_HARD,
      SITECOREIZE_TSX_FIELD_USAGE_HARD,
      SITECOREIZE_NO_SELF_ALLOWED_CONTROLS_HARD,
      SITECOREIZE_NO_CAPTURE_IMAGE_URLS_HARD,
      SITECOREIZE_MULTI_BAND_COMPOSITE_HARD,
      SITECOREIZE_JSON_BAG_ARRAY_MAP_HARD,
      SITECOREIZE_LEAF_USE_CLIENT_HARD,
      SITECOREIZE_NO_ANY_CALLBACKS_HARD,
      formatUiIconLibraryForPrompt(),
      '',
      DEFINITION_SCHEMA_SNIPPET,
      '',
      MULTI_BAND_COMPOSITE_EXAMPLE_SNIPPET,
      '',
      SITECOREIZE_OUTPUT_JSON_SCHEMA,
      '',
      fieldCatalog,
      '',
      (await loadPrompt('linklist-package-codegen.md').catch(() => '')).trim(),
      '',
      'Naming: brand-prefix child componentName with codePrefix; unique vs takenNames and lockedSectionName.',
      'Field type → SDK: Single/Multi-Line Text → <Text>; Rich Text → <RichText>; Image → <Image>; General Link → <Link>.',
      'Quote multi-word Fields keys: "Close Icon": ImageField; "Privacy Link": LinkField; "Card Link": LinkField; access fields["Card Link"] — never bare Close Icon: ImageField / Privacy Link: LinkField / Card Link: LinkField (invalid TS).',
    ]
      .filter(Boolean)
      .join('\n'),
  };

  const sectionInputMessage = {
    role: 'user',
    content: [
      '=== SECTION INPUT ===',
      `sectionFolder: ${sectionFolder}`,
      `codePrefix: ${prefix || '(none)'}`,
      `lockedSectionName: ${sectionComponentName}`,
      `lockedDefinitionKey: ${sectionDefinitionKey}`,
      `takenNames: ${JSON.stringify(takenForSitecoreize)}`,
      lockedChildList.length
        ? `lockedChildren: ${JSON.stringify(lockedChildList)}`
        : 'lockedChildren: []',
      ...formatLockedChildrenSitecoreizeHardLines(lockedChildList),
      `maxDepth: ${maxDepth}`,
      `chromeCatalogue (authoritative landing): ${chromeCatalogue}`,
      formatChromeEvidenceForPrompt(chromeEvidence),
      sitecoreInteractionContract,
      sitecoreSvgInventory,
      ...(isLinkListAsCompositeEnabled()
        ? ['', linkListAsCompositePromptOverride()]
        : []),
      '',
      '=== VISUAL TSX (authoritative appearance / structure / content) ===',
      '```tsx',
      visualTsx,
      '```',
      '',
      htmlExcerpt
        ? [
            '=== SECTION HTML (supplementary links / assets / semantics only) ===',
            htmlExcerpt.length >= 120_000
              ? `${htmlExcerpt}\n…[truncated]`
              : htmlExcerpt,
          ].join('\n')
        : '(no HTML excerpt)',
    ]
      .filter(Boolean)
      .join('\n'),
  };

  // Authoritative input is the visual TSX dump — not section.html (HTML may
  // still appear in the prompt as a URL/image crib only).
  const visualTsxSource = `sections/${sectionFolder}/ai-debug/visual-${sectionComponentName}.tsx.ai`;
  const sitecoreizeStem = aiDebugStem(
    'codegen-sitecoreize',
    sectionComponentName,
  );

  /** @type {object|null} */
  let activeRevisionBrief =
    revisionBrief && typeof revisionBrief === 'object' ? revisionBrief : null;
  /** @type {object[]} */
  let packages = [];
  /** @type {object|null} */
  let layoutSketch = null;
  /** Last non-collapsed packages kept for retry feedback / collapse restore. */
  /** @type {object[]} */
  let lastFullPackages = [];
  /** @type {object|null} */
  let lastFullLayoutSketch = null;
  let reason = visualReason;
  /** @type {object[]} */
  let sanitizeChangeLog = [];
  /** @type {object[]} */
  let sitecoreMessages = [];
  let orphanRetries = 0;
  let multiBandRetries = 0;
  let collapseRetries = 0;
  const maxCollapseRetries = 2;
  const maxTotalAttempts =
    1 +
    SITECOREIZE_ORPHAN_CHILD_MAX_RETRIES +
    SITECOREIZE_MULTI_BAND_MAX_RETRIES +
    maxCollapseRetries;

  // Always attach section crops to sitecoreize (appearance authority), even when
  // visual codegen used html evidence mode without PNGs.
  /** @type {object[]} */
  let sitecoreizeCropParts = [];
  /** @type {string[]} */
  let sitecoreizeCropAttachments = [];
  /** @type {string[]} */
  let sitecoreizeCropImageRels = [];
  if (pageDir && sectionFolder) {
    try {
      const cropEvidence = await buildSectionEvidenceParts(
        pageDir,
        sectionFolder,
        info || {},
        { attachScreenshots: true },
      );
      sitecoreizeCropParts = Array.isArray(cropEvidence.parts)
        ? cropEvidence.parts
        : [];
      sitecoreizeCropAttachments = cropEvidence.attachments || [];
      sitecoreizeCropImageRels = cropEvidence.imageRelsInOrder || [];
    } catch (err) {
      console.warn(
        `  ⚠ sitecoreize crop attachments skipped: ${err?.message || err}`,
      );
    }
  }

  for (let attempt = 0; attempt < maxTotalAttempts; attempt += 1) {
    const validationFeedbackMessage =
      formatSitecoreizeValidationFeedbackMessage(activeRevisionBrief);
    sitecoreMessages = [
      { role: 'system', content: sitecoreSystem },
      projectContractMessage,
      sectionInputMessage,
      ...(sitecoreizeCropParts.length
        ? [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: '=== SECTION CROPS (appearance authority — preserve chrome) ===',
                },
                ...sitecoreizeCropParts,
              ],
            },
          ]
        : []),
      ...(validationFeedbackMessage ? [validationFeedbackMessage] : []),
    ];

    const retryPurpose = sitecoreizeRetryPurposeLabel({
      attempt,
      orphanRetries,
      multiBandRetries,
      collapseRetries,
    });
    const retryLabel =
      orphanRetries > 0
        ? `, orphan-retry ${orphanRetries}/${SITECOREIZE_ORPHAN_CHILD_MAX_RETRIES}`
        : multiBandRetries > 0
          ? `, multi-band-retry ${multiBandRetries}/${SITECOREIZE_MULTI_BAND_MAX_RETRIES}`
          : collapseRetries > 0
            ? `, collapse-retry ${collapseRetries}/${maxCollapseRetries}`
            : '';
    console.log(
      `  · sitecoreize: ${sectionFolder} (maxDepth=${maxDepth}${retryLabel})…`,
    );
    const sitecoreResult = await azureChatCompletion({
      messages: sitecoreMessages,
      responseFormat: { type: 'json_object' },
      model: screenshotConversionModel(),
    });

    await writeAiDebugDump({
      aiDebugRoot,
      pageDir: pageDir || null,
      projectRoot: projectRoot || (pageDir ? path.dirname(pageDir) : null),
      componentFolder:
        registryComponentFolder ||
        getRegistrySection(info)?.componentFolder ||
        null,
      sectionFolder,
      purpose: retryPurpose,
      componentName: sectionComponentName,
      messages: sitecoreMessages,
      result: sitecoreResult,
      attachments: sitecoreizeCropAttachments,
      imageRelsInOrder: sitecoreizeCropImageRels,
      clearBeforeWrite: false,
      evidenceMode: resolveCodegenEvidenceMode(),
      sources: [
        visualTsxSource,
        'prompts/system-codegen-sitecoreize.md',
        'prompts/references/FieldCatalog.reference.tsx',
      ],
    });

    ledger.record({
      purpose: retryPurpose,
      section: sectionFolder,
      componentName: sectionComponentName,
      ok: sitecoreResult.ok,
      model: sitecoreResult.model,
      usage: sitecoreResult.usage,
      costEstimate: sitecoreResult.costEstimate,
      skipReason: sitecoreResult.skipReason,
    });

    if (!sitecoreResult.ok) {
      throw new Error(
        `sitecoreize failed for ${sectionFolder}: ${sitecoreResult.skipReason || 'unknown'}`,
      );
    }

    try {
      const parsed = parseJsonContent(sitecoreResult.content);
      packages = Array.isArray(parsed.packages) ? parsed.packages : [];
      layoutSketch = parsed.layoutSketch || null;
      if (parsed.reason) reason = String(parsed.reason);
    } catch (err) {
      throw new Error(`sitecoreize JSON parse failed: ${err.message}`);
    }

    sanitizeChangeLog = [];
    packages = packages
      .map((p) => {
        let componentName = normalizeProposedComponentName(
          p?.componentName || 'Section',
          prefix,
        );
        const role =
          String(p?.role || '').toLowerCase() === 'child' ? 'child' : 'section';
        if (role === 'section') {
          componentName = sectionComponentName;
        }
        const definitionKey =
          role === 'section'
            ? sectionDefinitionKey
            : prefix
              ? ensureBrandDefinitionKeyPrefix(
                  toDefinitionKey(componentName),
                  prefix,
                )
              : toDefinitionKey(componentName);
        const definitionTsRaw = normalizeAiSource(String(p?.definitionTs || ''));
        const sanitized = sanitizeDefinitionStringSeedsDetailed(definitionTsRaw);
        if (sanitized.changed > 0) {
          for (const ch of sanitized.changes) {
            sanitizeChangeLog.push({
              ...ch,
              componentName,
            });
          }
        }
        return {
          componentName,
          definitionKey,
          kebab: toKebabCase(componentName),
          role,
          parentPlaceholder: p?.parentPlaceholder
            ? String(p.parentPlaceholder).trim()
            : null,
          packageKind:
            String(p?.packageKind || '').toLowerCase() === 'navigation'
              ? 'navigation'
              : 'default',
          repeatHint: Number(p?.repeatHint) > 0 ? Number(p.repeatHint) : 1,
          tsx: normalizeAiSource(String(p?.tsx || '')),
          definitionTs: sanitized.text,
          clientTsx: p?.clientTsx
            ? normalizeAiSource(String(p.clientTsx))
            : null,
        };
      })
      .filter((p) => p.tsx.trim() && p.definitionTs.trim());

    if (!packages.length) {
      throw new Error('sitecoreize returned no valid packages');
    }

    // Reject host-only / tiny stubs when a prior full composite existed.
    if (
      lastFullPackages.length &&
      isSitecoreizeRetryCollapse(lastFullPackages, packages)
    ) {
      collapseRetries += 1;
      console.warn(
        `  ⚠ Sitecoreize retry collapse (host-only/undersized vs prior ${lastFullPackages.length} pkg / ${countSitecoreizeChildPackages(lastFullPackages)} child) — ` +
          (collapseRetries <= maxCollapseRetries
            ? `retrying (${collapseRetries}/${maxCollapseRetries})`
            : 'retries exhausted'),
      );
      if (collapseRetries > maxCollapseRetries) {
        throw new Error(
          `sitecoreize retry collapsed to host-only/undersized after ${maxCollapseRetries} retries ` +
            `(prior packages=${lastFullPackages.length}, children=${countSitecoreizeChildPackages(lastFullPackages)}; ` +
            `got packages=${packages.length}, children=${countSitecoreizeChildPackages(packages)})`,
        );
      }
      activeRevisionBrief = buildSitecoreizeRetryRevisionBrief({
        kind: 'collapse',
        packages: lastFullPackages,
        layoutSketch: lastFullLayoutSketch || layoutSketch,
        changes: [
          `REJECTED UNDERSIZED RESPONSE: prior emit had ${lastFullPackages.length} packages ` +
            `(${countSitecoreizeChildPackages(lastFullPackages)} children); this response has ` +
            `${packages.length} packages (${countSitecoreizeChildPackages(packages)} children).`,
          'Host-only stubs and patch deltas are INVALID. Re-emit the FULL previous packages[] (section + every child), applying the earlier CONTRACT fixes.',
        ],
      });
      continue;
    }

    if (isOrphanChildPackageList(packages)) {
      const repaired = repairOrphanChildPackagesWithSketchHost(
        packages,
        layoutSketch,
        {
          sectionComponentName,
          sectionDefinitionKey,
        },
      );
      if (repaired.repaired) {
        packages = repaired.packages;
      }
    }

    if (isOrphanChildPackageList(packages)) {
      const changes = buildOrphanChildRetryChanges(packages, {
        sectionComponentName,
        sectionDefinitionKey,
      });
      orphanRetries += 1;
      console.warn(
        `  ⚠ Sitecoreize orphan-child packages (no role:section) — ` +
          (orphanRetries <= SITECOREIZE_ORPHAN_CHILD_MAX_RETRIES
            ? `retrying (${orphanRetries}/${SITECOREIZE_ORPHAN_CHILD_MAX_RETRIES})`
            : 'retries exhausted'),
      );
      if (orphanRetries > SITECOREIZE_ORPHAN_CHILD_MAX_RETRIES) {
        throw new Error(
          `sitecoreize orphan-child topology after ${SITECOREIZE_ORPHAN_CHILD_MAX_RETRIES} retries: ${changes[0]}`,
        );
      }
      activeRevisionBrief = buildSitecoreizeRetryRevisionBrief({
        kind: 'orphan',
        changes,
        packages,
        layoutSketch,
      });
      continue;
    }

    // Keep the best full composite for feedback even when CONTRACT fails.
    lastFullPackages = packages;
    lastFullLayoutSketch = layoutSketch;

    const multiBandDiags = collectHtmlMultiBandEmitDiagnostics({
      sectionHtml,
      packages,
      layoutSketch,
    });
    if (multiBandDiags.length) {
      multiBandRetries += 1;
      console.warn(
        `  ⚠ Sitecoreize multi-band CONTRACT (${multiBandDiags.length}) — ` +
          (multiBandRetries <= SITECOREIZE_MULTI_BAND_MAX_RETRIES
            ? `retrying (${multiBandRetries}/${SITECOREIZE_MULTI_BAND_MAX_RETRIES})`
            : 'retries exhausted'),
      );
      if (multiBandRetries > SITECOREIZE_MULTI_BAND_MAX_RETRIES) {
        throw new Error(
          `sitecoreize multi-band CONTRACT after ${SITECOREIZE_MULTI_BAND_MAX_RETRIES} retries: ${multiBandDiags[0]}`,
        );
      }
      activeRevisionBrief = buildSitecoreizeRetryRevisionBrief({
        kind: 'multi-band',
        packages,
        layoutSketch,
        changes: buildMultiBandRetryChanges(
          multiBandDiags,
          layoutSketch,
          packages,
          { sectionComponentName },
        ),
      });
      continue;
    }

    break;
  }

  if (sanitizeChangeLog.length > 0 && aiDebugRoot) {
    writeDefinitionSanitizeDump({
      aiDebugRoot,
      pageDir: pageDir || null,
      stem: sitecoreizeStem,
      purpose: 'codegen-sitecoreize',
      componentName: sectionComponentName,
      componentNames: packages.map((p) => p.componentName),
      changed: sanitizeChangeLog.length,
      changes: sanitizeChangeLog,
      packagesJson: {
        reason,
        layoutSketch,
        packages: packages.map((p) => ({
          componentName: p.componentName,
          definitionKey: p.definitionKey,
          role: p.role,
          parentPlaceholder: p.parentPlaceholder,
          packageKind: p.packageKind,
          repeatHint: p.repeatHint,
          tsx: p.tsx,
          definitionTs: p.definitionTs,
          clientTsx: p.clientTsx,
        })),
      },
    });
  }

  // HTML-derived Path names → English (cache); remap layoutSketch datasourceName.
  {
    const named = await normalizeSitecoreizePathNames({
      packages,
      layoutSketch,
    });
    packages = named.packages;
    layoutSketch = named.layoutSketch;
    if (named.remaps.length > 0) {
      console.warn(
        `  ⚠ Definition Path name normalize: ${named.remaps.length} remap(s) (${named.sourceCulture}→en)`,
      );
      if (aiDebugRoot) {
        writeDefinitionNameNormalizeDump({
          aiDebugRoot,
          pageSectionDir: pageDir || undefined,
          stem: sitecoreizeStem,
          componentName: sectionComponentName,
          remaps: named.remaps,
          packagesJson: {
            reason,
            layoutSketch,
            packages: packages.map((p) => ({
              componentName: p.componentName,
              definitionKey: p.definitionKey,
              role: p.role,
              parentPlaceholder: p.parentPlaceholder,
              packageKind: p.packageKind,
              repeatHint: p.repeatHint,
              tsx: p.tsx,
              definitionTs: p.definitionTs,
              clientTsx: p.clientTsx,
            })),
          },
        });
      }
    }
  }

  // Never promote orphan children to section — topology already validated above.
  const sectionPkg = packages.find((p) => p.role === 'section');
  if (!sectionPkg) {
    throw new Error(
      `sitecoreize returned no role:"section" package for ${sectionComponentName}`,
    );
  }
  sectionPkg.componentName = sectionComponentName;
  sectionPkg.definitionKey = sectionDefinitionKey;
  sectionPkg.kebab = toKebabCase(sectionComponentName);

  // Apply locked child names by index when present.
  const childPkgs = packages.filter((p) => p !== sectionPkg);
  for (let i = 0; i < childPkgs.length; i++) {
    const lock = lockedChildList[i];
    if (!lock?.componentName) continue;
    childPkgs[i].componentName = normalizeProposedComponentName(
      lock.componentName,
      prefix,
    );
    childPkgs[i].definitionKey =
      String(lock.definitionKey || '').trim() ||
      toDefinitionKey(childPkgs[i].componentName);
    childPkgs[i].kebab = toKebabCase(childPkgs[i].componentName);
    if (lock.placeholderKey) {
      childPkgs[i].parentPlaceholder = lock.placeholderKey;
    }
  }

  // Same invent discipline as visual: unlocked children must be free vs takenNames.
  const { renames: childRenames } = await ensureUniqueChildPackageNames({
    childPkgs,
    sectionComponentName,
    codePrefix: prefix,
    takenNames: takenForSitecoreize,
    lockedChildList,
    repairChildName: (repairOpts) =>
      repairSitecoreizeChildComponentName({
        ...repairOpts,
        codePrefix: prefix,
        sitecoreMessages,
        sectionFolder,
        aiDebugRoot,
        projectRoot,
        pageDir,
        registryComponentFolder,
        info,
        ledger,
      }),
  });
  if (layoutSketch && childRenames && Object.keys(childRenames).length) {
    layoutSketch = remapLayoutSketchComponentNames(layoutSketch, childRenames);
  }

  // Visual catalogue owns landing; sitecoreize target must not invent cookie.
  const landingRole = catalogueToProvisionalRole(chromeCatalogue);
  if (layoutSketch && typeof layoutSketch === 'object') {
    layoutSketch = {
      ...layoutSketch,
      target: landingRole,
    };
  } else {
    layoutSketch = { target: landingRole };
  }

  const plan = buildPlanFromPackages({
    sectionPkg,
    childPkgs,
    layoutSketch,
    reason,
    chromeCatalogue,
  });

  if (aiDebugRoot && layoutSketch) {
    try {
      await writeFile(
        path.join(aiDebugRoot, 'layout-sketch.json'),
        `${JSON.stringify(layoutSketch, null, 2)}\n`,
        'utf8',
      );
    } catch {
      /* non-fatal */
    }
  }

  return {
    visualTsx,
    packages,
    layoutSketch,
    reason,
    plan,
    chromeCatalogue,
    lockedSectionName: sectionComponentName,
    lockedDefinitionKey: sectionDefinitionKey,
    // Pre-sitecoreize scored visual TSX; post-write scores composed packages
    // under sitecoreize-proof/ (or capture-only proof shots).
    visualFidelityHandled: true,
  };
}
