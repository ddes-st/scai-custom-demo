# Domain Glossary

## Page Types

- **Article Page Template** — A Sitecore route template that inherits from the base page template and adds article-specific fields (content, image, author, publication date, key takeaways, read time). Components placed on article pages read from these route fields (context components), not from datasources. Contrast with regular pages where components use datasource items.

- **Base Page Template** — The existing Sitecore route template that all page types inherit from. Carries standard fields: Title, metadata (metadataTitle, metadataDescription, metadataKeywords), Open Graph (ogTitle, ogDescription, ogImage), pageSummary, thumbnailImage, BackgroundColor, and placeholder settings.

## Content Models

- **Context Component** — A rendering that reads from route/page fields rather than a datasource item. Cannot be reused across pages via datasource selection. Tightly coupled to the page template that defines its fields. Examples: ArticleHero, ArticleBody.

- **Datasource Component** — A rendering backed by a datasource item (simple or list). Reusable across any page by selecting a datasource. Examples: HeroBanner, CTABanner, FeatureCardsGrid.

- **Person** — A shared data template representing an individual (author, expert, team member). Fields: first name, last name, job title, profile image, bio, LinkedIn link. Referenced by article pages via a Droptree field. Reusable across articles, testimonials, team pages.

## Presentation

- **Partial Design** — An XM Cloud mechanism for pre-placing components on pages. The Article Layout partial design places ArticleHero and ArticleBody in `headless-main`, so new article pages start with those components already wired up. Preferred over setting presentation directly on `__Standard Values`.

- **Variant** — A named export in a component's TSX file that provides an alternate visual layout for the same data. Matched to a Variant Definition item in Sitecore. Example: ArticleHero has Default, Minimal, and SplitImage variants.

## Content Tree

- **Articles Parent Page** — A regular page at `/Home/Articles/` with insert options allowing Article child pages. Provides clean URL structure: `/articles/my-first-article`. Does not require a special template.

## Search

- **SearchResults** — The full search page component (`src/components/uiim/search/SearchResults.tsx`): instant-filtering input (local state + debounce, no server round-trips), cards with title / HTML-stripped snippet / date / image / link, pagination, and shareable `?q=`/`?page=` URLs mirrored write-only via `history.replaceState`. Configured by a minimal datasource item (index GUID + attribute mappings).

- **SearchCollection** — A zero-input, index-driven content strip ("Latest Articles") that queries the index in browse mode (empty keyphrase) sorted by a configurable attribute, capped at MaxItems, with an authorable heading. Auto-updates as content publishes — search as content infrastructure.

- **SearchTypeahead** — A compact suggest box: debounced title suggestions in a keyboard-navigable dropdown; Enter or "See all results" navigates to the results page carrying the query in `?q=`, where SearchResults picks it up. Born page-scoped; promoted to the global header manually in Page Builder.

- **search-ui foundation** (`src/lib/search-ui/`) — Shared helpers behind all three search components: guarded dictionary labels (missing key → English fallback, never MISSING_MESSAGE), HTML stripping, date formatting, debouncing, write-only URL mirroring, search analytics events, and a `navigateTo` seam for testable navigation. See `docs/adr/0006-search-three-component-rebuild.md`.

- **SearchExperience / SearchExperienceV2 (superseded)** — The OOTB starter-kit component (JSON-blob config) and its template-fields successor. Superseded by the three components above and removed from all pages; code retained as historical reference. ADR trail: 0003 → 0004 → 0006.

- **Search Configuration Manager** — A SitecoreAI Marketplace app for managing search indexes: creating sources, inspecting index attributes, and (for ticket #49) adding a URL attribute. Where an SE finds the index GUID that every search datasource item needs.

- **Search Source / Index** — An indexed content source in SitecoreAI that the search components query. Created and configured by the SE in the SitecoreAI UI as part of demo setup; reflects published content only.

## Media

- **SmartMedia** — A drop-in wrapper around `ContentSdkImage` that auto-detects whether a Sitecore Image field carries an image asset or a video asset (via Content Hub `dam-content-type='video'` or file-extension fallback) and renders `<ContentSdkImage>` or `<video>` accordingly. Scoped to five video-capable surfaces only — HeroBanner, HeroBannerCarousel (main slide), CTABanner (WithImage), FeatureHighlight, ArticleHero (background). Other surfaces stay on `ContentSdkImage` to keep icons/avatars/logos from accidentally authoring autoplay videos. Reads `isEditing` internally via `useSitecore()`, respects `prefers-reduced-motion`, suppresses autoplay in Experience Editor. See `docs/adr/0005-smartmedia-for-video-capable-surfaces.md`.

## Catalogs

- **Component Registry** (`component-registry.yaml`) — Machine-readable index of datasource-based homepage components used by the Site Analyzer in the demo builder pipeline.

- **Page Template Registry** (`page-template-registry.yaml`) — Machine-readable index of page types (Article, and future types like Event, Case Study). Separate from the component registry because page types define data models, not droppable homepage sections.

- **Capabilities Registry** (`capabilities-registry.yaml`) — Machine-readable index of cross-cutting platform features (search, personalization, analytics) that SEs enable manually. Separate from the component registry (visual homepage sections) and page template registry (page types).
