/**
 * Orchestrate pixel-perfect experiments: generate → score → report.
 *
 *   node tools/_experiments/pixel-perfect-home/run-all.mjs
 *   node tools/_experiments/pixel-perfect-home/run-all.mjs --phase harness|deterministic|ai|external|score|report|all
 *   node tools/_experiments/pixel-perfect-home/run-all.mjs --skip-ai
 */
import path from 'node:path';
import { readdir } from 'node:fs/promises';
import { runDeterministicAll } from './methods/m1-m5.mjs';
import { runAiAll } from './methods/m6-m10.mjs';
import { runExternalAll } from './methods/m11-m15.mjs';
import { runM16 } from './methods/m16-neko.mjs';
import { runNekoUrlAll } from './methods/m16u-neko.mjs';
import { runM16F } from './methods/m16f-neko-page.mjs';
import { runM16S } from './methods/m16s-neko-shots.mjs';
import { runM17 } from './methods/m17-v0.mjs';
import { scoreMethodTarget } from './harness/score.mjs';
import { writeReport } from './harness/report.mjs';
import {
  methodsOutRoot,
  reportsOutRoot,
  SAMPLE_SECTIONS,
  experimentOutRoot,
} from './lib/paths.mjs';
import { ensureDir as ensure } from './lib/io.mjs';

function parseArgs(argv) {
  const out = { phase: 'all', skipAi: false, methodsFilter: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--phase') out.phase = argv[++i];
    if (argv[i] === '--skip-ai') out.skipAi = true;
    if (argv[i] === '--methods') out.methodsFilter = argv[++i].split(',').map((s) => s.trim());
  }
  return out;
}

async function scoreAllMethods(methodsFilter = null) {
  const { chromium } = await import('playwright');
  const { startStaticServer } = await import('./harness/static-server.mjs');
  const server = await startStaticServer();
  const browser = await chromium.launch({ headless: true });
  let methods = await readdir(methodsOutRoot).catch(() => []);
  if (methodsFilter?.length) {
    methods = methods.filter((m) => methodsFilter.includes(m));
  }
  const summaries = [];
  try {
    for (const method of methods.sort()) {
      const methodDir = path.join(methodsOutRoot, method);
      const targets = await readdir(methodDir).catch(() => []);
      for (const target of targets) {
        const targetDir = path.join(methodDir, target);
        if (target.endsWith('.md') || target.endsWith('.json')) continue;
        const previewHtml = path.join(targetDir, 'preview.html');
        try {
          const { access } = await import('node:fs/promises');
          await access(previewHtml);
        } catch {
          continue;
        }
        console.log(`Scoring ${method}/${target}…`);
        try {
          const kind = target === 'full-page' ? 'page' : 'section';
          const summary = await scoreMethodTarget(targetDir, {
            kind,
            baseUrl: server.baseUrl,
            browser,
          });
          summaries.push(summary);
          console.log(`  avg mismatch ${summary.avgMismatchPercent ?? 'n/a'}%`);
        } catch (err) {
          console.error(`  score failed:`, err instanceof Error ? err.message : err);
        }
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }
  return summaries;
}

async function composePathA() {
  // Compose M02 section samples into a mini full page (section-first path)
  const parts = [];
  for (const section of SAMPLE_SECTIONS) {
    const p = path.join(methodsOutRoot, 'M02', section, 'preview.html');
    try {
      const { readFile } = await import('node:fs/promises');
      const html = await readFile(p, 'utf8');
      const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] || html;
      parts.push(`<!-- ${section} -->\n${body}`);
    } catch {
      /* skip */
    }
  }
  const { wrapHtmlDocument } = await import('./lib/io.mjs');
  const { withStabilize } = await import('./lib/preview-tweaks.mjs');
  const { writeMethodArtifacts } = await import('./lib/io.mjs');
  await writeMethodArtifacts('PATH_A', 'full-page', {
    tsx: `/** Path A: section-first compose of M02 samples */\nexport default function PathA(){return null}\n`,
    previewHtml: wrapHtmlDocument(parts.join('\n'), {
      title: 'Path A compose',
      extraHead: withStabilize(),
    }),
    meta: { path: 'A', note: 'Compose of sample sections only (not all 13)' },
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await ensure(experimentOutRoot);
  await ensure(methodsOutRoot);
  await ensure(reportsOutRoot);

  const phase = args.phase;
  if (phase === 'harness' || phase === 'all') {
    console.log('--- Phase harness: smoke score M1 oracle after generate ---');
  }

  if (phase === 'deterministic' || phase === 'all') {
    console.log('=== Deterministic M1–M5 ===');
    await runDeterministicAll(SAMPLE_SECTIONS);
  }

  if ((phase === 'ai' || phase === 'all') && !args.skipAi) {
    console.log('=== AI M6–M10 (sample section-04 only for cost) ===');
    await runAiAll(['section-04']);
  } else if (args.skipAi) {
    console.log('Skipping AI methods (--skip-ai)');
  }

  if (phase === 'external' || phase === 'all') {
    console.log('=== External M11–M15 ===');
    await runExternalAll();
  }

  if (phase === 'compose' || phase === 'all') {
    console.log('=== Path A compose ===');
    await composePathA();
  }

  if (phase === 'neko' || phase === 'neko-v0') {
    console.log('=== M16 NEKO (capture HTML) ===');
    await runM16();
    console.log('=== M16U NEKO (live URL) + M16U-PROMPT ===');
    await runNekoUrlAll();
  }

  if (phase === 'v0' || phase === 'neko-v0') {
    console.log('=== M17 v0 API ===');
    await runM17();
  }

  if (phase === 'neko' || phase === 'v0' || phase === 'neko-v0') {
    console.log('=== Scoring NEKO/v0 methods ===');
    await scoreAllMethods(['M16', 'M16U', 'M16U-PROMPT', 'M17']);
    console.log('=== Report ===');
    const rows = await writeReport();
    console.log(`Leaderboard rows: ${rows.length}`);
    return;
  }

  if (phase === 'neko-page-shots') {
    console.log('=== M16F NEKO full-page HTML (absolute URLs) ===');
    await runM16F();
    console.log('=== M16S NEKO section-03 + 3 screenshots ===');
    await runM16S(['section-03']);
    console.log('=== Scoring M16F / M16S ===');
    await scoreAllMethods(['M16F', 'M16S']);
    console.log('=== Report ===');
    const rows = await writeReport();
    console.log(`Leaderboard rows: ${rows.length}`);
    return;
  }

  if (phase === 'score' || phase === 'all') {
    console.log('=== Scoring ===');
    await scoreAllMethods(args.methodsFilter);
  }

  if (phase === 'report' || phase === 'all') {
    console.log('=== Report ===');
    const rows = await writeReport();
    console.log(`Leaderboard rows: ${rows.length}`);
  }

  console.log('Done. Outputs:', experimentOutRoot);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
