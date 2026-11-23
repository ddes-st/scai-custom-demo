/**
 * On --force component rename: remap CM items from old inventory paths to new
 * Path leaves (renameItem / moveItem), migrate apply-inventory, delete leftovers.
 */
import fs from "node:fs";
import path from "node:path";
import {
  type ApplyInventoryEntry,
  type ApplyInventoryFile,
  applyInventoryPath,
  deleteApplyInventory,
  inferApplyInventoryKind,
  leafNameFromSitecorePath,
  loadApplyInventory,
  saveApplyInventory,
} from "./apply-inventory";
import {
  CM_DELETE_VIA_AUTHORING_API,
  deleteCmItemById,
  formatAuthoringItemId,
} from "./cm-delete-item";
import {
  CM_MOVE_VIA_AUTHORING_API,
  CM_RENAME_VIA_AUTHORING_API,
  moveCmItem,
  renameCmItem,
} from "./cm-rename-move-item";
import { findItemByPath } from "./cm-sibling-lookup";
import { warnCreateVerbose } from "./id-resolve-log";
import { BQ_DEFINITIONS_DIR } from "./paths";
import { PLATFORM_DATA_FOLDER_NAMES, toSpacedItemName } from "./naming";

const CM_DELETE_NOT_FOUND_RE = /was not found|may have been deleted/i;

/** Template-like leftovers delete after content so CM allows template removal. */
function isTemplateLikeLeftover(entry: ApplyInventoryEntry): boolean {
  const kind = String(
    entry.kind || inferApplyInventoryKind(entry.path || ""),
  ).toLowerCase();
  return kind === "template" || kind === "parameters";
}

function pathSegmentCount(sitecorePath: string): number {
  return String(sitecorePath || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean).length;
}

function sortLeftoverDeletesDeepestFirst(
  actions: ForceRenameRemapAction[],
): ForceRenameRemapAction[] {
  return [...actions].sort((a, b) => {
    const aPath = a.type === "leftover-delete" ? a.entry.path || "" : "";
    const bPath = b.type === "leftover-delete" ? b.entry.path || "" : "";
    return pathSegmentCount(bPath) - pathSegmentCount(aPath);
  });
}

/**
 * Remap/keep/skip first; then leftover content/media; then leftover templates
 * (deepest path first so parent templates are last).
 */
export function orderActionsForExecution(
  actions: ForceRenameRemapAction[],
): ForceRenameRemapAction[] {
  const other: ForceRenameRemapAction[] = [];
  const leftoverContent: ForceRenameRemapAction[] = [];
  const leftoverTemplates: ForceRenameRemapAction[] = [];
  for (const action of actions) {
    if (action.type !== "leftover-delete") {
      other.push(action);
      continue;
    }
    if (isTemplateLikeLeftover(action.entry)) leftoverTemplates.push(action);
    else leftoverContent.push(action);
  }
  return [
    ...other,
    ...sortLeftoverDeletesDeepestFirst(leftoverContent),
    ...sortLeftoverDeletesDeepestFirst(leftoverTemplates),
  ];
}

export type ForceRenameRemapAction =
  | {
      type: "rename";
      entry: ApplyInventoryEntry;
      newPath: string;
      newLeaf: string;
    }
  | {
      type: "move";
      entry: ApplyInventoryEntry;
      newPath: string;
      newParentPath: string;
      newLeaf: string;
      renameAfterMove: boolean;
    }
  | {
      type: "keep";
      entry: ApplyInventoryEntry;
      reason: string;
    }
  | {
      type: "leftover-delete";
      entry: ApplyInventoryEntry;
      reason: string;
    }
  | {
      type: "skip-protected";
      entry: ApplyInventoryEntry;
      reason: string;
    }
  | {
      type: "skip-shared";
      entry: ApplyInventoryEntry;
      reason: string;
    };

export type ForceRenameRemapPlan = {
  oldDefinitionKey: string;
  newDefinitionKey: string;
  oldSpaced: string;
  newSpaced: string;
  actions: ForceRenameRemapAction[];
};

function normalizePath(p: string): string {
  return String(p || "")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "")
    .trim();
}

function pathParent(sitecorePath: string): string {
  const n = normalizePath(sitecorePath);
  const idx = n.lastIndexOf("/");
  return idx > 0 ? n.slice(0, idx) : "";
}

function pathDepth(sitecorePath: string): number {
  return normalizePath(sitecorePath).split("/").filter(Boolean).length;
}

/**
 * Escape for case-insensitive RegExp segment match.
 */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replace old spaced component name (and optional kebab key) inside a Sitecore path.
 */
export function substituteComponentPathSegments(
  sitecorePath: string,
  options: {
    oldSpaced: string;
    newSpaced: string;
    oldKebab?: string;
    newKebab?: string;
  },
): string {
  let out = normalizePath(sitecorePath);
  const oldSpaced = String(options.oldSpaced || "").trim();
  const newSpaced = String(options.newSpaced || "").trim();
  if (oldSpaced && newSpaced && oldSpaced.toLowerCase() !== newSpaced.toLowerCase()) {
    const re = new RegExp(escapeRegExp(oldSpaced), "gi");
    out = out.replace(re, newSpaced);
  }
  const oldKebab = String(options.oldKebab || "").trim();
  const newKebab = String(options.newKebab || "").trim();
  if (oldKebab && newKebab && oldKebab.toLowerCase() !== newKebab.toLowerCase()) {
    const re = new RegExp(escapeRegExp(oldKebab), "gi");
    out = out.replace(re, newKebab);
  }
  return out;
}

const PLATFORM_FOLDER_SET = new Set(
  PLATFORM_DATA_FOLDER_NAMES.map((n) => n.toLowerCase()),
);

/**
 * True when the path is under a shared platform Data folder (Link Lists, etc.)
 * whose leaf does not encode the component name — safe to keep on force rename.
 */
export function isSharedPlatformDataPath(sitecorePath: string): boolean {
  const p = normalizePath(sitecorePath);
  if (!p) return false;
  const parts = p.split("/").filter(Boolean);
  const lowerParts = parts.map((x) => x.toLowerCase());
  const dataIdx = lowerParts.findIndex((x, i) => x === "data" && i >= 2);
  if (dataIdx < 0 || dataIdx >= parts.length - 1) return false;
  const folderUnderData = lowerParts[dataIdx + 1] || "";
  return PLATFORM_FOLDER_SET.has(folderUnderData);
}

/**
 * True when the Sitecore path is a protected root that must never be renamed/moved/deleted.
 */
export function isProtectedSitecoreRoot(sitecorePath: string): boolean {
  const p = normalizePath(sitecorePath);
  if (!p) return true;
  const lower = p.toLowerCase();
  const parts = p.split("/").filter(Boolean);
  const leaf = (parts[parts.length - 1] || "").toLowerCase();

  // Exact platform / project folder roots
  if (
    /^\/sitecore\/layout\/placeholder settings\/project$/i.test(lower) ||
    /^\/sitecore\/layout\/renderings\/project$/i.test(lower) ||
    /^\/sitecore\/templates\/project$/i.test(lower) ||
    /^\/sitecore\/media library\/project$/i.test(lower) ||
    /^\/sitecore\/content$/i.test(lower)
  ) {
    return true;
  }

  // /sitecore/layout/.../Project/{collection}
  if (
    /^\/sitecore\/layout\/(placeholder settings|renderings)\/project\/[^/]+$/i.test(
      lower,
    ) ||
    /^\/sitecore\/templates\/project\/[^/]+$/i.test(lower) ||
    /^\/sitecore\/media library\/project\/[^/]+$/i.test(lower)
  ) {
    return true;
  }

  // /sitecore/content/{collection} or /{collection}/{site} or .../Data
  if (/^\/sitecore\/content\/[^/]+$/i.test(lower)) return true;
  if (/^\/sitecore\/content\/[^/]+\/[^/]+$/i.test(lower)) return true;
  if (/^\/sitecore\/content\/[^/]+\/[^/]+\/data$/i.test(lower)) return true;
  if (/^\/sitecore\/content\/[^/]+\/[^/]+\/home$/i.test(lower)) return true;

  // Shared Link Lists / Icon / Image Link Lists parents
  if (PLATFORM_FOLDER_SET.has(leaf)) {
    if (/\/data\/[^/]+$/i.test(lower)) return true;
  }

  return false;
}

/**
 * List definitionKeys that have apply-inventory files (excluding one key).
 */
export function listOtherApplyInventoryKeys(
  excludeDefinitionKey: string,
): string[] {
  const dirs = [
    path.join(BQ_DEFINITIONS_DIR, "apply-inventory"),
    path.join(BQ_DEFINITIONS_DIR, "emit-inventory"),
  ];
  const exclude = String(excludeDefinitionKey || "")
    .trim()
    .toLowerCase();
  const keys = new Set<string>();
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".json")) continue;
      const key = name.replace(/\.json$/i, "");
      if (key.toLowerCase() === exclude) continue;
      keys.add(key);
    }
  }
  return [...keys];
}

/**
 * True when another inventory still references the same id or path.
 */
export function isSharedAcrossInventories(
  entry: ApplyInventoryEntry,
  oldDefinitionKey: string,
): boolean {
  const idHex = String(entry.id || "")
    .replace(/[{}-]/g, "")
    .toLowerCase();
  const pathKey = normalizePath(entry.path).toLowerCase();
  if (!idHex && !pathKey) return false;
  for (const otherKey of listOtherApplyInventoryKeys(oldDefinitionKey)) {
    const inv = loadApplyInventory(otherKey);
    if (!inv?.entries?.length) continue;
    for (const e of inv.entries) {
      const otherId = String(e.id || "")
        .replace(/[{}-]/g, "")
        .toLowerCase();
      if (idHex && otherId === idHex) return true;
      if (pathKey && normalizePath(e.path).toLowerCase() === pathKey) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Build a rename/move/delete plan from old inventory → new component paths.
 */
export function planForceRenameCmRemap(options: {
  oldDefinitionKey: string;
  newDefinitionKey: string;
  oldComponentName: string;
  newComponentName: string;
  inventory?: ApplyInventoryFile | null;
}): ForceRenameRemapPlan {
  const oldKey = String(options.oldDefinitionKey || "").trim();
  const newKey = String(options.newDefinitionKey || "").trim();
  const oldSpaced = toSpacedItemName(options.oldComponentName);
  const newSpaced = toSpacedItemName(options.newComponentName);
  const inventory =
    options.inventory !== undefined
      ? options.inventory
      : loadApplyInventory(oldKey);

  const actions: ForceRenameRemapAction[] = [];
  if (!inventory?.entries?.length) {
    return {
      oldDefinitionKey: oldKey,
      newDefinitionKey: newKey,
      oldSpaced,
      newSpaced,
      actions,
    };
  }

  const sorted = [...inventory.entries].sort(
    (a, b) => pathDepth(a.path) - pathDepth(b.path),
  );

  for (const entry of sorted) {
    const oldPath = normalizePath(entry.path);
    if (!oldPath) continue;

    if (isProtectedSitecoreRoot(oldPath)) {
      actions.push({
        type: "skip-protected",
        entry,
        reason: "protected root",
      });
      continue;
    }

    const kind = String(entry.kind || inferApplyInventoryKind(oldPath)).toLowerCase();
    if (
      kind === "placeholder-setting" &&
      isSharedAcrossInventories(entry, oldKey)
    ) {
      actions.push({
        type: "skip-shared",
        entry,
        reason: "placeholder-setting shared with other inventories",
      });
      continue;
    }

    const newPath = substituteComponentPathSegments(oldPath, {
      oldSpaced,
      newSpaced,
      oldKebab: oldKey,
      newKebab: newKey,
    });

    if (normalizePath(newPath).toLowerCase() === oldPath.toLowerCase()) {
      // Path does not carry the old component name. Shared platform data (Link Lists,
      // etc.) can stay owned by the survivor; package-specific leftovers must delete
      // so unused SitecoreAI items from the old package do not linger.
      if (isSharedPlatformDataPath(oldPath)) {
        actions.push({
          type: "keep",
          entry,
          reason: "shared platform data path unchanged after name substitute",
        });
      } else {
        actions.push({
          type: "leftover-delete",
          entry,
          reason:
            "path unchanged after name substitute — not remappable; delete leftover",
        });
      }
      continue;
    }

    if (isProtectedSitecoreRoot(newPath)) {
      actions.push({
        type: "leftover-delete",
        entry,
        reason: "remap would hit protected root",
      });
      continue;
    }

    const oldParent = pathParent(oldPath);
    const newParent = pathParent(newPath);
    const newLeaf = leafNameFromSitecorePath(newPath);

    if (oldParent.toLowerCase() === newParent.toLowerCase()) {
      actions.push({
        type: "rename",
        entry,
        newPath,
        newLeaf,
      });
    } else {
      const oldLeaf = leafNameFromSitecorePath(oldPath);
      actions.push({
        type: "move",
        entry,
        newPath,
        newParentPath: newParent,
        newLeaf,
        renameAfterMove: oldLeaf.toLowerCase() !== newLeaf.toLowerCase(),
      });
    }
  }

  return {
    oldDefinitionKey: oldKey,
    newDefinitionKey: newKey,
    oldSpaced,
    newSpaced,
    actions,
  };
}

export type ForceRenameCmRemapResult = {
  plan: ForceRenameRemapPlan;
  renamed: number;
  moved: number;
  kept: number;
  deleted: number;
  skipped: number;
  failed: number;
  migrated: ApplyInventoryFile | null;
  dryRun: boolean;
};

/**
 * Execute remap plan: rename/move CM items, migrate inventory, delete leftovers.
 */
export async function executeForceRenameCmRemap(options: {
  plan: ForceRenameRemapPlan;
  dryRun?: boolean;
  endpointName?: string;
  auth?: { host: string; token: string };
  fetchImpl?: typeof fetch;
  log?: (message: string) => void;
  /** Injected for tests — resolve parent id by path. */
  resolveParentId?: (parentPath: string) => Promise<string | undefined>;
}): Promise<ForceRenameCmRemapResult> {
  const log = options.log || ((m: string) => console.warn(m));
  const dryRun = Boolean(options.dryRun);
  const plan = options.plan;
  let renamed = 0;
  let moved = 0;
  let kept = 0;
  let deleted = 0;
  let skipped = 0;
  let failed = 0;

  /** id → updated entry for migrated inventory */
  const migratedById = new Map<string, ApplyInventoryEntry>();
  /** Paths already achieved via ancestor rename (skip redundant child ops). */
  const achievedPaths = new Set<string>();

  const resolveParent =
    options.resolveParentId ||
    (async (parentPath: string) => {
      const hit = await findItemByPath({
        path: parentPath,
        endpointName: options.endpointName,
        auth: options.auth,
        fetchImpl: options.fetchImpl,
      });
      return hit?.itemId;
    });

  function entryKey(e: ApplyInventoryEntry): string {
    return String(e.id || "")
      .replace(/[{}-]/g, "")
      .toLowerCase();
  }

  function markMigrated(entry: ApplyInventoryEntry, newPath: string): void {
    const id = entryKey(entry);
    if (!id) return;
    migratedById.set(id, {
      ...entry,
      path: newPath,
      leafName: leafNameFromSitecorePath(newPath),
      kind: entry.kind || inferApplyInventoryKind(newPath),
    });
    achievedPaths.add(normalizePath(newPath).toLowerCase());
  }

  function pathAlreadyAchieved(newPath: string): boolean {
    return achievedPaths.has(normalizePath(newPath).toLowerCase());
  }

  function ancestorRemapped(oldPath: string, newPath: string): boolean {
    // If any proper ancestor of oldPath was remapped, child CM path may already match.
    const oldParts = normalizePath(oldPath).split("/").filter(Boolean);
    for (let i = oldParts.length - 1; i >= 1; i -= 1) {
      const ancestorOld = `/${oldParts.slice(0, i).join("/")}`;
      const ancestorNew = substituteComponentPathSegments(ancestorOld, {
        oldSpaced: plan.oldSpaced,
        newSpaced: plan.newSpaced,
        oldKebab: plan.oldDefinitionKey,
        newKebab: plan.newDefinitionKey,
      });
      if (
        ancestorOld.toLowerCase() !== ancestorNew.toLowerCase() &&
        achievedPaths.has(normalizePath(ancestorNew).toLowerCase())
      ) {
        return true;
      }
    }
    return pathAlreadyAchieved(newPath);
  }

  async function fallbackDelete(
    entry: ApplyInventoryEntry,
    reason: string,
  ): Promise<void> {
    log(
      `  · CM leftover delete (${reason}): ${entry.path || entry.id}`,
    );
    if (dryRun) {
      deleted += 1;
      return;
    }
    const result = await deleteCmItemById({
      itemId: entry.id,
      endpointName: options.endpointName,
      auth: options.auth,
      fetchImpl: options.fetchImpl,
      log,
    });
    if (result.ok) {
      deleted += 1;
      return;
    }
    if (CM_DELETE_NOT_FOUND_RE.test(result.error || "")) {
      deleted += 1;
      warnCreateVerbose(
        `  · CM leftover delete already gone (${entry.id}): ${result.error}`,
      );
      return;
    }
    failed += 1;
    log(
      `  · ⚠ ${CM_DELETE_VIA_AUTHORING_API} failed for ${formatAuthoringItemId(entry.id)}: ${result.error || "unknown"}`,
    );
  }

  for (const action of orderActionsForExecution(plan.actions)) {
    if (action.type === "skip-protected" || action.type === "skip-shared") {
      skipped += 1;
      // Shared placeholders: still carry into new inventory at same path.
      if (action.type === "skip-shared") {
        markMigrated(action.entry, normalizePath(action.entry.path));
      }
      continue;
    }

    if (action.type === "keep") {
      kept += 1;
      markMigrated(action.entry, normalizePath(action.entry.path));
      continue;
    }

    if (action.type === "leftover-delete") {
      await fallbackDelete(action.entry, action.reason);
      continue;
    }

    if (action.type === "rename") {
      if (ancestorRemapped(action.entry.path, action.newPath)) {
        kept += 1;
        markMigrated(action.entry, action.newPath);
        continue;
      }
      log(
        `  · ${CM_RENAME_VIA_AUTHORING_API}: ${action.entry.path} → ${action.newLeaf}`,
      );
      if (dryRun) {
        renamed += 1;
        markMigrated(action.entry, action.newPath);
        continue;
      }
      const result = await renameCmItem({
        itemId: action.entry.id,
        newName: action.newLeaf,
        endpointName: options.endpointName,
        auth: options.auth,
        fetchImpl: options.fetchImpl,
      });
      if (result.ok) {
        renamed += 1;
        markMigrated(action.entry, result.path || action.newPath);
      } else {
        log(
          `  · ⚠ rename failed (${result.error || "unknown"}); falling back to delete`,
        );
        await fallbackDelete(action.entry, "rename-failed");
      }
      continue;
    }

    if (action.type === "move") {
      if (ancestorRemapped(action.entry.path, action.newPath)) {
        kept += 1;
        markMigrated(action.entry, action.newPath);
        continue;
      }
      log(
        `  · ${CM_MOVE_VIA_AUTHORING_API}: ${action.entry.path} → ${action.newPath}`,
      );
      if (dryRun) {
        moved += 1;
        markMigrated(action.entry, action.newPath);
        continue;
      }
      const parentId = await resolveParent(action.newParentPath);
      if (!parentId) {
        log(
          `  · ⚠ move target parent missing (${action.newParentPath}); falling back to delete`,
        );
        await fallbackDelete(action.entry, "move-parent-missing");
        continue;
      }
      const moveResult = await moveCmItem({
        itemId: action.entry.id,
        targetParentId: parentId,
        endpointName: options.endpointName,
        auth: options.auth,
        fetchImpl: options.fetchImpl,
      });
      if (!moveResult.ok) {
        log(
          `  · ⚠ move failed (${moveResult.error || "unknown"}); falling back to delete`,
        );
        await fallbackDelete(action.entry, "move-failed");
        continue;
      }
      moved += 1;
      let finalPath = moveResult.path || action.newPath;
      if (action.renameAfterMove) {
        const renameResult = await renameCmItem({
          itemId: action.entry.id,
          newName: action.newLeaf,
          endpointName: options.endpointName,
          auth: options.auth,
          fetchImpl: options.fetchImpl,
        });
        if (renameResult.ok) {
          renamed += 1;
          finalPath = renameResult.path || action.newPath;
        } else {
          log(
            `  · ⚠ post-move rename failed (${renameResult.error || "unknown"})`,
          );
        }
      }
      markMigrated(action.entry, finalPath);
    }
  }

  let migrated: ApplyInventoryFile | null = null;
  if (plan.newDefinitionKey) {
    const prior = loadApplyInventory(plan.oldDefinitionKey);
    migrated = {
      definitionKey: plan.newDefinitionKey,
      sourceContentHash: prior?.sourceContentHash ?? null,
      modelHash: prior?.modelHash ?? null,
      contentHash: prior?.contentHash ?? null,
      presentationHash: prior?.presentationHash ?? null,
      updatedAt: new Date().toISOString(),
      entries: [...migratedById.values()].sort((a, b) =>
        a.path.localeCompare(b.path),
      ),
    };
    if (!dryRun) {
      saveApplyInventory(migrated);
      if (
        plan.oldDefinitionKey &&
        plan.oldDefinitionKey.toLowerCase() !==
          plan.newDefinitionKey.toLowerCase()
      ) {
        deleteApplyInventory(plan.oldDefinitionKey);
      }
    }
  }

  return {
    plan,
    renamed,
    moved,
    kept,
    deleted,
    skipped,
    failed,
    migrated,
    dryRun,
  };
}

/**
 * Load old inventory, plan + execute CM remap for a force rename.
 */
export async function remapCmInventoryOnForceRename(options: {
  oldDefinitionKey: string;
  newDefinitionKey: string;
  oldComponentName: string;
  newComponentName: string;
  dryRun?: boolean;
  endpointName?: string;
  auth?: { host: string; token: string };
  fetchImpl?: typeof fetch;
  log?: (message: string) => void;
}): Promise<ForceRenameCmRemapResult | null> {
  const oldKey = String(options.oldDefinitionKey || "").trim();
  const newKey = String(options.newDefinitionKey || "").trim();
  if (!oldKey || !newKey) return null;
  if (oldKey.toLowerCase() === newKey.toLowerCase()) return null;

  const inventory = loadApplyInventory(oldKey);
  if (!inventory?.entries?.length) {
    options.log?.(
      `  · No apply-inventory for ${oldKey} — skip CM remap`,
    );
    return null;
  }

  const plan = planForceRenameCmRemap({
    oldDefinitionKey: oldKey,
    newDefinitionKey: newKey,
    oldComponentName: options.oldComponentName,
    newComponentName: options.newComponentName,
    inventory,
  });

  options.log?.(
    `  · CM remap plan for ${oldKey} → ${newKey}: ${plan.actions.length} action(s) (inventory ${applyInventoryPath(oldKey)})`,
  );

  return executeForceRenameCmRemap({
    plan,
    dryRun: options.dryRun,
    endpointName: options.endpointName,
    auth: options.auth,
    fetchImpl: options.fetchImpl,
    log: options.log,
  });
}
