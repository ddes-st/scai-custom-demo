---
name: capture-website
description: >-
  Invoke BQ website capture (npm run capture:webpage). Output under
  <repo>/.bq/captures/. Logic in bq/tools/capture, not in the skill.
paths:
  - "**/.bq/captures/**"
  - "bq/tools/capture/**"
---

# Capture Website (BQ)

```bash
cd bq
npm run capture:webpage -- --urls "https://example.com" --manifest
```

One pass: full-page screenshots (overlay + clean), HTML, CSS/fonts, hybrid section detection (`detected-sections.png|.json` at the page folder root), catalogue naming, page-local `sections/{folder}/` assets (default PNGs + interactive `states/` for menus/FAQ/tabs; always AI-enriched in place), and `ai-derived-design.md`. After pages exist for a host: `npm run capture:merge-sections -- --url …` → `{host}/section-registry/{component}/instances.json` (refs to page sections) + `ai-website-design.md` (optional `--ai` for unsure pairs; optional `--use-ai` → `{host}/section-registry-ai/`). Also step 0 of `create:sectioncomponents`. To codegen unique registry components and recreate **all** captured pages for the host: `npm run create:sectioncomponents -- --url "https://…" --all`.

Screenshots land in `.bq/captures/{domain}/…` (e.g. `www-sitecore-com`; log: `{domain}/capture.log`). Definitions: `.bq/definitions/`. Do not hand-run Playwright.

Full instructions: [../../../.cursor/capture-website/SKILL.md](../../../.cursor/capture-website/SKILL.md)
