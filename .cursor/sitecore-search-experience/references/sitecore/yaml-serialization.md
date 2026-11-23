# Search Experience — Sitecore serialization YAML

Vendored from a working JM3Collection implementation. Copy **templates and renderings** into the target collection’s serialized folders, adapt placeholders, then validate before push.

**Host prerequisite:** Target rendering host must be **Next.js App Router** with next-intl — [app-router-next-intl.md](../app-router-next-intl.md). Pages Router hosts are not supported for search UI.

## Placeholders (replace before copy/push)

| Placeholder | Example | How to resolve |
|-------------|---------|----------------|
| `{{collectionName}}` | `jm3collection`, `rai` | Project/collection folder name under `/sitecore/templates/Project/` and `/sitecore/layout/Renderings/Project/` |
| `{{collectionTemplatesRootId}}` | `deb883dd-0dea-48b3-aea6-0965e2f5f23c` | ID of `{collectionName}.yml` under `serialized-content/templates/` |
| `{{collectionRenderingsRootId}}` | `3c0484d5-ae25-4447-a098-6fef0e181873` | ID of `{collectionName}.yml` under `serialized-content/renderings/` |
| `{{searchIndexSourceId}}` | `pub-958f3b66-0fb0-4675-8808-a5dc40949051` | Search index source for the `search` field plugin (ask user or CM) |
| `{{siteName}}` | `jm3site`, `rai-amsterdam` | Headless site item name under `/sitecore/content/{collectionName}/` |
| `{{siteModule}}` | `jm3site` | Serialized content subfolder name in `*.module.json` (often same as site name) |
| `{{availableRenderingsFolderId}}` | `811f051c-443f-42a7-95c6-04becfc619a4` | ID of `{siteName}/Presentation/Available Renderings.yml` |
| `{{searchExperienceRenderingId}}` | `{F6952169-D48B-4612-9C31-AC13CAC54C61}` | Search Experience rendering ID (matches vendored rendering YAML) |

**Keep item IDs** inside the Search Experience trees as-is — parent chains are self-contained. Root folder `Parent` values and all `Path:` fields must match the target collection/site.

## Templates — skill source → destination

| Skill reference | Destination |
|-----------------|-------------|
| [templates/Search Experience.yml](templates/Search Experience.yml) | `authoring/items/{CollectionFolder}/serialized-content/templates/{collectionName}/Search Experience.yml` |
| [templates/Search Experience/](templates/Search Experience/) (entire tree) | `authoring/items/{CollectionFolder}/serialized-content/templates/{collectionName}/Search Experience/` |

## Renderings — skill source → destination

| Skill reference | Destination |
|-----------------|-------------|
| [renderings/Search Experience.yml](renderings/Search Experience.yml) | `authoring/items/{CollectionFolder}/serialized-content/renderings/{collectionName}/Search Experience.yml` |
| [renderings/Search Experience/Search Experience.yml](renderings/Search Experience/Search Experience.yml) | `authoring/items/{CollectionFolder}/serialized-content/renderings/{collectionName}/Search Experience/Search Experience.yml` |

The rendering sets `componentName: SearchExperience`, datasource template `{5A3D7AA7-0CB1-468A-9C8D-7BC02D6F110B}`, params template `{BAD0EF57-D3BF-4841-A7DB-D6247F95F94A}`, and datasource location query for `Search Experience Folder`.

## Available Renderings — skill source → destination

Registers Search Experience in the **Search** toolbox group so authors can add it to pages.

| Skill reference | Destination |
|-----------------|-------------|
| [available-renderings/Search.yml](available-renderings/Search.yml) | `authoring/items/{CollectionFolder}/serialized-content/{siteModule}/{siteName}/Presentation/Available Renderings/Search.yml` |

The `Renderings` field must reference the Search Experience rendering ID (`{{searchExperienceRenderingId}}`). Set `Parent` to the target site’s **Available Renderings** folder item ID.

Example layout for JM3Collection:

```
authoring/items/JM3Collection/serialized-content/
├── templates/jm3collection/Search Experience/…
├── renderings/jm3collection/Search Experience/…
└── jm3site/jm3site/Presentation/Available Renderings/Search.yml
```

## PowerShell copy + adapt example

```powershell
$skillBase = ".cursor/skills/sitecore-rendering-host-skills/search-experience/references/sitecore"
$collectionFolder = "authoring/items/JM3Collection"
$collectionName = "jm3collection"
$templatesRootId = "deb883dd-0dea-48b3-aea6-0965e2f5f23c"
$renderingsRootId = "3c0484d5-ae25-4447-a098-6fef0e181873"
$searchIndexSourceId = "pub-YOUR-INDEX-SOURCE-ID"
$siteName = "jm3site"
$siteModule = "jm3site"
$availableRenderingsFolderId = "811f051c-443f-42a7-95c6-04becfc619a4"
$searchExperienceRenderingId = "{F6952169-D48B-4612-9C31-AC13CAC54C61}"

# Templates
$tplDest = "$collectionFolder/serialized-content/templates/$collectionName"
Copy-Item -Force "$skillBase/templates/Search Experience.yml" "$tplDest/Search Experience.yml"
Copy-Item -Recurse -Force "$skillBase/templates/Search Experience" "$tplDest/Search Experience"

# Renderings
$renDest = "$collectionFolder/serialized-content/renderings/$collectionName"
Copy-Item -Force "$skillBase/renderings/Search Experience.yml" "$renDest/Search Experience.yml"
New-Item -ItemType Directory -Force -Path "$renDest/Search Experience" | Out-Null
Copy-Item -Force "$skillBase/renderings/Search Experience/Search Experience.yml" "$renDest/Search Experience/Search Experience.yml"

# Available Renderings (makes component pickable in Pages)
$availDest = "$collectionFolder/serialized-content/$siteModule/$siteName/Presentation/Available Renderings"
New-Item -ItemType Directory -Force -Path $availDest | Out-Null
Copy-Item -Force "$skillBase/available-renderings/Search.yml" "$availDest/Search.yml"

Get-ChildItem -Path "$collectionFolder/serialized-content" -Recurse -Filter "*.yml" |
  Where-Object { $_.FullName -match "Search Experience|Available Renderings/Search" } | ForEach-Object {
  $c = Get-Content $_.FullName -Raw
  $c = $c.Replace("{{collectionName}}", $collectionName)
  $c = $c.Replace("{{collectionTemplatesRootId}}", $templatesRootId)
  $c = $c.Replace("{{collectionRenderingsRootId}}", $renderingsRootId)
  $c = $c.Replace("{{searchIndexSourceId}}", $searchIndexSourceId)
  $c = $c.Replace("{{siteName}}", $siteName)
  $c = $c.Replace("{{availableRenderingsFolderId}}", $availableRenderingsFolderId)
  $c = $c.Replace("{{searchExperienceRenderingId}}", $searchExperienceRenderingId)
  Set-Content -Path $_.FullName -Value $c -NoNewline
}
```

## Module include requirement

The collection’s `*.module.json` must include both:

```json
{
  "name": "templates",
  "path": "/sitecore/templates/Project/{collectionName}",
  "scope": "ItemAndDescendants"
},
{
  "name": "renderings",
  "path": "/sitecore/layout/Renderings/Project/{collectionName}",
  "scope": "ItemAndDescendants"
}
```

If `Path:` still references another project (e.g. `click-click-launch`), serialization reports **EXTRA ITEM** and `validate --fix` will **delete** those files — that means wrong paths, not unwanted items.

## After copy

```powershell
dotnet sitecore serialization validate --fix -i {moduleNamespace}
dotnet sitecore serialization push -n {environment}
```

`validate --fix` may move nested `Data` folders to ID-based paths (e.g. `CFF68637DED0247F/`) — that is normal SCS behavior.

## Template tree (what gets created)

| Item | Role |
|------|------|
| **Search Experience** (folder) | Component template group |
| **Search Experience** (template) | Datasource template; `Data/search` field (Plugin type) holds index JSON |
| **Search Experience Folder** | Datasource folder with insert options |
| **Rendering Parameters / Search Experience Parameters** | Params template; `columns` number field |
| **__Standard Values** | Defaults for datasource and params |

## Rendering tree (what gets created)

| Item | Role |
|------|------|
| **Search Experience** (folder) | Rendering group under `/sitecore/layout/Renderings/Project/{collectionName}/` |
| **Search Experience** (rendering) | Headless rendering; `componentName: SearchExperience` |

## Available Renderings (what gets created)

| Item | Role |
|------|------|
| **Search** (under `Presentation/Available Renderings/`) | Toolbox group listing the Search Experience rendering for page authoring |

Requires site module rule including `/Presentation` (see `jm3collection.module.json` `jm3site` rules).

## Still required after templates + renderings

Also add (per host/collection):

1. **Headless variants** (`Default`, `LoadMore`) on the rendering in CM or YAML if not present — TSX exports both from `SearchExperience.tsx` / `SearchExperience.LoadMore.tsx`
2. **Datasource** item under site `Data/SearchExperience/`
3. **Search page** item with rendering wired
4. **Dictionary** keys from [search-experience/search-components/constants.ts](../search-experience/search-components/constants.ts)

Reference host with templates already applied: `authoring/items/JM3Collection/`.

## Do not

- Copy YAML without replacing `{{collectionName}}`, `{{collectionTemplatesRootId}}`, and `{{collectionRenderingsRootId}}`
- Leave paths pointing at a source project (`click-click-launch`, etc.)
- Run `validate --fix` expecting deletion when paths are wrong — fix paths first
