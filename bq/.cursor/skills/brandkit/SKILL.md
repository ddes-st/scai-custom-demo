---
name: brandkit
description: >-
  BQ Stream brand-kit domain: create/update brand kits via Brand Management API,
  AI-fill default sections from capture artifacts, set logo, publish via Documents
  + BrandIngestionPipeline, set site brandKitId.
  Logic in bq/tools/brandkit/; enabled from create:sectioncomponents.
paths:
  - "bq/tools/brandkit/**"
  - "**/.bq/captures/**/brandkit/**"
---

# Brandkit (BQ / Sitecore Stream)

Optional step of `create:sectioncomponents` when `BQ_CREATE_BRANDKIT=true` or `--brandkit`.

## Commands

```bash
cd bq
npm run create:sectioncomponents -- --url "https://www.example.com/" --brandkit
# or in .env.local: BQ_CREATE_BRANDKIT=true
```

`--no-brandkit` forces off even if the env flag is true.

## What it does

1. After Phase 3 (collection/site Sites API bootstrap), resolves or creates a Stream brand kit named `{siteDisplayName} Brand Kit` (state → list by name → create; duplicate-name create falls back to reuse — never a second kit).
2. Resolves a public logo URL from capture HTML and passes `logo` on create; on reuse, best-effort PATCH if remote logo is empty.
3. Lists remote default sections/fields, then asks Azure OpenAI for values using URL/company + captured homepage HTML/CSS (+ design MD / site-summary when present). Each field is ~5–10 lines of guideline prose (`promptVersion: v2-extended`).
4. Ensures Dos and Don'ts has dedicated `Extensions` / `Restrictions` subsections with Stream `#Extend#` (AI disclaimer) and `#Restrict#` (competitor refusal) rules — creates remote fields if missing — then PATCHes section field values (`aiEditable: false`); regenerated drafts force-overwrite remote fields.
5. PATCHes the SitecoreAI site `brandKitId` and stamps `api.brandKitId` on the local site definition.
6. Publishes (Stream Publish equivalent): export `guidelines.pdf` → delete any prior guidelines document(s) for the kit (`state.documentId` + list by brandkit) → Documents API upload → `BrandIngestionPipeline` with `populateSections: false` so BQ field text is kept. Failures warn and continue.
7. Persists `.bq/captures/{host}/brandkit/state.json` + `draft.json` (+ `guidelines.pdf`, optional `logo.*`).
8. Records Azure usage on the create `AiLedger` (`purpose: brandkit-generate`).

## Env

| Variable | Purpose |
|----------|---------|
| `BQ_CREATE_BRANDKIT` | `true`/`false` (default false) |
| `SITECORE_ORGANIZATION_ID` | Cloud Portal `organization=org_…` |
| `SITECORE_STREAM_AI_CLIENT_ID` / `SECRET` | Stream Admin → AI API keys (`ai.org.brd:*`, `ai.org.docs:*`) |
| `BQ_BRANDS_API_BASE` | Optional Brand Management API base |
| `BQ_DOCUMENTS_API_BASE` | Optional Documents API base |
| `BQ_PIPELINE_API_BASE` | Optional Pipeline API base |
| `BQ_BRANDKIT_MAX_CHARS` | Prompt artifact char budget |

Sites linking still uses `SITECORE_AUTH_*` + `BQ_SITECORE_ENVIRONMENT_ID`.

## Code

All brand-kit logic lives under [`bq/tools/brandkit/`](../../tools/brandkit/). Entry: `ensureBrandKitForHost` from `ensure.mjs`. Do not mix Brand Management HTTP into capture/codegen modules.

Docs:
- [Brand Management API](https://api-docs.sitecore.com/ai-skills/ai-brand-management-rest-api)
- [Document Management API](https://api-docs.sitecore.com/ai-skills/ai-document-management-rest-api)
- [Pipeline API](https://api-docs.sitecore.com/ai-skills/ai-pipeline-rest-api)
