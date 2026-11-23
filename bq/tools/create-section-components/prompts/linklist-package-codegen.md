# LinkList package codegen (minimal TSX context)

Use this block when generating a **LinkList** child package for a flat link-list UI region (parent already has `AppPlaceholder`).

## Give the model ONLY

1. **Field shape** (inline in the TSX — do not import `sxa-link-list.props`):

```ts
// ComponentQuery shape (JSS LinkList):
fields?.data?.datasource?.children?.results[] → element.field.link (LinkField)
fields?.data?.datasource?.field?.title (TextField) // optional; omit in UI if design has no title
```

2. **Visual fragment** extracted from the parent (nav/ul/li/link classes only) — not the full parent TSX.
3. Instruction to use Content SDK `<Link field={…} />` (and optional `<Text>` for title); editing-safe empty states.

## Definition rules

- `datasourceLocation` / `content.location`: `{ root: 'data', folder: ['Link Lists'] }`
- Shared data architecture: `itemTemplate.name: 'Link List'` + `folderTemplate.name: 'Link List Folder'` (+ child `Link`) may be reused across LinkList packages. Do **not** invent unique template names just because the TSX/display differs.
- Unique Project rendering: each LinkList package still needs its own `componentName` / `definitionKey` / `displayName` (e.g. `MenzisFooterQuickLinkList` vs `MenzisFooterAccountLinkList`). Apply derives the rendering Path leaf from `componentName` — different displays must not share a rendering.
- `content.items`: one Link List group (`name` / optional `Title`) + `children: [{ name, fields: { Link: { text, url } } }, …]`
- `placeholders: []`
- Nested Link row template: `model.childItemTemplate` as a **sibling** of `itemTemplate` (name `'Link'`, General Link field). **Never** `itemTemplate.children: { itemTemplate: … }` (not in DataItemTemplateDef — TS2353).
- Emit applies JSS LinkList Json Rendering fields (ComponentQuery, branch Datasource Template, templatename Datasource Location, Parameters Template `{33C9207E-…}`, Page Editor Buttons, empty Contents Resolver).

## TSX rules

- Guard optional links: `{item.field?.link ? <Link field={item.field.link} /> : null}` (never bare `field={item.fields?.Link}`).
- `aria-label` / DOM strings: `typeof title?.value === 'string' ? title.value : undefined` (never raw `title?.value`).

## Forbidden

- Multi-LineText JSON `{ text, url }[]` on the parent for this list
- `content.linkLists` dual-write sidecar
- N× single-link child renderings for the same slot
- Nested mega-menu JSON as Link Lists
- `itemTemplate.children` / non-empty `placeholders` on the LinkList package itself
- Copying the parent host's `placeholders` array onto this LinkList package
- Putting this package's own `definitionKey` in any `allowedControls` (self-nest)
