# BQ definition kind recipes

**Source of truth:** `bq/src/components/**/*.definition.ts` (and optional `*.content.ts`).  
**Emit:** from `bq/` run `npm run definitions:generate` (or `authoring:generate`).  

**Hard ban:** do not create, edit, move, or delete any `*.yml` / `*.yaml`. Only the generate command may change serialization files. Fix definitions (or emitters) and re-run generate.

Types: `bq/tools/definitions/types.ts`.  

### Icons (mandatory for template kinds)

For **`rendering`**, **`component`**, and **`variants`**, always set `icon:` by using the **`sitecore-icons`** skill before finishing the definition:

```bash
node bq/.cursor/skills/sitecore-icons/scripts/select-icon.mjs "short purpose / UI metaphor"
```

Put the returned `{Set}/32x32/{file}.png` on the definition. Never omit `icon` or invent a path. Do not set `__Icon` in YAML.

---

## Where to put files

| Kind | Suggested path under `bq/src/components/` |
|------|-------------------------------------------|
| `collection` | `{hostSlug}/{system}-collection.definition.ts` (alongside site components) |
| `site` | `{hostSlug}/{system}-site.definition.ts` |
| `site-presentation` | `{hostSlug}/{system}-presentation.definition.ts` |
| `data` | `data/{key}.definition.ts` |
| `media` | `media/{key}.definition.ts` |
| `enumeration` | `enums/{key}.definition.ts` |
| `dictionary` | `dictionary/{key}.definition.ts` |
| `field-validator` | `validators/{key}.definition.ts` |
| `rendering` | `renderings/{key}.definition.ts` |
| `component` | `atoms|molecules|…/{name}/{name}.definition.ts` |
| `parameters` | `parameters/{key}.definition.ts` |
| `variants` | `variants/{key}.definition.ts` |
| seed only | `{name}.content.ts` (`kind: "component-content"`) |

`definitionKey`: stable kebab-case id (never rename lightly).  
`name`: Sitecore item display/name as provided (casing preserved except URL pages under `Home`).

---

## Minimal skeletons (copy + fill)

### collection

Sample: `sitecore-com/sitecore-collection.definition.ts` (same host folder as FE components)

```ts
import type { CollectionDefinition } from "../../../tools/definitions/types";

export const myCollection = {
  kind: "collection",
  definitionKey: "my-collection",
  name: "My Collection",
  systemName: "mycollection",
  description: "…",
} satisfies CollectionDefinition;
```

### site

Sample: `sitecore-com/sitecore-com-site.definition.ts`

```ts
import type { SiteDefinition } from "../../../tools/definitions/types";

export const mySite = {
  kind: "site",
  definitionKey: "my-site",
  name: "My Site",
  systemName: "mysite",
  description: "…",
  collectionSystem: "mycollection",
} satisfies SiteDefinition;
```

### data

Sample: `data/authors.definition.ts`

```ts
import type { DataDefinition } from "../../../tools/definitions/types";

export const myData = {
  kind: "data",
  definitionKey: "my-data",
  name: "MyData",
  location: { root: "data", folder: ["MyData"] },
  cultures: ["nl-BE"], // optional
  model: {
    folderTemplate: { name: "MyData", sections: [/* … */] },
    itemTemplate: { name: "MyItem", sections: [/* fields */] },
  },
  items: [{ name: "Sample", fields: { /* … */ } }],
} satisfies DataDefinition;
```

### media

Sample: `media/sample-hero.definition.ts`

```ts
import type { MediaDefinition } from "../../../tools/definitions/types";

export const myMedia = {
  kind: "media",
  definitionKey: "my-media",
  name: "my-hero",
  location: { folder: ["Samples"] },
  // exactly one of: url | base64 | svgMarkup | path | guid | definitionKey
  source: { url: "https://…" },
} satisfies MediaDefinition;
```

### enumeration

Sample: `enums/caption-style.definition.ts`

```ts
import type { EnumerationDefinition } from "../../../tools/definitions/types";

export const myEnum = {
  kind: "enumeration",
  definitionKey: "my-enum",
  name: "MyEnum",
  location: { scope: "site", folder: ["Components"] },
  default: "option-a",
  constants: [
    { name: "option-a", displayName: "Option A" },
    { name: "option-b", displayName: "Option B" },
  ],
} satisfies EnumerationDefinition;
```

### dictionary

Sample: `dictionary/forms-labels.definition.ts`

```ts
import type { DictionaryDefinition } from "../../../tools/definitions/types";

export const myDictionary = {
  kind: "dictionary",
  definitionKey: "forms-labels",
  name: "FormsLabels",
  location: { scope: "site", folder: ["Forms"] },
  entries: [{ key: "form-submit", phrase: "Submit" }],
} satisfies DictionaryDefinition;
```

### field-validator

Sample: `validators/at-least-two-words.definition.ts`

```ts
import type { FieldValidatorDefinition } from "../../../tools/definitions/types";

export const myValidator = {
  kind: "field-validator",
  definitionKey: "at-least-two-words",
  name: "At Least Two Words",
  folder: "BQ",
  versions: [{ version: 1, /* rule spec */ }],
} satisfies FieldValidatorDefinition;
```

### rendering

Sample: `renderings/custom-card.definition.ts`

```ts
import type { RenderingDefinition } from "../../../tools/definitions/types";

export const myRendering = {
  kind: "rendering",
  definitionKey: "my-rendering",
  name: "My Rendering",
  displayName: "My Rendering",
  componentName: "MyRendering",
  icon: "…/32x32/….png", // required — from sitecore-icons
  model: {
    // Pin once; treat as immutable after first successful push (Path leaf).
    folderTemplate: { name: "My Rendering Folder" },
    itemTemplate: {
      name: "My Rendering",
      sections: [{ name: "Data", fields: [/* … */] }],
    },
  },
  variants: [{ name: "Default" }],
  // parameters: { definitionKey: "…" } | inline sections
} satisfies RenderingDefinition;
```

`displayName` is for authoring UI only — never used as the Sitecore template Path leaf. Prefer short stems tied to the component, not marketing copy.

### component (atom façade)

Sample: `atoms/cta-button/cta-button.definition.ts`

Same shape as `rendering` with `kind: "component"` plus optional inline `content` seed or separate `*.content.ts`. **`icon:` required** (sitecore-icons).

### parameters / variants

Samples: `parameters/mycustom-test.definition.ts`, `variants/dummy-demo.definition.ts`

Reference from renderings/components via `{ definitionKey: "…" }`. For **`variants`**, set **`icon:`** via sitecore-icons.

---

## After authoring

```bash
cd bq
npm run definitions:generate   # ends with read-only ser validate
# or
npm run authoring:generate
```

Check terminal fractions + `Detail log:` path. Fix definitions (not YAML) if validate fails. Never touch YAML files directly.
