/**
 * Resolve content-item Sitecore paths / ids for presentation emit (s:ds).
 * Matches content emit: spaced Data folders + English Path item names.
 * Lookup is CM/Authoring only (no YAML disk walk).
 */
import {
  normalizeDataFolderSegments,
  proposeValidItemName,
  toSpacedItemName,
} from "../../shared/naming";
import { resolveEnglishItemName } from "../../shared/english-item-name";
import { resolveItemIdByPath } from "../../shared/resolve-item-id-by-path";
import { resolveComponentDatasourceLocation } from "./component-to-rendering";
import type {
  ComponentTemplateDefinition,
  RenderingDefinition,
} from "../types";

export type ContentDefForDatasource =
  | ComponentTemplateDefinition
  | RenderingDefinition;

/**
 * Collapse for fuzzy compare: lowercase, strip diacritics, keep alnum only.
 * Treats "website" as "site" so translator Site→Website folder drift still matches.
 */
export function normalizeItemNameKey(name: string): string {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/website/g, "site")
    .replace(/[^a-z0-9]+/g, "");
}

/** Strip straight/curly apostrophes from a display name. */
export function stripItemNameApostrophes(name: string): string {
  return String(name || "").replace(/['\u2019\u2018`´]/g, "");
}

/**
 * Name variants for DS path lookup (apostrophe truncation / Sitecore sanitization).
 * e.g. "Thema's" → Themas; stale "Thema" still pairs with Themas via key+'s' fuzzy.
 */
export function datasourceItemNameCandidates(itemName: string): string[] {
  const raw = String(itemName || "").trim();
  if (!raw) return [];
  const bare = stripItemNameApostrophes(raw).trim();
  const out = [
    raw,
    bare,
    proposeValidItemName(raw, raw),
    bare ? proposeValidItemName(bare, bare) : "",
  ];
  return [...new Set(out.filter(Boolean))];
}

/**
 * True when two item-name keys are the same or differ only by a trailing plural "s"
 * (Thema ↔ Themas from seed Thema's).
 */
export function itemNameKeysRelated(a: string, b: string): boolean {
  const ka = normalizeItemNameKey(a);
  const kb = normalizeItemNameKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  return ka + "s" === kb || kb + "s" === ka;
}

/**
 * Strip trailing " Folder" / plural "s" from folder template display names.
 */
export function folderStemFromTemplateName(raw: string): string {
  let s = toSpacedItemName(String(raw || "").trim());
  s = s.replace(/\s+Folder$/i, "").trim();
  return s;
}

/**
 * Candidate folder segment arrays under Data/Home for a component def.
 */
export function collectDatasourceFolderCandidates(
  def: ContentDefForDatasource,
): string[][] {
  /** @type {string[][]} */
  const out: string[][] = [];
  const seen = new Set<string>();

  const push = (folder: string[] | undefined | null) => {
    const norm = normalizeDataFolderSegments(folder);
    if (!norm?.length) return;
    const key = norm.join("/").toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(norm);
  };

  if (def.content?.location?.folder) {
    push(def.content.location.folder);
  }
  if (def.kind === "component") {
    const ds = resolveComponentDatasourceLocation(def);
    push(ds.folder);
  } else if (def.datasourceLocation?.folder) {
    push(def.datasourceLocation.folder);
  }

  const folderTpl =
    def.kind === "component"
      ? def.model?.folderTemplate?.name
      : undefined;
  if (folderTpl) {
    const stem = folderStemFromTemplateName(folderTpl);
    if (stem) push([stem]);
    // Plural sibling (… Contents) often left from older emits
    if (stem && !/s$/i.test(stem)) push([`${stem}s`]);
  }

  return out;
}

/**
 * Englishize folder segments the same way as content emit (`ensureFolderChain`).
 * Keeps already-English structural keys stable; still adds raw spaced candidates.
 */
export async function englishizeDatasourceFolderCandidates(
  folderCandidates: string[][],
  sourceLanguage: string | null | undefined,
): Promise<string[][]> {
  const out: string[][] = [];
  const seen = new Set<string>();
  const push = (folder: string[]) => {
    if (!folder.length) return;
    const key = folder.join("/").toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(folder);
  };

  for (const folder of folderCandidates) {
    push(folder);
    const english: string[] = [];
    for (const seg of folder) {
      english.push(
        await resolveEnglishItemName(seg, {
          sourceLanguage: sourceLanguage || "nl-BE",
          structuralFolder: true,
        }),
      );
    }
    push(english);
  }
  return out;
}

export type ResolveDatasourceByPathResult = {
  sitecorePath: string;
  itemId: string;
  folderUsed: string;
  itemNameUsed: string;
};

/** Site context (system names) used to build `/sitecore/content/{collection}/{site}/…` paths. */
export type DatasourceSiteContext = {
  collectionSystem: string;
  siteSystem: string;
};

export type DatasourceCmLookupOptions = {
  endpointName?: string;
  lookupPath?: (sitecorePath: string) => Promise<string | undefined>;
  skipCm?: boolean;
};

/**
 * Resolved folder candidates + English item-name candidates for a presentation
 * datasource (shared by path building and failure messages).
 */
async function resolveDatasourceLookupPlan(opts: {
  def: ContentDefForDatasource;
  datasourceItem?: string | null;
  englishItemNameHint?: string | null;
}): Promise<{
  rootSegment: "Home" | "Data";
  folderCandidates: string[][];
  itemNames: string[];
} | null> {
  const { def } = opts;
  const location = resolveContentLocation(def);
  if (!location) return null;

  const itemName =
    String(opts.datasourceItem || "").trim() ||
    def.content?.items?.[0]?.name ||
    def.content?.versions?.[0]?.items?.[0]?.name ||
    "";
  if (!itemName) return null;

  const sourceCulture =
    (def.content && "culture" in def.content
      ? String(def.content.culture || "").trim()
      : "") || "nl-BE";

  const rawFolders = collectDatasourceFolderCandidates(def);
  const baseFolders = rawFolders.length
    ? rawFolders
    : [normalizeDataFolderSegments(location.folder) || []].filter(
        (f) => f.length,
      );
  const folderCandidates = await englishizeDatasourceFolderCandidates(
    baseFolders,
    sourceCulture,
  );

  const nameCandidates: string[] = [...datasourceItemNameCandidates(itemName)];
  if (opts.englishItemNameHint) {
    nameCandidates.push(
      ...datasourceItemNameCandidates(String(opts.englishItemNameHint).trim()),
    );
  } else {
    try {
      const english = await resolveEnglishItemName(itemName, {
        sourceLanguage: sourceCulture,
      });
      if (english) {
        nameCandidates.push(...datasourceItemNameCandidates(english));
      }
    } catch {
      /* translate optional for lookup */
    }
  }

  const itemNames = [...new Set(nameCandidates.filter(Boolean))];
  if (!itemNames.length) return null;

  return {
    rootSegment: location.root === "home" ? "Home" : "Data",
    folderCandidates,
    itemNames,
  };
}

/** Sitecore paths tried (in order) for a datasource item. */
export function buildDatasourceCandidatePaths(opts: {
  collectionSystem: string;
  siteSystem: string;
  rootSegment: "Home" | "Data";
  folderCandidates: string[][];
  itemNames: string[];
}): Array<{ sitecorePath: string; folderUsed: string; itemName: string }> {
  const siteRoot = `/sitecore/content/${opts.collectionSystem}/${opts.siteSystem}`;
  const out: Array<{
    sitecorePath: string;
    folderUsed: string;
    itemName: string;
  }> = [];
  const seen = new Set<string>();
  for (const folder of opts.folderCandidates) {
    if (!folder.length) continue;
    const folderPath = `${siteRoot}/${opts.rootSegment}/${folder.join("/")}`;
    for (const itemName of opts.itemNames) {
      const sitecorePath = `${folderPath}/${itemName}`;
      const key = sitecorePath.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ sitecorePath, folderUsed: folderPath, itemName });
    }
  }
  return out;
}

/**
 * Find a presentation datasource item id by Sitecore path (CM / in-run cache).
 * Returns null only when there is no item name to resolve or no candidate path exists in CM.
 */
export async function resolveDatasourceByPath(
  opts: DatasourceSiteContext &
    DatasourceCmLookupOptions & {
      def: ContentDefForDatasource;
      datasourceItem?: string | null;
      /** Test hook: skip translateText and use this English Path name. */
      englishItemNameHint?: string | null;
    },
): Promise<ResolveDatasourceByPathResult | null> {
  const plan = await resolveDatasourceLookupPlan(opts);
  if (!plan) return null;

  const candidates = buildDatasourceCandidatePaths({
    collectionSystem: opts.collectionSystem,
    siteSystem: opts.siteSystem,
    rootSegment: plan.rootSegment,
    folderCandidates: plan.folderCandidates,
    itemNames: plan.itemNames,
  });

  for (const candidate of candidates) {
    const resolved = await resolveItemIdByPath({
      sitecorePath: candidate.sitecorePath,
      endpointName: opts.endpointName,
      lookupPath: opts.lookupPath,
      skipCm: opts.skipCm,
      logPrefix: "[bq:apply:site-presentation]",
    });
    if (!resolved.found) continue;
    return {
      sitecorePath: candidate.sitecorePath,
      itemId: resolved.id,
      folderUsed: candidate.folderUsed,
      itemNameUsed: candidate.itemName,
    };
  }

  return null;
}

/**
 * Describe lookup failure for hard-fail messages (cites Sitecore paths, not disk).
 */
export function formatDatasourceLookupFailure(opts: {
  definitionKey: string;
  itemName: string;
  collectionSystem: string;
  siteSystem: string;
  def: ContentDefForDatasource;
}): string {
  const folders = collectDatasourceFolderCandidates(opts.def)
    .map((f) => f.join("/"))
    .join(", ");
  const location = resolveContentLocation(opts.def);
  const rootSegment = location?.root === "home" ? "Home" : "Data";
  const siteRoot = `/sitecore/content/${opts.collectionSystem}/${opts.siteSystem}`;
  return (
    `[bq:apply:site-presentation] no datasource item for "${opts.definitionKey}" ` +
    `item "${opts.itemName}" at Sitecore path ${siteRoot}/${rootSegment}/… ` +
    `(tried folders: ${folders || "(none)"}) — refusing to omit s:ds`
  );
}

export function resolveContentLocation(
  def: ContentDefForDatasource,
): { root: "data" | "home"; folder?: string[] } | null {
  if (def.content?.location) {
    return {
      root: def.content.location.root,
      folder: def.content.location.folder,
    };
  }
  if (def.kind === "component") {
    const ds = resolveComponentDatasourceLocation(def);
    return { root: ds.root, folder: ds.folder };
  }
  if (def.datasourceLocation) {
    return {
      root: def.datasourceLocation.root,
      folder: def.datasourceLocation.folder,
    };
  }
  return null;
}

/**
 * True when emit must bind a datasource (explicit item or content seeds).
 */
export function expectsDatasource(
  def: ContentDefForDatasource | undefined,
  datasourceItem?: string | null,
): boolean {
  if (String(datasourceItem || "").trim()) return true;
  if (!def || (def.kind !== "component" && def.kind !== "rendering")) {
    return false;
  }
  const items = def.content?.items || def.content?.versions?.[0]?.items;
  return Array.isArray(items) && items.length > 0;
}
