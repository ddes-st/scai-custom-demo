---
name: sitecore-icons
description: >-
  Pick the best Sitecore 32x32 icon path for BQ definitions (icon field on
  renderings, components, templates, folders). Use when authoring *.definition.ts,
  when the user asks for a Sitecore icon, or when choosing icon: for Sitecore AI
  items. Always returns exactly one path like Office/32x32/window_dialog.png.
---

# Sitecore icon picker (32x32)

## Purpose

Sitecore item icons use paths relative to the icon library, always under a **32x32** folder:

```ts
icon: "Office/32x32/window_dialog.png"
```

That maps to the image file `icons/Office/32x32/window_dialog.png` in this repository.

This skill helps you **choose exactly one icon path** when writing `icon:` on BQ **`*.definition.ts`** files. Do not edit YAML to set icons — put `icon` on the definition and run generate.

---

## When to use

- **Required** whenever `bq-definitions` creates or updates a **`rendering`**, **`component`**, or **`variants`** definition — always return a path and put it on `icon:`
- User asks for an icon for a component, rendering, template, folder, or data type
- You are writing or editing `icon:` in `*.definition.ts`
- You need a Sitecore-compatible path string (not a file system path)

---

## Required output

**Always return one icon path string** in this format:

```
{Set}/32x32/{filename}.png
```

Example response for a Custom Card rendering:

```
Office/32x32/window_dialog.png
```

Optionally include one short line why it fits, but the **path is mandatory**.

---

## Selection workflow (follow in order)

### 1. Run the selector script (preferred)

From repo root:

```bash
node bq/.cursor/skills/sitecore-icons/scripts/select-icon.mjs "describe component purpose and UI metaphor"
```

Examples:

```bash
node bq/.cursor/skills/sitecore-icons/scripts/select-icon.mjs "custom card dialog teaser image link"
node bq/.cursor/skills/sitecore-icons/scripts/select-icon.mjs "authors user profile directory"
node bq/.cursor/skills/sitecore-icons/scripts/select-icon.mjs "cta button call to action"
node bq/.cursor/skills/sitecore-icons/scripts/select-icon.mjs "search experience results pagination"
node bq/.cursor/skills/sitecore-icons/scripts/select-icon.mjs --set People "team members audience"
```

Use the JSON `path` field as your answer. Review `alternatives` if the top hit is clearly wrong (e.g. credit card vs content card).

### 2. If the script is unavailable, search the catalog

Search in:

- `bq/.cursor/skills/sitecore-icons/references/icons-catalog.json` (machine-readable, 8886 icons)
- `bq/.cursor/skills/sitecore-icons/references/sets/{Set}.md` (browse by library)
- `bq/.cursor/skills/sitecore-icons/references/icons-catalog-compact.md` (full flat list)

Match on **component name**, **template purpose**, **user-facing metaphor**, and **keywords** in each icon description.

### 3. Default set and fallbacks

| Situation | Prefer |
|-----------|--------|
| General rendering / template / folder | **Office** set |
| Users, authors, profiles, roles | **People** or **PeopleV2** |
| Documents, articles, rich text | **WordProcessing** |
| Media, gallery, hero image | **Imaging** or **Multimedia** |
| Search, API, connectivity | **Network** / **Core** |
| Locale / market flags | **Flags** / **FlagsV2** |
| LaunchPad-style tile | **LaunchPadIcons** or **Apps** |
| No good match | `Office/32x32/document.png` |

---

## Icon libraries (27 sets)

| Set | Count | Use when |
|-----|------:|----------|
| Applications | 483 | Application windows, modules, shells |
| ApplicationsV2 | 578 | Updated application icons |
| Apps | 248 | Dashboard tiles, app shortcuts |
| Business | 289 | Finance, KPIs, commerce, org charts |
| BusinessV2 | 372 | Updated business / enterprise |
| Control | 177 | Form controls, toggles, UI widgets |
| Core | 412 | Sitecore platform, system items |
| Core2 | 398 | Extended core metaphors |
| Core3 | 351 | Additional core / workflow |
| Database | 156 | Tables, queries, data sources |
| Flags | 507 | Country / region flags |
| FlagsV2 | 507 | Updated flags |
| Imaging | 312 | Photos, cameras, galleries |
| LaunchPadIcons | 89 | LaunchPad tiles |
| Multimedia | 234 | Audio, video, playlists |
| Network | 289 | Servers, cloud, links, domains |
| NetworkV2 | 312 | Updated network / infra |
| **Office** | **1417** | **Default — dialogs, folders, actions** |
| OfficeWhite | 1417 | Light variants for dark chrome |
| Other | 198 | Miscellaneous |
| People | 312 | Users, teams, contacts |
| PeopleV2 | 312 | Updated people / identity |
| Software | 289 | Code, packages, dev tools |
| SoftwareV2 | 312 | Updated developer icons |
| WordProcessing | 234 | Documents, text, editorial |

Full per-icon descriptions: see `references/sets/*.md`.

---

## Mapping component types → icon strategy

| Definition kind | Think about | Typical icons |
|-----------------|-------------|----------------|
| **Rendering** | Visual block on page | `window_dialog`, `component`, `layout`, feature metaphor |
| **Template / branch** | Content structure | `document`, `folder`, `template`, section metaphor |
| **Data definition** | Entity being stored | entity noun (`user`, `author`, `product`, `event`) |
| **Folder template** | Container | `folder`, `folder_document`, `folder_open` |
| **Parameters** | Settings | `settings`, `preferences`, `slider` |
| **Enumeration** | Fixed list | `list`, `enum`, `tag` |
| **Dictionary** | Labels / i18n | `dictionary`, `translate`, `globe` |
| **Field validator** | Rule / constraint | `validator`, `warning`, `check` |
| **Headless variant** | Usually inherits parent rendering icon | Same as parent component |

### Examples (verified paths)

| Component / purpose | Recommended path |
|---------------------|------------------|
| Custom Card (dialog-style card block) | `Office/32x32/window_dialog.png` |
| CTA Button | `Office/32x32/button.png` |
| Hero / banner | `Office/32x32/window_sidebar.png` or `Imaging/32x32/image.png` |
| Authors data | `People/32x32/user.png` or `Office/32x32/user.png` |
| Search Experience | `Office/32x32/search.png` |
| Navigation / menu | `Office/32x32/navigation.png` |
| Rich text | `WordProcessing/32x32/document.png` |
| Image / media block | `Multimedia/32x32/image.png` |
| Product listing | `Business/32x32/product.png` |
| Location finder | `Office/32x32/map.png` |
| Form | `Office/32x32/form.png` |
| Generic fallback | `Office/32x32/document.png` |

---

## Regenerating the catalog

When icons are added or updated under repo root `icons/`:

```bash
node bq/.cursor/skills/sitecore-icons/scripts/build-catalog.mjs
```

This rebuilds:

- `references/icons-catalog.json`
- `references/icons-catalog-compact.md`
- `references/sets/{Set}.md`
- `references/README.md`

---

## Rules

1. **Always** use a `32x32` path — never `16x16`, `24x24`, or `48x48`.
2. **Always** return exactly **one** path string.
3. **Never** invent paths — they must exist in `icons/{Set}/32x32/`.
4. Prefer **Office** unless another set is a clearly better semantic match.
5. Match **purpose**, not just filename keywords (avoid `credit_card` for a content “card” block).
6. For BQ definitions, set the definition field:

```ts
icon: "Office/32x32/window_dialog.png",
```

---

## Related

- BQ definitions skill: `bq/.cursor/skills/bq-definitions/SKILL.md` (`icon` on rendering/component definitions also flows to Headless Variants folder `__Icon`)
