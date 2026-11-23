/**
 * Scope definitions:generate / content:generate to a site and/or collection.
 * Optional definitionKey allowlist (create --only) further narrows emit.
 */
import type {
  CollectionDefinition,
  Definition,
  SiteDefinition,
} from "../definitions/types";
import { parseHostnameBrandMarket } from "../create-section-components/naming.mjs";
import { toSystemName } from "./naming";
import { toItemSystemName } from "../definitions/blueprints/clone-blueprint";

export type GenerateScope = {
  /** Sitecore site system name, or null for all sites under collection. */
  siteSystem: string | null;
  /** Sitecore collection system name. */
  collectionSystem: string | null;
  /** True when either flag/env was set. */
  active: boolean;
  /** Hostname (no www) when scope came from `--url` / bare https URL. */
  urlHost?: string | null;
};

/**
 * Kinds always kept when a definitionKey allowlist is active (create --only).
 * Collection/site/presentation + shared field infra for a coherent CM tree.
 */
/** Infra kinds always included in scoped apply (not force-gated alone). */
export const ALWAYS_APPLY_DEFINITION_KINDS = new Set([
  "collection",
  "site",
  "site-presentation",
  "field-validator",
  "enumeration",
  "dictionary",
]);
/** @deprecated Use ALWAYS_APPLY_DEFINITION_KINDS */
export const ALWAYS_EMIT_DEFINITION_KINDS = ALWAYS_APPLY_DEFINITION_KINDS;

/**
 * Parse `--definitionKeys=a,b` / `--definition-keys a b` / `BQ_GENERATE_DEFINITION_KEYS`.
 * When the flag/env is **present** (including empty), allowlist mode is active.
 * When absent, returns null (no key filtering).
 */
export function parseDefinitionKeyAllowlist(
  argv: string[] = process.argv.slice(2),
): Set<string> | null {
  const eq = "--definitionKeys=";
  const eqAlt = "--definition-keys=";
  /** @type {string[]} */
  const collected: string[] = [];
  let flagSeen = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--definitionKeys" || a === "--definition-keys") {
      flagSeen = true;
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        collected.push(next);
        i += 1;
      }
      continue;
    }
    if (a.startsWith(eq)) {
      flagSeen = true;
      collected.push(a.slice(eq.length));
      continue;
    }
    if (a.startsWith(eqAlt)) {
      flagSeen = true;
      collected.push(a.slice(eqAlt.length));
      continue;
    }
  }

  if (Object.prototype.hasOwnProperty.call(process.env, "BQ_GENERATE_DEFINITION_KEYS")) {
    flagSeen = true;
    const envVal = process.env.BQ_GENERATE_DEFINITION_KEYS;
    if (envVal != null && String(envVal).trim()) {
      collected.push(String(envVal));
    }
  }

  if (!flagSeen) return null;

  const keys = new Set<string>();
  for (const chunk of collected) {
    for (const part of String(chunk).split(/[,;\s]+/)) {
      const k = part.trim();
      if (k) keys.add(k);
    }
  }
  return keys;
}

/**
 * After site/collection scope: keep always-required kinds + allowlisted definitionKeys.
 * @param allowlist null = no key filter; Set (possibly empty) = infra + listed keys only
 */
export function definitionMatchesKeyAllowlist(
  def: Definition,
  allowlist: Set<string> | null,
): boolean {
  if (!allowlist) return true;
  if (ALWAYS_APPLY_DEFINITION_KINDS.has(def.kind)) return true;
  const key =
    "definitionKey" in def && def.definitionKey
      ? String(def.definitionKey)
      : "";
  return Boolean(key && allowlist.has(key));
}

export function filterDefinitionsByKeyAllowlist<
  T extends { definition: Definition },
>(loaded: T[], allowlist: Set<string> | null): T[] {
  if (!allowlist) return loaded;
  return loaded.filter((row) =>
    definitionMatchesKeyAllowlist(row.definition, allowlist),
  );
}

/**
 * Content emit: when allowlist is active, only listed component keys (infra N/A).
 */
export function componentKeyInAllowlist(
  definitionKey: string,
  allowlist: Set<string> | null,
): boolean {
  if (!allowlist) return true;
  return allowlist.has(definitionKey);
}

/**
 * Whether `--force` / `--force:apply` (or translations) should bypass mtime
 * and apply-inventory `sourceContentHash` skips for this definition.
 *
 * - No allowlist: force is site-wide (every definition).
 * - Allowlist active: force only for allowlisted component keys; always-emit
 *   infra kinds (collection/site/presentation/…) keep normal hash/mtime skip.
 */
export function shouldForceApplyForDefinition(
  definition: Definition,
  forceApply: boolean,
  allowlist: Set<string> | null,
): boolean {
  if (!forceApply) return false;
  if (!allowlist) return true;
  if (ALWAYS_APPLY_DEFINITION_KINDS.has(definition.kind)) return false;
  const key =
    "definitionKey" in definition && definition.definitionKey
      ? String(definition.definitionKey)
      : "";
  return Boolean(key && allowlist.has(key));
}

function argValue(argv: string[], name: string): string | undefined {
  const flag = `--${name}`;
  const eq = `${flag}=`;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === flag) return argv[i + 1];
    if (a.startsWith(eq)) return a.slice(eq.length);
  }
  return undefined;
}

function hasFlag(argv: string[], ...names: string[]): boolean {
  for (const name of names) {
    const flag = `--${name}`;
    const eq = `${flag}=`;
    for (const a of argv) {
      if (a === flag) return true;
      if (a.startsWith(eq)) {
        const v = a.slice(eq.length).trim().toLowerCase();
        return v !== "0" && v !== "false" && v !== "no";
      }
    }
  }
  return false;
}

/**
 * When set, definitions:generate skips the start orphan-heal + `ser pull`.
 * Used by create:sectioncomponents on the final authoring:generate only.
 */
export function parseSkipPull(
  argv: string[] = process.argv.slice(2),
): boolean {
  return hasFlag(argv, "skipPull", "skip-pull");
}

/**
 * Optional CLI override for Sitecore CLI endpoint name (`ser pull|push -n`).
 * Env `BQ_SITECORE_ENDPOINT` is resolved inside {@link resolveSitecoreEndpoint}.
 */
export function parseSitecoreEndpoint(
  argv: string[] = process.argv.slice(2),
): string | undefined {
  return (
    argValue(argv, "endpoint")?.trim() ||
    argValue(argv, "endpointName")?.trim() ||
    undefined
  );
}

/**
 * When set, definitions:generate skips collection/site Phase 1 emit.
 * Used by create:sectioncomponents on the final authoring:generate only.
 */
export function parseSkipSites(
  argv: string[] = process.argv.slice(2),
): boolean {
  return hasFlag(argv, "skipSites", "skip-sites");
}

/**
 * Create phase 3 only: definitions:generate stops after Sites API (phase 5);
 * authoring:generate skips content:generate. Not a public create CLI flag —
 * passed internally via runAuthoringGenerate({ bootstrapSitesOnly: true }).
 */
export function parseBootstrapSitesOnly(
  argv: string[] = process.argv.slice(2),
): boolean {
  return hasFlag(argv, "bootstrapSitesOnly", "bootstrap-sites-only");
}

/**
 * `--url https://…` or a bare `https://…` argv token (same as create:sectioncomponents).
 */
export function parseGenerateUrlArg(
  argv: string[] = process.argv.slice(2),
): string | undefined {
  const fromFlag = argValue(argv, "url")?.trim();
  if (fromFlag) return fromFlag;
  const fromEnv = process.env.BQ_GENERATE_URL?.trim();
  if (fromEnv) return fromEnv;
  for (const a of argv) {
    if (/^https?:\/\//i.test(a)) return a.trim();
  }
  return undefined;
}

/**
 * Scope from CLI/env:
 * - `--site` / `--collection` / `BQ_GENERATE_*` (explicit wins)
 * - else `--url` / bare https URL / `BQ_GENERATE_URL` → site + collection via hostname
 *   (`https://www.sitecore.com` → site `sitecore-com`, collection `sitecore`)
 */
export function parseGenerateScope(
  argv: string[] = process.argv.slice(2),
): GenerateScope {
  const siteRaw =
    argValue(argv, "site")?.trim() ||
    process.env.BQ_GENERATE_SITE?.trim() ||
    "";
  const collectionRaw =
    argValue(argv, "collection")?.trim() ||
    process.env.BQ_GENERATE_COLLECTION?.trim() ||
    "";
  let siteSystem = siteRaw
    ? toSystemName(siteRaw) || siteRaw.toLowerCase()
    : null;
  let collectionSystem = collectionRaw
    ? toSystemName(collectionRaw) || collectionRaw.toLowerCase()
    : null;

  let urlHost: string | null = null;
  const urlRaw = parseGenerateUrlArg(argv);
  if (urlRaw && (!siteSystem || !collectionSystem)) {
    const parts = parseHostnameBrandMarket(urlRaw);
    urlHost = parts.hostname || null;
    if (!siteSystem && parts.siteSystemName) {
      siteSystem = parts.siteSystemName;
    }
    if (!collectionSystem && parts.collectionSystemName) {
      collectionSystem = parts.collectionSystemName;
    }
  }

  return {
    siteSystem,
    collectionSystem,
    active: Boolean(siteSystem || collectionSystem),
    urlHost,
  };
}

function collectionSystemOf(def: Definition): string | null {
  if (def.kind === "collection") {
    return (
      def.systemName?.trim() || toItemSystemName(def.name)
    ).toLowerCase();
  }
  if (def.kind === "site") {
    if ("collectionSystem" in def && def.collectionSystem) {
      return def.collectionSystem.trim().toLowerCase();
    }
    if ("collection" in def && def.collection) {
      return (
        def.collection.systemName?.trim() ||
        toItemSystemName(def.collection.name)
      ).toLowerCase();
    }
    return null;
  }
  if (
    "collectionSystem" in def &&
    typeof (def as { collectionSystem?: string }).collectionSystem === "string"
  ) {
    const v = (def as { collectionSystem?: string }).collectionSystem?.trim();
    return v ? v.toLowerCase() : null;
  }
  if (
    "location" in def &&
    def.location &&
    typeof def.location === "object" &&
    "collectionSystem" in def.location
  ) {
    const v = (def.location as { collectionSystem?: string }).collectionSystem?.trim();
    return v ? v.toLowerCase() : null;
  }
  return null;
}

function siteSystemOf(def: Definition): string | null {
  if (def.kind === "site") {
    return (
      def.systemName?.trim() || toItemSystemName(def.name)
    ).toLowerCase();
  }
  if ("siteSystem" in def && typeof def.siteSystem === "string") {
    const v = def.siteSystem.trim();
    return v ? v.toLowerCase() : null;
  }
  return null;
}

/**
 * Resolve collection from a site definition when only `--site` was provided.
 */
export function resolveScopeCollection(
  scope: GenerateScope,
  loaded: Definition[],
): GenerateScope {
  if (!scope.active) return scope;
  if (scope.collectionSystem) return scope;
  if (!scope.siteSystem) return scope;

  const site = loaded.find(
    (d): d is SiteDefinition =>
      d.kind === "site" && siteSystemOf(d) === scope.siteSystem,
  );
  if (!site) {
    throw new Error(
      `[generate] --site "${scope.siteSystem}" has no matching kind: "site" definition; ` +
        `pass --collection as well or add the site definition.`,
    );
  }
  const collection = collectionSystemOf(site);
  if (!collection) {
    throw new Error(
      `[generate] site "${scope.siteSystem}" has no collectionSystem / collection.`,
    );
  }
  return { ...scope, collectionSystem: collection };
}

export function definitionMatchesScope(
  def: Definition,
  scope: GenerateScope,
): boolean {
  if (!scope.active) return true;

  const coll = collectionSystemOf(def);
  const site = siteSystemOf(def);

  if (def.kind === "collection") {
    return Boolean(
      scope.collectionSystem && coll === scope.collectionSystem,
    );
  }

  if (def.kind === "site") {
    if (scope.siteSystem) return site === scope.siteSystem;
    return Boolean(scope.collectionSystem && coll === scope.collectionSystem);
  }

  if (
    def.kind === "site-presentation" ||
    def.kind === "page-stub" ||
    def.kind === "page"
  ) {
    if (scope.siteSystem && site && site !== scope.siteSystem) return false;
    if (scope.collectionSystem && coll && coll !== scope.collectionSystem) {
      return false;
    }
    if (scope.siteSystem && !site) return false;
    if (scope.collectionSystem && !coll) return false;
    return true;
  }

  // Shared infra without collection: keep when scoped (validators/enums often shared).
  if (def.kind === "field-validator" || def.kind === "enumeration") {
    if (!coll) return true;
    return coll === scope.collectionSystem;
  }

  if (def.kind === "dictionary") {
    if (!coll || coll !== scope.collectionSystem) return false;
    // When site-scoped, dictionaries with a siteSystem must match that site.
    if (scope.siteSystem && site && site !== scope.siteSystem) return false;
    return true;
  }

  // Components / renderings / data / media / parameters / variants.
  if (!coll || coll !== scope.collectionSystem) return false;
  // Site-scoped: other websites' defs (different siteSystem) are excluded;
  // defs with no siteSystem stay (shared within the collection).
  if (scope.siteSystem && site && site !== scope.siteSystem) return false;
  return true;
}

export function filterDefinitionsByScope<T extends { definition: Definition }>(
  loaded: T[],
  scope: GenerateScope,
): T[] {
  if (!scope.active) return loaded;
  return loaded.filter((row) => definitionMatchesScope(row.definition, scope));
}

export function formatScopeLog(
  scope: GenerateScope,
  kept: number,
  total: number,
): string {
  if (!scope.active) return "";
  const bits = [
    scope.urlHost ? `urlHost=${scope.urlHost}` : null,
    scope.siteSystem ? `site=${scope.siteSystem}` : null,
    scope.collectionSystem ? `collection=${scope.collectionSystem}` : null,
  ].filter(Boolean);
  return `scope: ${bits.join(" ")} → ${kept}/${total} definitions`;
}

/**
 * For content:generate — keep content whose component matches scoped collection
 * and (when site-scoped) siteSystem.
 */
export function componentKeyAllowed(
  definitionKey: string,
  componentCollectionByKey: Map<string, string | null>,
  scope: GenerateScope,
  componentSiteByKey?: Map<string, string | null>,
): boolean {
  if (!scope.active || !scope.collectionSystem) return true;
  const coll = componentCollectionByKey.get(definitionKey);
  if (!coll || coll !== scope.collectionSystem) return false;
  if (scope.siteSystem && componentSiteByKey) {
    const site = componentSiteByKey.get(definitionKey);
    if (site && site !== scope.siteSystem) return false;
  }
  return true;
}

/** Exported for tests. */
export function siteSystemFromDefinition(def: Definition): string | null {
  return siteSystemOf(def);
}

export function collectionSystemFromDefinition(
  def: CollectionDefinition | Definition,
): string | null {
  return collectionSystemOf(def as Definition);
}

/** @deprecated Use shouldForceApplyForDefinition */
export const shouldForceYamlForDefinition = shouldForceApplyForDefinition;
