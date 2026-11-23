/**
 * `npm run restore:collection` — restore local disk from a
 * `delete:collection --package` archive, then ser push and reset module.json.
 *
 * Usage:
 *   npm run restore:collection -- --package .bq/delete-packages/collection-….tar.gz
 *   npm run restore:collection -- --package … --dry-run
 *   npm run restore:collection -- --package … --skip-push
 *
 * Restores FE trees, YAML, caches, inventories, capture create-artifacts, and
 * pre-op snapshots. Then: expand module → ser push → reset to `.minimal`.
 * Does NOT recreate Sites API / CM entities (YAML push restores CM item trees).
 */
import path from 'node:path';
import { ensureBqConsole } from './shared/bq-console.mjs';
import { loadLocalEnvFiles } from './shared/load-local-env.ts';
import { restoreCollectionPackage } from './site-delete/delete-package.mjs';
import {
  expandModuleForSerSession,
  resetModuleJsonToMinimal,
} from './definitions/apply/module-json.ts';
import { pushSerializationNow } from './shared/ser-cli.ts';

loadLocalEnvFiles();
ensureBqConsole();

function printHelp() {
  console.log(`Usage:
  npm run restore:collection -- --package <archive.tar.gz>
  npm run restore:collection -- --package <archive.tar.gz> --dry-run
  npm run restore:collection -- --package <archive.tar.gz> --skip-push

Restores local files from an archive created by:
  npm run delete:collection -- --package --name <collection> …

Order (apply): restore disk → expand module.json for collection → ser push →
reset module.json to .minimal.

Options:
  --package <path>   Archive under .bq/delete-packages/ (required)
  --dry-run          List restore actions without writing / pushing
  --skip-push        Restore disk + reset module only (no expand/ser push)
  --help             Show this help
`);
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  const out = {
    /** @type {string|null} */
    packagePath: null,
    dryRun: false,
    skipPush: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--skip-push') out.skipPush = true;
    else if (a === '--package') out.packagePath = argv[++i];
    else if (a.startsWith('--package=')) out.packagePath = a.slice(10);
    else if (a.startsWith('-')) {
      console.error(`Unknown flag: ${a}`);
      process.exit(1);
    } else if (!out.packagePath) {
      out.packagePath = a;
    } else {
      console.error(`Unexpected argument: ${a}`);
      process.exit(1);
    }
  }
  return out;
}

/**
 * @param {{
 *   archivePath: string,
 *   dryRun?: boolean,
 *   skipPush?: boolean,
 *   expandModuleForSerSession?: typeof expandModuleForSerSession,
 *   pushSerializationNow?: typeof pushSerializationNow,
 *   resetModuleJsonToMinimal?: typeof resetModuleJsonToMinimal,
 *   restoreCollectionPackage?: typeof restoreCollectionPackage,
 * }} opts
 */
export async function runRestoreCollection(opts) {
  const dryRun = Boolean(opts.dryRun);
  const skipPush = Boolean(opts.skipPush);
  const restoreFn = opts.restoreCollectionPackage || restoreCollectionPackage;
  const expandFn = opts.expandModuleForSerSession || expandModuleForSerSession;
  const pushFn = opts.pushSerializationNow || pushSerializationNow;
  const resetFn = opts.resetModuleJsonToMinimal || resetModuleJsonToMinimal;

  const result = await restoreFn({
    archivePath: opts.archivePath,
    dryRun,
  });

  /** @type {object|null} */
  let moduleExpanded = null;
  /** @type {object|null} */
  let push = null;
  /** @type {object|null} */
  let moduleReset = null;

  if (dryRun) {
    return {
      ...result,
      moduleExpanded,
      push: { skipped: true, dryRun: true },
      moduleReset: { skipped: true, dryRun: true },
    };
  }

  if (!skipPush && !result.manifest.localOnly) {
    const collectionSystem = String(result.manifest.collectionSystem || '').trim();
    if (!collectionSystem) {
      throw new Error(
        '[restore:collection] manifest missing collectionSystem for ser push',
      );
    }
    const siteSystems = Array.isArray(result.manifest.siteSystems)
      ? result.manifest.siteSystems.map((s) => String(s || '').trim()).filter(Boolean)
      : [];
    moduleExpanded = expandFn({
      collectionSystem,
      siteSystem: siteSystems.length === 1 ? siteSystems[0] : undefined,
    });
    console.log(
      `[restore:collection] expanded module.json for ser push: ${collectionSystem}` +
        (moduleExpanded.siteSystem ? `/${moduleExpanded.siteSystem}` : ''),
    );
    await pushFn({
      reason: `restore:collection ${collectionSystem}`,
    });
    push = { ok: true, skipped: false };
    console.log('[restore:collection] ser push complete');
  } else {
    push = {
      skipped: true,
      reason: skipPush
        ? '--skip-push'
        : result.manifest.localOnly
          ? 'manifest.localOnly'
          : 'skipped',
    };
    console.log(
      `[restore:collection] ser push skipped (${push.reason})`,
    );
  }

  moduleReset = resetFn();
  if (moduleReset?.changed) {
    console.log(
      `[restore:collection] reset module.json to minimal (${moduleReset.path})`,
    );
  }

  return {
    ...result,
    moduleExpanded,
    push,
    moduleReset,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.packagePath) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const mode = args.dryRun ? 'DRY-RUN' : 'RESTORE';
  console.log(
    `restore:collection [${mode}] package=${path.resolve(args.packagePath)}`,
  );

  const result = await runRestoreCollection({
    archivePath: args.packagePath,
    dryRun: args.dryRun,
    skipPush: args.skipPush,
  });

  console.log(
    `  collection=${result.manifest.collectionSystem}` +
      (result.manifest.siteSystems?.length
        ? ` sites=${result.manifest.siteSystems.join(',')}`
        : ''),
  );
  console.log(`  files to restore: ${result.restoredFiles.length}`);
  for (const p of result.restoredFiles.slice(0, 40)) {
    console.log(`    · ${p}`);
  }
  if (result.restoredFiles.length > 40) {
    console.log(`    … +${result.restoredFiles.length - 40} more`);
  }
  console.log(`  snapshots to restore: ${result.restoredSnapshots.length}`);
  for (const p of result.restoredSnapshots.slice(0, 20)) {
    console.log(`    · ${p}`);
  }
  if (result.clearedDisabled.length) {
    console.log(
      `  .disabled cleared/renamed: ${result.clearedDisabled.length}`,
    );
  }

  if (args.dryRun) {
    console.log('\nDry-run only. Re-run without --dry-run to restore.');
    return;
  }

  console.log(
    `  ✓ restored ${result.restoredFiles.length} path(s), ` +
      `${result.restoredSnapshots.length} snapshot(s)`,
  );
  if (result.push?.ok) {
    console.log('  ✓ ser push restored CM serialization trees');
  }
  if (result.moduleReset) {
    console.log('  ✓ module.json resting at .minimal');
  }
  if (result.manifest.localOnly) {
    console.log(
      '  · Original delete was --local-only: no remote push was required.',
    );
  } else if (!result.remoteWasDeleted) {
    console.warn(
      '  ! Package remote status unclear — verify CM if ser push was skipped.',
    );
  }
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
const isDirectRun =
  entry.endsWith(`${path.sep}restore-collection.mjs`) ||
  entry.endsWith(`${path.sep}restore-collection.ts`);

if (isDirectRun) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.stack || err.message : err);
    process.exit(1);
  });
}
