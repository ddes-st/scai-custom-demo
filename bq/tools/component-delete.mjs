/**
 * `npm run component:delete` — remove a BQ component package + BQ-owned YAML.
 *
 * Usage:
 *   npm run component:delete -- --dry-run SitecoreCustomerStory
 *   npm run component:delete -- --apply SitecoreCustomerStory sitecore-footer-branding
 *   npm run component:delete -- --host=sitecore-com --apply SitecoreHeader
 */
import { ensureBqConsole } from './shared/bq-console.mjs';
import { planComponentDelete } from './component-delete/lib.mjs';

ensureBqConsole();

function printHelp() {
  console.log(`Usage: npm run component:delete -- [options] <PackageOrDefinitionKey...>

Remove rename-orphan (or empty stub) packages under bq/src/components/{host}/:
  1. Delete BQ-owned YAML under definition prune roots (+ apply-inventory paths)
  2. Scrub site presentation availableRenderings / layout refs
  3. Delete apply-inventory JSON for the definitionKey
  4. Delete the package folder

Options:
  --host <slug>     Host components folder (default: sitecore-com)
  --dry-run         Plan only (default when --apply is absent)
  --apply           Perform deletes
  --force           Allow delete even if definitionKey is wired on a page/partial
  --help            Show this help

Examples:
  npm run component:delete -- --dry-run SitecoreCustomerStory
  npm run component:delete -- --apply SitecoreCustomerStory sitecore-footer-branding
`);
}

function parseArgs(argv) {
  const out = {
    host: 'sitecore-com',
    apply: false,
    force: false,
    help: false,
    /** @type {string[]} */
    targets: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--apply') out.apply = true;
    else if (a === '--dry-run') out.apply = false;
    else if (a === '--force') out.force = true;
    else if (a === '--host') out.host = argv[++i];
    else if (a.startsWith('--host=')) out.host = a.slice(7);
    else if (a.startsWith('-')) {
      console.error(`Unknown flag: ${a}`);
      process.exit(1);
    } else {
      out.targets.push(a);
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.targets.length) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const mode = args.apply ? 'APPLY' : 'DRY-RUN';
  console.log(`component:delete [${mode}] host=${args.host} targets=${args.targets.length}`);

  let failed = 0;
  for (const target of args.targets) {
    const plan = await planComponentDelete({
      target,
      host: args.host,
      apply: args.apply,
      force: args.force,
    });
    if (!plan.ok) {
      failed += 1;
      console.error(`  ✗ ${target}: ${plan.error}`);
      continue;
    }
    console.log(
      `  ${args.apply ? '✓' : '·'} ${plan.packageName}` +
        (plan.definitionKey ? ` (${plan.definitionKey})` : ' [empty stub]') +
        (plan.wired ? ' [was wired — forced]' : ''),
    );
    console.log(`      package: ${plan.packageDir}`);
    console.log(
      `      yaml: ${plan.yamlWouldDelete.length} BQ-owned` +
        (plan.yamlSkippedNotBq.length
          ? `, ${plan.yamlSkippedNotBq.length} skipped (not BQ)`
          : ''),
    );
    if (plan.scrub) {
      console.log(
        `      presentation scrub: avail=${plan.scrub.removedAvailable} wired=${plan.scrub.removedWired}`,
      );
    }
  }

  if (failed) {
    console.error(`\n${failed} target(s) failed.`);
    process.exit(1);
  }
  if (!args.apply) {
    console.log('\nDry-run only. Re-run with --apply to delete.');
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack || err.message : err);
  process.exit(1);
});
