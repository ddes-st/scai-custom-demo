# Site collection serialization structure

Template source: pull of **New Collection** (reference structure; the generator writes equivalent YAML locally).

**The generator only creates files under `authoring/items/` — nothing is created in Sitecore CM until `dotnet sitecore serialization push`.**

## Output layout

```
authoring/items/{Collection Display Name}/
├── {system-name}.module.json
└── serialized-content/
    ├── templates/{system-name}/          # Headless Tenant, Headless Site, Page, …
    ├── templates/{system-name}.yml
    ├── branches/{system-name}.yml
    ├── renderings/{system-name}.yml
    ├── placeholder-settings/{system-name}.yml
    ├── collection/{system-name}.yml           # Headless Tenant content root
    ├── project-settings/{system-name}.yml     # SettingsFolder target (Project settings root)
    ├── project-settings/{system-name}/{system-name}.yml
    ├── branches/{system-name}.yml             # BranchesFolder root
    ├── renderings/{system-name}.yml           # RenderingsFolder root
    ├── placeholder-settings/{system-name}.yml # PlaceholderSettingsFolder root
    └── media-library/{system-name}/
        ├── {system-name}.yml                  # MediaLibrary root
        └── shared.yml                         # SharedMediaLibrary
```

## Naming

| Input | Example | Used in |
|-------|---------|---------|
| Display name | `Company Name` | `authoring/items/` folder name |
| System name | `company-name` | Sitecore paths, YAML file names, module file name |
| Namespace | `company-name-scs` | `dotnet sitecore serialization -i` |

System name rule: lowercase, spaces → hyphens, strip non-alphanumeric (except hyphen).

## Module includes

| Include | Sitecore path |
|---------|---------------|
| templates | `/sitecore/templates/Project/{system-name}` |
| branches | `/sitecore/templates/Branches/Project/{system-name}` |
| media-library | `/sitecore/media library/Project/{system-name}` |
| renderings | `/sitecore/Layout/Renderings/Project/{system-name}` |
| placeholder-settings | `/sitecore/Layout/Placeholder Settings/Project/{system-name}` |
| project-settings | `/sitecore/system/Settings/Project/{system-name}` |
| collection | `/sitecore/content/{system-name}/` (Headless Tenant — **`scope: "SingleItem"`**, kept when sites are added) |

**Note:** This module includes the **collection tenant** and **project settings**. Add **sites** with the [`sitecore-new-site-yaml`](../sitecore-new-site-yaml/SKILL.md) skill — the `collection` include stays so the tenant can be pushed alongside sites.

## Site media library wiring

When a site is added, **`SiteMediaLibrary`** on the site root must reference the generated item at `media-library/{collection-system}/{site-system}.yml`. The site generator sets this explicitly, along with `Media.yml` **`AdditionalChildren`** and **`ThumbnailsRootPath`** in Site Grouping.

## Project settings and SettingsFolder

The tenant item (`collection/{system-name}.yml`) **`SettingsFolder`** field must reference the project settings root item ID from `project-settings/{system-name}.yml`. The generator remaps both IDs together so the reference stays valid.

## Five project root folders (required)

When a collection exists in Sitecore CM, five **project root folder** items exist under layout/templates/media paths. The generator serializes them as separate YAML files and links them from the tenant content root item:

| Sitecore path | Serialized file | Site content field |
|---------------|-----------------|-------------------|
| `/sitecore/templates/Branches/Project/{system-name}` | `branches/{system-name}.yml` | `BranchesFolder` |
| `/sitecore/media library/Project/{system-name}` | `media-library/{system-name}.yml` | `MediaLibrary` |
| `/sitecore/media library/Project/{system-name}/shared` | `media-library/{system-name}/shared.yml` | `SharedMediaLibrary` |
| `/sitecore/layout/Renderings/Project/{system-name}` | `renderings/{system-name}.yml` | `RenderingsFolder` |
| `/sitecore/layout/Placeholder Settings/Project/{system-name}` | `placeholder-settings/{system-name}.yml` | `PlaceholderSettingsFolder` |

The generator remaps all six item IDs (tenant root + five folders) and updates cross-references in `collection/{system-name}.yml` automatically.

After the first push to CM, run a pull — CM may replace the IDs of these five folder items; that is expected.

## Path hashing

When paths exceed `defaultMaxRelativeItemPathLength` (see `sitecore.json` and the [SCS configuration reference](https://doc.sitecore.com/sai/en/developers/sitecoreai/sitecore-content-serialization/configuration/sitecore-content-serialization-configuration-reference.html)), the CLI may store some files under hash folders on disk while siblings with shorter paths remain in readable folders. YAML `Path:` always stays the full logical Sitecore path. Run `validate --fix` — never guess hash names or edit `Path:` to match disk layout.

Item YAML format: [YAML serialization format](https://doc.sitecore.com/xp/en/developers/104/sitecore-experience-manager/the-yaml-serialization-format.html).

## GUID remapping

The generator assigns **new random UUIDs** to every item `ID:` in the template YAML and replaces all references to those IDs across files (`Parent`, `Template`, `__Standard values`, `__Masters`, braced GUIDs in `Value`, etc.).

**Not remapped** (Sitecore foundation / standard field IDs):

- Parent IDs pointing outside the collection (e.g. Project templates root)
- `__Base template` branch GUIDs shared across collections (`79C9FA01-…`, `FD2059FD-…`, …)
- Standard field definition IDs (`25bed78c-…`, `52807595-…`, …)

## Foundation branch IDs (same for every collection)

These appear in `__Base template` / `BranchID` and stay unchanged:

- Partial Designs branch: `{79C9FA01-5F6A-48B2-B459-05BBAA826A9D}`
- Page Designs branch: `{DAAF41FD-96DB-4892-BE99-F62F16D036C4}`
- Partial Design Folder branch: `{25F01F50-5534-44F9-B1BA-BCBB60B2D13D}`
- Page Design Folder branch: `{023F5D48-979D-4381-BC5E-149E36ABD3BD}`
