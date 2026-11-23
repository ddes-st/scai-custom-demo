---
name: unique-serialization-ids
description: Prevent and fix duplicate Sitecore item IDs across serialization YAML on disk. Use when push fails with "existed on disk in more than one place", when forking a collection generator from a sibling project, or before validate/push on a new module.
paths:
  - "authoring/items/**"
  - "authoring/scripts/Generate-*Components.mjs"
  - "authoring/scripts/Complete-*Authoring.mjs"
---

# Unique serialization item IDs

Sitecore Content Serialization validates **the entire repo on disk**, not just the module you push. If the same item `ID:` appears in two YAML files (even in different collections), push fails:

```text
Detected the item with ID … existed on disk in more than one place
(…\Johnson Matthey 2\…\HeroPanelCard.yml + more). Use the validate command to diagnose.
```

---

## Root cause (common)

| Mistake | Result |
|---------|--------|
| Copy sibling module YAML and change paths only | Same `ID:` values as jm2 / axa2 |
| Fork `Generate-Jm2Components.mjs` → `Generate-Jm3Components.mjs` but leave `stableGuid` prefix as `jm2-` | **Deterministic duplicate IDs** for every component |
| Reuse `{collection}-component-ids.json` from another module | Page YAML points at wrong renderings |
| Hand-copy template/rendering YAML between projects | Duplicate template + field IDs |

**Rule:** Each collection module needs **its own ID namespace**. Collection/site scaffolds from [`sitecore-new-collection-yaml`](../sitecore-new-collection-yaml/SKILL.md) and [`sitecore-new-site-yaml`](../sitecore-new-site-yaml/SKILL.md) already assign fresh UUIDs. Component batch generators must use a **unique `stableGuid` prefix** per project.

---

## Deterministic GUIDs (`stableGuid`)

When using MD5-seeded IDs in `Generate-{Project}Components.mjs`:

```javascript
function stableGuid(seed) {
  // MUST be unique per collection — never reuse jm2-, axa2-, etc. from a sibling
  const hash = createHash('md5').update(`jm3-${seed}`, 'utf8').digest();
  // … RFC-4122 variant bits …
}
```

| Script | Prefix example |
|--------|----------------|
| `Generate-Jm2Components.mjs` | `jm2-` |
| `Generate-Jm3Components.mjs` | `jm3-` |
| `Complete-Jm2Authoring.mjs` | `jm2-authoring-` |
| `Complete-Jm3Authoring.mjs` | `jm3-authoring-` |

Authoring scripts (`Complete-*Authoring.mjs`) use a **different** prefix from component generators so layout UIDs and datasource IDs do not collide with template IDs.

After changing a prefix, **regenerate** — do not hand-edit hundreds of GUIDs:

```powershell
node authoring/scripts/Generate-Jm3Components.mjs
node authoring/scripts/Complete-Jm3Authoring.mjs
```

---

## Pre-push checks

**1. Cross-module duplicate scan** (catches the error `validate` sometimes surfaces only at push):

```powershell
node authoring/scripts/Check-SerializationUniqueIds.mjs
```

Optional — limit to one module folder (still compares against all modules):

```powershell
node authoring/scripts/Check-SerializationUniqueIds.mjs --module JM3Collection
```

**2. SCS validate** on the target module:

```powershell
cd authoring/items/{Collection Display Name}
dotnet sitecore serialization validate --fix -i {system-name}-scs
```

**3. Push**

```powershell
dotnet sitecore serialization push -n production -i {system-name}-scs
```

Run **both** steps 1 and 2 before every push when adding a new collection or forking generators.

---

## Fix workflow when duplicates exist

1. Identify source: grep the failing ID — `rg -i "45b54a41-c818-483f-93ae-0c77b5b0aec8" authoring/items`
2. If JM3 duplicates JM2: fix `stableGuid` prefix in `Generate-Jm3Components.mjs`, re-run generator + authoring scripts.
3. If YAML was copied manually: regenerate via official generators, or assign fresh UUIDs with `[guid]::NewGuid().ToLower()` and rewire all `Parent` / rendering / datasource references.
4. Re-run `Check-SerializationUniqueIds.mjs` until exit code 0.
5. Re-run `validate --fix` and push.

---

## Push fails: `Object reference not set` on datasource update

Typical after **adding template fields** or **regenerating template IDs** when CM already has the datasource item on an older template version.

| Symptom | Cause |
|---------|--------|
| `[U] …/Data/…/Some Datasource` → `Object reference not set to an instance of an object` | CM item still uses old template; YAML sets field IDs from the new template (e.g. new `VideoThumbnailMobile` Image field) |
| Other datasources in same push succeed | Only items with **new fields** or **template mismatch** fail |

**Fix (pick one):**

1. **Regenerate datasource IDs** — `Complete-*Authoring.mjs` seeds IDs with `ds-{component}-{itemName}-{templateId}` so template changes create fresh items; re-run authoring + push (`Create` not `Update`).
2. **Delete the datasource item in Content Editor** under `{site}/Data/…`, then push again.
3. **Push templates only first** (`-i {module}-scs` includes templates before content in normal runs); if still failing, the CM item is stale — use (1) or (2).

Always push **one module**: `dotnet sitecore serialization push -n production -i jm3collection-scs` (not bare `push` from an editing host — that pushes every configured module).

---

## Checklist (new collection / forked generator)

- [ ] Collection created via `Generate-SitecoreCollection.mjs` (not copied folder)
- [ ] Site created via `Generate-SitecoreSite.mjs` (not copied `jm2/jm2` tree)
- [ ] `Generate-{Project}Components.mjs` uses `{project}-` prefix unique in this repo
- [ ] `Complete-{Project}Authoring.mjs` uses `{project}-authoring-` prefix
- [ ] `{project}-component-ids.json` lives only under `authoring/scripts/` for that project
- [ ] `Check-SerializationUniqueIds.mjs` exits 0
- [ ] `dotnet sitecore serialization validate --fix -i {module}-scs` passes
- [ ] See also [project-isolation](../../sitecore-rendering-host-skills/sitecore-component-from-design/references/project-isolation.md)

---

## Related

- [project-isolation](../../sitecore-rendering-host-skills/sitecore-component-from-design/references/project-isolation.md) — no cross-module YAML reuse
- [yaml-artifacts](../../sitecore-rendering-host-skills/sitecore-content-sdk-component/references/yaml-artifacts.md) — per-component ID rules
- [sitecore-new-collection-yaml](../sitecore-new-collection-yaml/SKILL.md)
- [sitecore-new-rendering-yaml](../sitecore-new-rendering-yaml/SKILL.md)
