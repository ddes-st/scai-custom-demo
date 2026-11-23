#!/usr/bin/env node
/**
 * Regenerate site-summary.json from existing page manifests (no browser).
 */
import path from 'node:path';
import { buildSiteSummary } from './lib/build-site-summary.mjs';
import { defaultCapturesDir } from './paths.mjs';

function parseArgs(argv) {
  let project = defaultCapturesDir;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--project') project = path.resolve(process.cwd(), argv[++i]);
    if (argv[i] === '--help' || argv[i] === '-h') {
      console.log('Usage: node write-site-summary.mjs --project ../.bq/captures/{domain}');
      process.exit(0);
    }
  }
  return { project };
}

async function main() {
  const { project } = parseArgs(process.argv.slice(2));
  const { path: outPath } = await buildSiteSummary(project);
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
