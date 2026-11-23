import { canonicalItemId } from "./ids";
import { proposeValidItemName } from "./naming";

function normalizeId(id: string): string {
  return canonicalItemId(id) || id.replace(/[{}]/g, "").trim().toLowerCase();
}

/**
 * parentId → (itemNameLower → itemId). Tracks siblings claimed this generate run.
 * CM children are discovered via Authoring path apply; disk YAML seeding is retired.
 */
const siblingNamesByParent = new Map<string, Map<string, string>>();

export function clearSiblingItemNameRegistry(): void {
  siblingNamesByParent.clear();
}

function namesForParent(parentId: string): Map<string, string> {
  const key = normalizeId(parentId);
  let map = siblingNamesByParent.get(key);
  if (!map) {
    map = new Map();
    siblingNamesByParent.set(key, map);
  }
  return map;
}

function registerName(
  parentId: string,
  itemName: string,
  itemId: string,
): void {
  namesForParent(parentId).set(
    itemName.trim().toLowerCase(),
    normalizeId(itemId),
  );
}

/** Look up which item ID (if any) already owns `itemName` under `parentId`. */
export function findSiblingIdUnderParent(
  parentId: string,
  itemName: string,
  _siblingDir?: string,
): string | undefined {
  const base = proposeValidItemName(
    itemName,
    itemName.trim() || "unnamed-item",
    { forUrl: false },
  );
  return namesForParent(parentId).get(base.trim().toLowerCase());
}

/**
 * Propose a Sitecore-valid item name that is unique among siblings under `parentId`.
 */
export function proposeUniqueItemNameUnderParent(options: {
  parentId: string;
  itemId: string;
  desiredName: string;
  siblingDir?: string;
  forUrl?: boolean;
  allowCollisionSuffix?: boolean;
}): string {
  const nameOpts = { forUrl: options.forUrl === true };
  const base = proposeValidItemName(
    options.desiredName,
    options.desiredName.trim() || "unnamed-item",
    nameOpts,
  );

  const taken = namesForParent(options.parentId);
  const myId = normalizeId(options.itemId);

  const ownerOf = (name: string): string | undefined =>
    taken.get(name.trim().toLowerCase());

  const claim = (name: string): string => {
    registerName(options.parentId, name, options.itemId);
    return name;
  };

  const existing = ownerOf(base);
  if (!existing || existing === myId) {
    return claim(base);
  }

  if (options.allowCollisionSuffix !== true) {
    console.warn(
      `[item-name] "${base}" under parent ${options.parentId} already owned by ${existing}; ` +
        `emitting item ${myId} will reuse the name (caller should have reused that ID)`,
    );
    return claim(base);
  }

  const stem =
    proposeValidItemName(
      base.replace(/(?:\s*\(\d+\)|-\d+)$/, "").trim() || base,
      base,
      nameOpts,
    ) || base;

  for (let n = 1; n <= 10_000; n += 1) {
    const candidate = proposeValidItemName(
      `${stem}-${n}`,
      `${stem}-${n}`,
      nameOpts,
    );
    const who = ownerOf(candidate);
    if (!who || who === myId) {
      return claim(candidate);
    }
  }

  throw new Error(
    `[item-name] Could not find a unique sibling name under parent ${options.parentId} for "${base}"`,
  );
}

/**
 * Replace the last segment of a Sitecore path with `itemName`.
 */
export function replaceSitecorePathItemName(
  sitecorePath: string,
  itemName: string,
): string {
  const parts = sitecorePath.split("/");
  if (parts.length === 0) return itemName;
  parts[parts.length - 1] = itemName;
  return parts.join("/");
}
