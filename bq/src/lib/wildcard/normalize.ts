import type { WildcardChildRaw, WildcardItemRaw } from './queries';

export type WildcardFieldMap = Record<string, unknown>;

export interface WildcardItem {
  id?: string;
  name?: string;
  displayName?: string;
  templateName?: string;
  urlPath?: string;
  fields: WildcardFieldMap;
  children?: WildcardLinkedItem[];
}

export interface WildcardLinkedItem {
  id?: string;
  name?: string;
  displayName?: string;
  url?: string;
  fields: WildcardFieldMap;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === 'object' && !Array.isArray(value);

const readString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;

const flattenFields = (entries?: Array<{ name?: string; jsonValue?: unknown }>): WildcardFieldMap => {
  const fields: WildcardFieldMap = {};
  for (const entry of entries ?? []) {
    if (!entry?.name) continue;
    fields[entry.name] = entry.jsonValue;
  }
  return fields;
};

/** Map named GraphQL field aliases onto the flat field map used by components. */
const NAMED_CHILD_FIELDS: Array<{ alias: string; fieldName: string }> = [
  { alias: 'label', fieldName: 'Label' },
  { alias: 'group', fieldName: 'Group' },
  { alias: 'image', fieldName: 'Image' },
  { alias: 'imageUrl', fieldName: 'Image Url' },
  { alias: 'href', fieldName: 'Href' },
  { alias: 'isDefault', fieldName: 'Is Default' },
  { alias: 'title', fieldName: 'Title' },
  { alias: 'tagline', fieldName: 'Tagline' },
  { alias: 'category1', fieldName: 'Category1 Slug' },
];

const flattenChildFields = (child: WildcardChildRaw): WildcardFieldMap => {
  const fields = flattenFields(child.fields);
  for (const { alias, fieldName } of NAMED_CHILD_FIELDS) {
    const named = child[alias as keyof WildcardChildRaw] as { jsonValue?: unknown } | undefined;
    if (named && 'jsonValue' in named && fields[fieldName] === undefined) {
      fields[fieldName] = named.jsonValue;
    }
  }
  return fields;
};

export function normalizeWildcardChildren(results?: WildcardChildRaw[] | null): WildcardLinkedItem[] {
  return (results ?? [])
    .map((child) => {
      const url =
        typeof child.url === 'string'
          ? child.url
          : typeof child.url?.path === 'string'
            ? child.url.path
            : undefined;
      return {
        id: child.id,
        name: child.name,
        displayName: child.displayName,
        url,
        fields: flattenChildFields(child),
      };
    })
    .filter((child) => child.name || child.id);
}

export function normalizeWildcardItem(raw: WildcardItemRaw): WildcardItem {
  const children = normalizeWildcardChildren(raw.children?.results);

  return {
    id: raw.id,
    name: raw.name,
    displayName: raw.displayName,
    templateName: raw.template?.name,
    urlPath: raw.url?.path,
    fields: flattenFields(raw.fields),
    children: children.length ? children : undefined,
  };
}

const normalizeLinkedEntry = (value: unknown): WildcardLinkedItem | null => {
  if (!isRecord(value)) return null;
  const hasIdentity = 'id' in value || 'name' in value || 'displayName' in value;
  if (!hasIdentity && !isRecord(value.fields)) return null;

  const url =
    readString(value.url) ?? (isRecord(value.url) ? readString(value.url.path) : undefined);

  return {
    id: readString(value.id),
    name: readString(value.name),
    displayName: readString(value.displayName),
    url,
    fields: isRecord(value.fields) ? (value.fields as WildcardFieldMap) : {},
  };
};

export function normalizeReferenceField(value: unknown): WildcardLinkedItem[] {
  if (Array.isArray(value)) {
    return value
      .map(normalizeLinkedEntry)
      .filter((entry): entry is WildcardLinkedItem => entry !== null);
  }
  const single = normalizeLinkedEntry(value);
  return single ? [single] : [];
}

export function fieldText(fields: WildcardFieldMap, name: string): string {
  const raw = fields[name];
  if (typeof raw === 'string') return raw;
  if (isRecord(raw) && typeof raw.value === 'string') return raw.value;
  return '';
}

export function fieldImageSrc(fields: WildcardFieldMap, name: string): string {
  const raw = fields[name];
  if (!isRecord(raw)) return '';
  const value = isRecord(raw.value) ? raw.value : raw;
  return typeof value.src === 'string' ? value.src : '';
}

/** First http(s) URL from a multi-line text field (e.g. Gallery Images). */
export function fieldFirstHttpUrl(fields: WildcardFieldMap, name: string): string {
  const raw = fieldText(fields, name);
  if (!raw) return '';
  for (const line of raw.split(/\r?\n/)) {
    const url = line.trim();
    if (/^https?:\/\//i.test(url)) return url;
  }
  return '';
}

/**
 * Prefer CDN text fields (available on Edge without media publish), then Sitecore Image.src.
 * Used by product grids where media Image often has no Edge src yet.
 */
export function fieldPrimaryImageSrc(fields: WildcardFieldMap | undefined): string {
  if (!fields) return '';
  return (
    fieldText(fields, 'Image Url') ||
    fieldImageSrc(fields, 'Image') ||
    fieldFirstHttpUrl(fields, 'Gallery Images') ||
    ''
  );
}
