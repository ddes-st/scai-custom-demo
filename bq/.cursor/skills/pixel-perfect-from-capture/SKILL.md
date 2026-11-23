---
name: pixel-perfect-from-capture
description: >-
  Reconstruct near pixel-perfect React/TSX from BQ webpage captures
  (.bq/captures/... section.html + CSS + fonts + viewport PNGs). Use when the
  user asks to implement pixel-perfect sections/pages from captures, improve
  visual fidelity vs screenshots, or continue the pixel-perfect experiment.
---

# Pixel-perfect from BQ capture

## Do not start from screenshots alone

When capture artifacts exist under `.bq/captures/{host}/{page}/`, **prefer HTML+CSS+fonts** over vision-only codegen.

Required evidence (in priority order):

1. `sections/section-NN/section.html` + page `css/` + `fonts/` + `css/page-inline.css`
2. Viewport crops `section-NN-{desktop,tablet,mobile}.png`
3. Full-page `html/page.html` + `screenshots/*-clean.png`
4. `section-information.json` / `detected-sections.json` for selectors and content seeds

## Winning recipe (validated in sandbox experiment)

Experiment code: `bq/tools/_experiments/pixel-perfect-home/`  
Findings: `bq/tools/_experiments/pixel-perfect-home/FINDINGS.md` (copy; also under `.bq/experiments/.../FINDINGS.md`)

1. **Wrap `section.html` as TSX** (React `dangerouslySetInnerHTML` or html→jsx attribute rename). Keep capture CSS/fonts.
2. **Score with Playwright** at the **reference PNG width** (this home capture used 1440/768/390; Sitecore AI teachers are 1024/768/370 — re-capture if you need those exact widths).
3. Serve previews over **HTTP** (fonts fail on `file://`). Freeze entrance animations before screenshot.
4. If mismatch is above threshold, run a **cheap vision model CSS-only patch** guided by a pixel heatmap (DOM/text frozen). Cap ≤2 iterations.
5. **Full page:** use `html/page.html` as shell, or compose section wrappers. Deriving sections by splitting full-page DOM (selectors) is a **fallback** when `section.html` is missing — dedicated section HTML usually scores better.
6. Only after visual fidelity: map content into Sitecore fields / `*.definition.ts` (separate from pixel work). **Do not** edit `tools/definitions/apply/*` for one-off fidelity.

## What lost in experiments

- Screenshot-only AI (M6) and token templates (M5) underperform HTML wrappers.
- AI converge that rewrites whole HTML (M8) can regress vs CSS-only patch (M10).
- Paid URL→React tools (ui.rip $3–5, CopyWeb $9.90+) were **not** needed; ui.rip docs say not pixel-perfect. Require `BQ_EXP_ALLOW_PAID=1` before charging.
- **NEKO URL-only** (prompt with just `https://…`, no HTML) fails (~95% mismatch).
- **NEKO Tailwind rewrite** and **v0-mini** can approach M10 on simple heroes but need HTML/screenshot evidence; they often fail on complex bands.

## NEKO + v0 (optional Tailwind path)

- NEKO LITE prompt: `bq/tools/_experiments/pixel-perfect-home/prompts/neko-conversion-lite.md`
- **M16**: capture `section.html` → NEKO → Tailwind TSX
- **M16U**: live URL → Playwright fetch section → NEKO (better than URL-only; can beat M16 on hero)
- **M17**: Vercel v0 API v2 (`V0_API_KEY`, `v0-mini`) with screenshot + HTML attachments — strong on hero, costly vs Azure NEKO
- Prefer M01/M10 when pixelmatch matters; prefer M16/M17 when maintainable Tailwind TSX is the deliverable

## Viewports

See `bq/tools/capture/lib/viewports.mjs` and `.cursor/rules/sitecore-ai-viewports.mdc`.

## Re-run harness

```bash
cd bq
node tools/_experiments/pixel-perfect-home/run-all.mjs --phase all
# or: --phase deterministic|ai|external|neko-v0|score|report
```

## Constraints

- Sandbox only under `bq/tools/_experiments/` and `.bq/experiments/` unless the user asks to integrate into production codegen.
- Do not hand-edit `authoring/**/*.yml` or production emitters for fidelity experiments.
