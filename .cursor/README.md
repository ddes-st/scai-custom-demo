# Optimized Cursor skills: website screenshots → Sitecore TSX + definitions

This pack keeps orchestration thin: skills dispatch to programmed tooling where possible.

## Install / Playwright (BQ)

Capture tooling and Playwright live in **`bq/`**, not under `.cursor/node_modules`.

```bash
cd bq
npm install
npm run setup:playwright
```

## Recommended workflow

```txt
1. website-to-sitecore
   Orchestrates the flow and keeps the agent on track.

2. capture-website
   Invokes: cd bq && npm run capture:webpage -- …
   (implementation: bq/tools/capture/)

3. visual-cms-map
   Reads screenshots/manifests and produces a CMS component inventory.

4. sitecore-from-capture
   Builds TSX components, variants, placeholders, page composition, and component-map registration.

5. Serialization
   - BQ / bq-demo: use bq/.cursor/skills/bq-definitions
     (write *.definition.ts, then npm run authoring:generate from bq/).
     Agents must never create/edit/delete *.yml — only generate may.
   - Other modules: sitecore-yaml generator scripts + site authoring wiring;
     validate with ser validate --fix. See references/non-unique-item-paths.md
     when validate reports NON-UNIQUE ITEM PATH.
```

## Why this should consume fewer tokens

Skills stay narrow:

- `website-to-sitecore` is the workflow skill.
- `capture-website` only invokes `npm run capture:webpage` (logic in `bq/tools/capture`).
- `visual-cms-map` is the screenshot interpretation skill.
- `sitecore-from-capture` is the TSX/page/component skill.
- `sitecore-yaml` is the serialization skill for **non-BQ** modules.
- For this fork’s **BQ** app, serialization is **`bq-definitions`** (`*.definition.ts` → `definitions:generate`), not hand-written YAML.

See also [RUNTIME-DEPENDENCIES.md](RUNTIME-DEPENDENCIES.md).
