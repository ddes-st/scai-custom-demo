# Media download and YAML creation

Download image bytes from URLs and write serialized **Unversioned Media** items under the module's `media-library` include.

**Never** put external design URLs in Sitecore Image field `src`. Always create (or reuse) media library items and reference them by `mediaid`.

---

## Supported URL shapes

The script [`create-media-from-urls.ps1`](../scripts/create-media-from-urls.ps1) handles three common shapes found in scraped reference HTML. Pass **the same string** in datasource `{MEDIA:{Url}}` placeholders and in the `-Assets` list (see [Canonical URL rule](#canonical-url-rule)).

| Shape | Example in HTML | Resolved download URL | Folder segments under site media root |
|-------|-----------------|----------------------|---------------------------------------|
| **Absolute static / CDN** | `https://cdn.example.com/assets/images/hero.jpg` | Same | `assets`, `images` |
| **Root-relative static** | `/static/logos/brand.svg` | `{BaseUrl}` + path → absolute | `static`, `logos` |
| **Relative static** | `images/teaser.png` or `../media/icon.svg` | `new URL(path, BaseUrl)` → absolute | From resolved path |
| **Protocol-relative** | `//cdn.example.com/img/logo.png` | `https:` + path | From host path |
| **Sitecore CDN** | `https://cdn.example.com/-/media/shared/logos/icon.svg?...` | Same (query normalized for download) | `shared`, `logos` — **`/-/media/` prefix stripped** |
| **XM Cloud edge CDN** | `https://edge.sitecorecloud.io/{tenant}/media/project/{package}/rai/rai/nieuws/img.png` | Same | `rai`, `rai`, `nieuws` — **`{tenant}/media/project/{package}/` prefix stripped** |

### XM Cloud edge CDN (`edge.sitecorecloud.io`)

Reference sites on XM Cloud often expose media via a CDN wrapper (e.g. `raicdn.nl/cdn-cgi/image/…/https://edge.sitecorecloud.io/…`) or directly:

```
https://edge.sitecorecloud.io/{tenant-hash}/media/project/{package-name}/rai/rai/afbeeldingen/agenda/hlth2026.png
```

Authoring scripts should **unwrap** resize/CDN wrappers and pass the stable `edge.sitecorecloud.io` URL to the asset list. The script strips `{tenant-hash}/media/project/{package-name}/` so folder segments start at `rai/rai/…` under the site media root — consistent across re-runs.

| URL path (decoded, trimmed) | Folder segments used |
|-----------------------------|----------------------|
| `{tenant}/media/project/rai-amsterdam-xmc/rai/rai/nieuws/img` | `rai`, `rai`, `nieuws` |
| `-/media/shared/logos/icon.svg` | `shared`, `logos` (after `/-/media/` strip) |

### Sitecore CDN (`/-/media/`)

Many Sitecore-hosted reference sites serve media from a CDN with paths like:

```
https://cdn.example.com/-/media/shared/logos/brand-logo.svg?...
```

After decoding the URI path and trimming a leading `/`, the path becomes `-/media/shared/logos/...`. Splitting on `/` would treat `-` as the first folder segment and fail when writing `{MediaRoot}/-.yml`.

The script **strips the `/-/media/` prefix** before building folder segments, so the folder tree starts at `shared/logos/...` under the site media root.

| URL path (decoded, trimmed) | Folder segments used |
|-----------------------------|----------------------|
| `-/media/shared/logos/icon.svg` | `shared`, `logos` |
| `-/media/projects/site/banner-images/hero.jpg` | `projects`, `site`, `banner-images` |
| `assets/images/hero.jpg` (static CDN, no `/-/media/`) | `assets`, `images` |

### Static paths (no Sitecore prefix)

Non-Sitecore sites use normal URL paths. No prefix stripping — folder segments mirror the URL path after the host:

```
https://www.example.com/o/theme/images/call_center_icon.svg
→ o / theme / images / call_center_icon
```

Liferay-style trailing GUID segments (`/filename/{guid}`) are stripped automatically.

### Relative paths

Scraped HTML often uses relative or root-relative `src` values. **Resolve before writing datasource YAML** (preferred), or pass `-BaseUrl` to the script:

| Scraped value | `-BaseUrl` | Resolved |
|---------------|------------|----------|
| `/assets/hero.jpg` | `https://www.example.com/` | `https://www.example.com/assets/hero.jpg` |
| `images/icon.svg` | `https://www.example.com/page/` | `https://www.example.com/page/images/icon.svg` |
| `//cdn.example.com/media/logo.png` | *(not required)* | `https://cdn.example.com/media/logo.png` |

**Base URL source:** `design-screenshots/{slug}/source-url.txt`, capture manifest origin, or the reference page URL from Phase 0.

### HTML entities and CDN query params

- Scraped URLs may contain `&amp;` query separators. The script decodes these to `&` for HTTP download but returns the **original** `Url` in JSON so callers can match `{MEDIA:{Url}}` placeholders.
- Query params like `savif=1` and `swebp=1` may return AVIF/WebP bytes while the path extension stays `.jpg`. The script strips those params for download and falls back to default dimensions when `System.Drawing` cannot read the stream.

---

## Canonical URL rule

Placeholder patching is **exact string match**:

```yaml
<image mediaid="{MEDIA:https://cdn.example.com/-/media/shared/logos/icon.svg?hash=ABC}" />
```

When building the asset manifest and datasource YAML:

1. **Resolve once** — relative → absolute using the capture base URL.
2. **Store the same resolved string** in `{MEDIA:{Url}}` placeholders **and** in `-Assets @{ Url = '…' }`.
3. Do not mix relative placeholders with absolute asset URLs (patch will miss).

Authoring scripts should resolve at collection time (`absUrl()` / `new URL(path, baseUrl)`), not only at download time.

---

## Download workflow

1. Receive URLs + alt text from the caller (typically [`sitecore-component-from-design`](../../sitecore-rendering-host-skills/sitecore-component-from-design/SKILL.md) or [`mimic-url`](../../mimic-website-skills/mimic-url/SKILL.md) Phase 4g).
2. Resolve relative URLs (caller or `-BaseUrl` on the script).
3. For each unique asset URL, **check whether a media item already exists** before downloading (see [Reuse existing media](#reuse-existing-media)).
4. Only download and create YAML for assets that do not yet exist.
5. Place new items under the module's **media include** on disk, mirroring URL path segments (after Sitecore prefix strip when applicable).
6. Create **folder YAML** items for each path segment and a **media file YAML** for the image in the leaf folder.
7. Set the media item **Blob** field to base64-encoded file content; set Alt, Width, Height, Extension, Mime Type, Size, and Dimensions.
8. Return `{ Url, ResolvedUrl, MediaId, Path, Skipped }` JSON so the caller can set datasource Image fields:

   ```yaml
   Value: |
     <image mediaid="ebb98692-806f-45f2-a7bd-1dd929463a09" />
   ```

9. **Verify** every `mediaid` in datasource YAML exists in serialized `media-library/` before validate/push (see [Post-import verification](#post-import-verification)).

### Media root paths (caller responsibility)

Derive disk and Sitecore paths from the **target site path** — never copy folder names from another project when forking authoring scripts:

| Variable | Pattern |
|----------|---------|
| `MediaRoot` | `{serializationRoot}/media-library/{collection}/{sitename}` |
| `SiteMediaPath` | `/sitecore/media library/Project/{collection}/{sitename}` |
| `SiteRootItemId` | GUID from `{sitename}.yml` under the media include |

Wrong `MediaRoot` (e.g. a sibling site's folder name) causes `Set-Content` failures because the directory does not exist.

---

## Reuse existing media

**Do not** re-download or overwrite media that already exists in the site's media library.

### Lookup order

1. **Search serialized YAML** under the module's `media-library` include for an item whose `Path:` matches the expected Sitecore path (derived from the URL). Blob files may live in path-segment folders or hash folders after `validate --fix` — match on `Path:`, not disk location.
2. **Folder items** — `Ensure-Folder` reuses existing folders by Sitecore `Path:` anywhere in the include (not only when `$seg.yml` exists under the current `MediaRoot` walk). This prevents duplicate folder IDs for the same path after hash relocation or multiple script runs.
3. **Read the existing item's `ID:`** from that YAML file.
4. Return `MediaId` to caller — no new YAML.

### When to create vs reuse

| Situation | Action |
|-----------|--------|
| No YAML with matching `Path:` | Download, create folder tree + media YAML, return new `MediaId` |
| YAML exists (any disk folder) | Return existing `MediaId` — skip download |
| Same URL, second component | Reuse — do not create duplicate media item |
| Same image, different URL path | Create separate media items (different Sitecore paths) |

[`create-media-from-urls.ps1`](../scripts/create-media-from-urls.ps1) implements this. Skipped items return `{ Skipped: true, MediaId: "…" }`.

---

## Automated script

```powershell
$baseUrl = (Get-Content "design-screenshots/{slug}/source-url.txt" -Raw).Trim()
$mediaRoot = "authoring/items/{Module}/serialized-content/media-library/{project}/{site}"
$assets = @(
  @{ Url = "https://cdn.example.com/-/media/shared/logos/icon.svg?hash=ABC"; Alt = "Logo" },
  @{ Url = "/static/images/hero.jpg"; Alt = "Hero" },
  @{ Url = "https://cdn.example.com/assets/images/teaser.png"; Alt = "Teaser" }
)
& ".cursor/skills/sitecore-serialization-skills/sitecore-media-from-url-yaml/scripts/create-media-from-urls.ps1" `
  -MediaRoot $mediaRoot `
  -SiteMediaPath "/sitecore/media library/Project/{project}/{site}" `
  -SiteRootItemId "{site-media-root-item-guid}" `
  -BaseUrl $baseUrl `
  -Assets $assets | Out-File media-mapping.json -Encoding utf8
```

The script:

- **Resolves** relative and protocol-relative URLs when `-BaseUrl` is set
- **Strips `/-/media/`** from Sitecore CDN URL paths so folder segments do not start with `-`
- **Uses static CDN paths as-is** when no `/-/media/` prefix is present
- **Strips `savif` / `swebp` query params** and decodes `&amp;` → `&` for HTTP download; returns the original `Url` in JSON for placeholder matching
- **Creates `MediaRoot`** on disk when missing
- **Skips download** when a media item with the same Sitecore `Path:` already exists
- Downloads via `WebClient.DownloadData` (SVG text and binary PNG/JPG)
- Creates folder items (template `fe5dd826-48c6-436d-b87a-7c4210c7413b`) — reuses existing folder YAMLs
- Creates media file items (template `f1828a2c-7e5d-4bbd-98ca-320474871548`) with base64 Blob when missing
- Strips trailing GUID path segments (Liferay-style `/filename/guid`)
- Returns JSON `{ Url, ResolvedUrl, MediaId, Path, Skipped }`

---

## Post-import verification

Before `validate --fix` / `push`, confirm:

1. **No `{MEDIA:https://…}` placeholders** remain in datasource YAML.
2. **Every `mediaid="…"`** in datasource YAML matches an `ID:` in a serialized media **file** item under `media-library/` (template `f1828a2c-7e5d-4bbd-98ca-320474871548`).

If a datasource references a GUID with no matching media YAML, the import failed partially — re-run download or fix Image fields. **Do not push** orphaned `mediaid` values to CM.

Also verify every media **file** `Parent:` matches an existing **folder** item `ID:` in serialization. Broken parent chains cause push move failures — see [media-orphan-prevention.md](media-orphan-prevention.md).

Authoring scripts should **fail the run** when verification fails rather than logging a warning and continuing.

---

## Media item YAML shape

See [media-item-template.md](media-item-template.md) for the full template.

| Field | Location | Notes |
|-------|----------|-------|
| Blob | SharedFields | Base64 file content; separate `BlobID` GUID |
| Width / Height | SharedFields | From image dimensions or SVG viewBox |
| Alt | Language Fields | From caller `Alt` parameter |
| Extension, Mime Type, Size, Dimensions | SharedFields | Derived from download |

---

## Validate and push

After YAML is on disk:

```powershell
dotnet sitecore serialization validate --fix -i {namespace}
dotnet sitecore serialization push -i {namespace}
```

**Note:** `validate --fix` may relocate blob media **file** YAMLs into hash-named folders. Folder items stay in the path-segment tree. `Path:` and `mediaid` references remain correct.

Fix **non-unique item paths** under `media-library/` manually before running `validate --fix` in fix mode. See [media-orphan-prevention.md](media-orphan-prevention.md) for duplicate-folder recovery.

---

## Security

- Only download URLs supplied by the caller (caller must restrict to user-approved domains).
- Do not embed third-party tracking from scraped HTML.
