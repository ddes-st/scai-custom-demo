# Capture output contract

Default capture workspace: `<repo>/.bq/captures/`

```txt
.bq/
  definitions/
    definitions-generate.log
    cache/                    # e.g. translations.json
  captures/
    {project}/                # host slug, e.g. www-sitecore-com (www kept)
      capture.log             # capture:webpage run log for this site
      ai-website-design.md             # site-wide Stitch guide (capture:merge-sections)
      ai-website-design.meta.json      # sourceHash over page ai-derived-design.md files
      section-registry/                # unique layout catalog (capture:merge-sections / create step 0)
        manifest.json
        content-families.json          # e.g. news-article shared item templates
        {component-folder}/
          component.json               # canonicalRef + identity
          instances.json               # refs to page sections (no full copies)
          section-plan.json
      section-registry-ai/             # optional merge --use-ai AI clustering registry
        ai-meta.json                   # AI usage/cost entries (by purpose)
        manifest.json
        {component-folder}/…
      # Legacy shared-sections/, sections/, ai-sections/ are migrated once if present.
      {page-slug}/
        source-url.txt
        ai-derived-design.md           # Azure Foundry Stitch-style design guide
        ai-meta.json                   # AI usage/cost + design sourceHash (purpose ai-derived-design)
        detected-fonts.json           # font catalog (families, hrefs, local paths)
        detected-css.json             # CSS catalog in document include order
        detected-sections.json    # canonical page section index + naming + paths
        detected-sections.png     # numbered boxes only
        fonts/                        # downloaded font binaries
        screenshots/
          desktop.png
          desktop-clean.png
          tablet.png
          tablet-clean.png
          mobile.png
          mobile-clean.png
        html/
          page.html
        css/                          # linked sheets + page-inline.css
        sections/                 # page-local positional slots; AI-enriched in place (no rename)
          ai-meta.json            # page AI enrich usage/cost + sourceHash (purpose sections-enrich)
          section-01/             # band order (zero-padded); cmsName lives in JSON only
            section-01-desktop.png         # Desktop Small 1024 (default/closed or selected tab)
            section-01-desktop-regular.png # Desktop Regular 1280
            section-01-desktop-large.png   # Desktop Large 1536
            section-01-tablet.png
            section-01-mobile.png
            original-section.html          # raw outerHTML (contentHash / structure identity)
            section.html                   # self-contained styled snapshot (fonts, shell, @media, desktop computed floor, open shadow flattened)
            section.styled.html            # optional (--styled-html): legacy matched-CSS sibling
            section.styled-desktop.html    # optional (--styled-html): computed styles @ desktop
            section.styled-tablet.html
            section.styled-mobile.html
            section-information.json       # cmsName, purpose, contentHash, scrollBehavior{}, fields, interactionStates[]
            states/                        # open menus (mutation panel), tabs, FAQ
              {state-slug}/
                section-01-{state-slug}-desktop|desktop-regular|desktop-large|tablet|mobile.png
                section.html               # DOM while this path is open
                state.json                 # one interactionStates[] entry (menus: detection "mutation")
            visual-fidelity/               # create:sectioncomponents --visual-fidelity (page-local)
              {ComponentName}/             # report.json, score-history.json, attempt-N/{preview,shots}
            source-fidelity/               # create:sectioncomponents --source-fidelity (page-local)
              {ComponentName}/             # score-history.json
          section-02/
          …
      site-summary.json
      site-content-tree.json
      manifest.json           # when --manifest
```

Chrome classification (site-generic layout probe during overlay detect): short top bands that **clear main content** under a stacked height (`mainTop ≈ stackH` or body `padding-top` / occupancy) become `track: "header"`, `isOverlay: false`, `chromeKind: "header-stack"` (announcement + nav and similar). True floats (cookie/CMP dialogs, bottom/center covers, no clearance) stay `track: "overlay"`, `isOverlay: true`, `chromeKind: "float-overlay"`. Decision uses geometry + dialog/consent heuristics — not site cmsNames. create:sectioncomponents maps `header` → `partial-header` and overlay cookie → `partial-cookie`.

`scrollBehavior` (per device under `section-information.json`) records sticky / hide-on-scroll / scroll-reveal from CSS + incremental geometry samples (`sticky`, `stickyTopPx`, `hidesOnScrollDown`, `showsOnScrollUp`, `hideAfterScrollYPx`, `hideAfterViewports`, `pinnedEdge`, …). After all page slots are exported, `chromeStack` (per device) records same-edge sticky stacking: `edge`, `restingInsetPx` (= measured `stickyTopPx`), `precedingMayCollapse` (any earlier same-edge band has `hidesOnScrollDown`), `precedingSlots`, `stackIndex`, `stackSize`. Codegen must wire hide-on-scroll publishers and inset consumers through `components/hooks/use-sticky-chrome` so later stickies move up when a preceding band collapses. When header-stack resting PNGs are captured, floating/sticky chrome is temporarily forced in-flow (and closed drawers collapsed) so the crop matches a normal section box; `captureNormalization` on `section-information.json` records that fact and points codegen at `scrollBehavior` (+ `chromeStack` / `presentationVariants`) for the original runtime behavior — do not infer “always static in-flow” from the resting PNG alone. Section PNG crops are remasured per viewport, neighbor-clamped (avoid previous-band bleed), chrome-tightened for overlays, and edge-trimmed as a safety net. Capture viewports are the five Sitecore AI fixed widths: mobile **370**, tablet **768**, Desktop Small **1024** (`desktop`), Desktop Regular **1280** (`desktopRegular`), Desktop Large **1536** (`desktopLarge`). Flexible preview mode is not captured as a fixed PNG. `section.html` computed overlays still use three CSS bands (mobile / tablet / desktop≥1024); wider desktop PNGs share that band plus authored `xl:`/`2xl:` utilities. Overlay scrollbars keep layout width equal to the viewport (avoids ~15px shrink from classic Chromium scrollbars). Full-page `*-clean.png` shots hide CMP/chat only — site Header/TopBar/Nav remain so clean screenshots and hybrid detection can see chrome. Short overlapping / fixed top chrome is detected as its own **overlay** section; tall in-flow page heroes are not treated as chrome. Content bands under that chrome are captured with the chrome hidden (`hideChrome`) so hero PNGs stay content-only. Overlay header PNGs use the **live element box** when it is a short full-bleed band (e.g. 128px), and temporarily neutralize overlapping/transparent/sticky positioning so shots use the solid presentation (own background) — the same mode is used when capturing in-section menu states. When chrome visibly changes between top-of-page and scrolled (transparent vs opaque, height), `presentationVariants` is recorded on `section-information.json` (`overlapping`, `solid`, optionally `compact`).
`ai-derived-design.md` is produced during `capture:webpage` / `create:design-system` via Azure Foundry from full `html/page.html` (script bodies stripped) + all CSS.

`create:design-system` targets by URL only (`--url` or bare https), resolving `.bq/captures/{host}/{slug}` the same way as capture.

`capture:webpage` AI-enriches page `sections/` in place after hybrid export (does **not** re-slice or rename folders). Page slots are positional (`section-01`, …); human/component names live in `section-information.json` (`cmsName`, `purpose`, `alternativeNames`, `scrollBehavior` per device). Export upserts per slot by `contentHash` of normalized **`original-section.html`** (falls back to `section.html` for older captures) — unchanged slots reuse PNGs/`states`/AI fields (except when legacy `png-crop` or missing `scrollBehavior` forces a slot rewrite); changed or new slots overwrite HTML/PNGs and reset that slot’s `states/`. Section screenshots are remasured per viewport, neighbor-clamped, chrome-tightened for overlays, and edge-trimmed. Leftover `section-(N+1)…` folders are pruned. Legacy purpose-named folders under `sections/` are removed when positional slots exist. Every section always gets a self-contained styled **`section.html`** (matched CSS with `@media` when extractable, page `:root`/`html`/`body` tokens, local `@font-face` from `detected-fonts.json` / `fonts/`, desktop non-default computed styles as a fidelity floor, open Shadow DOM flattened). With `--styled-html`, legacy `section.styled.html` + `section.styled-{desktop|tablet|mobile}.html` siblings are also written. Closed Shadow DOM and cross-origin stylesheet *source text* remain residual limits (computed styles still help). During section export, interactive states (nav menus: `depth: 0` hamburger-open on tablet/mobile, then L1→L2→L3, plus FAQ/accordion, tabs) are captured into `states/` with live HTML+PNGs. Menu panels use before/after DOM mutation detection (`detection: "mutation"` on each menu `state.json`). Open menu PNGs are **chrome control bar ∪ appeared panel only** (variable height OK) — never other components showing under/through the overlay; page content behind the menu is hidden for the shot, and stray dialogs/dimmers/teasers are suppressed. Narrow L1 shots do not grow the viewport (sites often reset drawers on resize); empty/unproven L1 panels are recorded as `failed-closed` rather than blank white success PNGs. Narrow viewports require an open nav drawer before menu shots (closed-page hero shots are refused). `section-information.json.interactionStates` is the codegen index. AI enrich / merge / structure fingerprinting prefer `original-section.html` when present; visual/codegen paths use styled `section.html`. AI enrich updates JSON only (never renames `section-NN`) and skips Azure for slots whose `contentHash` is unchanged unless `--force` / `--force=sections`. Global skip when `sections/use-ai.meta.json` `sourceHash` matches. Logs batch + page/run AI token totals (no per-section cost split).

`capture:merge-sections -- --url <https://…>` (also step 0 of `create:sectioncomponents`) builds `{project}/section-registry/` as a **layout catalog** (not “shared by every page”): **one component folder per unique layout** (folder from best-voted content-role `cmsName`, not page `section-NN`). Each component stores **`instances.json` refs** to page `sections/section-NN/` (no full copies). Dedup order: `contentHash` → structure fingerprint → skeleton / purpose+description soft match (cmsName assist only when structure agrees); optional `--ai` for unsure pairs. Writes `registrySection` (and read-compat `sharedSection`) into each page `section-information.json`. After dedup, detects **content families** (e.g. `news-article`) into `content-families.json` and may rename weak folders (`rich-text-entry` → `news-article-body`). Also writes host **`component-inventory.json`** (unique components + instances + `needs-codegen` status + canonical evidence). Component root holds generated metadata only (`component.json` with `canonicalRef`, `instances.json` with refs + identical/differences summary, `section-plan.json`). Optional `--use-ai` clusters all page section HTML into `{project}/section-registry-ai/` plus `use-ai.meta.json` with **total** token usage/cost. Then writes site-level `ai-website-design.md`. Skip website-design Azure when `ai-website-design.meta.json` `sourceHash` matches unless `--force design`.

`create:sectioncomponents -- --url <https://…>` is **host-wide by default**: merge once, Phase A codegen each unique inventory/registry component once (codegen v2 attaches `FieldCatalog.reference.tsx` + closest type `*.reference.tsx`), Phase B wire every page’s presentation (body only; header/footer/cookie in partials), then `authoring:generate` once. AI debug dumps land under the page `sections/section-NN/ai-debug/` being codegenned. Use **`--page-only`** for the legacy single-page path. **`--all`** is a no-op alias for the default. **`--only`** implies page-scoped mode (same as `--page-only`) and scopes conversion/emit to the listed section/package tokens.

Requires `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY` or `AZURE_FOUNDRY_API_KEY`, and `AZURE_OPENAI_DEFAULT_MODEL` (e.g. `gpt-5.6-luna`). Optional `AZURE_AI_DESIGN_MAX_CHARS`, `AZURE_AI_DECIDE_MAX_CHARS` (AI section batch budget).

Skip Azure when `ai-derived-design.md` exists and `ai-meta.json` entry `ai-derived-design` `context.sourceHash` matches HTML+CSS.

Reuse existing html/css/fonts/screenshots/sections unless `--force` / `--force=html,css,fonts,screenshots,sections,design`.

`detected-sections.json` (page folder root) is the single page index (replaces page-manifest.json, new-sections-manifest.json, page-decomposition.json, and annotated.json).
