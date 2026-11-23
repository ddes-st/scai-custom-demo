#!/usr/bin/env node
/**
 * Regenerate section-plan.json for all sections from an existing manifest.
 * Use when manifest was updated but you don't want a full re-capture.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { writeSectionPlans } from './lib/section-plan.mjs';
import { defaultCapturesDir } from './paths.mjs';

function parseArgs(argv) {
  let project = defaultCapturesDir;
  let section = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--project') project = path.resolve(process.cwd(), argv[++i]);
    if (argv[i] === '--section') section = argv[++i];
    if (argv[i] === '--help' || argv[i] === '-h') {
      console.log('Usage: node write-section-plans.mjs --project ../.bq/captures/{domain} [--section folder-name]');
      process.exit(0);
    }
  }
  return { project, section };
}

async function main() {
  const { project, section } = parseArgs(process.argv.slice(2));
  const manifestPath = path.join(project, 'sections', 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (section) {
    const filtered = Object.fromEntries(
      Object.entries(manifest.components ?? {}).filter(([, entry]) => entry?.folderName === section)
    );
    if (!Object.keys(filtered).length) {
      console.error(`No manifest entry with folderName "${section}"`);
      process.exit(1);
    }
    manifest.components = filtered;
  }
  const result = await writeSectionPlans(project, manifest);
  console.log(`Wrote ${result.written} section-plan.json files under ${result.sectionsRoot}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
