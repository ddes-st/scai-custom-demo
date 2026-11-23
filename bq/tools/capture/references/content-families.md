# Content families

Marketing sites reuse one content model across several layouts: a newsroom grid, latest teasers, an article header, and an article body often describe the same kind of item (title, image, date, link, body) with different presentation. Without families, create would emit duplicate Sitecore item templates and seed data would diverge.

After layout dedup, merge therefore looks for **related content** across the host registry—not only “news + news list,” but listing/teaser/header/body roles for news, press, blog, and similar taxonomies. Detection is multi-signal (co-occurrence, field overlap, route/purpose tokens, content hashes); a single shared heading or image is never enough. Site chrome (header, footer, nav, consent) is excluded.

Each family picks an **owner** (richest item template, usually the detail body) and treats other members as thin renderings that point at the owner via `datasourceTemplate`. Create unions fields and shared `content.items` on the owner. Capture a listing page and at least one detail URL on the same host so families have co-occurrence to work with.

Written to `{host}/section-registry/content-families.json`.

## Strong signals (need ≥2)

1. **Page co-occurrence** — ≥70% of pages hosting A also host B (or vice versa).
2. **Field-set overlap** — Jaccard ≥ 0.5 on suggested field names **and** ≥ 3 overlapping names (Title, Image, Date, Link, Body, …). A single shared heading or image URL is never enough.
3. **Route / purpose taxonomy** — URL or cmsName/purpose tokens in `{news, article, blog, press}`, or one is listing (`*Grid` / `*Teasers`) and the other detail (`*Header` / `*Body`) on article routes.
4. **Datasource identity** — overlapping instance `contentHash` across layouts **plus** news taxonomy (structural child match).

Weak signals (logged only, never alone): one matching image URL, one matching heading, vague “content” cmsName.

## Owner selection

**Owner = richest item-template member** (most fields / content model), not largest listing HTML:

1. Field-set size (suggested fields + role heuristics: body/header/teaser/list)
2. Strong boost when the set includes **Body** / `detail-body` role
3. Weak tie-break on **average** instance `extensionScore` (capped) — a newsroom grid of many cards must not beat an article body

Typically that is `news-article-body` (Title, Date, Image, Body), not teasers or the overview grid.

## Roles

| Role | Typical folders | Emit behavior |
|------|-----------------|---------------|
| Owner (richest) | usually `news-article-body` | Full item template + shared `content.items` |
| Other members | `news-article-header`, `news-teasers`, `news-grid` | Thin → owner `datasourceTemplate` (no content seeds) |

## Naming

Weak generic folders (`rich-text-entry`, `eh-grid`) are renamed to role names when unlocked (`status` not `created`, no `definitionKey`).

## Create / emit — field union + shared items

`create:sectioncomponents` reads `contentFamilyId` from the registry entry / `registrySection` backlink, then:

1. **Owner merge (once per family per run)** — `ensureFamilyOwnerPackage` / `mergeFamilyOwnerDefinition`:
   - Collect seeds from all member page `section-information.json` instances.
   - **Value-match** fields across ≥2 members (or matching an owner seed). Canonical **name** from owner if present, else preference list (Title > Heading > …).
   - **Type from value shape** — HTML → `RichText`; plain text stays `Single-Line Text` even if AI guessed RichText; images/links from object shape.
   - Union matched (+ owner-only) fields into the owner `itemTemplate`; write shared `content.items` **only on the owner** (dedupe by title/url, stable sort by `name`).
   - Sync final name/type back to page `suggestedFields`, registry `familyFieldHints`, and align TSX (`RichText` vs `Text`).
2. **Non-owners** — thin definition (empty `sections`, `datasourceTemplate` → owner). No `content.items` seeds.
3. **Idempotent** — same captures + family membership ⇒ same fields/types/items on re-run. Skip-AI / reuse paths still re-apply merge + sync.
4. **`--only` non-owner** — ensures the owner package once if missing/stale, then emits the thin member.

Implementation: [`content-family-merge.mjs`](../../create-section-components/content-family-merge.mjs), [`content-family-emit.mjs`](../../create-section-components/content-family-emit.mjs), wired from [`run.mjs`](../../create-section-components/run.mjs).
