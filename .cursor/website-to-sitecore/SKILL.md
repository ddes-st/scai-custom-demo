---
name: website-to-sitecore
description: >-
  Compact end-to-end workflow for reference URL or screenshots → CMS component
  manifest → Sitecore Content SDK TSX → serialization. Orchestrator only.
  For BQ / bq-demo, serialization must go through bq-definitions
  (*.definition.ts + definitions:generate), not sitecore-yaml generators.
paths:
  - "**/.bq/captures/**/page-manifest.json"
  - "**/.bq/captures/**/sections/manifest.json"
  - "**/design-screenshots/**/page-manifest.json"
  - "**/design-screenshots/**/sections/manifest.json"
---

# Website to Sitecore

Use this skill when the user wants to mimic a website/page and produce Sitecore Content SDK components plus serialization.

## Target: BQ vs other modules

| Target | Serialization path |
|--------|--------------------|
| **`bq/`** / module **`BQ`** / `authoring/items/bq-demo` | **`bq-definitions`**: write `*.definition.ts` / `*.content.ts`, then `npm run authoring:generate` from `bq/`. **Never** create/edit/delete YAML files — only generate may. Do not run `.cursor/sitecore-yaml` generators. |
| Other modules | `sitecore-yaml` generator **scripts** only (not manual YAML edits) + [site authoring wiring](../sitecore-yaml/references/site-authoring-wiring.md) |

## Outcome

Produce:

```txt
design-screenshots/{project}/...
# BQ capture default:
.bq/captures/{project}/...
# BQ:
bq/src/components/.../*.tsx
bq/src/components/.../*.definition.ts
# Other hosts:
src/components/{namespace}/{Component}.tsx
.sitecore/component-map*.ts
authoring/items/{module}/...   # emitted by generate (BQ) or sitecore-yaml (other)
```

## Workflow

1. **Capture** — run `capture-website` skill → from `bq/`: `npm run capture:webpage -- …`. Skip when screenshots already exist.
2. **Analyze visually** — run `visual-cms-map` on full-page screenshots + section crops.
3. **Create review manifest** — list components with action: `create`, `reuse`, `skip`, or `unclear`.
4. **Stop for user approval** before writing TSX/authoring, unless the user explicitly asked for a no-review batch.
5. **Build approved items** — run `sitecore-from-capture` (TSX + placeholders + datasources + page/partial wiring).
6. **Generate serialization**
   - **BQ:** follow `bq/.cursor/skills/bq-definitions` — create/update definitions for collection/site/rendering/media/data as needed, then `cd bq && npm run authoring:generate`.
   - **Other:** run `sitecore-yaml` (collection/site/renderings/media + site authoring wiring).
7. **Validate**
   - **BQ:** generate already runs read-only `ser validate -i BQ`; also `npm run build` in the rendering host if TSX changed.
   - **Other:** `npm run build`, then `dotnet sitecore ser validate --fix`. If `NON-UNIQUE ITEM PATH` appears, fix per [non-unique-item-paths](../sitecore-yaml/references/non-unique-item-paths.md).

## Non-negotiable rules

- Do not build components from URL memory. Use screenshots/HTML/manifests as evidence.
- Do not create one component per `div`; create CMS-authorable renderings.
- Do not duplicate components already marked `reuse` in `new-sections-manifest.json`.
- Do not copy GUIDs from another project.
- Do not hardcode marketing content in TSX; make content editable fields.
- Keep all generated files inside the current rendering host and current serialization module.
- **Never create/edit/delete `*.yml` with agent tools for BQ** — change definitions and re-run generate. For other modules, prefer generator scripts over hand-edited YAML.

## Review manifest shape

```json
{
  "project": "example-com",
  "pages": ["home"],
  "components": [
    {
      "id": "S1",
      "cmsName": "HeroBanner",
      "scope": "page",
      "action": "create",
      "evidence": ["design-screenshots/example-com/sections/hero-banner/hero-banner-desktop.png"],
      "fields": ["title", "body", "primaryLink", "image"],
      "placeholders": []
    }
  ]
}
```

Write this manifest to:

```txt
design-screenshots/{project}/component-review.json
```
