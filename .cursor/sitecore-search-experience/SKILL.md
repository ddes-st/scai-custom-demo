---
name: sitecore-search-experience
description: Add the Sitecore Search Experience component to a Content SDK App Router rendering host, including TSX, component-map registration, next-intl wiring, and dependencies. For BQ/bq-demo do not copy YAML — use bq-definitions + generate if/when a definition kind covers it.
paths:
  - "**/src/components/**/SearchExperience*.tsx"
  - "**/.sitecore/component-map*.ts"
  - "authoring/items/**/Search*.yml"
---

# Sitecore Search Experience

Use only for App Router hosts. Pages Router is not supported by this optimized skill.

## Steps

1. Confirm the target rendering host uses App Router.
2. Confirm or add `next-intl` provider wiring from `references/app-router-next-intl.md`.
3. Copy TSX from `references/search-experience/` into the target host.
4. Install dependencies listed in `references/package.json.dependencies.json`.
5. Register component-map entries using `references/component-map-registration.md`.
6. Serialization: **BQ / bq-demo** — do not create/edit/delete YAML; use `bq-definitions` + `definitions:generate` (or ask to extend emitters). **Other modules** — copy/adapt YAML from `references/sitecore/` into the current module only via the approved generator/copy flow for that host (prefer not inventing YAML by hand).
7. Ask for search index/source ID if it is not present in the user's context.
8. Run `npm run build`.

## Rules

- Keep all generated files inside the current rendering host/module.
- **Never** create/edit/delete `authoring/items/bq-demo/**/*.yml` with agent tools.
- Replace placeholders such as `{{hostRoot}}`, `{{componentNamespace}}`, and `{{collectionName}}`.
- Do not hardcode a search index ID unless supplied by the user or existing config.
