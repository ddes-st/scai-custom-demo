# BQ Cursor skills

| Skill | Role |
|-------|------|
| [skills/bq-definitions](skills/bq-definitions/SKILL.md) | **Canonical Sitecore authoring** — write `*.definition.ts` / `*.content.ts`, then `npm run definitions:generate`. **Never** create/edit/delete YAML; generate owns emit + prune. For **`rendering` / `component` / `variants`**, always pick `icon:` via sitecore-icons. Kind recipes: [kind-recipes.md](skills/bq-definitions/references/kind-recipes.md). |
| [skills/sitecore-icons](skills/sitecore-icons/SKILL.md) | Pick `icon:` paths for template-bearing definitions (required by bq-definitions). |
| [skills/capture-website](skills/capture-website/SKILL.md) | Invoke `npm run capture:webpage` (Playwright lives in `bq/tools/capture`). |

Root repo skills under `/.cursor` (`website-to-sitecore`, `sitecore-from-capture`, `sitecore-yaml`) redirect BQ work here for serialization.
