import fs from "node:fs";
import path from "node:path";
import { getSaiModuleDiskRoot } from "../../shared/data-placement";

type ModuleRule = {
  path?: string;
  scope?: string;
  allowedPushOperations?: string;
  rules?: ModuleRule[];
};

type ModuleInclude = {
  name: string;
  path: string;
  scope?: string;
  allowedPushOperations?: string;
  rules?: ModuleRule[];
};

type ModuleFile = {
  $schema?: string;
  namespace?: string;
  items?: {
    path?: string;
    includes?: ModuleInclude[];
  };
  [key: string]: unknown;
};

const SITE_CHILD_RULES: ModuleRule[] = [
  {
    path: "/home",
    scope: "ItemAndDescendants",
    allowedPushOperations: "CreateAndUpdate",
  },
  {
    path: "/Media",
    scope: "ItemAndDescendants",
    allowedPushOperations: "CreateAndUpdate",
  },
  {
    path: "/Data",
    scope: "ItemAndDescendants",
    allowedPushOperations: "CreateAndUpdate",
  },
  {
    path: "/Enums",
    scope: "ItemAndDescendants",
    allowedPushOperations: "CreateAndUpdate",
  },
  {
    path: "/Dictionary",
    scope: "ItemAndDescendants",
    allowedPushOperations: "CreateAndUpdate",
  },
  {
    path: "/Presentation",
    scope: "ItemAndDescendants",
    allowedPushOperations: "CreateAndUpdate",
  },
  {
    path: "/Settings",
    scope: "ItemAndDescendants",
    allowedPushOperations: "CreateAndUpdate",
  },
  { path: "*", scope: "Ignored" },
];

const COLLECTION_INCLUDE_NAMES = new Set([
  "templates",
  "branchTemplates",
  "media-library",
  "renderings",
  "layout",
  "systemSettings",
]);

/**
 * Locate the Sitecore module JSON that owns the SAI folder
 * (`*.module.json` beside `sai/`) — not a hardcoded filename.
 */
export function findSaiModuleJsonPath(): string {
  const saiRoot = getSaiModuleDiskRoot();
  const moduleDir = path.dirname(saiRoot);
  if (!fs.existsSync(moduleDir)) {
    throw new Error(`[module-json] SAI parent folder not found: ${moduleDir}`);
  }
  const matches = fs
    .readdirSync(moduleDir)
    .filter((name) => name.endsWith(".module.json"))
    .map((name) => path.join(moduleDir, name));
  if (matches.length === 0) {
    throw new Error(
      `[module-json] No *.module.json found next to SAI at ${moduleDir}`,
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `[module-json] Multiple *.module.json files next to SAI (${matches.join(", ")}); expected exactly one.`,
    );
  }
  return matches[0]!;
}

/**
 * Sibling `*.module.json.minimal` next to the active module — source of truth
 * for the resting module shape (create/apply must leave module.json here).
 */
export function getMinimalModuleJsonPath(moduleJsonPath?: string): string {
  const active = moduleJsonPath || findSaiModuleJsonPath();
  return `${active}.minimal`;
}

/** Namespace for `dotnet sitecore ser … -i` (defaults to BQ). */
export function getModuleIncludeName(moduleJsonPath?: string): string {
  const active = moduleJsonPath || findSaiModuleJsonPath();
  if (!fs.existsSync(active)) return "BQ";
  try {
    const data = readModuleFile(active);
    const ns = String(data.namespace || "").trim();
    return ns || "BQ";
  } catch {
    return "BQ";
  }
}

export type ResetModuleJsonResult = {
  path: string;
  from: string;
  changed: boolean;
};

/**
 * Overwrite active `*.module.json` from sibling `*.module.json.minimal`
 * (atomic write). Prefer this as the last step after delete/restore ser sessions.
 */
export function resetModuleJsonToMinimal(
  moduleJsonPath?: string,
): ResetModuleJsonResult {
  const active = moduleJsonPath || findSaiModuleJsonPath();
  const from = getMinimalModuleJsonPath(active);
  if (!fs.existsSync(from)) {
    throw new Error(
      `[module-json] Minimal baseline missing: ${from}. ` +
        `Expected sibling of ${path.basename(active)}.`,
    );
  }
  const next = fs.readFileSync(from, "utf8");
  const prev = fs.existsSync(active) ? fs.readFileSync(active, "utf8") : "";
  if (prev === next) {
    return { path: active, from, changed: false };
  }
  const tmp = `${active}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, next, "utf8");
  fs.renameSync(tmp, active);
  return { path: active, from, changed: true };
}

export type ExpandModuleForSerSessionResult = {
  path: string;
  collectionSystem: string;
  siteSystem?: string;
  reset: ResetModuleJsonResult;
};

/**
 * Prepare module.json for a short ser pull/push session: reset to `.minimal`,
 * then add only the target collection (+ optional site) include rules.
 */
export function expandModuleForSerSession(options: {
  collectionSystem: string;
  siteSystem?: string;
}): ExpandModuleForSerSessionResult {
  const collectionSystem = String(options.collectionSystem || "").trim();
  if (!collectionSystem) {
    throw new Error(
      "[module-json] expandModuleForSerSession requires collectionSystem",
    );
  }
  const siteSystem = options.siteSystem?.trim() || undefined;
  const reset = resetModuleJsonToMinimal();
  if (siteSystem) {
    ensureModuleSiteRules(collectionSystem, siteSystem);
  } else {
    ensureModuleCollectionRules(collectionSystem);
  }
  return {
    path: findSaiModuleJsonPath(),
    collectionSystem,
    siteSystem,
    reset,
  };
}

function readModuleFile(filePath: string): ModuleFile {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as ModuleFile;
}

function writeModuleFile(filePath: string, data: ModuleFile): void {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function ensureTrailingIgnored(rules: ModuleRule[]): void {
  if (!rules.some((rule) => rule.path === "*" && rule.scope === "Ignored")) {
    rules.push({ path: "*", scope: "Ignored" });
  }
}

function findRuleByPath(
  rules: ModuleRule[] | undefined,
  rulePath: string,
): ModuleRule | undefined {
  return rules?.find((rule) => rule.path === rulePath);
}

function insertBeforeIgnored(rules: ModuleRule[], rule: ModuleRule): void {
  const ignoredIndex = rules.findIndex(
    (r) => r.path === "*" && r.scope === "Ignored",
  );
  if (ignoredIndex >= 0) rules.splice(ignoredIndex, 0, rule);
  else {
    rules.push(rule);
    ensureTrailingIgnored(rules);
  }
}

/** Ensure Project includes list the collection system name. */
export function ensureModuleCollectionRules(systemName: string): void {
  const filePath = findSaiModuleJsonPath();
  const moduleJson = readModuleFile(filePath);
  const includes = moduleJson.items?.includes;
  if (!includes?.length) {
    throw new Error(`[module-json] No items.includes in ${filePath}`);
  }

  const collectionPath = `/${systemName}`;
  let changed = false;

  for (const include of includes) {
    if (!COLLECTION_INCLUDE_NAMES.has(include.name)) continue;
    if (!include.rules) include.rules = [];

    const existing = findRuleByPath(include.rules, collectionPath);
    const pushOps =
      include.name === "systemSettings"
        ? "CreateAndUpdate"
        : "CreateUpdateAndDelete";

    if (existing) {
      if (existing.scope !== "ItemAndDescendants") {
        existing.scope = "ItemAndDescendants";
        changed = true;
      }
      if (existing.allowedPushOperations !== pushOps) {
        existing.allowedPushOperations = pushOps;
        changed = true;
      }
      continue;
    }

    insertBeforeIgnored(include.rules, {
      path: collectionPath,
      scope: "ItemAndDescendants",
      allowedPushOperations: pushOps,
    });
    changed = true;
  }

  const sitesInclude = includes.find((include) => include.name === "sites");
  if (sitesInclude) {
    if (!sitesInclude.rules) sitesInclude.rules = [];
    if (!findRuleByPath(sitesInclude.rules, collectionPath)) {
      insertBeforeIgnored(sitesInclude.rules, {
        path: collectionPath,
        scope: "ItemAndDescendants",
        rules: [],
      });
      changed = true;
    }
  }

  if (changed) writeModuleFile(filePath, moduleJson);
}

/** Ensure the sites include nests the site under its collection. */
export function ensureModuleSiteRules(
  collectionSystem: string,
  siteSystem: string,
): void {
  ensureModuleCollectionRules(collectionSystem);

  const filePath = findSaiModuleJsonPath();
  const moduleJson = readModuleFile(filePath);
  const sitesInclude = moduleJson.items?.includes?.find(
    (include) => include.name === "sites",
  );
  if (!sitesInclude) {
    throw new Error(`[module-json] Missing sites include in ${filePath}`);
  }
  if (!sitesInclude.rules) sitesInclude.rules = [];

  const collectionPath = `/${collectionSystem}`;
  const sitePath = `/${siteSystem}`;

  let collectionRule = findRuleByPath(sitesInclude.rules, collectionPath);
  if (!collectionRule) {
    collectionRule = {
      path: collectionPath,
      scope: "ItemAndDescendants",
      rules: [],
    };
    insertBeforeIgnored(sitesInclude.rules, collectionRule);
  }
  if (!collectionRule.rules) collectionRule.rules = [];

  const existingSite = findRuleByPath(collectionRule.rules, sitePath);
  if (existingSite) {
    if (!existingSite.rules?.length) {
      existingSite.rules = SITE_CHILD_RULES.map((rule) => ({ ...rule }));
      writeModuleFile(filePath, moduleJson);
    }
    return;
  }

  collectionRule.rules.push({
    path: sitePath,
    rules: SITE_CHILD_RULES.map((rule) => ({ ...rule })),
  });
  writeModuleFile(filePath, moduleJson);
}

function normalizeModulePathSegment(systemName: string): string {
  const raw = String(systemName || "")
    .trim()
    .toLowerCase()
    .replace(/^\/+/, "");
  return raw ? `/${raw}` : "";
}

function isIgnoredStarRule(rule: ModuleRule | undefined): boolean {
  return Boolean(rule && rule.path === "*" && rule.scope === "Ignored");
}

function removeRuleByPath(rules: ModuleRule[], rulePath: string): boolean {
  const want = String(rulePath || "").toLowerCase();
  const idx = rules.findIndex(
    (r) => String(r.path || "").toLowerCase() === want,
  );
  if (idx < 0) return false;
  rules.splice(idx, 1);
  return true;
}

/**
 * Pure mutator: drop `/${collection}` from collection includes + sites.
 * Returns same object reference when unchanged.
 */
export function scrubModuleCollectionRules(
  data: ModuleFile,
  collectionSystem: string,
): { data: ModuleFile; changed: boolean } {
  const collectionPath = normalizeModulePathSegment(collectionSystem);
  if (!collectionPath || !data?.items?.includes?.length) {
    return { data, changed: false };
  }

  let changed = false;
  for (const include of data.items.includes) {
    if (
      !COLLECTION_INCLUDE_NAMES.has(include.name) &&
      include.name !== "sites"
    ) {
      continue;
    }
    if (!include.rules?.length) continue;
    if (removeRuleByPath(include.rules, collectionPath)) {
      changed = true;
    }
  }

  return { data, changed };
}

/**
 * Pure mutator: drop `/${site}` under sites → `/${collection}`.
 * If the collection then has no remaining site children, remove the collection
 * rule from sites only (does not touch templates/media collection rules).
 */
export function scrubModuleSiteRules(
  data: ModuleFile,
  collectionSystem: string,
  siteSystem: string,
): { data: ModuleFile; changed: boolean } {
  const collectionPath = normalizeModulePathSegment(collectionSystem);
  const sitePath = normalizeModulePathSegment(siteSystem);
  if (!collectionPath || !sitePath || !data?.items?.includes?.length) {
    return { data, changed: false };
  }

  const sitesInclude = data.items.includes.find((i) => i.name === "sites");
  if (!sitesInclude?.rules?.length) {
    return { data, changed: false };
  }

  const collectionRule = findRuleByPath(sitesInclude.rules, collectionPath);
  if (!collectionRule?.rules?.length) {
    return { data, changed: false };
  }

  let changed = false;
  if (removeRuleByPath(collectionRule.rules, sitePath)) {
    changed = true;
  }

  const remainingSites = (collectionRule.rules || []).filter(
    (r) => !isIgnoredStarRule(r),
  );
  if (remainingSites.length === 0) {
    if (removeRuleByPath(sitesInclude.rules, collectionPath)) {
      changed = true;
    }
  }

  return { data, changed };
}

export type RemoveModuleRulesResult = {
  path: string;
  changed: boolean;
  missing?: boolean;
};

/**
 * Remove collection rules from SAI *.module.json (templates/media/… + sites).
 * Prefer {@link resetModuleJsonToMinimal} after delete/restore ser sessions.
 */
export function removeModuleCollectionRules(
  collectionSystem: string,
): RemoveModuleRulesResult {
  let filePath: string;
  try {
    filePath = findSaiModuleJsonPath();
  } catch {
    return { path: "", changed: false, missing: true };
  }
  if (!fs.existsSync(filePath)) {
    return { path: filePath, changed: false, missing: true };
  }
  const moduleJson = readModuleFile(filePath);
  const { data, changed } = scrubModuleCollectionRules(
    moduleJson,
    collectionSystem,
  );
  if (changed) writeModuleFile(filePath, data);
  return { path: filePath, changed };
}

/**
 * Remove one site under its collection in the sites include.
 * Prefer {@link resetModuleJsonToMinimal} after delete/restore ser sessions.
 */
export function removeModuleSiteRules(
  collectionSystem: string,
  siteSystem: string,
): RemoveModuleRulesResult {
  let filePath: string;
  try {
    filePath = findSaiModuleJsonPath();
  } catch {
    return { path: "", changed: false, missing: true };
  }
  if (!fs.existsSync(filePath)) {
    return { path: filePath, changed: false, missing: true };
  }
  const moduleJson = readModuleFile(filePath);
  const { data, changed } = scrubModuleSiteRules(
    moduleJson,
    collectionSystem,
    siteSystem,
  );
  if (changed) writeModuleFile(filePath, data);
  return { path: filePath, changed };
}
