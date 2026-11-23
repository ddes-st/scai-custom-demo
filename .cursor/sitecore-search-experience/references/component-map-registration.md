# Component map + import map registration (App Router)

After copying search files to `{{hostRoot}}/src/components/{{componentNamespace}}/search-experience/`, register in the **target App Router host only**. Replace `{ns}` with `{{componentNamespace}}`.

Search components are `'use client'` — register in **`.sitecore/component-map.client.ts`** (primary) and server map if your host uses split maps.

---

## component-map.client.ts

```typescript
import * as SearchExperienceLoadMore from 'src/components/{ns}/search-experience/SearchExperience.LoadMore';
import * as SearchExperience from 'src/components/{ns}/search-experience/SearchExperience';
// … submodules as needed for editing

export const componentMap = new Map([
  // …
  ['SearchExperience', { ...SearchExperienceLoadMore, ...SearchExperience, componentType: 'client' }],
]);
```

If the host uses a single `.sitecore/component-map.ts` only (older template), register there with `componentType: 'client'`. App Router Content SDK templates use **both** server and client maps — mirror KPMG.

---

## component-map.ts (server)

Only needed if editing resolves server map entries for search submodules. Most search UI lives in the client map.

---

## import-map.ts

Required modules for App Router editing:

| module | exports |
|--------|---------|
| `next-intl` | `useTranslations` |
| `next/navigation` | `useSearchParams`, `useRouter`, `usePathname` |
| `@sitecore-content-sdk/nextjs/search` | `useSearch`, `useInfiniteSearch` (LoadMore variant) |
| `lib/utils` | `cn` |
| `src/components/{ns}/search-experience/search-components/*` | each search subcomponent used in editor |

Regenerate import map after registration:

```bash
cd {{hostRoot}}
npm run sitecore:import-map
```

---

## Do not

- Register search only in Pages Router `pages/_app.tsx` hosts without App Router + next-intl — see [app-router-next-intl.md](app-router-next-intl.md)
- Hardcode `jm3` or `jm` — use `{{hostRoot}}` and `{{componentNamespace}}`
- Skip `lib/utils.ts` — search UI depends on `cn` from `lib/utils`
