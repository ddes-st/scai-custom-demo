# ADR 0006: Search rebuilt from scratch as three components on Content SDK search hooks

## Status

Accepted (2026-08-18). Supersedes the component decisions of [ADR 0003](0003-search-uses-cloud-sdk-not-content-sdk.md) and [ADR 0004](0004-search-experience-v2-proper-fields.md). Spec: [#45](https://github.com/FMC-ORG/custom-demo/issues/45); tickets [#46](https://github.com/FMC-ORG/custom-demo/issues/46), [#47](https://github.com/FMC-ORG/custom-demo/issues/47), [#48](https://github.com/FMC-ORG/custom-demo/issues/48).

## Context

ADR 0003 adopted the OOTB SearchExperience component; ADR 0004 gave it proper template fields as SearchExperienceV2. V2 technically connected to the search API, but the live experience was broken and spartan:

1. **Typing did not filter results.** V2's URL-round-trip state design triggered a full App Router server navigation per keystroke and lost the query.
2. **Title-only cards.** Descriptions were HTML that would render as raw tags; no dates, no links.
3. **Dead-code dictionary fallbacks.** The `t(key) || fallback` pattern does not work with next-intl — a missing key throws instead of returning something falsy — flooding the console with MISSING_MESSAGE errors on any site without dictionary entries.

Just as costly was the configuration journey: finding the search index GUID, discovering index attribute names, learning the index has no URL attribute, and discovering rendering parameters cannot be set via MCP each burned real investigation time. A capability an SE cannot configure in minutes does not get demoed.

## Decision

Build a from-scratch search experience of three small components on the Content SDK search hooks (`useSearch` from `@sitecore-content-sdk/nextjs/search`), sharing a foundation in `src/lib/search-ui/`:

- **SearchResults** — the full search page: instant-filtering input (local state + debounce), cards with title / HTML-stripped description / date / image / link, pagination, shareable URLs.
- **SearchCollection** — a zero-input, index-driven content strip ("Latest Articles"): empty keyphrase + sort by date, authorable heading. Search as content infrastructure.
- **SearchTypeahead** — a compact suggest box: top-N title suggestions while typing, keyboard navigable; Enter / "See all results" navigates to the results page carrying `?q=`.

### Key design choices

- **Data layer: Content SDK hooks, not raw fetch.** Empirical probing proved the SDK expresses 100% of the endpoint's real contract (see the endpoint-contract section of `docs/ai/reference/agent-api-limitations.md`). Raw fetch buys zero capability.
- **State model: local state is the source of truth; the URL is a write-only mirror** via native `history.replaceState` (`src/lib/search-ui/useUrlMirror.ts`). No router navigation on keystrokes — the V2 bug class is structurally impossible. Components hydrate from the URL once at mount; popstate restoration is a non-goal.
- **Three independent minimal datasource templates**, no inheritance — each component's template holds only the fields it uses, every field with help text (including where to find the index GUID).
- **Guarded dictionary lookups** (`useSearchLabels`): `t.has(key) ? t(key) : fallback`. Reuses the existing `SearchExperience_*` Dictionary entries; a missing entry renders the English fallback, never throws.
- **Skeletons in editing/preview; no live API calls in authoring surfaces.**
- **Graceful degradation**: empty mapping or absent index attribute → cards render without that element (no links until the index gains a URL attribute, ticket #49).

### Load-bearing implementation lessons (found only in live browser runs)

- The `sort` option passed to `useSearch` must have a **stable identity** — an inline object literal re-triggers the hook every render (infinite fetch loop). Memoize it.
- jsdom forbids redefining `window.location`; navigation goes through `src/lib/search-ui/navigate.ts` (`navigateTo`) so tests mock that module.
- Keyphrase matching is loose: a full-title query matches other documents too. Verification contracts assert *the expected document ranks first*, not exact result counts.

## Consequences

- V2 and the OOTB SearchExperience remain in the repo as historical reference (per the ADR trail) but were removed from all pages; the SE recipe for a new vertical is now: create index → create datasource item(s) → drop component(s) on a page. See `docs/ai/catalog/capabilities-registry.yaml`.
- Verification is scripted end-to-end: `docs/ai/scripts/search-verify.mjs`, `collection-verify.mjs`, `typeahead-verify.mjs` (browser protocols), `search-probe.mjs` (HTTP boundary). All three components pass 7/7 with zero console errors as of 2026-08-18.
- Sitecore item IDs and verification records live in `docs/ai/manifests/sitecore-manifest.yaml` (components-searchv3 section).
