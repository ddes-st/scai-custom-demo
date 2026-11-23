# Migration map from old skills to optimized skills

| Old skill/folder | Replace with | Notes |
|---|---|---|
| `mimic-website-skills/mimic-url` | `website-to-sitecore` | End-to-end orchestration only. No long embedded phase docs. |
| `mimic-website-skills/url-screenshots` | `capture-website` → `bq/tools/capture` | Skill invokes `npm run capture:webpage`; Playwright is a bq devDependency. |
| `mimic-website-skills/url-page-html` | `capture-website` | HTML is included in `npm run capture:webpage` from `bq/`. |
| `mimic-website-skills/visual-cms-component-detection` | `visual-cms-map` | Visual rules condensed into taxonomy + output contract. |
| `sitecore-rendering-host-skills/sitecore-page-from-design` | `sitecore-from-capture` | Page assembly folded into one Sitecore build skill. |
| `sitecore-rendering-host-skills/sitecore-component-from-design` | `sitecore-from-capture` | Component TSX, placeholders, variants, build gate. |
| `sitecore-rendering-host-skills/sitecore-section-decomposition` | `sitecore-from-capture` | Section → component blueprint phase. Includes original `decompose-sections.mjs`. |
| `sitecore-rendering-host-skills/sitecore-content-sdk-component` | `sitecore-from-capture` | Content SDK conventions summarized. |
| `sitecore-serialization-skills/sitecore-new-*` | `sitecore-yaml` | Collection, site, rendering, media, IDs in one serialization skill. **BQ/bq-demo:** redirect to `bq/.cursor/skills/bq-definitions` instead. |
| `search-experience` and `sitecore-rendering-host-skills/search-experience` | `sitecore-search-experience` | Single App Router search skill. |
| `sitecore-auth0-authentication`, `sitecore-env-local`, `header-navigation`, `scaffold-rendering-host`, `sitecore-cloud-sdk-*` | `sitecore-utilities` | Support tasks consolidated. |

## Suggested prompt after installing

```txt
Use the optimized website-to-sitecore workflow. Capture this URL, create the CMS component manifest, wait for my approval, then generate the Sitecore TSX and YAML only for approved components.
```
