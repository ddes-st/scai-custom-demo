#!/usr/bin/env node
/**
 * Regenerate site-content-tree.json from captured HTML internal links.
 */
import path from 'node:path';
import { buildSiteContentTree } from './lib/build-site-content-tree.mjs';
import { defaultCapturesDir } from './paths.mjs';

function parseArgs(argv) {
  let project = defaultCapturesDir;
  let siteContentPath;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--project') project = path.resolve(process.cwd(), argv[++i]);
    if (argv[i] === '--site-content-path') siteContentPath = argv[++i];
    if (argv[i] === '--help' || argv[i] === '-h') {
      console.log(`Usage: node write-site-content-tree.mjs --project ../.bq/captures/{domain} [--site-content-path /sitecore/content/...]`);
      process.exit(0);
    }
  }
  return { project, siteContentPath };
}

async function main() {
  const { project, siteContentPath } = parseArgs(process.argv.slice(2));
  const { path: outPath, tree } = await buildSiteContentTree(project, { siteContentPath });
  console.log(`Wrote ${outPath} (${tree.stats.total} pages: ${tree.stats.mimicked} mimicked, ${tree.stats.stub} stub)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
