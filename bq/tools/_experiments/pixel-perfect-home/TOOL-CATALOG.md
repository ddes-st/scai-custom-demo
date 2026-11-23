# HTML / URL → TSX tool catalog (experiment)

Inputs for this capture:

| Input | Path / URL |
|-------|------------|
| Full page HTML | `.bq/captures/www-sitecore-com/www-sitecore-com--home/html/page.html` |
| Section HTML | `…/sections/section-NN/section.html` |
| Live URL | `https://www.sitecore.com/` |
| Reference PNGs | `screenshots/{desktop,tablet,mobile}-clean.png` (1440 / 768 / 390) |

## Free / OSS

| Tool | Input | Output shape | Cost | Experiment ID |
|------|-------|--------------|------|---------------|
| Local capture HTML oracle | page/section.html + css/fonts | HTML (ceiling) | $0 | M01 |
| React `dangerouslySetInnerHTML` wrapper | same | `.tsx` + CSS assets | $0 | M02 |
| Computed-style flatten | section.html via Playwright | inline-styled HTML/TSX | $0 | M03 |
| Class + CSS extract | section.html + page-inline.css | TSX + CSS module stub | $0 | M04 |
| `htmltojsx`-style syntax convert | HTML string | TSX (attribute renames) | $0 | M11 |
| Mirrorframe (upstream) | Live URL | Deterministic React + CSS + pixel converge | $0 software | M12 (lite) |
| Open Lovable | Live URL | Next/React + Tailwind | $0 + Firecrawl/LLM | M12 (deferred) |
| Memma CLI | URL or image | TS React + Tailwind | $0 + AI keys | M12 (deferred) |
| Browser paste converters (Abect, SnipShift, …) | Paste HTML | TSX scaffold | $0 | Equivalent to M11 |

## Paid / freemium

| Tool | Input | Output | List price | Experiment ID |
|------|-------|--------|------------|---------------|
| ui.rip | Live URL | Next.js + TS + Tailwind | Free inspect; **$3–5** download | M13 (skipped until `BQ_EXP_ALLOW_PAID=1`) |
| CopyWeb | URL / HTML / screenshot | React / Next / Vue / Tailwind | **$9.90 / 100**, **$29.90 / 400**, **$39.90 / 1000** credits | M14 (skipped until authorized) |
| Lovable.dev cloud | URL/chat | React app | ~$25+/mo | Prefer Open Lovable |
| Anima / Locofy / Builder / DhiWise | Figma → React | React/Next | Free tiers + ~$15–24+/mo | Out of scope (no Figma source) |

## Recommended input strategy

1. Prefer **capture `page.html` + css/fonts** over live URL when offline fidelity is required (CMP chrome already cleaned in `*-clean.png`).
2. Use live URL only for tools that cannot ingest local HTML (ui.rip, Open Lovable).
3. Score every export with `harness/score.mjs` at reference PNG widths.

## Full-page → sections

See **M15**: take best full-page HTML/TSX, split with `detected-sections.json` / `section-information.json` selectors, fall back to `section.html`.
