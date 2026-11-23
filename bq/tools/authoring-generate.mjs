/**
 * Run definitions:generate then content:generate with the same CLI argv.
 * Replaces npm-run-all so flags like --skipPull / --site actually reach tsx.
 * Preserves BQ_PHASE_NEST so nested phase banners from create still apply.
 * Preserves BQ_RUN_T0 so child processes share the elapsed-time clock.
 *
 * Early-exits when apply-source hash matches (scoped) unless --force apply/translations.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureBqConsole } from "./shared/bq-console.mjs";
import {
  parseAuthoringForce,
} from "./shared/authoring-force-kinds.mjs";
import {
  canSkipApplyFromSourceCache,
} from "./shared/apply-source-cache.mjs";
import {
  readPhaseNest,
} from "./shared/phase-log.mjs";

ensureBqConsole();

const __filename = fileURLToPath(import.meta.url);
const bqRoot = path.resolve(path.dirname(__filename), "..");
const require = createRequire(import.meta.url);
const args = process.argv.slice(2);

/**
 * Minimal --site / --collection parse (mirrors generate-scope CLI flags).
 * @param {string[]} argv
 */
function parseScopeArgv(argv) {
  let siteSystem = null;
  let collectionSystem = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--site") siteSystem = String(argv[++i] || "").trim() || null;
    else if (a.startsWith("--site=")) {
      siteSystem = a.slice("--site=".length).trim() || null;
    } else if (a === "--collection") {
      collectionSystem = String(argv[++i] || "").trim() || null;
    } else if (a.startsWith("--collection=")) {
      collectionSystem = a.slice("--collection=".length).trim() || null;
    }
  }
  return {
    siteSystem,
    collectionSystem,
    active: Boolean(siteSystem || collectionSystem),
  };
}

/**
 * Run a local TS tool via node + tsx/cli (no shell — avoids DEP0190).
 * @param {string} scriptRel path under bq/
 */
function runTsx(scriptRel) {
  const tsxCli = require.resolve("tsx/cli");
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [tsxCli, scriptRel, ...args],
      {
        cwd: bqRoot,
        stdio: "inherit",
        env: process.env,
      },
    );
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptRel} exited ${code}`));
    });
    child.on("error", reject);
  });
}

try {
  const scope = parseScopeArgv(args);
  const forceKinds = parseAuthoringForce(args);
  if (scope.active && scope.siteSystem && scope.collectionSystem) {
    const skipCheck = await canSkipApplyFromSourceCache({
      collectionSystem: scope.collectionSystem,
      siteSystem: scope.siteSystem,
      forceKinds,
    });
    if (skipCheck.skip) {
      console.log(
        `[authoring:generate] skip: ${skipCheck.reason} ` +
          `(use --force:apply to regenerate)`,
      );
      process.exit(0);
    }
  }

  const nest = readPhaseNest();
  if (!nest) {
    console.log("\n▶ authoring:generate → definitions:generate");
  }
  await runTsx("tools/definitions/generate.ts");

  const bootstrapSitesOnly =
    args.includes("--bootstrapSitesOnly") ||
    args.includes("--bootstrap-sites-only") ||
    args.some(
      (a) =>
        a.startsWith("--bootstrapSitesOnly=") ||
        a.startsWith("--bootstrap-sites-only="),
    );
  if (bootstrapSitesOnly) {
    console.log(
      "[authoring:generate] content:generate — skipped (intentional — --bootstrapSitesOnly: Sites API warm-up only)",
    );
  } else {
    if (!nest) {
      console.log("\n▶ authoring:generate → content:generate");
    }
    await runTsx("tools/content/generate.ts");
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
