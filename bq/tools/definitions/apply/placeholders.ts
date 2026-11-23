/**
 * Emit placeholder-settings items + set rendering Placeholders field from definition.
 *
 * Disk/Sitecore paths must live under `Placeholder Settings/Project/{collection}`
 * so the BQ module `layout` include can ser push/pull them.
 */
import path from "node:path";
import { applyAuthoringItem } from "../../shared/authoring-apply-bridge";
import { braceGuid } from "../../shared/ids";
import { warnCreateVerbose } from "../../shared/id-resolve-log";
import { saiHandleFrom } from "../../shared/sai-handle";
import {
  ensureDynamicPlaceholderKey,
  toBasePlaceholderKey,
  toSystemName,
} from "../../shared/naming";

/** Pascal / spaced name → kebab definitionKey (local; avoid circular import). */
function toDefinitionKey(name: string): string {
  return String(name || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}
import {
  DEFAULT_PROJECT_COLLECTION,
  getProjectRenderingsSitecorePath,
  getSaiModuleDiskRoot,
} from "../../shared/data-placement";
import {
  type ScsItem,
  type ScsWriteStats,
  emptyWriteStats,
  mergeWriteStats,
  recordWrite
} from "../../shared/authoring-item-model";
import { FIELD_IDS, PLACEHOLDER_SETTINGS_TEMPLATE } from "../../shared/system-ids";
import type { Definition, RenderingDefinition, RenderingPlaceholderDef } from "../types";
import { readItemFieldValue } from "../../shared/authoring-items";
import { projectRenderingPathLeaf } from "./component-to-rendering";
import { resolveItemIdByPathWithRewrite } from "../../shared/resolve-item-id-by-path";

/** Folder template used for collection roots under Placeholder Settings/Project. */
const PLACEHOLDER_SETTINGS_FOLDER_TEMPLATE = "3d281bf8-5336-4686-9dd6-ab4ab5b3fd5d";
/** Platform folder template for `/sitecore/layout/Placeholder Settings/Project`. */
const PLACEHOLDER_SETTINGS_PROJECT_TEMPLATE =
  "c3b037a0-46e5-4b67-ac7a-a144b962a56f";
/** Parent of Placeholder Settings/Project (platform Placeholder Settings root). */
const PLACEHOLDER_SETTINGS_ROOT_ID = "1ce3b36c-9b0c-4eb5-a996-bfcb4eaa5287";

/** Disk dir: `sai/layout/Project/{collection}/`. */
export function getPlaceholderSettingsDiskDir(collectionSystem: string): string {
  return path.join(
    getSaiModuleDiskRoot(),
    "layout",
    "Project",
    collectionSystem,
  );
}

/** Collection folder YAML: `sai/layout/Project/{collection}.yml`. */
export function getPlaceholderSettingsCollectionYamlPath(
  collectionSystem: string,
): string {
  return path.join(
    getSaiModuleDiskRoot(),
    "layout",
    "Project",
    `${collectionSystem}.yml`,
  );
}

export function getPlaceholderSettingsSitecorePath(
  collectionSystem: string,
  key?: string,
): string {
  const base = `/sitecore/layout/Placeholder Settings/Project/${collectionSystem}`;
  return key ? `${base}/${key}` : base;
}

function getProjectPlaceholderSettingsRootYamlPath(): string {
  return path.join(getSaiModuleDiskRoot(), "layout", "Project.yml");
}

/**
 * Ensure `layout/Project/{collection}.yml` exists (SCS include root for that collection).
 * CM-aligns Project root + collection folder so missing local YAML cannot remint over CM.
 */
export async function ensurePlaceholderSettingsCollectionFolder(
  collectionSystem: string,
  options?: {
    endpointName?: string;
    lookupPath?: (sitecorePath: string) => Promise<string | undefined>;
    skipCm?: boolean;
  },
): Promise<{ id: string; stats: ScsWriteStats }> {
  const stats = emptyWriteStats();
  const folderYaml = getPlaceholderSettingsCollectionYamlPath(collectionSystem);
  const projectYaml = getProjectPlaceholderSettingsRootYamlPath();
  const projectSitecore = "/sitecore/layout/Placeholder Settings/Project";
  const collectionSitecore =
    getPlaceholderSettingsSitecorePath(collectionSystem);

  let projectResolved = await resolveItemIdByPathWithRewrite({
    sitecorePath: projectSitecore,
    endpointName: options?.endpointName,
    lookupPath: options?.lookupPath,
    skipCm: options?.skipCm,
    logPrefix: "[bq:apply:placeholders]",
  });
  if (!projectResolved.found) {
    const applied = await applyAuthoringItem(projectYaml, {
      parent: PLACEHOLDER_SETTINGS_ROOT_ID,
      template: PLACEHOLDER_SETTINGS_PROJECT_TEMPLATE,
      path: projectSitecore,
      languages: [
        {
          language: "en",
          versions: [
            {
              version: 1,
              versionFields: [
                {
                  id: FIELD_IDS.Created,
                  hint: "__Created",
                  value: "20200101T000000Z",
                },
              ],
            },
          ],
        },
      ],
    });
    recordWrite(stats, applied);
    projectResolved = {
      found: true,
      id: applied.itemId,
      source: "cm",
      diskId: undefined,
      cmId: applied.itemId,
      remappedFromDisk: false,
    };
  }

  const collectionResolved = await resolveItemIdByPathWithRewrite({
    sitecorePath: collectionSitecore,
    endpointName: options?.endpointName,
    lookupPath: options?.lookupPath,
    skipCm: options?.skipCm,
    logPrefix: "[bq:apply:placeholders]",
  });

  if (collectionResolved.found) {
    return { id: collectionResolved.id, stats };
  }

  const item: ScsItem = {
    parent: projectResolved.id,
    template: PLACEHOLDER_SETTINGS_FOLDER_TEMPLATE,
    path: collectionSitecore,
    languages: [
      {
        language: "en",
        versions: [
          {
            version: 1,
            versionFields: [
              { id: FIELD_IDS.Created, hint: "__Created", value: "20200101T000000Z" },
            ],
          },
        ],
      },
    ],
  };
  const applied = await applyAuthoringItem(folderYaml, item);
  recordWrite(stats, applied);
  return { id: applied.itemId, stats };
}

export async function applyRenderingPlaceholders(
  definition: RenderingDefinition,
  registry: Map<string, Definition>,
  _renderingId: string | undefined,
  renderingYamlPath: string,
): Promise<{ stats: ScsWriteStats; placeholderSettingIds: string[] }> {
  let stats = emptyWriteStats();
  const placeholders = definition.placeholders ?? [];
  if (!placeholders.length) {
    return { stats, placeholderSettingIds: [] };
  }

  const collectionSystem = toSystemName(
    definition.collectionSystem ?? DEFAULT_PROJECT_COLLECTION,
  );
  const handle = saiHandleFrom(definition.definitionKey, 1);
  const folder = await ensurePlaceholderSettingsCollectionFolder(
    collectionSystem,
  );
  stats = mergeWriteStats(stats, folder.stats);

  const settingsDir = getPlaceholderSettingsDiskDir(collectionSystem);
  const settingIds: string[] = [];
  const ownKey = String(definition.definitionKey || "").trim();
  warnRegistryPathLeafCollisions(registry, collectionSystem);

  for (const ph of placeholders) {
    const baseKey = toBasePlaceholderKey(ph.key?.trim() || "");
    if (!baseKey) continue;
    const rawControls = (ph.allowedControls ?? [])
      .map((k) => String(k || "").trim())
      .filter(Boolean);
    if (!rawControls.length) {
      console.warn(
        `[bq:apply:placeholders] empty allowedControls for key "${baseKey}" on ${ownKey || renderingYamlPath} — still creating Placeholder Settings (Allowed Controls empty)`,
      );
    }
    for (const ctrl of rawControls) {
      if (ownKey && ctrl === ownKey) {
        console.warn(
          `[bq:apply:placeholders] allowedControls self-reference "${ctrl}" on ${ownKey} (key "${baseKey}") — ignored`,
        );
      }
    }
    const controls = rawControls.filter((k) => !ownKey || k !== ownKey);

    const settingsKey = ensureDynamicPlaceholderKey(baseKey);
    const filePath = path.join(settingsDir, `${baseKey}.yml`);
    // Shared placeholder keys (e.g. footer-navigation) are emitted by multiple
    // parent renderings — union Allowed Controls so last-writer cannot wipe peers.
    const fromDefinition = controls.length
      ? await resolveAllowedControlIds(
          { ...ph, allowedControls: controls },
          registry,
        )
      : [];
    const sitecorePath = getPlaceholderSettingsSitecorePath(
      collectionSystem,
      baseKey,
    );
    const existingRaw = await readItemFieldValue({
      path: sitecorePath,
      fieldName: "Allowed Controls",
    });
    const allowed = mergeAllowedControlIds(
      parseAllowedControlIds(existingRaw),
      fromDefinition,
    );
    const item: ScsItem = {
      parent: folder.id,
      template: PLACEHOLDER_SETTINGS_TEMPLATE,
      path: sitecorePath,
      sharedFields: [
        {
          id: FIELD_IDS.PlaceholderKey,
          hint: "Placeholder Key",
          value: settingsKey,
        },
        {
          id: FIELD_IDS.PlaceholderAllowedControls,
          hint: "Allowed Controls",
          // TreeList / Multilist — Authoring GraphQL expects `|`-separated IDs.
          value: allowed.map(braceGuid).join("|"),
        },
        { id: FIELD_IDS.Icon, hint: "__Icon", value: "Software/32x32/element.png" },
      ],
      languages: [
        {
          language: "en",
          versions: [
            {
              version: 1,
              versionFields: [
                { id: FIELD_IDS.Created, hint: "__Created", value: "20200101T000000Z" },
              ],
            },
          ],
        },
      ],
    };
    const applied = await applyAuthoringItem(filePath, item);
    recordWrite(stats, applied);
    assertPlaceholderSettingId(applied.itemId, sitecorePath, collectionSystem);
    settingIds.push(applied.itemId);
  }

  void _renderingId;
  void renderingYamlPath;
  void handle;

  return { stats, placeholderSettingIds: settingIds };
}

/**
 * Warn when two registry defs under the same collection share a Project
 * rendering Path leaf (Allowed Controls would collapse to one GUID).
 */
export function warnRegistryPathLeafCollisions(
  registry: Map<string, Definition>,
  collectionSystem: string,
): void {
  const byLeaf = new Map<string, string[]>();
  const coll = toSystemName(collectionSystem);
  for (const [defKey, def] of registry) {
    if (def.kind !== "component" && def.kind !== "rendering") continue;
    const defColl = toSystemName(
      ("collectionSystem" in def && def.collectionSystem) ||
        DEFAULT_PROJECT_COLLECTION,
    );
    if (defColl !== coll) continue;
    const leaf = projectRenderingPathLeaf(def);
    if (!leaf) continue;
    const list = byLeaf.get(leaf) || [];
    list.push(defKey);
    byLeaf.set(leaf, list);
  }
  for (const [leaf, keys] of byLeaf) {
    if (keys.length < 2) continue;
    console.warn(
      `[bq:apply:placeholders] Path leaf collision "${leaf}" ← [${keys.join(", ")}] — Allowed Controls will share one rendering GUID`,
    );
  }
}

/**
 * Assert a Placeholders multilist candidate is a Placeholder Settings item
 * (path under `/sitecore/layout/Placeholder Settings/Project/{collection}`),
 * not a JsonRendering GUID mixed in by mistake.
 */
export function assertPlaceholderSettingId(
  itemId: string | undefined,
  sitecorePath: string,
  collectionSystem: string,
): void {
  const expectedPrefix = getPlaceholderSettingsSitecorePath(
    toSystemName(collectionSystem),
  );
  const pathNorm = String(sitecorePath || "").replace(/\\/g, "/");
  if (!pathNorm.toLowerCase().startsWith(expectedPrefix.toLowerCase())) {
    console.warn(
      `[bq:apply:placeholders] Placeholders candidate path is not under Placeholder Settings: ${sitecorePath} (expected ${expectedPrefix}/…)`,
    );
  }
  const renderingsPrefix = getProjectRenderingsSitecorePath(
    toSystemName(collectionSystem),
  );
  if (pathNorm.toLowerCase().startsWith(renderingsPrefix.toLowerCase())) {
    console.warn(
      `[bq:apply:placeholders] refusing JsonRendering path in Placeholders multilist: ${sitecorePath}`,
    );
  }
  const id = String(itemId || "").replace(/[{}]/g, "").trim();
  // Authoring often returns 32-hex (no dashes); multilist writes still go through braceGuid.
  // Compact-hex shape noise is verbose-only (BQ_CREATE_LOG=verbose / create --verbose).
  if (id && !/^[0-9a-f-]{36}$/i.test(id)) {
    warnCreateVerbose(
      `[bq:apply:placeholders] Placeholders multilist value is not a GUID: "${itemId}"`,
    );
  }
}

async function resolveAllowedControlIds(
  ph: RenderingPlaceholderDef,
  registry: Map<string, Definition>,
): Promise<string[]> {
  const ids: string[] = [];
  /** @type {Map<string, string[]>} */
  const idToKeys = new Map<string, string[]>();
  /** @type {Map<string, string[]>} */
  const leafToKeys = new Map<string, string[]>();

  for (const key of ph.allowedControls ?? []) {
    const def = resolveAllowedControlDefinition(key, registry);
    if (!def || (def.kind !== "component" && def.kind !== "rendering")) continue;
    const collectionSystem = toSystemName(
      ("collectionSystem" in def && def.collectionSystem) ||
        DEFAULT_PROJECT_COLLECTION,
    );
    const pathLeaf = projectRenderingPathLeaf(def);
    if (!pathLeaf) continue;
    const leafKeys = leafToKeys.get(pathLeaf) || [];
    leafKeys.push(key);
    leafToKeys.set(pathLeaf, leafKeys);
    const sitecorePath = `${getProjectRenderingsSitecorePath(collectionSystem)}/${pathLeaf}`;
    const resolved = await resolveItemIdByPathWithRewrite({
      sitecorePath,
      logPrefix: "[bq:apply:placeholders:allowed]",
    });
    if (resolved.found && resolved.id) {
      const bare = resolved.id.replace(/[{}]/g, "").trim();
      ids.push(bare);
      const keys = idToKeys.get(bare.toLowerCase()) || [];
      keys.push(key);
      idToKeys.set(bare.toLowerCase(), keys);
    }
  }

  for (const [leaf, keys] of leafToKeys) {
    if (keys.length < 2) continue;
    console.warn(
      `[bq:apply:placeholders] allowedControls Path leaf collision "${leaf}" for keys [${keys.join(", ")}]`,
    );
  }
  for (const [id, keys] of idToKeys) {
    if (keys.length < 2) continue;
    console.warn(
      `[bq:apply:placeholders] allowedControls resolved to same rendering GUID {${id}} for keys [${keys.join(", ")}]`,
    );
  }

  return ids;
}

/**
 * Resolve allowedControls keys: exact definitionKey, or brand-prefixed /
 * suffix alias (e.g. `footer-branding-social` → `sitecore-footer-branding-social`).
 */
function resolveAllowedControlDefinition(
  key: string,
  registry: Map<string, Definition>,
): Definition | undefined {
  const raw = String(key || "").trim();
  if (!raw) return undefined;
  const exact = registry.get(raw);
  if (exact) return exact;
  // Suffix alias: bare `footer-branding-social` vs `sitecore-footer-branding-social`
  for (const [defKey, def] of registry) {
    if (def.kind !== "component" && def.kind !== "rendering") continue;
    if (defKey === raw || defKey.endsWith(`-${raw}`) || defKey.endsWith(raw)) {
      return def;
    }
    const name =
      def.kind === "component"
        ? def.componentName
        : def.componentName || def.name;
    if (
      name &&
      (toDefinitionKey(name) === raw ||
        toDefinitionKey(name).endsWith(`-${raw}`))
    ) {
      return def;
    }
  }
  return undefined;
}

/** Parse Allowed Controls multilist value into bare GUID strings. */
function parseAllowedControlIds(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[\r\n|]+/)
    .map((s) => s.replace(/[{}]/g, "").trim())
    .filter(Boolean);
}

/** Union Allowed Controls IDs (case-insensitive), preserving first-seen casing. */
function mergeAllowedControlIds(
  existing: string[],
  next: string[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of [...existing, ...next]) {
    const bare = id.replace(/[{}]/g, "").trim();
    if (!bare) continue;
    const key = bare.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(bare);
  }
  return out;
}

/** Layout Service Placeholders TreeList value for Authoring GraphQL (`|`-separated). */
export function placeholdersFieldValue(settingIds: string[]): string {
  return settingIds.map(braceGuid).join("|");
}
