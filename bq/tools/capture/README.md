# Website capture tooling

Programmed capture pipeline for BQ (same role as `definitions:generate` for authoring).

```bash
cd bq
npm install
npm run setup:playwright   # Chromium → bq/.playwright (durable; not sandbox temp)
npm run capture:webpage -- --urls "https://example.com" --manifest
```

Browsers default to `bq/.playwright` via `PLAYWRIGHT_BROWSERS_PATH` (override in `.env.local` if needed).

One command captures full-page screenshots, HTML, CSS/fonts, hybrid section detection, interactive states (menus/FAQ/tabs under `sections/*/states/`), AI-enriched page `sections/`, and `ai-derived-design.md`.

Default section PNGs are the closed/selected state. Each section folder gets `original-section.html` (raw outerHTML for hashing/structure) and `section.html` (self-contained styled snapshot: fonts, page shell tokens, matched CSS with `@media`, desktop computed floor, open Shadow DOM flattened). Non-interactive sections and **tabs/accordion-only** interactive sections take resting PNGs from `section.html` (`method: section-html`). Expanded menus (`depth: 0` hamburger-open on tablet/mobile, then L1→L2→L3), FAQ panels, and alternate tabs live under `states/` with open-state `original-section.html` + styled `section.html` + multi-viewport PNGs (tab/accordion state PNGs also from `section.html` when possible). Menu panels are resolved by DOM before/after mutation (written into `states/`). Narrow viewports open the hamburger/drawer before menu shots. Menu PNGs stay live chrome∪panel only (no page underlay). `section-information.json.interactionStates` indexes them for later codegen. Pass `--styled-html` to also emit legacy `section.styled*.html` siblings.

```bash
# After capturing one or more pages for a host:
npm run capture:merge-sections -- --url https://nl.renault.be/
# Optional: Azure for unsure layout pairs only:
npm run capture:merge-sections -- --url https://nl.renault.be/ --ai
# Optional: Azure clusters all section HTMLs → parallel ai-sections/ registry (logs total tokens):
npm run capture:merge-sections -- --url https://nl.renault.be/ --use-ai
# Re-merge site AI design even if page guides unchanged:
npm run capture:merge-sections -- --url https://nl.renault.be/ --force design
```

| Script | Entry |
|--------|-------|
| `capture:webpage` | `capture.mjs` — full pipeline (html, css, fonts, screenshots, sections + AI enrich, AI design); reuses on-disk artifacts unless `--force[=kinds]` |
| `create:design-system` | `create-design-system.mjs` — refresh AI design for one URL (`--force[=kinds]`) |
| `capture:merge-sections` | `merge-page-sections.mjs` — `section-registry/` catalog (+ optional `--ai`); `--use-ai` also writes `{project}/section-registry-ai/` |
| `capture:site-summary` | `write-site-summary.mjs` |
| `capture:site-content-tree` | `write-site-content-tree.mjs` |
| `capture:section-plans` | `write-section-plans.mjs` |

Removed: `capture:generate` / `capture:website` (now `capture:webpage`), `capture:html`, `capture:sections`, `capture:enrich-design` (use `create:design-system` per URL).

Default output: **`<repo>/.bq/captures/{domain}/…`** (www kept in slug). Capture log: **`.bq/captures/{domain}/capture.log`**. Definitions: **`.bq/definitions/`**. See `references/`.

Agents must invoke these npm scripts via the `capture-website` skill — do not re-implement Playwright in prompts.
