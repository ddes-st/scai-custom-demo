---
name: sitecore-yaml
description: >-
  Generate and validate Sitecore Content Serialization YAML for non-BQ modules
  (collections, sites, renderings, placeholders, media). For the BQ / bq-demo
  module and bq/ app, do NOT use these generators — use bq-definitions
  (*.definition.ts + npm run definitions:generate) instead.
paths:
  - "authoring/items/**/*.yml"
  - "**/*.module.json"
  - "**/sitecore.json"
---

# Sitecore YAML

Use this skill for serialization only. Do not design components here.

## BQ / this showcase fork (mandatory redirect)

When the target is **`bq/`**, module **`BQ`**, or `authoring/items/bq-demo/sai/**`:

1. **Stop** — do not run the generators below.
2. **Do not create, edit, or delete any YAML** (agent tools must not mutate `*.yml`).
3. Load **`bq/.cursor/skills/bq-definitions`** (+ [kind-recipes](../../bq/.cursor/skills/bq-definitions/references/kind-recipes.md)).
4. Author `bq/src/components/**/*.definition.ts` (and optional `*.content.ts`).
5. From `bq/`: `npm run definitions:generate` or `npm run authoring:generate` — that command alone may write/prune YAML.

Root `.cursor` generators remain for **other** modules / classic serialization workflows only. Even there: prefer running the generator scripts below; do not hand-author YAML with editor tools when a generator covers the item.

## Generators

```txt
generators/sitecore-new-collection-yaml/scripts/Generate-SitecoreCollection.mjs
generators/sitecore-new-site-yaml/scripts/Generate-SitecoreSite.mjs
generators/sitecore-new-rendering-yaml/scripts/Generate-SitecoreRendering.mjs
generators/sitecore-media-from-url-yaml/scripts/create-media-from-urls.ps1
```

## Collection

```bash
node .cursor/skills/sitecore-yaml/generators/sitecore-new-collection-yaml/scripts/Generate-SitecoreCollection.mjs "Collection Display Name"
```

## Site

```bash
node .cursor/skills/sitecore-yaml/generators/sitecore-new-site-yaml/scripts/Generate-SitecoreSite.mjs "Site Display Name" --collection "Collection Display Name"
```

## Rendering/component YAML

```bash
node .cursor/skills/sitecore-yaml/generators/sitecore-new-rendering-yaml/scripts/Generate-SitecoreRendering.mjs "ComponentName" --module "Module Name"
```

When the generator requires a fields JSON file, produce one from the approved component fields first.

## Media from URLs

Use the PowerShell script when screenshots/HTML reference assets that must become Sitecore media items:

```powershell
.cursor/skills/sitecore-yaml/generators/sitecore-media-from-url-yaml/scripts/create-media-from-urls.ps1 `
  -MediaRoot "authoring/items/{module}/serialized-content/media-library/{project}/{site}" `
  -SiteMediaPath "/sitecore/media library/Project/{project}/{site}" `
  -SiteRootItemId "{GUID}" `
  -Assets $assets `
  -BaseUrl "https://example.com"
```

## After renderings: site wiring

Generators create templates/renderings only. Complete authoring wiring before considering YAML done:

1. Placeholder settings + rendering `Placeholders` field
2. `Data/{Component}s/` folders + default datasource items (reuse field definition IDs)
3. Available Renderings entries for every project rendering
4. Partial designs (header/footer/cookie) + Page Design / TemplatesMapping
5. Page `__Renderings` for body composition

See [references/site-authoring-wiring.md](references/site-authoring-wiring.md).

## Validation

From the module folder:

```bash
dotnet sitecore ser validate --fix -i {collection-system}-scs
```

If validate reports **`NON-UNIQUE ITEM PATH`**, stop and fix manually — `--fix` will not resolve it. See [references/non-unique-item-paths.md](references/non-unique-item-paths.md).

Push only when the user requested it or when the workflow explicitly includes push:

```bash
dotnet sitecore ser push -i {collection-system}-scs
```

## Rules

- **BQ / `bq-demo`:** do not use this skill to mutate YAML — use `bq-definitions` + generate.
- Prefer generator scripts over agent Write/StrReplace/Delete on `*.yml`.
- Generate fresh GUIDs for new items (via generators).
- Never duplicate one Sitecore `Path:` across multiple YAML files (hash folder + readable tree is the usual trap).
- Before adding a template field, search the module for that `Path:` and for `{FieldName}.yml` under `templates/{HASH}/`.
- Respect `*.module.json` include roots.
- Let `validate --fix` relocate long paths into hash folders; do not guess hash names or edit `Path:` to match disk layout.
- Datasource field values must reference existing template field IDs (by Hint/Path lookup), never invent field GUIDs.
- For internal links, prefer Sitecore item IDs from `site-content-tree.json`.
- YAML must stay in the current module namespace.
