# Media orphan prevention

How serialized media items become **orphaned** (valid `mediaid` in datasource YAML but broken or missing item in CM), and how to prevent it.

---

## What “orphaned” means here

| Term | Meaning |
|------|---------|
| **Orphaned `mediaid`** | Datasource YAML references a GUID with no matching media **file** item in serialization (or CM after push). |
| **Broken parent chain** | Media file YAML `Parent:` points to a folder ID that does not exist, or to a **duplicate** folder item that was never pushed. |
| **Hash folder on disk** | After `validate --fix`, blob **file** YAML may live under `{HASH}/filename.yml`. This is **normal** — not an orphan if `Path:` and `Parent:` are correct. |

Do **not** move hash-folder files back into path-segment trees manually. `validate --fix` chose that layout on purpose.

---

## Root cause: duplicate folder items (RAI case)

The RAI `afbeelding-3` item failed on push with:

```text
[M] 5c8b1419-… to 8db6eccd-…: Item 5c8b1419-… did not exist.
```

That happened because:

1. **`create-media-from-urls.ps1` ran more than once** (or ran after partial manual cleanup).
2. **`Ensure-Folder` only checked the path-segment disk tree** under `MediaRoot` (`…/media-library/rai/rai-amsterdam/…`).
3. A **parallel folder tree** already existed elsewhere on disk (hash folder `C40BF4988F3A515A/…/nieuws.yml` from an earlier run or from `validate --fix` relocating ancestors).
4. The script created a **second `nieuws` folder** with the **same Sitecore `Path:`** but a **different `ID:`** (`487ddda5…` vs `8db6eccd…`).
5. The media **file** was created with `Parent:` pointing at one duplicate; a **manual parent edit** switched it to the other duplicate.
6. On push, serialization tried to **move** the item to the new parent, but CM never had that item → push error.

**Fix applied in script:** `Ensure-Folder` now calls `Find-ExistingFolderByPath` (same pattern as media file reuse) so folder items are reused by Sitecore `Path:` across the whole `media-library` include — not only when `$seg.yml` exists under the current `MediaRoot` walk.

---

## Other common causes

| Cause | Symptom | Prevention |
|-------|---------|------------|
| **Inconsistent URL → path mapping** | Same image, two Sitecore `Path:` values (e.g. with vs without `edge.sitecorecloud.io` tenant prefix) | Strip `/-/media/` and edge `{tenant}/media/project/{package}/` in `Get-DecodedPath`; unwrap CDN wrappers in authoring `normalizeMediaUrl()` before asset list |
| **`{MEDIA:…}` / `-Assets` URL mismatch** | Placeholders not patched; random GUIDs left in datasource | [Canonical URL rule](media-download.md#canonical-url-rule) |
| **Manual `Parent:` / `ID:` edits** | Push reports `[M] … did not exist` or corrupt tree | Never hand-edit media IDs/parents — delete duplicate YAML, re-run script, or assign **new** file ID + update datasource |
| **Non-unique `Path:`** | `validate` reports `NON-UNIQUE ITEM PATH` | Delete duplicate YAML (keep ID referenced by datasources); see [non-unique-item-paths.md](../../../references/non-unique-item-paths.md). Do not push until clean |
| **Push before download completes** | `mediaid` with no serialized file | Fail authoring run when placeholders remain ([Post-import verification](media-download.md#post-import-verification)) |
| **Wrong `MediaRoot`** | Folders created outside site tree; parents don’t chain to site root | Derive from `{collection}/{sitename}` — never copy another site’s folder name |

---

## Authoring script requirements

When an authoring script (e.g. `Complete-*Authoring.mjs`) wraps the media skill:

1. **Normalize scraped URLs once** before `{MEDIA:{Url}}` placeholders and before the asset manifest (edge CDN, `raicdn` wrappers, `&amp;`).
2. **Run media download once per full authoring pass** — avoid re-downloading on every partial re-run without cleaning duplicates first.
3. **After download + patch:** assert no `{MEDIA:…}` placeholders and every `mediaid` resolves to a file item.
4. **Run `validate --fix`** and **fail the script** (not just warn) on non-unique media paths or unresolved references.
5. **Do not push** if validation reports duplicate paths or orphaned parents.

---

## Recovery (when push already failed)

1. `dotnet sitecore serialization validate -i {namespace}` — list non-unique paths and incorrect file paths.
2. For duplicate **folder** items with the same `Path:` — delete the extra YAML tree; keep the folder ID that existing **children** reference in `Parent:`.
3. For a media **file** stuck on a bad parent — assign a **new** file `ID:`, update datasource `mediaid`, do **not** change parent to “the other duplicate” by hand.
4. `validate --fix` — let it relocate blob files into hash folders if needed.
5. Re-run push.

---

## Checklist (before push)

```
- [ ] Every media file Parent: matches an existing folder item ID: in serialization
- [ ] No two YAML files share the same Sitecore Path:
- [ ] Hash-folder blob files are OK — verify Path: + Parent:, not disk location
- [ ] No manual Parent:/ID: edits on media items
- [ ] validate --fix passes without NON-UNIQUE ITEM PATH
- [ ] Every datasource mediaid= exists under media-library/ (file template f1828a2c-…)
```
