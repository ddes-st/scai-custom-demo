/**
 * Delete a BQ site or entire collection (remote → ser pull → local).
 *
 * Preferred for create reset (keeps capture:webpage crops):
 *   npm run create:sectioncomponents:reset -- --url "https://www.sitecore.com"
 *
 * Also:
 *   npm run delete:collection -- --url "https://www.sitecore.com"
 *   npm run delete:site -- --url "https://www.sitecore.com/products"
 *   npm run delete:collection -- --url "https://www.sitecore.com" --local-only
 *
 * Deletes immediately. Pass --dry-run to preview only.
 */
import path from 'node:path';
import { ensureBqConsole } from './shared/bq-console.mjs';
import { loadLocalEnvFiles } from './shared/load-local-env.ts';
import {
  resolveDeletePlan,
  flattenPlanPaths,
  applyDeletePlan,
  probeRemoteDeleteTarget,
  resolveIdentityFromInput,
} from './site-delete/lib.mjs';
import { packageCollectionDeleteArchive } from './site-delete/delete-package.mjs';

loadLocalEnvFiles();
ensureBqConsole();

function printHelp(modeHint) {
  const mode = modeHint || 'site|collection';
  console.log(`Usage:
  npm run create:sectioncomponents:reset -- --url "https://www.sitecore.com"
  npm run delete:collection -- --url "https://www.sitecore.com"
  npm run delete:site -- --url "https://www.sitecore.com/products"
  npm run delete:collection -- --name sitecore
  npm run delete:site -- --name sitecore-com
  npm run delete:collection -- --url "https://www.sitecore.com" --local-only

Order (default): Sites API delete → hash-folder + YAML + FE/cache scrub →
reset module.json to .minimal. No module expand / ser pull.
With --package (collection): expand module → ser pull → write archive →
Sites API delete → local scrub → reset to .minimal.
With --local-only: local cleanup only, then reset module.json to .minimal
(no expand, no Sites API, no ser pull).

Deletes / resets create:sectioncomponents output:
  • Remote Sites API (collection: force-delete child sites, then collection)
    — skipped with --local-only (YAML-resource collections/sites from GitHub)
  • FE packages, caches, authoring YAML trees for the target scope
  • SCS path-length hash folders (sai/sites|templates/{hex}/) for that collection/site
  • Renames *.definition.ts → *.definition.ts.disabled (not deleted)
  • Under captures: only create/merge artifacts (section-registry, *-conversion.json,
    ai-debug, ai-website-design, site-summary, registrySection backlinks)
    — never wholesale-deletes .bq/captures/<host>/
  • Ends by resetting bq-demo.module.json from .minimal (resting create/apply shape)
Keeps capture project root + webpage crops (section.html, screenshots, page-meta, section-information, …).
Translation cache (.bq/definitions/cache/translations.json) is kept.

Collection packaging (opt-in):
  • delete:collection without --package — delete only (no expand / ser pull)
  • delete:collection --package — expand + ser pull, archive .bq/delete-packages/collection-*.tar.gz, then delete
  • restore:collection --package <archive> — restore disk, ser push, reset module.json

Options:
  --url <url>        Any page/host URL under the brand (path ignored)
  --name <system>    System name (sitecore / sitecore-com)
  --dry-run          Preview only — do not delete
  --package          (collection) Expand/pull, archive deleted paths + snapshots, then delete
  --local-only       Local cleanup only: no Sites API, no ser pull
                     (YAML-resource collections/sites deployed from GitHub)
  --help             Show this help

Current mode: ${mode}
`);
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  const out = {
    /** @type {'site'|'collection'|null} */
    mode: null,
    /** @type {string|null} */
    url: null,
    /** @type {string|null} */
    name: null,
    // legacy flags still accepted
    site: /** @type {string|null} */ (null),
    collection: /** @type {string|null} */ (null),
    apply: true,
    localOnly: false,
    package: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--apply') out.apply = true; // no-op; kept for old muscle memory
    else if (a === '--dry-run') out.apply = false;
    else if (a === '--package') out.package = true;
    else if (a === '--local-only') out.localOnly = true;
    else if (a === '--skip-remote' || a === '--skip-pull') {
      console.error(
        `Removed flag ${a}. Use --local-only (skips Sites API and ser pull).`,
      );
      process.exit(1);
    } else if (a === '--mode') out.mode = /** @type {'site'|'collection'} */ (argv[++i]);
    else if (a.startsWith('--mode=')) {
      out.mode = /** @type {'site'|'collection'} */ (a.slice(7));
    } else if (a === '--url') out.url = argv[++i];
    else if (a.startsWith('--url=')) out.url = a.slice(6);
    else if (a === '--name') out.name = argv[++i];
    else if (a.startsWith('--name=')) out.name = a.slice(7);
    else if (a === '--site') out.site = argv[++i];
    else if (a.startsWith('--site=')) out.site = a.slice(7);
    else if (a === '--collection') out.collection = argv[++i];
    else if (a.startsWith('--collection=')) out.collection = a.slice(13);
    else if (a.startsWith('-')) {
      console.error(`Unknown flag: ${a}`);
      process.exit(1);
    } else if (!out.url && !out.name) {
      // bare URL or name as first positional
      if (/^(https?:\/\/)/i.test(a) || /\./.test(a.split('/')[0])) out.url = a;
      else out.name = a;
    } else {
      console.error(`Unexpected argument: ${a}`);
      process.exit(1);
    }
  }
  if (out.mode && out.mode !== 'site' && out.mode !== 'collection') {
    console.error(`Invalid --mode ${out.mode} (use site or collection)`);
    process.exit(1);
  }
  return out;
}

/**
 * Map CLI args → resolveDeletePlan input.
 * @param {ReturnType<typeof parseArgs>} args
 */
function toPlanArgs(args) {
  const target = args.url || args.name || args.site || args.collection || null;

  // Explicit legacy flags win when no --mode
  if (!args.mode) {
    if (args.collection) {
      return { collection: args.collection, site: null, url: null };
    }
    if (args.site) {
      return { site: args.site, collection: null, url: null };
    }
    if (args.url && !args.name) {
      // Ambiguous without mode — require delete:site / delete:collection
      throw new Error(
        'Use npm run delete:collection or delete:site (or pass --mode).',
      );
    }
  }

  if (!target) {
    throw new Error('Pass --url or --name (e.g. --url "https://www.sitecore.com").');
  }

  if (args.mode === 'collection') {
    return { collection: target, site: null, url: null };
  }
  if (args.mode === 'site') {
    // Prefer url channel so deep paths resolve via hostname helpers
    if (args.url || (target && /^(https?:\/\/)/i.test(target)) || /\./.test(String(target).split('/')[0])) {
      return { url: target, site: null, collection: null };
    }
    return { site: target, collection: null, url: null };
  }

  throw new Error('Use npm run delete:collection or delete:site.');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp(args.mode);
    process.exit(0);
  }

  let planArgs;
  try {
    planArgs = toPlanArgs(args);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    printHelp(args.mode);
    process.exit(1);
  }

  let plan;
  try {
    plan = await resolveDeletePlan(planArgs);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    printHelp(args.mode);
    process.exit(1);
  }

  const flat = flattenPlanPaths(plan);
  const label = plan.mode === 'collection' ? 'delete:collection' : 'delete:site';
  const mode = args.apply ? 'DELETE' : 'DRY-RUN';
  console.log(
    `${label} [${mode}] collection=${plan.collectionSystem}` +
      (plan.siteSystem ? ` site=${plan.siteSystem}` : '') +
      (args.localOnly ? ' (local-only)' : '') +
      (args.package ? ' (--package)' : ''),
  );

  if (plan.mode === 'collection') {
    console.log(
      `  sites in plan: ${(plan.local.sitePlans || []).map((s) => s.siteSystem).join(', ') || '(none found locally)'}`,
    );
  } else {
    const raw = args.url || args.name || args.site || '';
    try {
      const id = resolveIdentityFromInput(raw);
      console.log(
        `  resolved → host=${id.hostname} site=${id.siteSystem} collection=${id.collectionSystem}`,
      );
    } catch {
      /* already resolved */
    }
  }

  if (!args.localOnly) {
    const probe = await probeRemoteDeleteTarget(plan);
    if (probe.error) {
      console.log(`  remote: probe failed (${probe.error})`);
    } else if (probe.found) {
      console.log(
        `  remote: found name=${probe.name}` +
          (probe.id ? ` id=${probe.id}` : ''),
      );
    } else {
      console.log('  remote: not found (already gone)');
    }
  } else {
    console.log('  remote: skipped (--local-only)');
  }

  console.log(`  dirs to remove: ${flat.dirs.length}`);
  for (const d of flat.dirs.slice(0, 40)) console.log(`    · ${d}`);
  if (flat.dirs.length > 40) console.log(`    … +${flat.dirs.length - 40} more`);
  console.log(
    `  capture roots to scrub (create artifacts only): ${(flat.captureRoots || []).length}`,
  );
  for (const c of (flat.captureRoots || []).slice(0, 20)) console.log(`    · ${c}`);
  if ((flat.captureRoots || []).length > 20) {
    console.log(`    … +${flat.captureRoots.length - 20} more`);
  }
  console.log(
    `  definition files to disable: ${(flat.definitionFiles || flat.files || []).length}`,
  );
  for (const f of flat.definitionFiles || flat.files || []) {
    console.log(`    · ${f} → ${f}.disabled`);
  }
  console.log(
    `  yaml roots (removed before ser pull): ${flat.yamlRoots.length}`,
  );
  for (const y of flat.yamlRoots.slice(0, 20)) console.log(`    · ${y}`);
  if (flat.yamlRoots.length > 20) {
    console.log(`    … +${flat.yamlRoots.length - 20} more`);
  }
  const hashDirs = flat.hashOrphanDirs || [];
  console.log(`  SCS hash-folder orphans: ${hashDirs.length}`);
  for (const h of hashDirs.slice(0, 20)) console.log(`    · ${h}`);
  if (hashDirs.length > 20) {
    console.log(`    … +${hashDirs.length - 20} more`);
  }
  console.log(`  definitionKeys / inventories: ${flat.definitionKeys.length}`);
  console.log(`  apply-source keys: ${flat.emitSourceKeys.join(', ') || '(none)'}`);
  console.log(`  url-routes keys: ${flat.urlRoutesKeys.join(', ') || '(none)'}`);
  if (flat.urlRoutesCollectionPrefixes?.length) {
    console.log(
      `  url-routes collection prefixes: ${flat.urlRoutesCollectionPrefixes
        .map((p) => `${p}/`)
        .join(', ')}`,
    );
  }

  if (!args.apply) {
    if (args.package && plan.mode === 'collection') {
      const pkg = await packageCollectionDeleteArchive({
        plan,
        flat,
        localOnly: args.localOnly,
        dryRun: true,
        cliArgs: process.argv.slice(2),
      });
      console.log(
        `  --package dry-run: would archive ${pkg.deletedCount} path(s), ` +
          `${pkg.snapshotCount} snapshot(s), ${pkg.renameCount} rename(s)`,
      );
      console.log(`    → ${pkg.archivePath}`);
      for (const p of (pkg.deleted || []).slice(0, 30)) {
        console.log(`    · files ${p}`);
      }
      if ((pkg.deleted || []).length > 30) {
        console.log(`    … +${pkg.deleted.length - 30} more`);
      }
      for (const s of (pkg.snapshots || []).slice(0, 20)) {
        console.log(`    · snapshot (${s.reason}) ${s.repoPath}`);
      }
    } else if (args.package) {
      console.log('  --package ignored (only supported for delete:collection)');
    }
    console.log('\nDry-run only. Re-run without --dry-run to delete.');
    return;
  }

  console.log('\nDeleting…');
  try {
    const { result } = await applyDeletePlan(plan, {
      apply: true,
      localOnly: args.localOnly,
      package: args.package,
      cliArgs: process.argv.slice(2),
    });
    if (result.package?.archivePath && !result.package.dryRun) {
      console.log(`  ✓ package ${result.package.archivePath}`);
    }
    console.log(
      `  ✓ local dirs=${result.local.removedDirs.length}` +
        ` defs-disabled=${result.local.disabledDefinitions?.length || 0}` +
        (result.local.removedYaml?.length
          ? ` yaml=${result.local.removedYaml.length}`
          : '') +
        (result.local.hashOrphansRemoved?.length
          ? ` hash-orphans=${result.local.hashOrphansRemoved.length}`
          : '') +
        (result.local.captureScrubRemoved?.length
          ? ` capture-scrub=${result.local.captureScrubRemoved.length}`
          : '') +
        (result.local.captureScrubStripped?.length
          ? ` section-info-stripped=${result.local.captureScrubStripped.length}`
          : '') +
        ` inventories=${result.local.inventories.length}`,
    );
    for (const d of result.local.disabledDefinitions || []) {
      console.log(`      ${path.basename(d.from)} → ${path.basename(d.to)}`);
    }
    if (result.local.emitSource?.changed) {
      console.log(`  ✓ scrubbed apply-source.json`);
    }
    if (result.local.urlRoutes?.changed) {
      console.log(`  ✓ scrubbed url-routes.json`);
    }
    if (result.local.moduleExpanded) {
      console.log(
        `  ✓ expanded module.json for ser session (${
          result.local.moduleExpanded.collectionSystem
        }${
          result.local.moduleExpanded.siteSystem
            ? `/${result.local.moduleExpanded.siteSystem}`
            : ''
        })`,
      );
    }
    if (result.local.moduleReset?.changed || result.local.moduleJson?.changed) {
      console.log(
        `  ✓ reset module.json to minimal (${
          result.local.moduleReset?.path ||
          result.local.moduleJson?.path ||
          'SAI module'
        })`,
      );
    }
    if (result.local.owned?.changed) {
      console.log(`  ✓ scrubbed bq-sites-api-owned.json`);
    }
    console.log('  · translations.json left intact');
    if (args.localOnly) {
      console.log('  · remote skipped (--local-only)');
      console.log('  · ser pull skipped (--local-only)');
    } else if (result.remote.action === 'missing') {
      console.log('  · remote: entity not found (already gone)');
    } else if (result.remote.action) {
      console.log(
        `  ✓ remote ${result.remote.action}` +
          (result.remote.id ? ` id=${result.remote.id}` : '') +
          (result.remote.deletedSites?.length
            ? ` (sites: ${result.remote.deletedSites.join(', ')})`
            : ''),
      );
    }
    if (result.pull.skipped && !args.localOnly) {
      console.log('  · ser pull skipped (only used with --package)');
    } else if (result.pull.softFailed) {
      console.log(
        '  · ser pull soft-failed (EXTRA ITEM / integrity after expand); continued',
      );
    } else if (result.pull.ok) {
      console.log('  ✓ ser pull synced authoring YAML for package');
    }
    if (result.local.yamlRootsRemovedBeforePull?.length) {
      console.log(
        `  ✓ YAML roots removed before pull: ${result.local.yamlRootsRemovedBeforePull.length}`,
      );
    }
  } catch (err) {
    console.error(
      '\nDelete failed (expand/ser pull, remote, and/or local cleanup).',
    );
    console.error(err instanceof Error ? err.message : err);
    console.error(
      'If Sites API jobs are stuck, or the collection is a YAML resource from GitHub:\n' +
        `  npm run delete:${plan.mode} -- --url "<url>" --local-only`,
    );
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack || err.message : err);
  process.exit(1);
});
