# Search experience reference file map

Copy from [references/](.) into the target **App Router** rendering host — templates only, not runtime imports from the skill folder.

**Prerequisite:** [app-router-next-intl.md](app-router-next-intl.md)

## Host paths (never hardcode `jm3` / `jm`)

| Placeholder | Example | Resolve |
|-------------|---------|---------|
| `{{hostRoot}}` | `editing-hosts/rai` | Active rendering host folder |
| `{{componentNamespace}}` | `rai`, `jm`, `axa` | Sole subfolder under `{{hostRoot}}/src/components/` (or the namespace used by existing site components) |

| Source (skill) | Destination (host) |
|----------------|-------------------|
| [lib/utils.ts](lib/utils.ts) | `{{hostRoot}}/src/lib/utils.ts` |
| [search-experience/](search-experience/) (entire tree) | `{{hostRoot}}/src/components/{{componentNamespace}}/search-experience/` |

## Root components

| File | Export | Hook |
|------|--------|------|
| [search-experience/SearchExperience.tsx](search-experience/SearchExperience.tsx) | `Default` | `useSearch` from `@sitecore-content-sdk/nextjs/search` |
| [search-experience/SearchExperience.LoadMore.tsx](search-experience/SearchExperience.LoadMore.tsx) | `LoadMore` | `useInfiniteSearch` |

## search-experience/search-components/

| File | Role |
|------|------|
| `models.ts` | `SearchDocument`, `SearchField`, `SearchExperienceProps`, params types |
| `constants.ts` | Debounce, page size, grid classes, dictionary keys |
| `useSearchField.tsx` | Parse JSON `fields.search.value` |
| `useRouter.tsx` | Sync `?q=` query param (`next/navigation` + debounce) |
| `useDebounce.tsx` | Input debounce helper |
| `useParams.tsx` | Rendering params → columns, pageSize, id, styles |
| `useEvent.tsx` | Search analytics via `@sitecore-content-sdk/events` |
| `SearchInput.tsx` | Controlled search input |
| `SearchPagination.tsx` | Page prev/next |
| `SearchEmptyResults.tsx` | Zero results UI |
| `SearchError.tsx` | Error + retry |
| `SearchSkeletonItem.tsx` | Loading placeholder |
| `SearchItemCommon.tsx` | Shared item layout |
| `SearchItem/index.tsx` | Result card/list composer |
| `SearchItem/SearchItemTitle.tsx` | Title from mapping |
| `SearchItem/SearchItemSummary.tsx` | Description |
| `SearchItem/SearchItemImage.tsx` | Image field |
| `SearchItem/SearchItemLink.tsx` | Link wrapper |
| `SearchItem/SearchItemTags.tsx` | Tags |
| `SearchItem/SearchItemCategory.tsx` | Category/type |
| `SearchItem/SearchItemSubTitle.tsx` | Subtitle |

## lib/utils.ts

Provides `cn()` (clsx + tailwind-merge), `getYouTubeThumbnail`, `getBaseUrl`, `getFullUrl`. Search components import `cn` from `lib/utils` — ensure `tsconfig` paths include `lib/*` (standard Content SDK host layout).

## Customization checklist

1. Update `SearchDocument` keys to match index schema
2. Update `SearchFieldsMapping` values to index field names
3. Replace Tailwind color classes with project tokens
4. Add dictionary entries for all `DICTIONARY_KEYS`
5. Register both variants in Sitecore rendering definition
6. Register paths in `.sitecore/component-map.ts` and `.sitecore/import-map.ts` using `{{componentNamespace}}` — see [component-map-registration.md](component-map-registration.md)
