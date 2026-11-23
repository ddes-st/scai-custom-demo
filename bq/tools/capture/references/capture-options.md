# Capture options

Run from **`bq/`**:

```bash
npm run capture:webpage -- [options]
```

Common flags:

```txt
--urls "https://a.com,https://a.com/about"
--file urls.txt
--out ./.bq/captures/project
--devices mobile,tablet,desktop,desktopRegular,desktopLarge
                     # aliases: desktop-regular, desktop-large (Flexible is not a width)
--viewport-only
--full-page
--wait-ms 1500
--manifest
--no-html
--no-sections          # skip hybrid detection + section export (+ AI enrich)
--styled-html          # also write legacy section.styled*.html siblings (section.html is always styled)
--force                # redo all kinds (html,css,fonts,screenshots,sections,design)
--force=html,css       # redo only listed kinds
```

Default `--out` is **`<repo>/.bq/captures`**. When you pass that bucket (or omit `--out`), a host-slug project folder is created automatically (e.g. `.bq/captures/example-com/…`).

By default, existing **html / css / fonts / screenshots / sections / ai-derived-design.md** are reused when complete (same `--force` kinds as `create:design-system`). Pass `--force` or `--force=css,fonts` to re-download/regenerate. Skip re-enriching `sections/` when `sections/ai-meta.json` entry `sections-enrich` `context.sourceHash` matches unless `--force` / `--force=sections`. Per-slot: unchanged `contentHash` skips PNG/`states` redo and Azure for that `section-NN` folder.

`capture:webpage` runs the full pipeline in one Playwright session: full-page screenshots, hybrid detection (`detected-sections.*` at the page folder root), catalogue naming, page-local positional `sections/section-NN/` export (upsert by HTML hash; no full wipe), then AI-enriches those folders in place (updates `cmsName`/fields in JSON; never renames folders). It does **not** re-slice the page.

Merge (`capture:merge-sections`): `--use-ai` clusters layouts into `{project}/ai-sections/` (separate from `--ai` unsure-pair assist).

Use `--viewport-only` only when the goal is above-the-fold analysis. Use full-page for Sitecore component discovery.

Viewports (five fixed Sitecore AI widths; **Flexible** is skipped — not a px preset): mobile **370×844**, tablet **768×1024**, Desktop Small **1024×900** (`desktop`), Desktop Regular **1280×900** (`desktopRegular`), Desktop Large **1536×900** (`desktopLarge`). Tailwind: 370=base, 768=`md:`, 1024=`lg:`, 1280=`xl:`, 1536=`2xl:`. Capture hides classic scrollbars so `clientWidth` stays at the full viewport width (real mobile overlay scrollbars); otherwise Chromium shrinks layout by ~15px and cramped nav CTAs wrap.
