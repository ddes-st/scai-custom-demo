# Capture output contract

Canonical docs: `bq/tools/capture/references/output-contract.md`

```txt
.bq/definitions/          # definitions:generate log + cache
.bq/captures/             # capture:webpage — {domain}/… + {domain}/capture.log
  {project}/
    ai-website-design.md          # site-wide (capture:merge-sections)
    ai-website-design.meta.json
    sections/                     # one folder per unique component + instances/{page}
    ai-sections/                  # optional merge --use-ai clustering registry
    {page}/
      ai-derived-design.md          # Azure Foundry Stitch-style design guide
      ai-derived-design.meta.json   # sourceHash for skip-if-unchanged
      detected-fonts.json           # font catalog
      detected-css.json             # CSS catalog (document order)
      detected-sections.json    # sole page section index
      detected-sections.png     # numbered boxes only
      fonts/                    # downloaded font binaries
      screenshots/
        desktop.png | desktop-clean.png | …
      css/                      # linked sheets + page-inline.css
      sections/{folder}/        # default PNGs + section.html + section-information.json
                                # (+ states/ for open menus≤L3, FAQ, tabs; interactionStates index)
      html/page.html
```

Azure design (`AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`|`AZURE_FOUNDRY_API_KEY`, `AZURE_OPENAI_DEFAULT_MODEL`) → `ai-derived-design.md` from full HTML+CSS. Reuse unless `--force`; skip Azure when sourceHash matches. Optional `AZURE_AI_DESIGN_MAX_CHARS`.

`capture:webpage` always AI-enriches page `sections/` in place (does not re-slice). Section export also captures interactive states under `states/` (menus L1→L2→L3, FAQ, tabs) with open HTML+PNGs; `interactionStates` in `section-information.json` indexes them. `capture:merge-sections -- --url …` → `{project}/sections/` (+ optional `--use-ai` → `{project}/ai-sections/` with `use-ai.meta.json` total tokens) and `ai-website-design.md`.
