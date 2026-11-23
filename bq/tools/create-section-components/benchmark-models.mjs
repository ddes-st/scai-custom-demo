/**
 * Benchmark screenshot→TSX multimodal models on known-bad sections.
 *
 * Usage (from bq/):
 *   node tools/create-section-components/benchmark-models.mjs --url <https://…> \
 *     --only section-04,section-07 --models deployA,deployB
 *
 * Env:
 *   AZURE_OPENAI_SCREENSHOT_CONVERSION_MODEL — baseline (also first candidate if --models omitted)
 *   AZURE_OPENAI_BENCHMARK_MODELS — comma-separated deploy names (optional)
 *
 * Writes: .bq/benchmarks/layout-fidelity-{timestamp}.json
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadLocalEnvFiles } from '../capture/lib/design-system/load-env.mjs';
import { azureChatCompletion } from '../capture/lib/design-system/ai/azure-chat.mjs';
import { bqRoot } from '../capture/paths.mjs';
import {
  buildSectionEvidenceParts,
  loadPreferredSectionHtml,
  screenshotConversionModel,
} from './ai-codegen.mjs';
import { createAiLedger } from './ai-ledger.mjs';
import { formatLayoutHintsForPrompt } from './layout-hints.mjs';
import { resolveCapturePageDir } from './resolve-capture.mjs';

function parseArgs(argv) {
  const out = {
    url: null,
    only: [],
    models: [],
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--url') out.url = argv[++i];
    else if (a.startsWith('--url=')) out.url = a.slice(6);
    else if (a === '--only') out.only = String(argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (a.startsWith('--only='))
      out.only = a
        .slice(7)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    else if (a === '--models')
      out.models = String(argv[++i] || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    else if (a.startsWith('--models='))
      out.models = a
        .slice(9)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
  }
  return out;
}

function printHelp() {
  console.log(`Usage: node tools/create-section-components/benchmark-models.mjs --url <https://…> [options]

Options:
  --url <url>              Captured page URL (required)
  --only <section-NN,…>    Sections to score (default: first 5 section folders)
  --models <deploy,…>      Azure deploy names to compare
  --help

Compares models on a short multimodal fidelity probe (not full codegen).
Full regeneration still uses create:sectioncomponents with AZURE_OPENAI_SCREENSHOT_CONVERSION_MODEL.
`);
}

async function listSectionFolders(pageDir) {
  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(path.join(pageDir, 'sections'), { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && /^section-\d+$/i.test(e.name))
    .map((e) => e.name)
    .sort();
}

async function scoreSectionWithModel({ pageDir, sectionFolder, info, html, model, ledger }) {
  const { parts: evidence } = await buildSectionEvidenceParts(
    pageDir,
    sectionFolder,
    info,
    { attachScreenshots: true },
  );
  const hints = formatLayoutHintsForPrompt(info, html);
  const result = await azureChatCompletion({
    messages: [
      {
        role: 'system',
        content:
          'You score how well a future TSX implementation can match these screenshots. Return JSON only: { "score": 0-100, "risks": ["…"], "notes": "…" }. Higher score = clearer near-pixel-perfect layout cues in the crops.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: [
              `Section: ${sectionFolder}`,
              `cmsName: ${info.cmsName || ''}`,
              hints,
              'Rate screenshot clarity for near pixel-perfect TSX (columns, gaps, accordion vs carousel, type).',
            ].join('\n'),
          },
          ...evidence,
        ],
      },
    ],
    responseFormat: { type: 'json_object' },
    model,
  });

  ledger.record({
    purpose: 'model-benchmark',
    section: sectionFolder,
    componentName: info.cmsName || sectionFolder,
    ok: result.ok,
    model: result.model || model,
    usage: result.usage,
    costEstimate: result.costEstimate,
    skipReason: result.skipReason,
  });

  let parsed = null;
  if (result.ok) {
    try {
      parsed = JSON.parse(String(result.content || '').replace(/^```json\s*|\s*```$/g, ''));
    } catch {
      parsed = { notes: 'parse failed', raw: String(result.content || '').slice(0, 500) };
    }
  }

  return {
    model: result.model || model,
    ok: result.ok,
    score: Number(parsed?.score),
    risks: parsed?.risks || [],
    notes: parsed?.notes || result.skipReason || '',
    usage: result.usage,
    costEstimate: result.costEstimate,
  };
}

async function main() {
  loadLocalEnvFiles({ root: bqRoot });
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.url) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const baseline = screenshotConversionModel();
  const envModels = String(process.env.AZURE_OPENAI_BENCHMARK_MODELS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const models = [...new Set([...(args.models.length ? args.models : envModels), baseline].filter(Boolean))];
  if (models.length === 0) {
    console.error('No models configured. Set AZURE_OPENAI_SCREENSHOT_CONVERSION_MODEL or --models.');
    process.exit(1);
  }

  const capture = await resolveCapturePageDir(args.url);
  let sections = args.only.length ? args.only : await listSectionFolders(capture.pageDir);
  if (!args.only.length) sections = sections.slice(0, 5);

  const ledger = createAiLedger();
  /** @type {object[]} */
  const rows = [];

  console.log(`Benchmark models: ${models.join(', ')}`);
  console.log(`Sections: ${sections.join(', ')}`);
  console.log(`Baseline (conversion): ${baseline || '(unset)'}`);

  for (const sectionFolder of sections) {
    const infoPath = path.join(capture.pageDir, 'sections', sectionFolder, 'section-information.json');
    const { readFile } = await import('node:fs/promises');
    let info;
    try {
      info = JSON.parse(await readFile(infoPath, 'utf8'));
    } catch {
      console.warn(`  skip ${sectionFolder}: no section-information.json`);
      continue;
    }
    const preferred = await loadPreferredSectionHtml(capture.pageDir, sectionFolder, info);
    const html = preferred?.html || '';
    for (const model of models) {
      console.log(`  → ${sectionFolder} @ ${model}`);
      const row = await scoreSectionWithModel({
        pageDir: capture.pageDir,
        sectionFolder,
        info,
        html,
        model,
        ledger,
      });
      rows.push({ sectionFolder, cmsName: info.cmsName || '', ...row });
    }
  }

  const outDir = path.join(bqRoot, '..', '.bq', 'benchmarks');
  await mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(outDir, `layout-fidelity-${stamp}.json`);
  const report = {
    createdAt: new Date().toISOString(),
    url: args.url,
    pageDir: capture.pageDir,
    baselineModel: baseline || null,
    models,
    sections,
    rows,
    ledgerTotals: ledger.totals(),
  };
  await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${outPath}`);

  // Console rollup by model
  for (const model of models) {
    const subset = rows.filter((r) => r.model === model && Number.isFinite(r.score));
    const avg =
      subset.length > 0
        ? subset.reduce((a, r) => a + r.score, 0) / subset.length
        : null;
    console.log(
      `  ${model}: avg score ${avg != null ? avg.toFixed(1) : 'n/a'} (${subset.length}/${sections.length} scored)`,
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack || err.message : err);
  process.exit(1);
});
