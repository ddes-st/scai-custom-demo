/**
 * In-run Sitecore path → itemId cache for Authoring apply.
 * Replaces disk YAML as the ID source during definitions:generate.
 */
import { canonicalItemId } from "./ids";

const pathIdCache = new Map<string, string>();

function pathKey(sitecorePath: string): string {
  return String(sitecorePath || "").trim().toLowerCase();
}

export function clearAuthoringPathCache(): void {
  pathIdCache.clear();
}

export function getCachedAuthoringPathId(
  sitecorePath: string,
): string | undefined {
  const key = pathKey(sitecorePath);
  if (!key) return undefined;
  const id = pathIdCache.get(key);
  return id || undefined;
}

export function cacheAuthoringPathId(
  sitecorePath: string,
  itemId: string,
): string {
  const key = pathKey(sitecorePath);
  const id =
    canonicalItemId(itemId) ||
    String(itemId || "")
      .replace(/[{}]/g, "")
      .trim()
      .toLowerCase();
  if (key && id) pathIdCache.set(key, id);
  return id;
}

export function getAuthoringPathCacheSize(): number {
  return pathIdCache.size;
}
