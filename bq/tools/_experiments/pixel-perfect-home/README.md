# Pixel-perfect home experiment (sandbox)

Isolated experiments converting `.bq/captures/www-sitecore-com/www-sitecore-com--home` into TSX previews and scoring them with Playwright + pixel diffs.

**Does not modify** production emitters or `bq/src/components`.

## Quick start

```bash
cd bq
node tools/_experiments/pixel-perfect-home/run-all.mjs --phase all
# skip Azure AI:
node tools/_experiments/pixel-perfect-home/run-all.mjs --skip-ai
```

Outputs: `.bq/experiments/pixel-perfect-home/`  
Findings: [FINDINGS.md](./FINDINGS.md)  
Tool catalog: [TOOL-CATALOG.md](./TOOL-CATALOG.md)

## Methods

| ID | Name |
|----|------|
| M01–M05 | Deterministic (HTML oracle → token templates) |
| M06–M10 | AI / hybrid (vision, multimodal, converge, BQ prompts, CSS patch) |
| M11–M15 | External converters + full-page→section split |
| M16 | NEKO LITE from capture section.html |
| M16U | NEKO LITE after live URL fetch |
| M16U-PROMPT | NEKO with URL string only (control) |
| M17 | Vercel v0 API (`v0-mini`, needs `V0_API_KEY`) |
| PATH_A | Section-first compose of M01 |

```bash
node tools/_experiments/pixel-perfect-home/run-all.mjs --phase neko-v0
```

Paid tools M13/M14 require `BQ_EXP_ALLOW_PAID=1`.
