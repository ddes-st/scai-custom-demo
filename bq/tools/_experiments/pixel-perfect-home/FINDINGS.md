# Pixel-perfect capture → TSX experiment — findings

**Capture:** `.bq/captures/www-sitecore-com/www-sitecore-com--home`  
**Sandbox code:** `bq/tools/_experiments/pixel-perfect-home/`  
**Outputs:** `.bq/experiments/pixel-perfect-home/`  
**Date:** 2026-10-07  

Reference PNGs in this capture are **1440 / 768 / 390** (not Sitecore AI 1024/370). Scoring matched reference widths for fair pixelmatch.

## Verdict (what to do when implementing for real)

**Winning pipeline = Path B-ish, but with section.html as the source of truth — not vision-only TSX:**

1. **Prefer capture `section.html` (+ `css/` + `fonts/` + `page-inline.css` tokens)** wrapped as TSX (`dangerouslySetInnerHTML` or htmltojsx-style) — methods **M01 / M02 / M11**.
2. **Serve previews over HTTP** (not `file://`) so fonts/CSS load.
3. **Freeze animations** before screenshot compare.
4. **Close the last gap with a cheap VLM converge loop on pixel heatmaps** that may **only patch CSS** while freezing DOM/text — **M10** (best section-04: **8.49% desktop** mismatch).
5. **Full-page:** keep `html/page.html` as the page shell (M01 full-page ≈ **44.7%** avg across viewports in this harness — residual driven by fonts, lazy media, sticky chrome, and tall-page crop). Derive sections via selectors (**M15**) only when `section.html` is missing or incomplete; when both exist, **M01 section.html usually beats M15 splits**.
6. **Do not pay for ui.rip / CopyWeb** until free capture-HTML path is exhausted — vendor copy admits non-pixel-perfect (ui.rip); CopyWeb claims 1:1 but was not purchased (`BQ_EXP_ALLOW_PAID` unset).

Target ≤2–3% needs: embedded/local fonts identical to capture, same `deviceScaleFactor` as capture, scroll/sticky freeze, and possibly live-URL Mirrorframe-style computed-style converge.

## Leaderboard highlights

### section-04 (hero) — all methods

| Rank | Method | Avg % | Desktop % | Notes |
|------|--------|------:|----------:|-------|
| 1 | **M10** hybrid CSS patch | **12.76** | **8.49** | Best overall (prior) |
| 2 | **M17 v0-mini** | **13.47** | **8.85** | Screenshot+HTML via v0 API |
| 3 | M03 computed-style | 15.10 | 10.49 | Strong deterministic |
| 4 | **M16U** NEKO live URL fetch | **15.18** | **10.95** | Playwright fetch + NEKO LITE |
| 5 | M01/M02/M04 HTML | 16.20 | 11.15 | Oracle / wrapper |
| 6 | M07 multimodal AI | 16.27 | 9.53 | Cheap vision + HTML |
| 7 | **M16** NEKO capture HTML | **17.48** | **11.38** | NEKO LITE + section.html |
| 8 | M16U-PROMPT URL-only | **94.99** | **95.71** | URL string alone fails |

*(Re-ranked after M16/M16U/M17. Full CSV still has M05–M15.)*

## NEKO (M16 / M16U) + v0 (M17) — follow-up run

Prompt: [NEKO CONVERSION_TEMPLATE_LITE](https://github.com/ksmgen/NEKO-Template) vendored at `prompts/neko-conversion-lite.md`.  
v0: Platform API v2 `POST /v2/chats`, model **`v0-mini`**, `V0_API_KEY` in `.env.local`.

| Method | section-04 avg | section-07 avg | section-13 avg | Notes |
|--------|---------------:|---------------:|---------------:|-------|
| M16 (capture HTML → NEKO) | 17.48 | 49.44 | **20.84** | Footer re-run (header/footer pass); prior bake-off was 20.34 |
| M16U (live URL fetch → NEKO) | **15.18** | 94.37 | 95.26 | Hero wins vs capture-HTML NEKO; other bands fetch/convert fail |
| M16U-PROMPT (URL string only) | 94.99 | — | — | **Do not** rely on URL-only prompts |
| M17 (v0-mini) | **13.47** | 95.74 | 95.09 | Strongest new hero result; ~$0.18–0.25 credits/section |

**Takeaways**

1. **URL-only NEKO (no HTML)** is useless for pixel fidelity (~95% mismatch).
2. **URL → fetch HTML → NEKO** can beat capture-HTML NEKO on the hero (live DOM fresher / fuller).
3. **v0-mini + screenshot + HTML** nearly ties prior M10 on hero desktop (8.85% vs 8.49%) but costs more (~$0.23 credits) and collapses on complex bands when preview extraction is weak.
4. Prefer **HTML wrapper + CSS patch (M01/M10)** for production fidelity; use **v0 or NEKO Tailwind rewrite** when you specifically need maintainable Tailwind TSX and accept higher mismatch on hard sections.

Re-run: `node tools/_experiments/pixel-perfect-home/run-all.mjs --phase neko-v0`

## Header/Footer M16

Dedicated M16 (NEKO LITE + capture `section.html`) pass on Sitecore.com chrome — not consent (section-01) or announcement (section-02).

| Role | Capture | cmsName | Avg % | Desktop % | Tablet % | Mobile % |
|------|---------|---------|------:|----------:|---------:|---------:|
| Header | section-03 | MainNavigation | **19.84** | 11.19 | 21.42 | 26.91 |
| Footer | section-13 | FooterNavigationAndSignposts | **20.84** | 20.83 | 18.75 | 22.93 |

Outputs: `.bq/experiments/pixel-perfect-home/methods/M16/section-03/` and `.../section-13/`.

**Notes**

1. Header desktop (~11%) is in the same ballpark as hero M16; tablet/mobile inflate avg (hamburger / collapsed nav).
2. Footer M16 (~21% avg) remains far better than M01 on this band (~95% when remote assets break); re-run slightly worse than prior bake-off 20.34.
3. For production chrome fidelity, still prefer HTML wrapper (M01/M02) + optional M10 CSS patch; use M16 when Tailwind TSX maintainability matters more than lowest mismatch.

## M16F (full-page HTML) + M16S (section-03 × 3 screenshots)

| Method | Target | Avg % | Desktop % | Tablet % | Mobile % | Notes |
|--------|--------|------:|----------:|---------:|---------:|-------|
| **M16S** | section-03 | **12.95** | 10.54 | 14.92 | 13.39 | section.html + 3 viewport PNGs |
| M16 (prior) | section-03 | 19.84 | 11.19 | 21.42 | 26.91 | section.html + desktop only |
| **M16F** | full-page | **40.04** | 35.60 | 48.43 | 36.09 | page.html absolute URLs, ~40k truncate |
| M01 (prior) | full-page | ~44.67 | — | — | — | oracle page.html wrapper |

Outputs: `.bq/experiments/pixel-perfect-home/methods/M16F/full-page/`, `.../M16S/section-03/`.

**Takeaways**

1. **Three screenshots help header a lot:** M16S avg **12.95%** vs M16 **19.84%** (tablet/mobile gap closed). Prefer multi-viewport images for chrome.
2. **Full-page NEKO with absolute URLs** slightly beats M01 full-page avg (**40.04%** vs **~44.7%**) but is still far from pixel-perfect; HTML was truncated from ~796k → 40k after style strip.
3. Re-run: `node tools/_experiments/pixel-perfect-home/run-all.mjs --phase neko-page-shots`

### Best section crops overall

| Method | Target | Avg % |
|--------|--------|------:|
| M01 | section-11 | **9.35** |
| M15 | section-06 | 11.39 |
| M10 | section-04 | 12.76 |
| M01 | section-08 | 12.85 |
| M01 | section-06 | 13.33 |

### Hard sections (asset / chrome / sticky)

| Target | M01 avg % | Likely cause |
|--------|----------:|--------------|
| section-13 (footer-ish) | ~95 | Missing remote assets / complex footer |
| section-02 | ~90 | Media / background |
| section-07 | ~55 | Partial CSS / layout chrome |
| section-10 | ~60 | Same |

### Full page

| Method | Avg mismatch % |
|--------|---------------:|
| M01 / M11 / M15 `page.html` | **44.67** |
| PATH_A compose of 13× M01 sections | 44.78 |
| M13/M14 placeholders | ~41–42 (not real exports) |

**Path A vs Path B:** Composing all section.html previews ≈ full `page.html`. For **per-section fidelity**, dedicated `section.html` (M01) **beat** selector-split from full page (M15) on most bands (e.g. section-03: 14.4% vs 27.2%). Use full-page-first only to recover missing section slices.

## External tools

| Tool | Price | Result |
|------|-------|--------|
| htmltojsx-style (M11) | $0 | Same fidelity class as M01 when CSS linked |
| Mirrorframe-lite (M12) | $0 | ≈ M01 on static hero; full Mirrorframe not installed |
| Open Lovable / Memma | $0 + APIs | Deferred (Firecrawl/keys); not expected to beat capture HTML |
| ui.rip (M13) | $3–5 download | **Not purchased**; docs say not pixel-perfect |
| CopyWeb (M14) | $9.90+ | **Not purchased**; claim unverified |

Authorize later with `BQ_EXP_ALLOW_PAID=1` only if capture-HTML+M10 cannot hit target.

## AI cost (section-04, gpt-5.6-luna via Azure)

| Method | Est. USD |
|--------|---------:|
| M06 | ~0.0018 |
| M07 | ~0.0045 |
| M09 | ~0.0064 |
| M10 | ~0.0027 |

For production, prefer a **cheaper vision deployment** (`BQ_EXP_CHEAP_VISION_MODEL`) if available; this run used the configured default.

## Recommended real implementation recipe

```text
capture:webpage (already have HTML/CSS/fonts/PNGs)
    → for each section:
         TSX wrapper from section.html + scoped/global CSS (M02/M11)
         Playwright render @ capture widths
         pixelmatch vs section-*-{desktop,tablet,mobile}.png
         if mismatch > threshold:
             cheap VLM CSS-only patch from heatmap (M10) ≤2 iters
    → page shell from page.html OR compose wrappers
    → only then map fields to Sitecore definitions (separate step)
```

**Do not** start from screenshot-only codegen when `section.html` exists.

## How to re-run

```bash
cd bq
node tools/_experiments/pixel-perfect-home/run-all.mjs --phase deterministic
node tools/_experiments/pixel-perfect-home/run-all.mjs --phase ai
node tools/_experiments/pixel-perfect-home/run-all.mjs --phase external
node tools/_experiments/pixel-perfect-home/run-all.mjs --phase neko-v0   # M16 + M16U + M17
node tools/_experiments/pixel-perfect-home/run-all.mjs --phase neko-page-shots  # M16F + M16S
node tools/_experiments/pixel-perfect-home/run-all.mjs --phase score
node tools/_experiments/pixel-perfect-home/run-all.mjs --phase report
```


Leaderboard: `.bq/experiments/pixel-perfect-home/reports/leaderboard.md`
