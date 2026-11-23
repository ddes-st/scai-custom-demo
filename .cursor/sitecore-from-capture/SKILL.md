---
name: sitecore-from-capture
description: >-
  Build Sitecore Content SDK Next.js components from approved webpage captures.
  For BQ: run npm run create:sectioncomponents (definitions + TSX only; never hand-edit YAML).
paths:
  - "**/.bq/captures/**"
  - "**/src/components/**/*.tsx"
  - "bq/src/components/**/*.definition.ts"
---

# Sitecore from Capture

Logic lives in **code**, not in this skill.

## BQ / `bq-demo`

```bash
cd bq
# Capture first (if needed)
npm run capture:webpage -- --urls "https://example.com/"

# Generate TSX + *.definition.ts + presentation + stubs, then authoring:generate
npm run create:sectioncomponents -- --url "https://example.com/"

# Host-wide: merge registry once, unique components once, wire every captured page
npm run create:sectioncomponents -- --url "https://example.com/" --all
```

Optional flags: `--collection`, `--site`, `--force`, `--dry-run`, `--skip-generate`, `--only section-04`, `--all` (incompatible with `--only`).

Unchanged sections are skipped (no Azure) when `section-conversion.json` `conversionSourceHash` matches and component sources still exist. Use `--force` to re-run AI and overwrite.

`authoring:generate` runs scoped to the capture’s `--site` / `--collection` (e.g. `axabe`) so other demo collections are left alone. Manual generate: `npm run authoring:generate -- --site axabe --collection axabe`.

**Do not** create/edit/delete YAML or call sitecore-yaml generators for BQ. Use definitions only; `authoring:generate` emits SCS YAML.

Prompts and rules: `bq/tools/create-section-components/prompts/`.

Provenance:

- Page: `.bq/captures/{host}/{page}/page-conversion.json` (includes AI totals)
- Section: `sections/section-NN/section-conversion.json`

After a successful run, follow the CLI “Next steps” (ser push + `npm run dev` / commit for Pages).

## Other modules (non-BQ)

Use `.cursor/sitecore-yaml` generator scripts for serialization. Prefer scripts over hand-edited YAML.
