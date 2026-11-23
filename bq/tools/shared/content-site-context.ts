import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_PROJECT_COLLECTION,
  getSaiModuleDiskRoot,
  type DataPlacementSiteContext,
} from "./data-placement";
import { parseGenerateScope } from "./generate-scope";
import { COMPONENTS_ROOT } from "./paths";

export type ResolveContentSiteContextHints = {
  /** Prefer this site system name when set (e.g. component.siteSystem). */
  siteSystemHint?: string | null;
};

function normalizeSystem(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

/**
 * Collect `*-site.definition.ts` paths under components (host folders + legacy sites/).
 */
function walkSiteDefinitionFiles(dir: string, out: string[]): void {
  if (!fs.existsSync(dir)) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip deep component packages; site defs sit at host-folder root
      // (or under legacy sites/). Recurse one level for host folders only
      // when scanning COMPONENTS_ROOT.
      if (dir === COMPONENTS_ROOT) {
        walkSiteDefinitionFiles(full, out);
      }
      continue;
    }
    if (
      entry.isFile() &&
      entry.name.endsWith("-site.definition.ts")
    ) {
      out.push(full);
    }
  }
}

/**
 * Sync-scan `*-site.definition.ts` for sites under a collection.
 * Looks in each host folder under `src/components/` and legacy `sites/`.
 */
function listSiteSystemsFromDefinitions(collectionSystem: string): string[] {
  const collection = normalizeSystem(collectionSystem);
  if (!collection) return [];

  const files: string[] = [];
  walkSiteDefinitionFiles(COMPONENTS_ROOT, files);

  const found = new Set<string>();
  for (const full of files) {
    let text: string;
    try {
      text = fs.readFileSync(full, "utf8");
    } catch {
      continue;
    }
    if (!/kind:\s*["']site["']/.test(text)) continue;
    const collMatch = text.match(/collectionSystem:\s*["']([^"']+)["']/);
    const coll = normalizeSystem(collMatch?.[1]);
    if (coll !== collection) continue;
    const sysMatch = text.match(/^\s*systemName:\s*["']([^"']+)["']/m);
    const systemName = normalizeSystem(sysMatch?.[1]);
    if (systemName) found.add(systemName);
  }
  return [...found].sort();
}

/**
 * Sites under `sites/content/{collection}/` that have Data.yml.
 */
function listSiteSystemsFromDisk(collectionSystem: string): string[] {
  const collection = normalizeSystem(collectionSystem);
  if (!collection) return [];
  const collectionRoot = path.join(
    getSaiModuleDiskRoot(),
    "sites",
    "content",
    collection,
  );
  if (!fs.existsSync(collectionRoot)) return [];

  const found: string[] = [];
  for (const entry of fs.readdirSync(collectionRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dataYml = path.join(collectionRoot, entry.name, "Data.yml");
    if (fs.existsSync(dataYml)) found.push(entry.name.toLowerCase());
  }
  return found.sort();
}

function context(
  collectionSystem: string,
  siteSystem: string,
): DataPlacementSiteContext {
  return {
    collectionSystem: normalizeSystem(collectionSystem),
    siteSystem: normalizeSystem(siteSystem),
  };
}

/**
 * Resolve which site content tree to use for a non-default collection.
 *
 * Precedence: component hint → generate `--site` → unique site definition →
 * unique on-disk site with Data.yml. Never silently uses collectionSystem as
 * siteSystem (collection `axa` ≠ site `axa-be`).
 *
 * Returns `undefined` for the default project collection (legacy SCOPES).
 */
export function resolveContentSiteContext(
  collectionSystem: string | null | undefined,
  hints?: ResolveContentSiteContextHints,
): DataPlacementSiteContext | undefined {
  const collection = normalizeSystem(collectionSystem);
  if (!collection || collection === DEFAULT_PROJECT_COLLECTION) {
    return undefined;
  }

  const hint = normalizeSystem(hints?.siteSystemHint);
  if (hint) {
    return context(collection, hint);
  }

  const scope = parseGenerateScope();
  const scopeSite = normalizeSystem(scope.siteSystem);
  if (scopeSite) {
    const scopeCollection = normalizeSystem(scope.collectionSystem);
    if (!scopeCollection || scopeCollection === collection) {
      return context(collection, scopeSite);
    }
  }

  const fromDefs = listSiteSystemsFromDefinitions(collection);
  if (fromDefs.length === 1) {
    return context(collection, fromDefs[0]!);
  }

  const fromDisk = listSiteSystemsFromDisk(collection);
  if (fromDisk.length === 1) {
    return context(collection, fromDisk[0]!);
  }

  const candidates = [...new Set([...fromDefs, ...fromDisk])].sort();
  const candidateMsg =
    candidates.length > 0
      ? ` Candidates: ${candidates.join(", ")}.`
      : " No site definitions or sites/content folders with Data.yml found.";
  throw new Error(
    `[bq:apply:content] Cannot resolve site for collection "${collection}": ` +
      `set component.siteSystem, pass --site / --url / BQ_GENERATE_SITE, ` +
      `or ensure exactly one site under that collection.${candidateMsg}`,
  );
}
