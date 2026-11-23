# Media item YAML template

Reference for serialized Unversioned Media items created from design URLs.

## Folder item (one per path segment)

Template: `fe5dd826-48c6-436d-b87a-7c4210c7413b`

Disk layout: `{parentPath}/{segment}.yml` with subdirectory `{parentPath}/{segment}/` for children.

Example — folder `new__jm__images` under `…/o/jm-platinum-theme/images/`:

```yaml
---
ID: "4020e9c8-19d7-456d-adc7-e42833a8565a"
Parent: "{parent-folder-item-guid}"
Template: "fe5dd826-48c6-436d-b87a-7c4210c7413b"
Path: "/sitecore/media library/Project/{project}/{site}/o/jm-platinum-theme/images/new__jm__images"
Languages:
- Language: en
  Versions:
  - Version: 1
```

## Media file item

Template: `f1828a2c-7e5d-4bbd-98ca-320474871548`

Example — `call_center_icon.svg` from URL `https://matthey.com/o/jm-platinum-theme/images/new__jm__images/call_center_icon.svg`:

Disk path: `…/{site}/o/jm-platinum-theme/images/new__jm__images/call_center_icon.yml`

After `dotnet sitecore serialization validate --fix`, the **file** YAML may move to a hash folder (e.g. `812BA050F4F3013F/…/call_center_icon.yml`). Folder items usually stay in the path-segment tree. **`Path:` and `Parent:` in YAML remain authoritative** — do not treat hash folders as orphans. See [media-orphan-prevention.md](media-orphan-prevention.md).

```yaml
---
ID: "ebb98692-806f-45f2-a7bd-1dd929463a09"
Parent: "4020e9c8-19d7-456d-adc7-e42833a8565a"
Template: "f1828a2c-7e5d-4bbd-98ca-320474871548"
Path: "/sitecore/media library/Project/{project}/{site}/o/jm-platinum-theme/images/new__jm__images/call_center_icon"
SharedFields:
- ID: "22eac599-f13b-4607-a89d-c091763a467d"
  Hint: Width
  Value: 24
- ID: "40e50ed9-ba07-4702-992e-a912738d32dc"
  Hint: Blob
  BlobID: "4998695a-055e-4ab6-acac-4487edc3fba9"
  Value: PHN2ZyBpZD0ic3VwcG9ydF9hZ2VudC1ibHVlLTQ4ZHAi…
- ID: "6954b7c7-2487-423f-8600-436cb3b6dc0e"
  Hint: Size
  Value: 1042
- ID: "6f47a0a5-9c94-4b48-abeb-42d38def6054"
  Hint: Mime Type
  Value: image/svg+xml
- ID: "c06867fe-9a43-4c7d-b739-48780492d06f"
  Hint: Extension
  Value: svg
- ID: "cb09946f-3218-4823-87d2-d5007c199a96"
  Hint: Dimensions
  Value: 24 x 24
- ID: "de2ca9e4-c117-4c8a-a139-1ff4b199d15a"
  Hint: Height
  Value: 24
Languages:
- Language: en
  Versions:
  - Version: 1
    Fields:
    - ID: "65885c44-8fcd-4a7f-94f1-ee63703fe193"
      Hint: Alt
      Value: "call_center"
```

## Datasource Image field reference

In default datasource YAML, reference the media item by ID (lowercase, no braces):

```yaml
- ID: "{image-field-guid}"
  Hint: Image
  Value: |
    <image mediaid="ebb98692-806f-45f2-a7bd-1dd929463a09" />
```

## URL → disk path mapping

| URL path | Disk path under `{site}/` |
|----------|---------------------------|
| `/o/jm-platinum-theme/images/new__jm__images/call_center_icon.svg` | `o/jm-platinum-theme/images/new__jm__images/call_center_icon.yml` |
| `/documents/161599/0/Youtube%20Icon.png` | `documents/161599/0/Youtube Icon.yml` |
| `/documents/161599/175204/Chemical-pattern-S.jpg/{guid}` | `documents/161599/175204/Chemical-pattern-S.yml` |

Folder YAMLs: `o.yml`, `o/jm-platinum-theme.yml`, `o/jm-platinum-theme/images.yml`, etc.

Use [`create-media-from-urls.ps1`](../scripts/create-media-from-urls.ps1) to generate folder + media items automatically. The script skips assets that already exist (matched by Sitecore `Path:`) and returns their `MediaId` for datasource references.

Script path: `.cursor/skills/sitecore-serialization-skills/sitecore-media-from-url-yaml/scripts/create-media-from-urls.ps1`
