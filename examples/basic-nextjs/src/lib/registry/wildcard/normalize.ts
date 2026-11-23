import type { WildcardItemRaw } from "components/lib/registry/wildcard/queries";

/**
 * Flat field map for a resolved wildcard item: field name →
 * layout-service-shaped value. Values pass straight into the registry
 * editables (`TextSource` / `ImageSource` / `RichTextSource`); use
 * {@link normalizeReferenceField} for reference-shaped values.
 */
export type WildcardFieldMap = Record<string, unknown>;

/** Resolved wildcard item with its fields flattened into a map. */
export interface WildcardItem {
  id?: string;
  name?: string;
  displayName?: string;
  templateName?: string;
  /** Canonical route path of the resolved item, when it has one. */
  urlPath?: string;
  fields: WildcardFieldMap;
}

/**
 * One referenced item, normalized from either an Edge `jsonValue`
 * reference entry or a Layout-Service linked item.
 */
export interface WildcardLinkedItem {
  id?: string;
  name?: string;
  displayName?: string;
  /** Route path/href of the referenced item, when the source carried one. */
  url?: string;
  /** The referenced item's immediate fields (layout-service-shaped values). */
  fields: WildcardFieldMap;
}

/** Flatten a raw Edge wildcard item into a {@link WildcardItem}. */
export function normalizeWildcardItem(raw: WildcardItemRaw): WildcardItem {
  const fields: WildcardFieldMap = {};
  for (const entry of raw.fields ?? []) {
    if (!entry?.name) continue;
    fields[entry.name] = entry.jsonValue;
  }
  return {
    id: raw.id,
    name: raw.name,
    displayName: raw.displayName,
    templateName: raw.template?.name,
    urlPath: raw.url?.path,
    fields,
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === "object" && !Array.isArray(value);

const readString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value : undefined;

/**
 * Normalize one referenced-item entry. Handles both source shapes:
 * Edge `jsonValue` (`url` as string or `{ path }`) and Layout-Service
 * `LinkedItem` (`url` usually absent). Returns `null` for anything
 * that doesn't look like an item reference.
 */
const normalizeLinkedEntry = (value: unknown): WildcardLinkedItem | null => {
  if (!isRecord(value)) return null;
  // An item reference carries at least one identity key. A scalar
  // field's jsonValue (`{ value: … }`) has none of these, so it is
  // correctly rejected here rather than misread as a reference.
  const hasIdentity =
    "id" in value || "name" in value || "displayName" in value;
  if (!hasIdentity && !isRecord(value.fields)) return null;

  const url =
    readString(value.url) ??
    (isRecord(value.url) ? readString(value.url.path) : undefined);

  return {
    id: readString(value.id),
    name: readString(value.name),
    displayName: readString(value.displayName),
    url,
    fields: isRecord(value.fields) ? value.fields : {},
  };
};

/**
 * Normalize a reference field's value into a list of linked items.
 *
 * Accepts: an array of item entries (Multilist/Treelist), a single
 * item entry (Droplink), or anything else (→ `[]`). Entries that
 * don't look like item references are dropped — be honest about what
 * `jsonValue` actually contained instead of fabricating cards.
 */
export function normalizeReferenceField(value: unknown): WildcardLinkedItem[] {
  if (Array.isArray(value)) {
    return value
      .map(normalizeLinkedEntry)
      .filter((entry): entry is WildcardLinkedItem => entry !== null);
  }
  const single = normalizeLinkedEntry(value);
  return single ? [single] : [];
}
