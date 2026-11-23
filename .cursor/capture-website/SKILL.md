---
name: capture-website
description: >-
  Capture desktop/tablet/mobile screenshots, clean screenshots, HTML, section
  crops, and manifests for URLs. Does not capture itself — runs programmed
  tooling via npm run capture:webpage in bq/. Output always under
  <repo>/.bq/captures/. Use before visual CMS analysis.
paths:
  - "**/.bq/captures/**"
  - "bq/tools/capture/**"
---

# Capture Website

Use this skill only to **invoke** the programmed capture tooling. Do not re-implement Playwright capture in the agent, and do not create TSX or YAML here.

## One-time setup (from `bq/`)

```bash
cd bq
npm install
npm run setup:playwright
```

Playwright is a **bq** devDependency (`bq/node_modules`). Do **not** install Playwright under `.cursor/`.

## Run (required)

From **`bq/`**, always prefer (default out is `<repo>/.bq/captures`):

```bash
npm run capture:webpage -- \
  --urls "https://example.com,https://example.com/about" \
  --manifest
```

Optional explicit project folder:

```bash
npm run capture:webpage -- \
  --urls "https://example.com" \
  --out "../.bq/captures/example-com" \
  --manifest
```

`capture:webpage` includes HTML, CSS/fonts, screenshots, hybrid section detection, page-local `sections/` export (interactive `states/` + always AI-enriched in place), and `ai-derived-design.md`.

To refresh AI design only for one URL:

```bash
npm run create:design-system -- --url "https://example.com"
```

After pages exist for a host:

```bash
npm run capture:merge-sections -- --url "https://example.com/"
npm run capture:merge-sections -- --url "https://example.com/" --use-ai
npm run create:sectioncomponents -- --url "https://example.com/" --all
```

| npm script | Tool |
|------------|------|
| `capture:webpage` | Full capture pipeline (AI-enriches page `sections/`) |
| `create:design-system` | AI design refresh for one URL |
| `capture:merge-sections` | Host `section-registry/` catalog; `--use-ai` → `{project}/section-registry-ai/` |
| `create:sectioncomponents --all` | Unique registry components + recreate every captured page |

Implementation lives in `bq/tools/capture/` (edit there to change capture behavior). CLI flags: `bq/tools/capture/references/capture-options.md`.

## Output contract

Always under **`<repo>/.bq/captures/{domain}/…`** (host slug keeps `www`, e.g. `www-sitecore-net`). Capture run log: `.bq/captures/{domain}/capture.log`. Definitions: `.bq/definitions/` (log + `cache/`). See `bq/tools/capture/references/output-contract.md`.

## Rules (enforced by tooling; do not bypass in the agent)

- Capture `desktop`, `tablet`, and `mobile` unless the user asks for fewer (`--devices`).
- Save both overlay and clean screenshots.
- Save rendered HTML as `page.html`.
- Hide cookie banners, sticky headers, chat widgets, floating buttons, and modal backdrops for clean captures.
- Section crops should represent major CMS bands, not every DOM element.
- Site chrome (`Header`, `Navigation`, `Footer`, `CookieBanner`) is site-scoped and captured once per project.
- Content sections are page-scoped first, then merged into `shared-sections/manifest.json` for reuse.

## After running

Report only:

- project folder under `.bq/captures/`;
- page folders;
- full-page screenshot paths;
- `shared-sections/manifest.json` path (if merge was run);
- failed URLs/viewports;
- whether overlay removal and section detection looked reliable.
