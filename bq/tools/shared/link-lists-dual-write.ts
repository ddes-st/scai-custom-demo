/**
 * Dual-write helpers: flat JSON `{ text, url }[]` bags → platform Link Lists.
 * Nested mega-menu JSON (columns / nested links) is never synthesized.
 */
import type {
  ComponentContentItemDef,
  ComponentContentLinkListDef,
  ComponentContentSeed,
  DataFieldValue,
  DataLinkValue,
} from "../definitions/types";
import type { PlatformLinkListItemDef } from "./platform-link-list";
import { isLinkListsFolder } from "./platform-link-list";

/** Row keys that mark nested mega-menu / non-flat bags — never dual-write. */
const NESTED_BAG_KEYS = [
  "columns",
  "Columns",
  "items",
  "Items",
  "children",
  "Children",
  "links",
  "Links",
  "groups",
  "Groups",
] as const;

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/**
 * True when a parsed row is a flat link object ({ text|Text, url|href|… })
 * without nested link/column collections.
 */
export function isFlatLinkBagRow(row: unknown): boolean {
  const obj = asObject(row);
  if (!obj) return false;
  for (const key of NESTED_BAG_KEYS) {
    if (Array.isArray(obj[key])) return false;
  }
  const text = obj.text ?? obj.Text ?? obj.label ?? obj.Label;
  const url = obj.url ?? obj.href ?? obj.Url ?? obj.Href;
  return (
    (typeof text === "string" || typeof text === "number") &&
    typeof url === "string" &&
    url.trim().length > 0
  );
}

/**
 * True when value is a flat array of `{ text, url }` rows (not mega-menu).
 */
export function isFlatLinkBagArray(value: unknown): value is Array<Record<string, unknown>> {
  if (!Array.isArray(value) || value.length === 0) return false;
  // Every row must be flat link-shaped; one nested row rejects the whole bag.
  return value.every((row) => isFlatLinkBagRow(row));
}

/**
 * Parse a field seed into a flat link bag, or null when nested / not a bag.
 */
export function parseFlatLinkBagSeed(
  raw: DataFieldValue | unknown,
): Array<{ text: string; url: string; target?: string }> | null {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t || t[0] !== "[") return null;
    try {
      parsed = JSON.parse(t);
    } catch {
      return null;
    }
  }
  if (!isFlatLinkBagArray(parsed)) return null;
  return parsed.map((row) => {
    const text = String(row.text ?? row.Text ?? row.label ?? row.Label ?? "").trim();
    const url = String(row.url ?? row.href ?? row.Url ?? row.Href ?? "").trim();
    const target =
      typeof row.target === "string"
        ? row.target
        : typeof row.Target === "string"
          ? row.Target
          : undefined;
    return target ? { text, url, target } : { text, url };
  });
}

function linkNameFromText(text: string, url: string, index: number): string {
  const fromText = text.trim();
  if (fromText) return fromText;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host) return host;
  } catch {
    /* ignore */
  }
  return `Link ${index + 1}`;
}

/**
 * Build one dual-write list from a field name + flat bag rows.
 */
export function linkListFromFlatBag(
  fieldName: string,
  rows: Array<{ text: string; url: string; target?: string }>,
): ComponentContentLinkListDef {
  return {
    name: fieldName,
    title: fieldName,
    sourceField: fieldName,
    links: rows.map((row, index) => {
      const link: DataLinkValue = row.target
        ? { text: row.text, url: row.url, target: row.target }
        : { text: row.text, url: row.url };
      return {
        name: linkNameFromText(row.text, row.url, index),
        link,
      };
    }),
  };
}

/**
 * Scan item field bags for flat JSON link arrays → linkLists sidecar entries.
 * Skips nested mega-menu shapes (e.g. Categories with `items[]`).
 */
export function synthesizeLinkListsFromItems(
  items: ComponentContentItemDef[] | undefined | null,
): ComponentContentLinkListDef[] {
  if (!items?.length) return [];
  /** @type {Map<string, ComponentContentLinkListDef>} */
  const byName = new Map<string, ComponentContentLinkListDef>();

  const visitFields = (fields: Record<string, DataFieldValue> | undefined) => {
    if (!fields) return;
    for (const [fieldName, value] of Object.entries(fields)) {
      const rows = parseFlatLinkBagSeed(value);
      if (!rows?.length) continue;
      // First wins when the same field name appears on multiple items.
      if (byName.has(fieldName)) continue;
      byName.set(fieldName, linkListFromFlatBag(fieldName, rows));
    }
  };

  const walk = (nodes: ComponentContentItemDef[]) => {
    for (const node of nodes) {
      visitFields(node.fields);
      if (node.versions?.length) {
        for (const ver of node.versions) {
          visitFields(ver.fields);
        }
      }
      if (node.children?.length) walk(node.children);
    }
  };

  walk(items);
  return [...byName.values()];
}

/**
 * Resolve dual-write lists: explicit `content.linkLists` wins; otherwise
 * synthesize from flat Multi-Line JSON bags on `items`.
 */
export function resolveLinkListsForDualWrite(
  content: Pick<ComponentContentSeed, "linkLists" | "items" | "location">,
): ComponentContentLinkListDef[] {
  // Primary platform Link Lists packages already emit via applyPlatformLinkListTree.
  if (isLinkListsFolder(content.location?.folder)) return [];

  const explicit = Array.isArray(content.linkLists) ? content.linkLists : [];
  const cleanedExplicit = explicit.filter(
    (list) =>
      list &&
      typeof list.name === "string" &&
      list.name.trim() &&
      Array.isArray(list.links) &&
      list.links.length > 0,
  );
  if (cleanedExplicit.length) return cleanedExplicit;

  return synthesizeLinkListsFromItems(content.items);
}

/**
 * Map dual-write sidecar → platform tree shape for `applyPlatformLinkListTree`.
 */
export function toPlatformLinkListItems(
  linkLists: ComponentContentLinkListDef[],
): PlatformLinkListItemDef[] {
  return linkLists.map((list) => ({
    name: list.name,
    fields: {
      Title: list.title?.trim() ? list.title : list.name,
    },
    children: list.links.map((entry) => ({
      name: entry.name,
      fields: {
        Link: entry.link,
      },
    })),
  }));
}
