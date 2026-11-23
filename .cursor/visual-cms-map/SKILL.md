---
name: visual-cms-map
description: Analyze website screenshots and section crops to identify CMS-authorable components, parent/child patterns, component names, scope, fields, placeholders, and reuse candidates. Use after capture-website and before Sitecore TSX/YAML generation.
paths:
  - "**/.bq/captures/**/sections/manifest.json"
  - "**/.bq/captures/**/*.png"
  - "**/design-screenshots/**/sections/manifest.json"
  - "**/design-screenshots/**/*.png"
---

# Visual CMS Map

Start from screenshots, not DOM. HTML may validate boundaries and extract copy, but visual evidence decides component structure.

## Inputs

- Full-page `desktop-clean.png`, `tablet-clean.png`, `mobile-clean.png`
- Section crops under `sections/{section}/`
- `sections/manifest.json`
- Optional `section.html` and `page.html`

## Output

Write a component inventory to:

```txt
design-screenshots/{project}/component-review.json
```

Use the schema in `references/output-contract.md`.

## Detection process

1. Read the full-page screenshot top to bottom.
2. Identify site chrome: TopBar, Header, Navigation, Breadcrumb, CookieBanner, Footer.
3. Identify large content sections before child components.
4. Detect repeated patterns: card grids, link grids, stats, carousels, teasers, icon lists.
5. For repeating patterns, create a parent section and one child card/item component.
6. Include the section title/intro inside the parent component, not as a separate card.
7. Assign `scope`: `site`, `page`, or `shared`.
8. Assign `action`: `create`, `reuse`, `skip`, or `unclear`.
9. Mark low-confidence splits as `unclear` instead of inventing components.

## Naming rules

Use `references/taxonomy.md`.

Reject names such as `DivContainer`, `BlueBox`, `RichTextImageBlock2`, `Section2`, `ContentBlock`, or names based only on color.

## Parent/child rules

```txt
VerticalTeaserGrid      -> placeholderFor: VerticalTeaserCard
StatsBar                -> placeholderFor: StatsItem
LogoGrid                -> placeholderFor: LogoItem
LinkListSection         -> placeholderFor: LinkListItem
HeroCarousel            -> placeholderFor: HeroSlide
Footer                  -> placeholderFor: FooterLinkColumn or FooterLinkItem
Header                  -> placeholderFor: Navigation
```

## Done gate

Before passing to `sitecore-from-capture`, every `create` row must have:

- a `cmsName`;
- evidence screenshot path;
- scope;
- fields list;
- placeholders list, even if empty;
- parent/child relationship when repeated content exists.
