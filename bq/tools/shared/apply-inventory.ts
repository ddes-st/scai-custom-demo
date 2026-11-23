/**
 * Durable per-definitionKey apply inventory for item reuse across renames
 * and per-definition content-hash skip.
 *
 * `.bq/definitions/apply-inventory/{definitionKey}.json`
 * (falls back to legacy `.bq/definitions/emit-inventory/` on read)
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { BQ_DEFINITIONS_DIR } from "./paths";

export type ApplyInventoryKind =
  | "media"
  | "media-folder"
  | "folder"
  | "content"
  | "template"
  | "rendering"
  | "placeholder-setting"
  | "parameters"
  | "other";

export type ApplyInventoryEntry = {
  id: string;
  /** Sitecore Path: */
  path: string;
  /** Absolute disk path when known */
  diskPath?: string;
  kind: ApplyInventoryKind | string;
  sourceKey?: string;
  leafName?: string;
  /**
   * Stable hash of intended content field bag / media sourceKey+alt before
   * culture expand — used to skip translate+write for unchanged leaves.
   */
  payloadHash?: string;
};

/**
 * Infer inventory kind from a Sitecore path (Authoring create/update).
 */
export function inferApplyInventoryKind(
  sitecorePath: string,
): ApplyInventoryKind {
  const p = String(sitecorePath || "")
    .replace(/\\/g, "/")
    .toLowerCase();
  if (!p) return "other";
  if (p.includes("/media library/")) {
    return /\.(jpe?g|png|gif|svg|webp|pdf|ico)$/i.test(p)
      ? "media"
      : "media-folder";
  }
  if (p.includes("/placeholder settings/")) return "placeholder-setting";
  if (p.includes("/layout/renderings/")) return "rendering";
  if (p.includes("/templates/")) {
    if (/rendering parameters|\/parameters\//.test(p)) return "parameters";
    return "template";
  }
  if (/\/data(\/|$)/.test(p)) {
    const leaf = p.split("/").filter(Boolean).pop() || "";
    if (/folder$/i.test(leaf)) return "folder";
    return "content";
  }
  return "other";
}

/** Leaf name from a Sitecore path. */
export function leafNameFromSitecorePath(sitecorePath: string): string {
  const parts = String(sitecorePath || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean);
  return parts[parts.length - 1] || "";
}

export type ApplyInventoryFile = {
  definitionKey: string;
  sourceContentHash: string | null;
  /** Templates / fields / placeholders / rendering wiring (excl. content.items). */
  modelHash?: string | null;
  /** content.items (+ nested children) seed payload only. */
  contentHash?: string | null;
  /** Site-presentation band wiring only. */
  presentationHash?: string | null;
  updatedAt: string;
  entries: ApplyInventoryEntry[];
};

export type DefinitionPackageFacets = {
  /** Combined package hash (same as computeDefinitionPackageHash). */
  packageHash: string;
  modelHash: string;
  contentHash: string;
  presentationHash: string;
};

export type ApplySlicePlan = {
  skipAll: boolean;
  applyModel: boolean;
  applyContent: boolean;
  applyPresentation: boolean;
  reason: string;
};

const INVENTORY_DIR = path.join(BQ_DEFINITIONS_DIR, "apply-inventory");
const LEGACY_INVENTORY_DIR = path.join(BQ_DEFINITIONS_DIR, "emit-inventory");

function sanitizeKeyForFile(definitionKey: string): string {
  return String(definitionKey || "unknown")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 180);
}

export function applyInventoryPath(definitionKey: string): string {
  return path.join(INVENTORY_DIR, `${sanitizeKeyForFile(definitionKey)}.json`);
}

function legacyApplyInventoryPath(definitionKey: string): string {
  return path.join(
    LEGACY_INVENTORY_DIR,
    `${sanitizeKeyForFile(definitionKey)}.json`,
  );
}

function parseInventoryFile(
  definitionKey: string,
  file: string,
): ApplyInventoryFile | null {
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as ApplyInventoryFile;
    if (!raw || typeof raw !== "object") return null;
    return {
      definitionKey: raw.definitionKey || definitionKey,
      sourceContentHash:
        typeof raw.sourceContentHash === "string" ? raw.sourceContentHash : null,
      modelHash: typeof raw.modelHash === "string" ? raw.modelHash : null,
      contentHash: typeof raw.contentHash === "string" ? raw.contentHash : null,
      presentationHash:
        typeof raw.presentationHash === "string" ? raw.presentationHash : null,
      updatedAt: raw.updatedAt || "",
      entries: Array.isArray(raw.entries) ? raw.entries : [],
    };
  } catch {
    return null;
  }
}

export function loadApplyInventory(
  definitionKey: string,
): ApplyInventoryFile | null {
  return (
    parseInventoryFile(definitionKey, applyInventoryPath(definitionKey)) ||
    parseInventoryFile(definitionKey, legacyApplyInventoryPath(definitionKey))
  );
}

export function saveApplyInventory(inventory: ApplyInventoryFile): string {
  fs.mkdirSync(INVENTORY_DIR, { recursive: true });
  const out = applyInventoryPath(inventory.definitionKey);
  const payload: ApplyInventoryFile = {
    definitionKey: inventory.definitionKey,
    sourceContentHash: inventory.sourceContentHash,
    modelHash: inventory.modelHash ?? null,
    contentHash: inventory.contentHash ?? null,
    presentationHash: inventory.presentationHash ?? null,
    updatedAt: inventory.updatedAt || new Date().toISOString(),
    entries: inventory.entries || [],
  };
  fs.writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  // Drop legacy file once migrated to the new path.
  const legacy = legacyApplyInventoryPath(inventory.definitionKey);
  if (legacy !== out && fs.existsSync(legacy)) {
    try {
      fs.unlinkSync(legacy);
    } catch {
      /* ignore */
    }
  }
  return out;
}

/** Remove durable apply-inventory JSON for a definitionKey (if present). */
export function deleteApplyInventory(definitionKey: string): boolean {
  let removed = false;
  for (const file of [
    applyInventoryPath(definitionKey),
    legacyApplyInventoryPath(definitionKey),
  ]) {
    if (!fs.existsSync(file)) continue;
    fs.unlinkSync(file);
    removed = true;
  }
  return removed;
}

function sha256Hex(text: string): string {
  return createHash("sha256").update(String(text || ""), "utf8").digest("hex");
}

/**
 * Bump when emit output shape changes without definition source bytes changing
 * (e.g. auto ComponentQuery for childItemTemplate). Invalidates inventory skips.
 */
export const APPLY_SCHEMA_VERSION = "2026-10-23-child-item-gql-v2";

/**
 * Content hash of a definition package (definition.ts + optional content.ts).
 */
export async function computeDefinitionPackageHash(
  definitionFileAbs: string,
): Promise<string> {
  const facets = await computeDefinitionPackageFacets(definitionFileAbs);
  return facets.packageHash;
}

/**
 * Strip `content: { … items … }` / top-level content seed blobs so modelHash
 * ignores seed text/URL changes.
 */
export function stripContentSeedsFromDefinitionSource(source: string): string {
  let text = String(source || "");
  // Remove content: { … } at top level of the default export object (balanced braces).
  const contentKey = /\bcontent\s*:\s*\{/;
  let match = contentKey.exec(text);
  while (match) {
    const open = match.index + match[0].length - 1;
    let depth = 0;
    let close = -1;
    for (let i = open; i < text.length; i += 1) {
      const ch = text[i];
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          close = i;
          break;
        }
      }
    }
    if (close < 0) break;
    let end = close + 1;
    while (end < text.length && /[ \t]/.test(text[end]!)) end += 1;
    if (text[end] === ",") end += 1;
    text = `${text.slice(0, match.index)}/*content-omitted*/${text.slice(end)}`;
    match = contentKey.exec(text);
  }
  return text;
}

/**
 * Extract only the content seed region for contentHash.
 */
export function extractContentSeedSource(source: string): string {
  const text = String(source || "");
  const contentKey = /\bcontent\s*:\s*\{/;
  const match = contentKey.exec(text);
  if (!match) {
    // Sidecar .content.ts or no content block
    return "";
  }
  const open = match.index + match[0].length - 1;
  let depth = 0;
  let close = -1;
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close < 0) return "";
  return text.slice(match.index, close + 1);
}

/**
 * Faceted hashes: model vs content vs presentation vs combined package.
 */
export async function computeDefinitionPackageFacets(
  definitionFileAbs: string,
): Promise<DefinitionPackageFacets> {
  const abs = path.resolve(definitionFileAbs);
  const parts: string[] = [];
  let defBody = "";
  let contentSidecar = "";
  try {
    defBody = fs.readFileSync(abs, "utf8");
    parts.push(`${path.basename(abs)}\0${sha256Hex(defBody)}`);
  } catch {
    /* empty */
  }
  if (abs.endsWith(".definition.ts")) {
    const sidecar = abs.replace(/\.definition\.ts$/i, ".content.ts");
    try {
      contentSidecar = fs.readFileSync(sidecar, "utf8");
      parts.push(`${path.basename(sidecar)}\0${sha256Hex(contentSidecar)}`);
    } catch {
      /* no sidecar */
    }
  }
  const packageHash = sha256Hex(
    `${APPLY_SCHEMA_VERSION}\n${parts.join("\n")}`,
  );
  const modelSource = stripContentSeedsFromDefinitionSource(defBody);
  const contentFromDef = extractContentSeedSource(defBody);
  const contentHash = sha256Hex(
    `${APPLY_SCHEMA_VERSION}\n${contentFromDef}\n${contentSidecar}`,
  );
  const modelHash = sha256Hex(`${APPLY_SCHEMA_VERSION}\n${modelSource}`);
  const isPresentation =
    /\bkind\s*:\s*["']site-presentation["']/.test(defBody) ||
    /site-presentation\.definition\.ts$/i.test(abs);
  const presentationHash = isPresentation
    ? sha256Hex(defBody)
    : sha256Hex("");
  return { packageHash, modelHash, contentHash, presentationHash };
}

/** Stable hash of a content leaf's intended field bag (pre-translate). */
export function computeContentLeafPayloadHash(payload: unknown): string {
  return sha256Hex(stableStringify(payload));
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

/**
 * Decide which emit slices to run when package hash differs.
 */
export function resolveApplySlicePlan(options: {
  facets: DefinitionPackageFacets;
  inventory: ApplyInventoryFile | null;
}): ApplySlicePlan {
  const { facets, inventory } = options;
  if (
    inventory?.sourceContentHash &&
    inventory.sourceContentHash === facets.packageHash &&
    inventoryPathsExist(inventory)
  ) {
    return {
      skipAll: true,
      applyModel: false,
      applyContent: false,
      applyPresentation: false,
      reason: "sourceContentHash match (emit inventory)",
    };
  }
  const priorModel = inventory?.modelHash || null;
  const priorContent = inventory?.contentHash || null;
  const priorPresentation = inventory?.presentationHash || null;
  // First run or legacy inventory without facets → full emit
  if (!inventory || (!priorModel && !priorContent && !priorPresentation)) {
    return {
      skipAll: false,
      applyModel: true,
      applyContent: true,
      applyPresentation: true,
      reason: "no faceted inventory — full emit",
    };
  }
  // Hash match alone is not enough — orphan prune / failed push / manual deletes
  // can remove template YAML while modelHash stays stale. Skipping model then
  // emitting content yields "Template ID … did not exist" on ser push.
  const modelPathsMissing = !inventoryModelPathsExist(inventory);
  const modelDirty = priorModel !== facets.modelHash || modelPathsMissing;
  const contentDirty = priorContent !== facets.contentHash;
  const presentationDirty = priorPresentation !== facets.presentationHash;
  if (!modelDirty && !contentDirty && !presentationDirty) {
    // Facets match but package hash did not (e.g. whitespace-only) — treat as skip.
    return {
      skipAll: true,
      applyModel: false,
      applyContent: false,
      applyPresentation: false,
      reason: "faceted hashes match (emit inventory)",
    };
  }
  return {
    skipAll: false,
    applyModel: modelDirty,
    applyContent: contentDirty || modelDirty,
    applyPresentation: presentationDirty,
    reason:
      `facets: model=${modelDirty ? "dirty" : "ok"} content=${contentDirty ? "dirty" : "ok"} presentation=${presentationDirty ? "dirty" : "ok"}` +
      (modelPathsMissing ? " (model disk paths missing)" : ""),
  };
}

/**
 * Normalize disk paths for inventory equality (case-fold; slash unify).
 * @param {string} p
 */
export function normalizeInventoryDiskPath(p: string): string {
  return path.normalize(String(p || ""))
    .replace(/\\/g, "/")
    .toLowerCase();
}

/**
 * True when a content leaf payloadHash matches inventory and disk exists.
 *
 * When `diskPath` is provided (preferred), only skip if that exact YAML file
 * is inventoried + present — never match a same-named child under `Name/Name.yml`
 * when emitting parent `Name.yml` (parent/child leafName collisions).
 */
export function canSkipContentLeaf(options: {
  inventory: ApplyInventoryFile | null | undefined;
  leafName: string;
  payloadHash: string;
  /** Intended parent/child YAML path — scopes skip away from same-named descendants. */
  diskPath?: string | null;
}): boolean {
  const { inventory, leafName, payloadHash, diskPath } = options;
  if (!inventory?.entries?.length || !payloadHash || !leafName) return false;

  if (diskPath) {
    const want = normalizeInventoryDiskPath(diskPath);
    const byPath = inventory.entries.find((e) => {
      if (String(e.kind || "").toLowerCase() !== "content") return false;
      if (!e.diskPath) return false;
      return normalizeInventoryDiskPath(e.diskPath) === want;
    });
    if (!byPath?.payloadHash || byPath.payloadHash !== payloadHash) return false;
    return fs.existsSync(byPath.diskPath!);
  }

  // Legacy leafName-only lookup — still require disk presence.
  const entry = findInventoryEntry(inventory, {
    kind: "content",
    leafName,
  });
  if (!entry?.payloadHash || entry.payloadHash !== payloadHash) return false;
  if (entry.diskPath && fs.existsSync(entry.diskPath)) return true;
  return false;
}

export function inventoryEntryLeaf(entry: ApplyInventoryEntry): string {
  if (entry.leafName) return entry.leafName;
  const parts = String(entry.path || "")
    .split("/")
    .filter(Boolean);
  return parts[parts.length - 1] || "";
}

export function findInventoryEntry(
  inventory: ApplyInventoryFile | null | undefined,
  options: {
    kind?: string;
    sourceKey?: string;
    leafName?: string;
    id?: string;
  },
): ApplyInventoryEntry | undefined {
  if (!inventory?.entries?.length) return undefined;
  const wantKey = options.sourceKey?.trim();
  const wantLeaf = options.leafName?.trim().toLowerCase();
  const wantId = options.id?.replace(/[{}-]/g, "").toLowerCase();
  const wantKind = options.kind?.toLowerCase();

  if (wantKey) {
    const byKey = inventory.entries.find(
      (e) =>
        e.sourceKey === wantKey &&
        (!wantKind || String(e.kind).toLowerCase() === wantKind),
    );
    if (byKey) return byKey;
  }
  if (wantId) {
    const byId = inventory.entries.find(
      (e) => e.id.replace(/[{}-]/g, "").toLowerCase() === wantId,
    );
    if (byId) return byId;
  }
  if (wantLeaf) {
    const byLeaf = inventory.entries.find((e) => {
      if (wantKind && String(e.kind).toLowerCase() !== wantKind) return false;
      return inventoryEntryLeaf(e).toLowerCase() === wantLeaf;
    });
    if (byLeaf) return byLeaf;
  }
  return undefined;
}

/** True when every inventory diskPath (or path-resolved) still exists. */
export function inventoryPathsExist(
  inventory: ApplyInventoryFile | null | undefined,
): boolean {
  if (!inventory?.entries?.length) return false;
  for (const e of inventory.entries) {
    if (e.diskPath) {
      if (!fs.existsSync(e.diskPath)) return false;
      continue;
    }
    // Soft: no diskPath — rely on hash alone for skip.
  }
  return true;
}

const MODEL_INVENTORY_KINDS = new Set(["template", "other", "folder"]);

/**
 * True when every inventory entry of the given kinds that has a diskPath still
 * exists. Entries without diskPath are ignored. Empty kind set → true.
 */
export function inventoryKindPathsExist(
  inventory: ApplyInventoryFile | null | undefined,
  kinds: ReadonlySet<string> | readonly string[],
): boolean {
  if (!inventory?.entries?.length) return true;
  const want =
    kinds instanceof Set
      ? kinds
      : new Set([...kinds].map((k) => String(k).toLowerCase()));
  for (const e of inventory.entries) {
    const kind = String(e.kind || "").toLowerCase();
    if (!want.has(kind)) continue;
    if (e.diskPath && !fs.existsSync(e.diskPath)) return false;
  }
  return true;
}

/** Template / folder model YAML still present for faceted model-skip. */
export function inventoryModelPathsExist(
  inventory: ApplyInventoryFile | null | undefined,
): boolean {
  return inventoryKindPathsExist(inventory, MODEL_INVENTORY_KINDS);
}

/**
 * Skip emit when package hash matches last inventory and paths still exist.
 * Pass `force: true` (`--force` / `--force:apply`) to bypass the hash skip.
 */
export function canSkipFromApplyInventory(options: {
  definitionKey: string;
  sourceContentHash: string;
  /** When true, never skip — used by `--force` / `--force:apply`. */
  force?: boolean;
}): { skip: boolean; reason: string; inventory: ApplyInventoryFile | null } {
  const inventory = loadApplyInventory(options.definitionKey);
  if (options.force) {
    return { skip: false, reason: "forced", inventory };
  }
  if (!inventory) {
    return { skip: false, reason: "no emit inventory", inventory: null };
  }
  if (!inventory.sourceContentHash) {
    return {
      skip: false,
      reason: "inventory missing sourceContentHash",
      inventory,
    };
  }
  if (inventory.sourceContentHash !== options.sourceContentHash) {
    return {
      skip: false,
      reason: "sourceContentHash mismatch",
      inventory,
    };
  }
  if (!inventoryPathsExist(inventory)) {
    return {
      skip: false,
      reason: "inventory disk paths missing",
      inventory,
    };
  }
  return {
    skip: true,
    reason: "sourceContentHash match (emit inventory)",
    inventory,
  };
}

/** In-memory builder for the active definition emit. */
export class ApplyInventorySession {
  readonly definitionKey: string;
  private readonly byId = new Map<string, ApplyInventoryEntry>();
  private facets: Omit<
    DefinitionPackageFacets,
    "packageHash"
  > | null = null;

  constructor(definitionKey: string) {
    this.definitionKey = definitionKey;
  }

  setFacets(
    facets: Pick<
      DefinitionPackageFacets,
      "modelHash" | "contentHash" | "presentationHash"
    > | null,
  ): void {
    this.facets = facets
      ? {
          modelHash: facets.modelHash,
          contentHash: facets.contentHash,
          presentationHash: facets.presentationHash,
        }
      : null;
  }

  record(entry: ApplyInventoryEntry): void {
    const id = entry.id.replace(/[{}]/g, "").trim().toLowerCase();
    if (!id) return;
    const leaf =
      entry.leafName ||
      entry.path.split("/").filter(Boolean).pop() ||
      undefined;
    const prev = this.byId.get(id);
    this.byId.set(id, {
      ...prev,
      ...entry,
      id: entry.id.replace(/[{}]/g, "").toLowerCase(),
      leafName: leaf,
      diskPath: entry.diskPath
        ? path.normalize(path.resolve(entry.diskPath))
        : undefined,
      payloadHash: entry.payloadHash ?? prev?.payloadHash,
    });
  }

  flush(sourceContentHash: string | null): ApplyInventoryFile {
    const inventory: ApplyInventoryFile = {
      definitionKey: this.definitionKey,
      sourceContentHash,
      modelHash: this.facets?.modelHash ?? null,
      contentHash: this.facets?.contentHash ?? null,
      presentationHash: this.facets?.presentationHash ?? null,
      updatedAt: new Date().toISOString(),
      entries: [...this.byId.values()].sort((a, b) =>
        a.path.localeCompare(b.path),
      ),
    };
    saveApplyInventory(inventory);
    return inventory;
  }

  /** Retain prior paths for prune when skipping emit. */
  trackAllOnManifest(track: (filePath: string) => void): void {
    for (const e of this.byId.values()) {
      if (e.diskPath && fs.existsSync(e.diskPath)) track(e.diskPath);
    }
  }
}

let activeSession: ApplyInventorySession | undefined;
let activeDefinitionKey: string | undefined;

export function setActiveApplyDefinitionKey(key: string | undefined): void {
  activeDefinitionKey = key?.trim() || undefined;
}

export function getActiveApplyDefinitionKey(): string | undefined {
  return activeDefinitionKey;
}

export function beginApplyInventorySession(
  definitionKey: string,
): ApplyInventorySession {
  const session = new ApplyInventorySession(definitionKey);
  activeSession = session;
  activeDefinitionKey = definitionKey;
  return session;
}

export function getActiveApplyInventorySession():
  | ApplyInventorySession
  | undefined {
  return activeSession;
}

export function endApplyInventorySession(
  sourceContentHash: string | null,
): ApplyInventoryFile | null {
  if (!activeSession) {
    activeDefinitionKey = undefined;
    return null;
  }
  const inv = activeSession.flush(sourceContentHash);
  activeSession = undefined;
  activeDefinitionKey = undefined;
  return inv;
}

export function clearApplyInventorySession(): void {
  activeSession = undefined;
  activeDefinitionKey = undefined;
}

export function recordActiveInventoryEntry(
  entry: ApplyInventoryEntry,
): void {
  activeSession?.record(entry);
}
