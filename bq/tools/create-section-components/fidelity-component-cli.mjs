/**
 * `npm run fidelity:component` — source/visual fidelity for one existing component.
 * Patches TSX/definition only; never runs authoring:generate / ser pull / ser push.
 */
import { ensureBqConsole } from '../shared/bq-console.mjs';
import { consumeOptionalNumberFlag } from './fidelity-enable.mjs';

ensureBqConsole();

function printHelp() {
  console.log(`Usage: npm run fidelity:component -- --component <PascalName> [options]

Run source and/or visual fidelity against one already-generated component package
under bq/src/components/{host}/{ComponentName}/. Reuses the same fidelity loops as
create:sectioncomponents. Does NOT merge, generate YAML, pull, or push.

Required:
  --component <Name>    PascalCase component folder name (e.g. SitecoreCardGrid)

Capture context:
  --url <https://…>     Captured page URL for crops (default: url in *.capture-meta.json)
  --host <hostSlug>     Host folder under src/components (default: from --url or unique match)

Fidelity (same as create:sectioncomponents; at least one mode via flag or env):
  --source-fidelity[=N] Enable source fidelity (TSX text vs crops → focused JSON patch).
                        Optional min score N (default 90). Patched TSX stays multi-line.
                        Skipped when BQ_SOURCE_FIDELITY_MAX_ITERS=0.
  --visual-fidelity[=N] Enable visual fidelity (render → score → codegen regen → re-score).
                        Optional min score N (default 95).
                        BQ_VISUAL_FIDELITY_MAX_ITERS = max repair rounds (1 = fix once).
                        When both are on, visual wins for that component.
                        Skipped when BQ_VISUAL_FIDELITY_MAX_ITERS=0.

Other:
  --dry-run             Do not write patched TSX/definition (score only where supported)
  --help                Show this help

Examples:
  npm run fidelity:component -- --component SitecoreCardGrid --url "https://www.sitecore.com/" --visual-fidelity=95
  npm run fidelity:component -- --component SitecoreMediaCallout --host sitecore-com --source-fidelity=90

Env: BQ_SOURCE_FIDELITY / BQ_VISUAL_FIDELITY (+ MIN_SCORE / MAX_ITERS) apply the same as create.
Optional stronger scoring model: AZURE_OPENAI_SOURCE_FIDELITY_MODEL.
`);
}

function parseArgs(argv) {
  const out = {
    component: null,
    url: null,
    host: null,
    dryRun: false,
    enableSourceFidelity: false,
    enableVisualFidelity: false,
    /** @type {number|null} */
    sourceFidelityMinScore: null,
    /** @type {number|null} */
    visualFidelityMinScore: null,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const sourceFlag = consumeOptionalNumberFlag(argv, i, '--source-fidelity');
    if (sourceFlag.hit) {
      out.enableSourceFidelity = true;
      out.sourceFidelityMinScore = sourceFlag.value;
      i = sourceFlag.nextIndex - 1;
      continue;
    }
    const visualFlag = consumeOptionalNumberFlag(argv, i, '--visual-fidelity');
    if (visualFlag.hit) {
      out.enableVisualFidelity = true;
      out.visualFidelityMinScore = visualFlag.value;
      i = visualFlag.nextIndex - 1;
      continue;
    }
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--component') out.component = argv[++i];
    else if (a.startsWith('--component=')) out.component = a.slice(12);
    else if (a === '--url') out.url = argv[++i];
    else if (a.startsWith('--url=')) out.url = a.slice(6);
    else if (a === '--host') out.host = argv[++i];
    else if (a.startsWith('--host=')) out.host = a.slice(7);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.component) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const { runFidelityComponent } = await import('./fidelity-component.mjs');
  await runFidelityComponent(args);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack || err.message : err);
  process.exit(1);
});
