/**
 * Source fidelity: compare generated TSX to capture crops @ 370/768/1024
 * and patch TSX toward perceptual match (no render).
 * Patches are normalized + Prettier-formatted before write (same as initial codegen write).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { azureChatCompletion } from '../capture/lib/design-system/ai/azure-chat.mjs';
import { loadLocalEnvFiles } from '../capture/lib/design-system/load-env.mjs';
import { bqRoot } from '../capture/paths.mjs';
import { buildSectionEvidenceParts, screenshotConversionModel } from './ai-codegen.mjs';
import {
  fixGluedJsxTagAttributes,
  normalizeClientTsx,
  normalizeComponentTsx,
  stripUnknownChromeProps,
} from './ai-source-fixup.mjs';
import {
  logFidelityAttempt,
  logFidelityHistory,
  pushFidelityHistory,
} from './fidelity-history.mjs';
import {
  fidelityMaxItersForMode,
  fidelityMinScoreForMode,
  isFidelityModeEnabled,
  isSourceFidelityEnvEnabled,
} from './fidelity-iters.mjs';
import { formatGeneratedSource } from './format-generated-source.mjs';
import { inferPlaceholderLayoutMode } from './layout-hints.mjs';
import { logVerbose } from './create-log.mjs';
import { ensureNewline, normalizeAiSource } from './source-text.mjs';

/**
 * @returns {boolean} true unless enabled via --source-fidelity / BQ_SOURCE_FIDELITY
 * and max iters > 0.
 */
export function shouldSkipLayoutCritique() {
  const maxIters = layoutCritiqueMaxIters();
  const enable = isSourceFidelityEnvEnabled();
  return !isFidelityModeEnabled({ maxIters, cliOrEnvEnable: enable, skip: false });
}

/**
 * Max source-fidelity iterations (0–3).
 * @returns {number}
 */
export function layoutCritiqueMaxIters() {
  return fidelityMaxItersForMode('source');
}

/**
 * @returns {number}
 */
export function sourceFidelityMinScore() {
  return fidelityMinScoreForMode('source');
}

/**
 * @returns {string|undefined}
 */
export function layoutCritiqueModel() {
  loadLocalEnvFiles({ root: bqRoot });
  const fidelity = (process.env.AZURE_OPENAI_SOURCE_FIDELITY_MODEL || '').trim();
  if (fidelity) return fidelity;
  return screenshotConversionModel();
}

function parseJsonContent(content) {
  const text = String(content || '').trim();
  if (!text) throw new Error('empty critique response');
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1].trim() : text;
  return JSON.parse(raw);
}

/**
 * Run multimodal source-fidelity critique and optionally rewrite TSX/client files.
 *
 * @param {{
 *   pageDir: string,
 *   sectionFolder: string,
 *   info: object,
 *   sectionHtml?: string|null,
 *   tsxPath: string,
 *   clientTsxPath?: string|null,
 *   componentName: string,
 *   hostSlug?: string,
 *   ledger?: object,
 *   dryRun?: boolean,
 *   minScore?: number|null,
 * }} opts
 * @returns {Promise<{ applied: boolean, score?: number, notes?: string, iterations: number, minScore?: number, scoreHistory?: object[] }>}
 */
export async function critiqueAndPatchComponentLayout(opts) {
  const {
    pageDir,
    sectionFolder,
    info,
    sectionHtml = null,
    tsxPath,
    clientTsxPath = null,
    componentName,
    hostSlug = '',
    ledger = null,
    dryRun = false,
    minScore: minScoreOpt = null,
  } = opts;

  const maxIters = layoutCritiqueMaxIters();
  if (maxIters <= 0) {
    return { applied: false, iterations: 0, notes: 'disabled (BQ_SOURCE_FIDELITY_MAX_ITERS=0)' };
  }

  if (shouldSkipLayoutCritique()) {
    return { applied: false, iterations: 0, notes: 'skipped (not enabled)' };
  }

  const minScore = fidelityMinScoreForMode('source', minScoreOpt);
  const layoutMode = inferPlaceholderLayoutMode(info, sectionHtml);
  let tsx = await readFile(tsxPath, 'utf8');
  let clientTsx = clientTsxPath ? await readFile(clientTsxPath, 'utf8') : null;
  let applied = false;
  let lastScore;
  let lastNotes = '';
  let lastPass = false;
  let iterations = 0;
  /** @type {object[]} */
  const scoreHistory = [];

  // Fidelity scoring always needs PNG crops, independent of BQ_CODEGEN_EVIDENCE_MODE.
  const { parts: evidence } = await buildSectionEvidenceParts(
    pageDir,
    sectionFolder,
    info,
    { attachScreenshots: true },
  );
  if (!evidence.length) {
    console.warn(`  ⚠ Source fidelity skipped for ${componentName}: no screenshot evidence`);
    return {
      applied: false,
      iterations: 0,
      notes: 'no screenshots',
      minScore,
      scoreHistory,
    };
  }

  for (let i = 0; i < maxIters; i++) {
    iterations += 1;
    const userContent = [
      {
        type: 'text',
        text: [
          'Compare the GENERATED TSX to the reference screenshots (mobile ~370, tablet 768, desktop 1024).',
          'Viewport contract: mobile <768; tablet 768–1023 (md:…max-lg:); desktop ≥1024 (lg: only).',
          'Goal: perceptual fidelity — everything visible in the crop must be present; composition must look like the original.',
          'Ignore minor left/right positional drift of text. Missing blocks/CTAs/media/columns are failures.',
          `Component: ${componentName}`,
          `layoutMode hint: ${layoutMode}`,
          `Pass when score ≥ ${minScore}.`,
          `Iteration ${iterations} of ${maxIters}.`,
          '',
          'Return JSON only:',
          '{',
          '  "score": 0-100,',
          '  "match": true|false,',
          '  "issues": ["…"],',
          '  "tsx": "full updated tsx or null if no change",',
          '  "clientTsx": "full updated client tsx or null",',
          '  "notes": "…"',
          '}',
          'When score < pass threshold: list EVERY material issue in issues[], then return a FULL updated tsx',
          'that addresses ALL of them in this single rewrite (do not trickle one fix per attempt).',
          'Only change Tailwind/structure needed for fidelity. Keep Sitecore field wiring intact.',
          `If already ≥${minScore} and issues are trivial, set match:true and tsx:null.`,
          '',
          '=== CURRENT TSX ===',
          tsx.slice(0, 60000),
          clientTsx
            ? `\n=== CURRENT CLIENT TSX ===\n${String(clientTsx).slice(0, 20000)}`
            : '',
        ]
          .filter(Boolean)
          .join('\n'),
      },
      ...evidence,
    ];

    const result = await azureChatCompletion({
      messages: [
        {
          role: 'system',
          content:
            'You are a source-fidelity QA agent for Sitecore Content SDK Next.js components. Score TSX vs screenshots and return focused JSON patches when below threshold. Patched tsx/clientTsx must be complete, parseable, multiline Prettier-like TypeScript/TSX (one JSX sibling per line — not minified or truncated). Never emit {\' \'} / {" "} between element siblings — only between adjacent text/expression nodes when a literal space is required. Invalid TSX is rejected by the write pipeline.',
        },
        { role: 'user', content: userContent },
      ],
      responseFormat: { type: 'json_object' },
      model: layoutCritiqueModel(),
    });

    if (ledger?.record) {
      ledger.record({
        purpose: 'source-fidelity-score',
        fidelityMode: 'source',
        iteration: iterations,
        section: sectionFolder,
        componentName,
        ok: result.ok,
        model: result.model,
        usage: result.usage,
        costEstimate: result.costEstimate,
        skipReason: result.skipReason,
      });
    }

    if (!result.ok) {
      console.warn(`  ⚠ Source fidelity failed for ${componentName}: ${result.skipReason || 'error'}`);
      break;
    }

    let parsed;
    try {
      parsed = parseJsonContent(result.content);
    } catch (err) {
      console.warn(`  ⚠ Source fidelity JSON parse failed for ${componentName}: ${err.message}`);
      break;
    }

    lastScore = Number(parsed.score);
    lastNotes = String(parsed.notes || '');
    const issues = Array.isArray(parsed.issues) ? parsed.issues : [];
    const goodEnough =
      parsed.match === true || (Number.isFinite(lastScore) && lastScore >= minScore);
    lastPass = goodEnough;

    const histRow = pushFidelityHistory(scoreHistory, {
      score: lastScore,
      pass: goodEnough,
      generation: iterations,
      notes: lastNotes,
    });
    if (ledger?.recordFidelityScore) {
      ledger.recordFidelityScore({
        mode: 'source',
        section: sectionFolder,
        componentName,
        ...histRow,
        minScore,
      });
    }

    logFidelityAttempt({
      mode: 'source',
      componentName,
      score: lastScore,
      minScore,
      label: histRow.label,
      generation: iterations,
      maxIters,
      pass: goodEnough,
      extra: issues.length ? issues.slice(0, 3).join('; ') : undefined,
    });
    if (issues.length) {
      logVerbose(`    issues: ${issues.slice(0, 5).join('; ')}`);
    }

    const nextTsx =
      parsed.tsx != null && String(parsed.tsx).trim()
        ? normalizeAiSource(parsed.tsx)
        : null;
    const nextClient =
      parsed.clientTsx != null && String(parsed.clientTsx).trim()
        ? normalizeAiSource(parsed.clientTsx)
        : null;

    if (!nextTsx && !nextClient) {
      if (goodEnough) {
        lastNotes = lastNotes || 'match ok';
      }
      break;
    }

    const kebab = path.basename(tsxPath, '.tsx');
    if (nextClient && clientTsxPath) {
      clientTsx = fixGluedJsxTagAttributes(normalizeClientTsx(nextClient));
      if (!dryRun) {
        try {
          const { writeFileIfChanged } = await import('../shared/write-file-if-changed.mjs');
          const prettyClient = await formatGeneratedSource(clientTsx, {
            filepath: clientTsxPath,
          });
          clientTsx = prettyClient;
          await writeFileIfChanged(clientTsxPath, ensureNewline(prettyClient));
          applied = true;
        } catch (err) {
          console.warn(
            `  ⚠ layout-critique: skip client patch (format failed): ${err instanceof Error ? err.message : String(err)}`.split(
              '\n',
            )[0],
          );
        }
      } else {
        applied = true;
      }
    }
    if (nextTsx) {
      tsx = fixGluedJsxTagAttributes(
        normalizeComponentTsx(nextTsx, {
          layoutMode,
          kebab,
          clientTsx: clientTsx || nextClient || undefined,
        }),
      );
      if (clientTsx) {
        tsx = stripUnknownChromeProps(tsx, clientTsx);
      }
      if (!dryRun) {
        try {
          const { writeFileIfChanged } = await import('../shared/write-file-if-changed.mjs');
          const prettyTsx = await formatGeneratedSource(tsx, { filepath: tsxPath });
          tsx = prettyTsx;
          await writeFileIfChanged(tsxPath, ensureNewline(prettyTsx));
          applied = true;
        } catch (err) {
          console.warn(
            `  ⚠ layout-critique: skip tsx patch (format failed): ${err instanceof Error ? err.message : String(err)}`.split(
              '\n',
            )[0],
          );
        }
      } else {
        applied = true;
      }
    } else if (clientTsx && tsx) {
      // Client-only critique pass: still strip invented Chrome props on existing main TSX.
      const stripped = stripUnknownChromeProps(tsx, clientTsx);
      if (stripped !== tsx) {
        tsx = fixGluedJsxTagAttributes(stripped);
        if (!dryRun) {
          try {
            const { writeFileIfChanged } = await import('../shared/write-file-if-changed.mjs');
            const prettyTsx = await formatGeneratedSource(tsx, { filepath: tsxPath });
            tsx = prettyTsx;
            await writeFileIfChanged(tsxPath, ensureNewline(prettyTsx));
            applied = true;
          } catch (err) {
            console.warn(
              `  ⚠ layout-critique: skip tsx strip patch (format failed): ${err instanceof Error ? err.message : String(err)}`.split(
                '\n',
              )[0],
            );
          }
        } else {
          applied = true;
        }
      }
    }

    if (goodEnough) break;
  }

  logFidelityHistory({
    mode: 'source',
    componentName,
    minScore,
    history: scoreHistory,
    pass: lastPass,
  });

  try {
    if (pageDir && sectionFolder) {
      const outRoot = path.join(
        pageDir,
        'sections',
        sectionFolder,
        'source-fidelity',
        componentName,
      );
      await mkdir(outRoot, { recursive: true });
      await writeFile(
        path.join(outRoot, 'score-history.json'),
        JSON.stringify(
          {
            componentName,
            sectionFolder,
            minScore,
            pass: lastPass,
            score: lastScore,
            percent:
              lastScore != null && Number.isFinite(Number(lastScore))
                ? `${Math.round(Number(lastScore))}%`
                : null,
            scoreHistory,
          },
          null,
          2,
        ),
        'utf8',
      );
    }
  } catch {
    /* best-effort disk history */
  }

  if (ledger?.printFidelityTotals) {
    ledger.printFidelityTotals({
      mode: 'source',
      section: sectionFolder,
      componentName,
      scoreHistory,
      minScore,
    });
  }

  return {
    applied,
    score: lastScore,
    percent:
      lastScore != null && Number.isFinite(Number(lastScore))
        ? `${Math.round(Number(lastScore))}%`
        : null,
    notes: lastNotes,
    iterations,
    minScore,
    pass: lastPass,
    scoreHistory,
  };
}
