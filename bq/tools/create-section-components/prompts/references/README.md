# Frozen component-type references (AI codegen)

Unstyled TSX primers attached to `create:sectioncomponents` codegen so the model
copies **field types, placeholders, imports, and structural patterns** — not visual styling.

These files live under `tools/…/prompts/references` on purpose. They are **prompt
text** loaded by codegen (`loadPrompt`), not app components. Do **not** move them
under `src/components` (component-map / app-tree pollution).

## Imports (`lib/*`, `.sitecore/*`)

Imports such as `lib/component-props` and `.sitecore/component-map` are the
**emit-target pattern** for packages generated under `src/components/{host}/…`.
They are not meant to resolve as local modules from this prompts folder.
`tsconfig.json` excludes `tools/create-section-components/prompts/**`, so IDE
“unresolved import” squiggles here are expected. Do **not** rewrite them to
relative `../../../src/lib/…` paths — that would teach AI the wrong import style.

## Freeze policy

- Each `*.reference.tsx` file is a **frozen contract**.
- **Do not edit** a reference after it ships. Fixes belong in prompts / formups, or a **new** filename if a new pattern is required.
- References intentionally omit Tailwind / brand styling. Capture HTML and screenshots are the visual source of truth.

## Catalog

| Type key | File | Typical use |
|----------|------|-------------|
| `field-catalog` | `FieldCatalog.reference.tsx` | Always attached — BQ field allowlist + `AppPlaceholder` |
| `header` | `Header.reference.tsx` | Site branding, utilities, nav placeholder |
| `footer` | `Footer.reference.tsx` | Site links, contact, legal |
| `navigation` | `Navigation.reference.tsx` | Menus via Sitecore nav resolver Fields |
| `hero` | `Hero.reference.tsx` | Page / campaign introduction |
| `banner` | `Banner.reference.tsx` | Announcements, alerts, promos |
| `content-section` | `ContentSection.reference.tsx` | General text / media / actions |
| `card` | `Card.reference.tsx` | Compact preview |
| `grid` | `Grid.reference.tsx` | Collection via placeholder |
| `list` | `List.reference.tsx` | Collection via `getDatasource` children |
| `carousel` | `Carousel.reference.tsx` | Horizontal / sliding collection |
| `gallery` | `Gallery.reference.tsx` | Image / media collection |
| `media-block` | `MediaBlock.reference.tsx` | Media + supporting copy |
| `text-and-media` | `TextAndMedia.reference.tsx` | Split text + media |
| `quote` | `Quote.reference.tsx` | Quote / testimonial |
| `accordion` | `Accordion.reference.tsx` | Expandable FAQ-style rows |
| `tabs` | `Tabs.reference.tsx` | Selectable panels |
| `table` | `Table.reference.tsx` | Tabular data |
| `comparison` | `Comparison.reference.tsx` | Side-by-side plans / products |
| `steps` | `Steps.reference.tsx` | Ordered process |
| `timeline` | `Timeline.reference.tsx` | Milestones over time |
| `statistics` | `Statistics.reference.tsx` | Highlighted numbers |
| `form` | `Form.reference.tsx` | Fields + submit |
| `search-filters` | `SearchFilters.reference.tsx` | Search / filter controls |
| `map-locator` | `MapLocator.reference.tsx` | Locations + optional map slot |
| `embed` | `Embed.reference.tsx` | External / iframe content |

## Codegen attachment

Selection lives in `bq/tools/create-section-components/reference-types.mjs`:

1. Always attach `FieldCatalog.reference.tsx`.
2. Infer type keys from `packageKind`, `layout.pattern`, `cmsName`, `componentName`, `purpose`, `pageRole`.
3. Attach matching `*.reference.tsx` files (Navigation only for `packageKind=navigation`).

Wired from `formatCodegenReferenceExamplesForPrompt` in `ai-codegen.mjs`.

## Legacy

The old multi-file nav pack and `comprehensive-sdk-component.example.tsx` were
removed. Use `FieldCatalog.reference.tsx` + type `*.reference.tsx` files only.
