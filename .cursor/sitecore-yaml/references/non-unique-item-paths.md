# NON-UNIQUE ITEM PATH (SCS)

## Symptom

```txt
NON-UNIQUE ITEM PATH: /sitecore/templates/.../Data/FieldName found in
  .../templates/{system}/Component Templates/.../Data/FieldName.yml, and
  .../templates/{HASH}/FieldName.yml
Non-unique paths must be fixed manually before completing validation...
```

`validate --fix` **will not** resolve this. Fix YAML first, then re-run validate.

## Cause

Long Sitecore paths exceed `defaultMaxRelativeItemPathLength`. SCS stores some files under hash folders (e.g. `templates/ACB17F4AD5B766C1/FeaturedBody.yml`) while `Path:` stays the full logical path.

Creating the **same field again** under the readable tree (`templates/{system}/.../Data/FieldName.yml`) produces a second file with a **different ID** and the same `Path:` → corruption risk.

## Fix

1. Grep both files for `^ID:` and `^Path:`.
2. Find which ID datasources / layouts reference (`Hint: FieldName` uses the field definition ID).
3. **Keep** the file whose ID is referenced (or the readable-tree file if neither is referenced yet).
4. **Delete** the other YAML file; remove the empty hash folder if empty.
5. Scan the whole module for any remaining duplicate `Path:` values before validate:

```powershell
# PowerShell: list Paths that appear in more than one YAML file
$files = Get-ChildItem "authoring/items/{Module}/serialized-content" -Recurse -Filter *.yml
$map = @{}
foreach ($f in $files) {
  $c = Get-Content $f.FullName -Raw
  if ($c -match '(?m)^Path: "([^"]+)"') {
    $p = $Matches[1]
    if (-not $map.ContainsKey($p)) { $map[$p] = @() }
    $map[$p] += $f.FullName
  }
}
$map.GetEnumerator() | Where-Object { $_.Value.Count -gt 1 }
```

6. Re-run `dotnet sitecore ser validate --fix -i {namespace}-scs`.

## Prevention

Before adding a template field YAML:

1. Search the module for `Path: ".../Data/{FieldName}"` **and** for files named `{FieldName}.yml` under any `templates/{HASH}/` folder.
2. If the field already exists (hash or readable), **reuse that ID** — do not write a second file.
3. Prefer extending fields via `--fields` on the rendering generator once, then let `validate --fix` relocate long paths. Do not hand-copy fields into both trees.
4. Never invent hash folder names; never edit `Path:` to match disk layout.

## Related

- Media orphans / hash folders: [media-orphan-prevention.md](../generators/sitecore-media-from-url-yaml/references/media-orphan-prevention.md)
- Site path hashing: [site-structure.md](../generators/sitecore-new-site-yaml/references/site-structure.md)
