---
name: bq-definitions
description: >-
  Author BQ Sitecore items via *.definition.ts / *.content.ts then
  npm run definitions:generate (never create/edit/delete .yml). Always set icon:
  via sitecore-icons for rendering/component/variants. Covers all kinds:
  collection, site, data, media, enumeration, dictionary, field-validator,
  rendering, component, parameters, variants. Use for any new Sitecore
  template/content/media/site work under bq/, or when editing
  bq/src/components/**/*.definition.ts, *.content.ts, or bq/tools/definitions/**.
paths:
  - "bq/src/components/**/*.definition.ts"
  - "bq/src/components/**/*.content.ts"
  - "bq/tools/definitions/**"
  - "authoring/items/bq-demo/**"
---

# BQ definitions

## Non-negotiable (this repo / BQ app)

1. **Create or change Sitecore authoring only by editing `*.definition.ts` / `*.content.ts`** under `bq/src/components/` (or emitters under `bq/tools/definitions/**` when extending the generator).
2. **Emit / update / remove YAML only by running** `npm run definitions:generate` or `npm run authoring:generate` from `bq/`. The generator owns create, update, and prune.
3. **Agents following this skill must never create, edit, patch, move, or delete `*.yml` / `*.yaml` files** (including under `authoring/items/bq-demo/sai/`). No Write / StrReplace / Delete / shell redirects on YAML. Reading YAML for debugging is OK; mutating it is not.
4. **Never** run `.cursor/sitecore-yaml` collection/site/rendering generators for the BQ module — use definition kinds instead.
5. If `ser validate` fails after generate, **fix the definition** (or emitter TypeScript), then re-run generate — never “fix” YAML by hand. Generate runs read-only `ser validate` then `ser push` on success (no `--fix`).

Kind recipes + skeletons: [references/kind-recipes.md](references/kind-recipes.md).

## Icons (required for template-bearing definitions)

Whenever you **create or meaningfully rename** a definition that emits Sitecore templates / renderings / variant folders — kinds **`rendering`**, **`component`**, and **`variants`** — you **must**:

1. Load **`sitecore-icons`** (`bq/.cursor/skills/sitecore-icons`).
2. Pick the best `Office|Apps|…/32x32/….png` path (prefer `node bq/.cursor/skills/sitecore-icons/scripts/select-icon.mjs "…purpose…"`).
3. Set that path on the definition as **`icon: "…"`** before finishing the file.

Do **not** omit `icon`, invent a path, or leave the emitter default (`Office/32x32/window_star.png`) unless `sitecore-icons` actually selected that path. Do **not** edit YAML to set `__Icon`.

When editing an existing definition only for unrelated fields, keep the existing `icon` unless the component’s purpose changed enough that a better metaphor is warranted — then re-run the icon skill.

## Keep this skill current

**After any change** to definition types, normalizers, emitters, or authoring patterns under:

- `bq/tools/definitions/**`
- `bq/tools/shared/normalize-versions.ts`
- `bq/tools/content/**`
- `bq/src/components/**/*.definition.ts` or `*.content.ts`

**update this SKILL.md** (and `references/kind-recipes.md` when kinds/samples change) in the same task.

---

## Quick workflow

1. Pick the `kind` (table below) → add/edit `bq/src/components/…/*.definition.ts` using a sample + [kind-recipes.md](references/kind-recipes.md).
2. If the kind is **`rendering`**, **`component`**, or **`variants`**: run **`sitecore-icons`** and set `icon:` on the definition (required).
3. From `bq/`: `npm run authoring:generate` (or `definitions:generate` / `content:generate`).
4. Read terminal: yaml created/updated/unchanged fractions; open `Detail log:` if needed.
5. Confirm `ser validate: No errors were detected.` and `ser push: completed.`
6. Update this skill if you introduced a new pattern.

---

## Definition kinds

| `kind` | File pattern | Emits to |
|--------|--------------|----------|
| `collection` | `*.definition.ts` | Full collection scaffold from `blueprints/collection` → `sai/{templates,renderings,…}/Project/{systemName}` + `sites/content/{systemName}`; updates sibling `*.module.json` |
| `site` | `*.definition.ts` | Full site scaffold from `blueprints/site` under a collection; requires `collectionSystem` **or** inline `collection` (create-or-reuse); updates `*.module.json` |
| `data` | `*.definition.ts` | `authoring/items/.../sai/data/...` + project templates |
| `media` | `*.definition.ts` | `sai/media-library/{collection}/{site}/…` (Blob YAML; image or file) |
| `enumeration` | `*.definition.ts` | `authoring/items/.../sai/.../Enums/...` |
| `dictionary` | `*.definition.ts` | `{site}/Dictionary/...` |
| `field-validator` | `*.definition.ts` | `authoring/.../Field Rules/{folder}/...` |
| `rendering` | `*.definition.ts` | `sai/templates/{name}/…` + `renderings/Project` + `systemSettings` insert rule |
| `component` | `*.definition.ts` | Same as rendering (façade) + optional seed `content`; supports `parameters: { definitionKey }` |
| `parameters` | `*.definition.ts` | `sai/templates/{name}/{name} Parameters/…` (parent folder create-if-absent) |
| `variants` | `*.definition.ts` | `{site}/Presentation/Headless Variants/{componentName}/…` |
| `component-content` | `*.content.ts` (optional) | Same as `ComponentTemplateDefinition.content` |

**Canonical samples** (copy structure from these):

| Kind | Sample |
|------|--------|
| collection | `src/components/{hostSlug}/{system}-collection.definition.ts` (e.g. `sitecore-com/sitecore-collection.definition.ts`) |
| site | `src/components/{hostSlug}/{system}-site.definition.ts` (e.g. `sitecore-com/sitecore-com-site.definition.ts`) |
| site-presentation | `src/components/{hostSlug}/{system}-presentation.definition.ts` |
| data | `src/components/data/authors.definition.ts` |
| media | `src/components/media/sample-hero.definition.ts` |
| enumeration | `src/components/enums/caption-style.definition.ts` |
| dictionary | `src/components/dictionary/forms-labels.definition.ts` |
| field-validator | `src/components/validators/at-least-two-words.definition.ts` |
| rendering | `src/components/renderings/custom-card.definition.ts` |
| component | `src/components/atoms/cta-button/cta-button.definition.ts` |
| parameters | `src/components/parameters/mycustom-test.definition.ts` |
| variants | `src/components/variants/dummy-demo.definition.ts` |

### Collection & site

- Prefer **local serialization** when the full collection/site blueprint tree is already pulled and matches the definition (root Name / Description / Path + every blueprint YAML except media `System/<hash>/…` buckets). Then Sites API auth/sync/`ser pull`/provenance push are **skipped**.
- Call Sites API when local YAML is missing/mismatched, on rename, or when `api.forceSync: true`.
- **Stale local wipe on API create:** when Sites API returns `created` for a collection/site and local authoring YAML for that entity still exists (typical after deleting the collection/site in the Sitecore AI UI without `npm run delete:collection`), generate wipes that collection/site’s local YAML roots + related caches (inventories, owned ledger, emit-source / url-routes, presentation caches) before deferred `ser pull`. Definitions and FE packages are left intact. Prefer `delete:collection` for a full intentional teardown; this wipe covers the local half when recreate happens via `create:sectioncomponents` / generate.
- **Generate starts with `ser pull`** so local YAML matches CM (required; failure aborts generate).
- After API create/update + pull: stamp `__Created by` / `__Updated by` to `BQ`, then `ser push` so CM ownership matches. That push does **not** run on the local-skip path.
- Ownership ledger `authoring/items/bq-demo/bq-sites-api-owned.json` (commit it) tracks `definitionKey` → remote id for orphan API deletes when a definition file is removed.
- `systemName` defaults to alphanumeric lowercase of `name`. Rename by changing `systemName` (same `definitionKey`).
- Sites **must** target a collection: `collectionSystem: "…"` **or** `collection: { name, systemName?, description? }`.
- Generate order: initial pull → orphan prune → collections → sites → other definitions.
- Auth: **Environment automation client** via `SITECORE_AUTH_CLIENT_ID` / `SITECORE_AUTH_CLIENT_SECRET` (Deploy → Credentials → **Environment** → Automation — not Organization; same vars as Content SDK). Also `BQ_SITECORE_ENVIRONMENT_ID`. Generate auto-runs non-interactive `dotnet sitecore login` from those vars before `ser` pull/push; interactive `cloud login` alone is not enough for Sites API.
- **Sitecore CLI endpoint (required):** set `BQ_SITECORE_ENDPOINT` in `bq/.env.local` to a key under `.sitecore/user.json` → `endpoints` (must have `allowWrite: true`). No hardcoded default — unset fails fast. Override per run: `--endpoint <name>` / `--endpointName <name>`.
- Expected YAML inventories: `bq/tools/definitions/blueprints/{collection,site}` (refresh via Sites API create + `ser pull` if scaffolding changes).

Samples: `src/components/sitecore-com/sitecore-collection.definition.ts`, `src/components/sitecore-com/sitecore-com-site.definition.ts`, `src/components/sitecore-com/sitecore-com-presentation.definition.ts`.

Generate ends with local serialization heal (empty dirs under `sites/` + `templates/Project`, including empty `Home/Data` and template `Content` sections — preserve anchors by absolute path only, never basename `/content/i`) then read-only `dotnet sitecore ser validate -i BQ` (no `--fix`). On success it runs `ser push -i BQ` so CM matches disk. Validate failure skips push and fails the run.

**Page Designs/Default:** `bumpPageDesignItemRevisions` must fully consume each `Value:` line when rewriting `__Revision` / `__Updated`. A prior `Value:.*?\r?\n?` pattern could stop after `Value:` and leave orphan GUIDs/timestamps (SCS corrupt YAML). Do not hand-edit that file — fix the emitter and re-generate.

Types: `bq/tools/definitions/types.ts`  
Normalizers: `bq/tools/shared/normalize-versions.ts`  
Item names (`proposeValidItemName` in `bq/tools/shared/naming.ts`, applied in `writeScsItem`):
- **URL pages under site `Home`** (path has `…/Home/<page…>` and no `Data` segment after `Home`): kebab-case via `toKebabItemName` (lowercase; spaces/underscores/camelCase → `-`; `*` / `$` kept).
- **Everywhere else** (templates, renderings, Data, `Home/…/Data`, media, Field Rules, …): keep the definition name; strip invalid UI chars only; preserve casing and spaces.
- Sibling uniqueness: `name-1`, `name-2`, … via `bq/tools/shared/sibling-item-names.ts` (same `forUrl` mode as the path).

---

## Cross-refs (`{ definitionKey }` / `{ path }` / `{ guid }` / `{ rule }`)

Shared tagged shapes in definition files (never written as-is into YAML):

| Shape | Meaning |
|-------|---------|
| `{ definitionKey: "…" }` | Another BQ definition |
| `{ path: "/sitecore/…" }` | Sitecore **content-tree** path |
| `{ guid: "{…}" }` | Sitecore item id |
| `{ rule: "Required" }` | Field Rules–relative name (validators only) |

**Validators**

```ts
validators: [
  { rule: "Required" },
  { rule: "Common/Is Email" },
  { definitionKey: "at-least-two-words" },
]
```

**Image / media values** (exactly one source): `url` | `base64` | `svgMarkup` | `path` | `guid` | `definitionKey`

**Enumerations / parameters / variants:** `{ definitionKey }` | `{ path }` | `{ guid }` (plus inline `{ sections }` / `[{ name }]` where applicable).

Emit resolves to GUID/path/XML as each Sitecore field’s YAML already expects.

## SAI handles (internal)

- Format: `{definitionKey}@{version}` (e.g. `authors@1`) — **emit-time only** (stable GUID salts, logs).
- Authors do **not** put `@version` in `definitionKey` or in cross-refs.
- Component templates use `@1` at emit time; data defs derive version from item versions (lowest).

---

## Version shorthand (single v1)

Use **flat fields** when there is only one version. Use **`versions: [{ version, … }]`** when multiple Sitecore numbered versions exist. **Never both** on the same object — normalizers throw.

| Scope | Shorthand (v1) | Multi-version |
|-------|----------------|---------------|
| **Data item** | `fields: { … }` | `versions: [{ version, fields }]` |
| **Dictionary entry** | `phrase`, optional `description` | `versions: [{ version, phrase }]` |
| **Dictionary / enum list (definition root)** | `displayName`, optional `description`, `shortDescription`; enum also `default` | `versions: [{ version, displayName, … }]` |
| **Enum constant** | `displayName`, optional `description` | `versions: [{ version, displayName }]` |
| **Field validator** | rule at top level: `type`, `pattern`, `title`, … | `versions: [{ version, type, … }]` |
| **Component content** | `items: [ … ]` | `versions: [{ version, items }]` |

Resolver functions (always use in emitters, not raw `versions` on items):

- `resolveDataItemVersions`
- `resolveDictionaryDefinitionVersions` / `resolveDictionaryEntryVersions`
- `resolveEnumerationListVersions` / `resolveEnumerationConstantVersions`
- `resolveFieldValidatorVersions`
- `resolveComponentContentVersions`

---

## Kind-specific notes

### `data`

```ts
export const authorsDataDefinition = {
  kind: "data",
  definitionKey: "authors",
  name: "Authors",
  location: { root: "data", folder: ["Authors"] },
  model: {
    folderTemplate: { name: "Authors", displayName: "…", sections?: [...] },
    itemTemplate: { name: "Author", sections: [{ name: "…", fields: [...] }] },
  },
  items: [{ name: "Amara Okonkwo", fields: { "Author Name": "…", … } }],
} satisfies DataDefinition;
```

**Path leaf immutability (templates):** Always pin `model.itemTemplate.name` and `folderTemplate.name`. After the first successful push, treat those names as **immutable** Sitecore Path leaves (IDs stay stable via `definitionKey`). Changing them forces an SCS Move and can fail push with Empty serialized parent. Use `displayName` only for authoring labels — emit never derives Path from `displayName`. Intentional renames require deleting the CM item (+ local YAML for that ID), then regenerating. Empty-parent conflicts after a UI-only collection delete are usually stale local YAML + stable IDs — generate’s API-create wipe (above) clears the local side; leftover CM template items may still need a one-time CM delete.

Link field values: `{ text, url }` or string shorthands.

Image field values (Sitecore `type: "Image"` — always image media).
Works on data / parameters / component / rendering field `default` and content values:

- Inline: `{ url, alt }`, `{ base64, alt }`, `{ svgMarkup: \`<svg…>\`, alt }`, or a URL/base64 string
- Reusable: `{ definitionKey: "sample-hero", alt?: "…" }` → `kind: "media"` (image-family only)

### `media`

```ts
export const sampleHeroMediaDefinition = {
  kind: "media",
  definitionKey: "sample-hero",
  name: "sample-hero",
  url: "https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=1200&h=630&fit=crop",
  alt: "Sample hero image",
  location: { folder: ["Samples"] },
} satisfies MediaDefinition;

// SVG authored as markup (emitter → base64 Blob)
export const sampleStarSvgMediaDefinition = {
  kind: "media",
  definitionKey: "sample-star-svg",
  name: "sample-star-svg",
  alt: "Lime star polygon",
  svgMarkup: `<svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">…</svg>`,
  location: { folder: ["Samples"] },
} satisfies MediaDefinition;
```

Emits media-library YAML (download, base64, or `svgMarkup` → Blob). Template + fields follow the asset type (jpg/svg/webp with dimensions/Alt where applicable; pdf/zip/doc/docx/txt as file media). Prefer shared assets via `{ definitionKey }` from **Image** fields.

### `enumeration`

```ts
export const bottomAlignmentEnumDefinition = {
  kind: "enumeration",
  definitionKey: "bottom-alignment",
  name: "BottomAlignment",
  location: { scope: "site", folder: ["Layout", "Section Wrapper"] },
  displayName: "Bottom Alignment",
  description: "…",
  default: "center",
  constants: [
    { name: "start", displayName: "Start" },
    { name: "center", displayName: "Center" },
  ],
} satisfies EnumerationDefinition;
```

### `dictionary`

```ts
export const formsLabelsDictionaryDefinition = {
  kind: "dictionary",
  definitionKey: "forms-labels",
  name: "FormsLabels",
  location: { scope: "site", folder: ["Forms"] },
  displayName: "Forms Labels",
  description: "…",
  entries: [{ key: "form-submit", phrase: "Submit", description: "…" }],
} satisfies DictionaryDefinition;
```

### `field-validator`

```ts
export const personNameValidatorDefinition = {
  kind: "field-validator",
  definitionKey: "person-name",
  name: "Person Name",
  folder: "BQ",
  type: "regex",
  pattern: "^[A-Za-z]+( [A-Za-z]+)+$",
  title: "Is person name",
  description: "…",
} satisfies FieldValidatorDefinition;
```

Reference from data fields: `validators: [{ rule: "Required" }, { definitionKey: "person-name" }]`.

### `component`

UI component package — **façade** over the same emitters as standalone kinds:

| Piece | Emitter reused |
|-------|----------------|
| Datasource `model` + project rendering + scaffolding + variants | `emitRenderingDefinition` (identical YAML to `kind: "rendering"`) |
| Inline `parameters` | `emitParametersTemplate` (same as `kind: "parameters"`) |
| `parameters: { definitionKey }` | Shared standalone `kind: "parameters"` (or rendering-with-params) |
| Inline `variants` / `variants: { definitionKey }` | `emitVariantsDefinition` (same as `kind: "variants"`) |
| Optional `content` | Site content helpers (same as data / `*.content.ts`) |

**Hybrid authoring**

1. **Default** — one `kind: "component"` export with inline `model`, `parameters`, `variants`, optional `content`.
2. **When sharing** — extract a standalone `kind: "parameters"` (and/or `kind: "data"` / `kind: "variants"`) definition; point the component at it with `parameters: { definitionKey }` / `variants: { definitionKey }`. Co-locate multiple Definition exports in the same `*.definition.ts` file if you want (generator loads all).

**Parameters** use the same sections/fields model as `kind: "parameters"` (data-style fields, not `shape`):

- In definition files, set **`shared: true`** on each parameters field (usual for rendering params). The emitter only marks Shared when the definition says so — it does not invent a default.
- Omit `shared` or use `shared: false` only when the param must be versioned/language-specific.
- Use only one of: `parameters: { sections }`, `parameters: { definitionKey }`, `parametersTemplateId`.

**Variants** (Headless Variants under site Presentation):

- Inline: `variants: [{ name: "Default" }, …]`
- Shared: `variants: { definitionKey: "dummy-demo-variants" }` → standalone `kind: "variants"`
- Use only one of: inline list or `{ definitionKey }`.

```ts
export const ctaButtonDefinition = {
  kind: "component",
  definitionKey: "cta-button",
  name: "cta-button",
  displayName: "CTA Button",
  componentName: "CtaButton", // Pascal branch + rendering YAML name; SCS componentName field is kebab definitionKey (cta-button) for component-map
  icon: "Office/32x32/button.png", // required — from sitecore-icons
  datasourceLocation: { scope: "site", root: "data", folder: ["CtaButtons"] },
  model: { folderTemplate: { … }, itemTemplate: { … } },
  variants: [{ name: "Default" }],
  parameters: { sections: [ … ] }, // or parameters: { definitionKey: "shared-cta-params" }
  content: {
    location: { root: "data", folder: ["CtaButtons"] },
    items: [{ name: "Get started", fields: { Link: { text: "Get started", url: "/" } } }],
  },
} satisfies ComponentTemplateDefinition;
```

Standalone `kind: "parameters"` when you need a shared param template without embedding it in the component:

```ts
{
  kind: "parameters",
  definitionKey: "example-rendering-parameters",
  name: "Example Rendering",
  model: { sections: [ … ] },
}
```

Parent folder `{name}.yml` is created only if missing; `{name} Parameters` is always emitted.

Standalone `kind: "variants"` (see `bq/src/components/variants/dummy-demo.definition.ts`):

```ts
{
  kind: "variants",
  definitionKey: "dummy-demo-variants",
  componentName: "DummyDemo",
  icon: "Office/32x32/…", // required — pick via sitecore-icons
  variants: [{ name: "Default" }, { name: "Alt" }],
}
```

### `rendering` (standalone)

Canonical headless rendering definition — branch name = `name` (e.g. `Example Rendering`). Same template/rendering/scaffolding emit path as `kind: "component"` (component maps onto this emitter).

**Parameters (exactly one or none):**

| Source | Definition field |
|--------|------------------|
| Inline | `parameters: { sections: [ … ] }` |
| Another definition | `parameters: { definitionKey: "other-key" }` (`kind: "parameters"` or `rendering` with inline params) |
| CM-pulled YAML | `parametersTemplateId: "{GUID}"` |

**Variants (exactly one or none):**

| Source | Definition field |
|--------|------------------|
| Inline | `variants: [{ name: "Default" }, …]` |
| Shared definition | `variants: { definitionKey: "other-key" }` (`kind: "variants"`) |

```ts
export const exampleRenderingDefinition = {
  kind: "rendering",
  definitionKey: "example-rendering",
  name: "Example Rendering",
  displayName: "Example Rendering",
  icon: "Office/32x32/…", // required — pick via sitecore-icons
  model: { folderTemplate: { … }, itemTemplate: { … } },
  datasourceLocation: { scope: "site", root: "data", folder: ["SubFolder"] }, // folder optional
  parameters: { sections: [ … ] }, // optional — inline params template
  variants: [{ name: "Default" }, { name: "Variant2" }], // or variants: { definitionKey }
} satisfies RenderingDefinition;
```

Also emits `{site}/Presentation/Headless Variants/{componentName}/…` (folder + one item per variant) via `emitVariantsDefinition`. Uses BQ provenance (`__Created by` / `__Updated by` = `BQ`) like data/content emitters; reuses existing item IDs from disk. Prune scope includes the variant folder when `variants` (inline or `{ definitionKey }`) is set.

Standalone `*.content.ts` remains supported when seed content is kept in a separate file.

**Output paths** (shared helpers in `bq/tools/shared/data-placement.ts`):

- `DEFAULT_PROJECT_COLLECTION` — `"build-quick-demos-and-proof-of-concepts"` (override with `collectionSystem` on the definition)
- Templates: `authoring/items/bq-demo/sai/templates/Project/{collection}/{branch}/…` (branch = Pascal `componentName` for components, `name` for renderings)
- Renderings: `authoring/items/bq-demo/sai/renderings/Project/{collection}/{name}.yml` — shared field `componentName` is kebab `definitionKey` (matches Content SDK component-map keys). When `folder: ["Link Lists"]`, emit also writes platform Datasource Template `{60C9AC62-…}` and Json Rendering **`ComponentQuery`** (`17bb046a-…`, JSS LinkListQuery GQL) from constants in `bq/tools/shared/platform-link-list.ts` (do not read on-disk JSS LinkList.yml).
- Headless variants: `authoring/items/bq-demo/sai/sites/content/…/Presentation/Headless Variants/{Pascal branch}/…`
- Scaffolding insert rules: `authoring/items/bq-demo/sai/systemSettings/Project/{collection}/{collection}/Add {Name}s Data Item.yml` (long paths may be hashed to `systemSettings/<16-hex>/…`)
- Parent IDs come from existing collection root YAML (`templates/Project/{collection}.yml`, `renderings/Project/{collection}.yml`) — the `{collection}/` subfolder is created automatically when child items are emitted

**SCS path-length hashing** (`bq/tools/shared/scs-path-length.ts`, applied in `writeScsItem` / ID reads):

Matches `SubtreeFilesystemPathProvider.ApplyPathLengthHashes`: length is measured on
the path **after skipping the first segment** (the prepended include leaf, e.g.
`Project/…`), without `.yml`. Max length follows `sitecore.json`
`defaultMaxRelativeItemPathLength` (**100** here; override via
`BQ_SCS_MAX_RELATIVE_ITEM_PATH_LENGTH`). When over the limit, SCS hashes a shortened
prefix (`SHA-256` of `"/" + segments.join("/")` on that skipped path — no extra skip,
first 8 bytes hex) and keeps the remainder. Under-limit writes still remove any
legacy `include/<16-hex-hash>/Item.yml` orphans (and empty hash folders). Media library
items go under `sai/media-library/Project/{collection}/…`.

**When to use which**

| Kind | Use when |
|------|----------|
| `component` | Real UI atom (model + params + rendering + optional seed) in one package |
| `rendering` | Layout registration + datasource templates without a component package |
| `parameters` / `data` | Shared building blocks referenced from components/renderings |

### `component-content` (standalone file)

Optional — prefer `content` on `ComponentTemplateDefinition`. Uses the same **site content item emitter** as data definitions.

```ts
export const ctaButtonContent = {
  kind: "component-content",
  definitionKey: "cta-button",
  location: { root: "data", folder: ["CtaButtons"] },
  cultures: ["nl-BE", "fr-BE"], // optional — extra targets; en always emitted
  culture: "nl-BE", // source language of seed strings (capture language)
  items: [{ name: "Get started", fields: { Link: { text: "Get started", url: "/" } } }],
} satisfies ComponentContentDefinition;
```

**`content.culture`:** Sitecore culture of seed field strings (defaults to `en` when omitted). Emit always writes an `en` version and translates from `culture` into `cultures` (translation disk cache; force does not re-call AI on cache hits).

**Same-site General Links → EN Home pages:** When emitting any General Link whose URL is same-site (relative `/…` or absolute same origin as the capture/`BQ_SITE_ORIGIN`), emit creates missing English page YAML under `{collection}/{site}/Home/…` (create-if-missing only; BQ provenance) and serializes the field as `linktype="internal"` with the item `id`. Cross-domain, `mailto:`, and `#` anchors stay `external` / special with no Home pages. Path segments and leaf display names are translated to English via `translateText` (AI usage rolls into generate totals). Shared helper: `bq/tools/shared/ensure-home-link-page.ts`. Codegen also writes `kind: "page-stub"` definitions under `_page-stubs/` for same-site links found in content.

---

## Commands (run from `bq/`)

| Command | Purpose |
|---------|---------|
| `npm run definitions:generate` | Emit all `*.definition.ts`; ends with `ser validate` then `ser push` on success. Requires `BQ_SITECORE_ENDPOINT` (or `--endpoint <name>`). |
| `npm run content:generate` | Emit all `*.content.ts` |
| `npm run authoring:generate` | Both, serial (same endpoint flags as `definitions:generate`) |

Field validators emit **first** so data definitions can reference BQ rule paths.

Detail log path is printed at the end (`.bq/definitions/definitions-generate.log`).

---

## Stale YAML prune (BQ-owned files only)

**Agent note:** prune is performed only by `definitions:generate` — agents must not delete YAML themselves (except one-time manual collision cleanup when a plan explicitly requires it).

After each generate (**full or scoped**), the generator **deletes orphaned BQ YAML** that was present under this run’s prune roots but never tracked in the run emit manifest when:

1. `Languages → Versions → __Created by` equals `BQ` (see `PROVENANCE_CREATED_BY`), or `__Updated by` is `BQ` when create provenance is missing

Hand-authored or Sitecore-synced YAML (different actor) is **never** deleted — logged as `skipped (not BQ)`.

**Scoped generates** (`--site` / `--collection`, including `create:sectioncomponents`) also run this prune. Snapshot roots are the union of `getDefinitionPruneRoots()` for definitions **in this run only** — other sites/collections live outside those roots and are never deleted. Inventory/mtime skips still `manifest.track()` prior disk paths so still-needed YAML for this site is kept.

Terminal logs a YAML summary (`created` / `updated` / `kept/unchanged` / `pruned`); full paths go in `.bq/definitions/definitions-generate.log`.

### How it works

1. **Emit manifest** — every `writeScsItem()` call during a definition run registers the target path (including unchanged files). Inventory/mtime skips also track prior inventory disk paths.
2. **Run-level snapshot roots** — union of `getDefinitionPruneRoots()` for every definition in the run, plus SCS path-length **hash folders** under each SAI include (`sai/{include}/<16-hex>/`). See `bq-orphan-prune-plan.ts`. Does **not** prune the whole SAI tree (avoids deleting other sites and site scaffold / Styles / Partial Designs that definitions do not re-emit).
3. **Prune pass** — BQ-owned YAML in the snapshot but not in the manifest is removed; empty **hash folders** only are cleaned via `tryRemoveEmptyHashDir` on the deleted file's parent (reverse of hash-folder creation).
4. **Stable IDs** — `resolveOrCreateId` reuses an existing BQ sibling ID when the desired Sitecore-valid leaf name already exists (avoids `-1` / `-2` collision leaves).

Implementation: `bq/tools/shared/emit-manifest.ts`, `prune-roots.ts`, `bq-orphan-prune-plan.ts`, wired in `definitions/generate.ts`.

When changing prune behavior, update this section in the same task.

---

## File conventions

- Export named `*Definition` or default; generator discovers `*.definition.ts` / `*.content.ts` under `src/components`.
- Use `satisfies DataDefinition` (or matching kind) for type-checking.
- `definitionKey`: kebab-case stable id; `name`: PascalCase Sitecore item/template name where applicable.
- Optional `cultures: ["nl-BE", "fr-BE"]` triggers auto-translation on emit.
