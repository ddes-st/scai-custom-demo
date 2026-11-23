# Flat link lists — maintainer note

Flat link-list UI regions use **parent AppPlaceholder + LinkList package** under `Data/Link Lists` (JSS LinkList Json Rendering fields). Do **not** seed Multi-LineText JSON `{ text, url }[]` on the parent and do **not** dual-write `content.linkLists`.

Nested mega-menu JSON may still use Multi-LineText bags (FE-only).

**Opt-in composite:** `BQ_LINK_LIST_AS_COMPOSITE=1` models parent + AppPlaceholder + per-link children with `General Link` instead of a LinkList package.

See `prompts/linklist-package-codegen.md` and `JSS_LINK_LIST_RENDERING` in `tools/shared/platform-link-list.ts`.
