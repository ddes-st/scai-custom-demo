# Site serialization structure

Template source: pull of **New Site** under **New Collection**.

**The generator only creates files under `authoring/items/` — nothing is created in Sitecore CM until `dotnet sitecore serialization push`.**

**Prerequisite:** Collection YAML must exist. If not, run [`sitecore-new-collection-yaml`](../sitecore-new-collection-yaml/SKILL.md) first.

Sites are part of the **collection module** — not a separate `module.json`. Generating site YAML updates `{collection-system}.module.json` includes.



## Output layout



```

authoring/items/{Collection}/serialized-content/

├── collection/{collection-system}.yml   ← Headless Tenant (stays in module)

├── {site-system}/

│   ├── {site-system}.yml              ← site root item

│   └── {site-system}/

│       ├── Home.yml

│       ├── Data.yml

│       ├── Dictionary.yml

│       ├── Media.yml

│       ├── Presentation/

│       └── Settings/Site Grouping/{site-system}.yml

└── media-library/{collection-system}/

    ├── {site-system}.yml

    └── {site-system}/

```



## Collection module update



When a site is generated, **append** a rules-based site include (template: [site-include.template.json](site-include.template.json)). See [SCS module rules](https://doc.sitecore.com/sai/en/developers/sitecoreai/sitecore-content-serialization/configuration/sitecore-content-serialization-configuration-reference.html#rules).



**Keep the `collection` include** — site roots reference the tenant as `Parent`, so the Headless Tenant must remain pushable:



```json

{

  "name": "collection",

  "path": "/sitecore/content/{collection-system}/",

  "allowedPushOperations": "CreateUpdateAndDelete",

  "scope": "SingleItem"

},

{

  "name": "{site-system}",

  "path": "/sitecore/content/{collection-system}/{site-system}",

  "allowedPushOperations": "CreateAndUpdate",

  "rules": [ … home, Media, Data, Dictionary, Presentation, Settings … ]

}

```



**Important:** `collection` uses **`scope: "SingleItem"`** so it only pushes the tenant root — not site folders. Site includes use **`allowedPushOperations: "CreateAndUpdate"`** on the include itself.



**Additional sites** — append another site include with the same rules pattern.



## GUID remapping



1. **Site items** — new UUIDs for all site + site-media YAML `ID:` fields; internal refs updated

2. **Collection bridge** — collection GUIDs in site YAML mapped to target collection by Sitecore `Path`

3. **Site root Parent** — set to tenant ID from `serialized-content/collection/{collection-system}.yml`

4. **Site media library** — read ID from `media-library/{collection-system}/{site-system}.yml` and wire `SiteMediaLibrary`, `Media.yml` `AdditionalChildren`, and `ThumbnailsRootPath`



## Path hashing

When paths exceed `defaultMaxRelativeItemPathLength` (see `sitecore.json` and the [SCS configuration reference](https://doc.sitecore.com/sai/en/developers/sitecoreai/sitecore-content-serialization/configuration/sitecore-content-serialization-configuration-reference.html)), the CLI may store some files under hash folders on disk while siblings with shorter paths remain in readable folders. YAML `Path:` always stays the full logical Sitecore path. Run `validate --fix` — never guess hash names or edit `Path:` to match disk layout.

Item YAML format: [YAML serialization format](https://doc.sitecore.com/xp/en/developers/104/sitecore-experience-manager/the-yaml-serialization-format.html).



## Push / validate



Uses the **collection namespace**: `{collection-system}-scs`



```powershell

dotnet sitecore serialization validate --fix -i {collection-system}-scs

dotnet sitecore serialization push -n production -i {collection-system}-scs

```



One push creates/updates the tenant, structural items, and all site includes together.


