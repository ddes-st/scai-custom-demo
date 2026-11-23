import path from "node:path";
import { fileURLToPath } from "node:url";

const toolsDir = path.dirname(fileURLToPath(import.meta.url));

/** BQ app root (`bq/`) */
export const FRAMEWORK_ROOT = path.resolve(toolsDir, "../..");

/** Monorepo root (parent of `bq/`) */
export const REPO_ROOT = path.resolve(FRAMEWORK_ROOT, "..");

/**
 * Repo-root working directory for BQ tooling outputs.
 * Same level as `.vscode`.
 *
 * ```
 * .bq/
 *   definitions/     # definitions:generate logs + cache
 *     cache/
 *     definitions-generate.log
 *   captures/
 *     {domain}/     # e.g. www-sitecore-net (www kept)
 *       capture.log
 *       {page}/
 *         screenshots/
 *         html/
 *         css/
 * ```
 */
export const BQ_DOT_DIR = path.join(REPO_ROOT, ".bq");

/** `.bq/definitions` — logs and temps for authoring generate */
export const BQ_DEFINITIONS_DIR = path.join(BQ_DOT_DIR, "definitions");

/** Caches / temp files for definitions:generate (translations, etc.) */
export const BQ_CACHE_DIR = path.join(BQ_DEFINITIONS_DIR, "cache");

/** Detail log from `npm run definitions:generate` */
export const DEFINITIONS_GENERATE_LOG = path.join(
  BQ_DEFINITIONS_DIR,
  "definitions-generate.log",
);

/**
 * Per-run Authoring/Sites API logs for definitions:generate apply.
 * Each run is a subfolder with definition snapshots + api-calls logs.
 */
export const BQ_APPLY_RUNS_DIR = path.join(BQ_DEFINITIONS_DIR, "apply-runs");

/**
 * Suffix for copied `*.definition.ts` snapshots under apply-runs.
 * Must NOT end with `.definition.ts` so discover / apply-source-cache ignore them.
 */
export const DEFINITION_APPLY_SNAPSHOT_SUFFIX = ".definition.ts.apply-snapshot";

/** `.bq/captures` — capture workspace (`{domain}/…` sites + per-project logs) */
export const BQ_CAPTURES_DIR = path.join(BQ_DOT_DIR, "captures");

/**
 * Example / docs path only — real runs write
 * `.bq/captures/{domain}/capture.log`.
 */
export const CAPTURE_LOG = path.join(BQ_CAPTURES_DIR, "{domain}", "capture.log");

/** @deprecated Use CAPTURE_LOG */
export const CAPTURE_GENERATE_LOG = CAPTURE_LOG;

/**
 * Temporary output root for generated Sitecore YAML.
 * Later this will come from site.definition.ts.
 */
export const GENERATED_ROOT = path.join(REPO_ROOT, "authoring", "generated");

export const COMPONENTS_ROOT = path.join(FRAMEWORK_ROOT, "src", "components");

/**
 * Provenance for generated YAML (`__Created by`).
 * BQ = Build Quick (PoCs / demos / customized SAI sites).
 */
export const PROVENANCE_CREATED_BY = "BQ";
