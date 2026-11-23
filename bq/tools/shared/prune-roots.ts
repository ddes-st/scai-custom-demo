import path from "node:path";
import {
  definitionKeyFromRef,
  isDefinitionKeyRef,
  isInlineVariantsList,
  isSitecoreGuidRef,
  isSitecorePathRef,
} from "./definition-ref";
import {
  DEFAULT_VALIDATOR_FOLDER,
  FIELD_RULES_DISK_ROOT,
} from "./field-validators";
import {
  getEnumerationScope,
  getDictionaryScope,
  resolveDictionaryFolder,
  resolveEnumerationFolder,
  ENUMERATION_SYSTEM_DISK_ROOT,
  getScope,
} from "./scopes";
import {
  DEFAULT_PROJECT_COLLECTION,
  getProjectRenderingsDiskDir,
  getProjectTemplatesDiskRoot,
  getScaffoldingActionsDiskRoot,
  getScaffoldingRulesDiskDir,
  getSaiModuleDiskRoot,
  getSiteContentDiskRoot,
  resolveDataPlacement,
} from "./data-placement";
import { resolveContentSiteContext } from "./content-site-context";
import { pluralComponentName } from "./naming";
import {
  getHeadlessVariantsDiskDir,
  resolveHeadlessVariantsPaths,
} from "../definitions/apply/variants";
import { getVariantsDefinition } from "./variants-registry";
import type { DataPlacement, Definition } from "../definitions/types";
import { getCollectionPruneRoots } from "../definitions/apply/collection";
import { getSitePruneRoots } from "../definitions/apply/site";
import { toItemSystemName } from "../definitions/blueprints/clone-blueprint";

const DEFAULT_COLLECTION = DEFAULT_PROJECT_COLLECTION;
const DEFAULT_SITE_NAME = "bq-demo";

function mediaLibraryFolderRoot(
  collectionSystem: string,
  folderSegments: string[],
): string {
  return path.join(
    getSaiModuleDiskRoot(),
    "media-library",
    "Project",
    collectionSystem,
    DEFAULT_SITE_NAME,
    ...folderSegments,
  );
}

/**
 * Content + media prune roots for a definition with `content.location`.
 * When site Data.yml / Home.yml is missing (greenfield recreate before ser pull),
 * skip the content disk root but still include the media-library folder root.
 */
function contentPlacementPruneRoots(
  collection: string,
  def: {
    content?: { location: DataPlacement };
    siteSystem?: string;
  },
): string[] {
  if (!def.content) return [];
  const folder = def.content.location.folder ?? [];
  const mediaRoot = mediaLibraryFolderRoot(collection, folder);
  try {
    const siteContext = resolveContentSiteContext(collection, {
      siteSystemHint: def.siteSystem,
    });
    const placement = resolveDataPlacement(def.content.location, siteContext);
    return [path.join(placement.diskRoot, ...folder), mediaRoot];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Missing (Data|Home)\.yml under /i.test(msg)) {
      return [mediaRoot];
    }
    throw err;
  }
}

function mediaLibraryCollectionRoot(collectionSystem: string): string {
  return path.join(
    getSaiModuleDiskRoot(),
    "media-library",
    "Project",
    collectionSystem,
  );
}

function headlessVariantsPruneRoots(
  componentName: string,
  options?: { collectionSystem?: string; siteSystem?: string },
): string[] {
  const name = componentName.trim();
  if (!name) return [];
  const dirs = new Set<string>();
  dirs.add(getHeadlessVariantsDiskDir());
  if (options?.collectionSystem) {
    try {
      const roots = resolveHeadlessVariantsPaths({
        collectionSystem: options.collectionSystem,
        siteSystem: options.siteSystem,
      });
      dirs.add(roots.diskDir);
    } catch {
      // Site unresolved — keep legacy scope only.
    }
  }
  const out: string[] = [];
  for (const variantsDir of dirs) {
    out.push(path.join(variantsDir, `${name}.yml`), path.join(variantsDir, name));
  }
  return out;
}

/**
 * Resolve the Headless Variants folder name for a rendering/component that
 * declares inline `variants` and/or `variants: { definitionKey }`.
 */
function resolveVariantsComponentName(definition: {
  componentName?: string;
  name?: string;
  variants?:
    | Array<{ name: string }>
    | { definitionKey: string }
    | { path: string }
    | { guid: string };
}): string | undefined {
  if (isDefinitionKeyRef(definition.variants)) {
    const fromRegistry = getVariantsDefinition(
      definitionKeyFromRef(definition.variants),
    );
    if (fromRegistry?.componentName?.trim()) {
      return fromRegistry.componentName.trim();
    }
  }
  if (isSitecorePathRef(definition.variants) || isSitecoreGuidRef(definition.variants)) {
    return (
      definition.componentName?.trim() ||
      definition.name?.trim() ||
      undefined
    );
  }
  if (isInlineVariantsList(definition.variants) && definition.variants.length) {
    return (
      definition.componentName?.trim() ||
      definition.name?.trim() ||
      undefined
    );
  }
  return undefined;
}

/** Disk paths safe to prune after a definition emit (scoped, never whole sai/). */
export function getDefinitionPruneRoots(definition: Definition): string[] {
  switch (definition.kind) {
    case "data": {
      const collection = definition.collectionSystem ?? DEFAULT_COLLECTION;
      const templatesRoot = getProjectTemplatesDiskRoot(collection);
      const placement = resolveDataPlacement(definition.location);
      const contentDir = path.join(
        placement.diskRoot,
        ...(definition.location.folder ?? []),
      );
      const mediaDir = mediaLibraryFolderRoot(
        collection,
        definition.location.folder ?? [],
      );
      return [
        path.join(templatesRoot, `${definition.name}.yml`),
        path.join(templatesRoot, definition.name),
        contentDir,
        mediaDir,
      ];
    }

    case "enumeration": {
      const scope = getEnumerationScope(definition.location.scope);
      const folder = resolveEnumerationFolder(
        definition.location.scope,
        definition.location.folder ?? [],
      );
      const diskDir =
        definition.location.scope === "system"
          ? path.join(ENUMERATION_SYSTEM_DISK_ROOT, ...folder)
          : path.join(scope.diskRoot, ...folder);
      return [
        path.join(diskDir, `${definition.name}.yml`),
        path.join(diskDir, definition.name),
      ];
    }

    case "dictionary": {
      const scope = getDictionaryScope(definition.location.scope);
      const folder = resolveDictionaryFolder(
        definition.location.scope,
        definition.location.folder ?? [],
      );
      const diskDir = path.join(scope.diskRoot, ...folder);
      return [diskDir];
    }

    case "field-validator": {
      const folder = definition.folder?.trim() || DEFAULT_VALIDATOR_FOLDER;
      return [
        path.join(FIELD_RULES_DISK_ROOT, folder, `${definition.name}.yml`),
      ];
    }

    case "parameters": {
      const collection = definition.collectionSystem ?? DEFAULT_COLLECTION;
      const branchName = definition.name;
      const parametersName = `${branchName} Parameters`;
      const templatesRoot = getProjectTemplatesDiskRoot(collection);
      return [
        path.join(templatesRoot, branchName, `${parametersName}.yml`),
        path.join(templatesRoot, branchName, parametersName),
        mediaLibraryFolderRoot(collection, [branchName, parametersName]),
      ];
    }

    case "media": {
      const collection =
        definition.location?.collectionSystem ??
        definition.collectionSystem ??
        DEFAULT_COLLECTION;
      const folder = definition.location?.folder ?? [];
      return [
        path.join(
          mediaLibraryFolderRoot(collection, folder),
          `${definition.name}.yml`,
        ),
      ];
    }

    case "variants": {
      return headlessVariantsPruneRoots(definition.componentName);
    }

    case "rendering": {
      const def = definition;
      const collection = def.collectionSystem ?? DEFAULT_COLLECTION;
      const branchName = def.name;
      const plural = pluralComponentName(branchName);
      const templatesRoot = getProjectTemplatesDiskRoot(collection);
      const roots = [
        path.join(templatesRoot, `${branchName}.yml`),
        path.join(templatesRoot, branchName),
        path.join(getProjectRenderingsDiskDir(collection), `${branchName}.yml`),
        path.join(
          getScaffoldingRulesDiskDir(collection),
          `Add ${plural} Data Item.yml`,
        ),
        // >>> BEGIN BQ_ORPHAN_PRUNE_PLAN
        path.join(
          getSaiModuleDiskRoot(),
          "layout",
          "Project",
          collection,
        ),
        // <<< END BQ_ORPHAN_PRUNE_PLAN
      ];
      roots.push(
        ...contentPlacementPruneRoots(collection, {
          content: def.content,
          siteSystem:
            "siteSystem" in def
              ? (def as { siteSystem?: string }).siteSystem
              : undefined,
        }),
      );
      const variantsName = resolveVariantsComponentName(def);
      if (variantsName) {
        roots.push(
          ...headlessVariantsPruneRoots(variantsName, {
            collectionSystem: collection,
            siteSystem:
              "siteSystem" in def
                ? (def as { siteSystem?: string }).siteSystem
                : undefined,
          }),
        );
      }
      return roots;
    }

    case "component": {
      const def = definition;
      const collection = def.collectionSystem ?? DEFAULT_COLLECTION;
      const componentName = def.componentName || def.displayName || def.name;
      const branchName = componentName;
      const plural = pluralComponentName(branchName);
      const templatesRoot = getProjectTemplatesDiskRoot(collection);
      const roots = [
        path.join(templatesRoot, `${branchName}.yml`),
        path.join(templatesRoot, branchName),
        path.join(getProjectRenderingsDiskDir(collection), `${branchName}.yml`),
        path.join(
          getScaffoldingRulesDiskDir(collection),
          `Add ${plural} Data Item.yml`,
        ),
        path.join(templatesRoot, `${componentName} Templates.yml`),
        path.join(templatesRoot, `${componentName} Templates`),
        // >>> BEGIN BQ_ORPHAN_PRUNE_PLAN
        path.join(
          getSaiModuleDiskRoot(),
          "layout",
          "Project",
          collection,
        ),
        // <<< END BQ_ORPHAN_PRUNE_PLAN
      ];
      roots.push(
        ...contentPlacementPruneRoots(collection, {
          content: def.content,
          siteSystem:
            "siteSystem" in def
              ? (def as { siteSystem?: string }).siteSystem
              : undefined,
        }),
      );
      const variantsName = resolveVariantsComponentName({
        ...def,
        name: componentName,
      });
      if (variantsName) {
        roots.push(
          ...headlessVariantsPruneRoots(variantsName, {
            collectionSystem: collection,
            siteSystem: def.siteSystem,
          }),
        );
      }
      return roots;
    }

    case "collection":
      return getCollectionPruneRoots(definition);

    case "site":
      return getSitePruneRoots(definition);

    default:
      return [];
  }
}

function collectionSystemsFromDefinitions(
  definitions: readonly Definition[],
): Set<string> {
  const out = new Set<string>();
  for (const def of definitions) {
    if (def.kind === "collection") {
      out.add(
        (def.systemName?.trim() || toItemSystemName(def.name)).toLowerCase(),
      );
      continue;
    }
    if (def.kind === "site") {
      const c =
        def.collectionSystem?.trim() ||
        def.collection?.systemName?.trim() ||
        (def.collection?.name
          ? toItemSystemName(def.collection.name)
          : undefined);
      if (c) out.add(c.toLowerCase());
      continue;
    }
    if ("collectionSystem" in def && def.collectionSystem) {
      out.add(String(def.collectionSystem).trim().toLowerCase());
    }
    if (def.kind === "media" && def.location?.collectionSystem) {
      out.add(def.location.collectionSystem.trim().toLowerCase());
    }
  }
  if (out.size === 0) {
    out.add(DEFAULT_COLLECTION.toLowerCase());
  }
  return out;
}

function resolveCollectionCasing(
  definitions: readonly Definition[],
  collectionLower: string,
): string {
  for (const d of definitions) {
    if (d.kind === "collection") {
      const name = d.systemName?.trim() || toItemSystemName(d.name);
      if (name.toLowerCase() === collectionLower) return name;
    }
    if ("collectionSystem" in d && d.collectionSystem) {
      const name = String(d.collectionSystem).trim();
      if (name.toLowerCase() === collectionLower) return name;
    }
  }
  return collectionLower;
}

function sitePairsFromDefinitions(
  definitions: readonly Definition[],
): Array<{ collectionSystem: string; siteSystem: string }> {
  const pairs = new Map<string, { collectionSystem: string; siteSystem: string }>();

  const add = (collectionSystem: string, siteSystem: string) => {
    const c = collectionSystem.trim();
    const s = siteSystem.trim();
    if (!c || !s) return;
    pairs.set(`${c.toLowerCase()}::${s.toLowerCase()}`, {
      collectionSystem: c,
      siteSystem: s,
    });
  };

  for (const def of definitions) {
    if (def.kind === "site") {
      const collection =
        def.collectionSystem?.trim() ||
        def.collection?.systemName?.trim() ||
        (def.collection?.name
          ? toItemSystemName(def.collection.name)
          : DEFAULT_COLLECTION);
      const site = def.systemName?.trim() || toItemSystemName(def.name);
      add(collection, site);
      continue;
    }
    if (
      (def.kind === "component" || def.kind === "rendering") &&
      def.collectionSystem &&
      def.collectionSystem !== DEFAULT_COLLECTION
    ) {
      add(def.collectionSystem, def.collectionSystem);
    }
    if (def.kind === "site-presentation") {
      add(def.collectionSystem, def.siteSystem);
    }
    if (def.kind === "page-stub" || def.kind === "page") {
      add(def.collectionSystem, def.siteSystem);
    }
  }

  if (
    [...collectionSystemsFromDefinitions(definitions)].some(
      (c) => c === DEFAULT_COLLECTION.toLowerCase(),
    )
  ) {
    add(DEFAULT_COLLECTION, DEFAULT_SITE_NAME);
  }

  return [...pairs.values()];
}

/**
 * Broad disk roots for a definitions:generate run (snapshot + run-level prune).
 * Covers whole collection/site trees BQ may write so renamed orphans are still
 * in the snapshot. Excludes Sites API identity trees (empty prune roots).
 */
export function getRunEmitRoots(definitions: readonly Definition[]): string[] {
  const roots = new Set<string>();
  const collections = collectionSystemsFromDefinitions(definitions);

  for (const collectionLower of collections) {
    const name = resolveCollectionCasing(definitions, collectionLower);
    roots.add(getProjectTemplatesDiskRoot(name));
    roots.add(getProjectRenderingsDiskDir(name));
    roots.add(getScaffoldingActionsDiskRoot(name));
    roots.add(mediaLibraryCollectionRoot(name));
  }

  for (const { collectionSystem, siteSystem } of sitePairsFromDefinitions(
    definitions,
  )) {
    if (
      collectionSystem === DEFAULT_COLLECTION &&
      siteSystem === DEFAULT_SITE_NAME
    ) {
      roots.add(getScope("site").diskRoot);
    }
    roots.add(getSiteContentDiskRoot(collectionSystem, siteSystem));
  }

  roots.add(getHeadlessVariantsDiskDir());
  roots.add(FIELD_RULES_DISK_ROOT);

  const hasEnum = definitions.some((d) => d.kind === "enumeration");
  const hasDict = definitions.some((d) => d.kind === "dictionary");
  if (hasEnum) {
    roots.add(ENUMERATION_SYSTEM_DISK_ROOT);
    roots.add(getEnumerationScope("project").diskRoot);
  }
  if (hasDict) {
    roots.add(getDictionaryScope("site").diskRoot);
  }

  return [...roots];
}
