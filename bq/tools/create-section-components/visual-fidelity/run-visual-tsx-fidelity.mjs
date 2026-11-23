/**
 * Pre-sitecoreize visual fidelity for codegen plain visual TSX.
 * One AI call: compare refs + candidates + TSX → score + repaired TSX when failing.
 * Then re-capture candidates; keep-best on regression.
 * BQ_VISUAL_FIDELITY / MIN_SCORE / MAX_ITERS gate the loop.
 * Shots live under sections/<section>/visual-fidelity/attempt-*.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  logFidelityAttempt,
  logFidelityHistory,
  pushFidelityHistory,
} from '../fidelity-history.mjs';
import {
  fidelityMaxItersForMode,
  fidelityMinScoreForMode,
} from '../fidelity-iters.mjs';
import { logVerbose } from '../create-log.mjs';
import { captureAndCompare } from './capture-and-compare.mjs';
import {
  buildStandaloneTsxPreview,
  cleanupWorkDir,
  startPreviewServer,
} from './preview-server.mjs';
import { scoreAndRegenerateVisualTsx } from './score-and-regenerate-visual.mjs';
import {
  shouldRepairAfterVisualScore,
  shouldSkipVisualFidelity,
  visualFidelityMaxScoreRounds,
} from './run-visual-fidelity.mjs';

/**
 * Persist authoritative visual TSX dump when aiDebugRoot is available.
 * @param {string|null|undefined} aiDebugRoot
 * @param {string} componentName
 * @param {string} visualTsx
 */
async function persistVisualTsxDump(aiDebugRoot, componentName, visualTsx) {
  if (!aiDebugRoot) return;
  try {
    await mkdir(aiDebugRoot, { recursive: true });
    await writeFile(
      path.join(aiDebugRoot, `visual-${componentName}.tsx.ai`),
      visualTsx.endsWith('\n') ? visualTsx : `${visualTsx}\n`,
      'utf8',
    );
  } catch {
    /* non-fatal */
  }
}

/**
 * @param {{
 *   pageDir: string,
 *   sectionFolder: string,
 *   info?: object|null,
 *   componentName: string,
 *   visualTsx: string,
 *   ledger?: object|null,
 *   dryRun?: boolean,
 *   minScore?: number|null,
 *   aiDebugRoot?: string|null,
 * }} opts
 */
export async function runVisualTsxFidelityLoop(opts) {
  const maxIters = fidelityMaxItersForMode('visual');
  const {
    pageDir,
    sectionFolder,
    info = null,
    componentName,
    ledger = null,
    dryRun = false,
    aiDebugRoot = null,
  } = opts || {};

  let visualTsx = String(opts?.visualTsx || '');

  if (!pageDir || !sectionFolder) {
    throw new Error('visual TSX fidelity requires pageDir and sectionFolder');
  }
  if (!componentName || !visualTsx.trim()) {
    throw new Error('visual TSX fidelity requires componentName and visualTsx');
  }

  // One VF tree per section — do not nest under component Pascal name.
  const outRoot = path.join(pageDir, 'sections', sectionFolder, 'visual-fidelity');

  if (maxIters <= 0) {
    return {
      visualTsx,
      applied: false,
      iterations: 0,
      repairs: 0,
      score: null,
      percent: null,
      notes: 'disabled (BQ_VISUAL_FIDELITY_MAX_ITERS=0)',
      pass: false,
      minScore: fidelityMinScoreForMode('visual', opts.minScore),
      scoreHistory: [],
      reportPath: null,
      outRoot,
    };
  }
  if (shouldSkipVisualFidelity()) {
    return {
      visualTsx,
      applied: false,
      iterations: 0,
      repairs: 0,
      score: null,
      percent: null,
      notes: 'skipped (not enabled)',
      pass: false,
      minScore: fidelityMinScoreForMode('visual', opts.minScore),
      scoreHistory: [],
      reportPath: null,
      outRoot,
    };
  }

  const minScore = fidelityMinScoreForMode('visual', opts.minScore);
  const maxScoreRounds = visualFidelityMaxScoreRounds(maxIters);
  await mkdir(outRoot, { recursive: true });

  let applied = false;
  let lastScore = null;
  let lastNotes = '';
  let lastPass = false;
  let scoreRounds = 0;
  let repairs = 0;
  /** @type {string[]} */
  const regressionNotes = [];
  /** @type {object[]} */
  const attemptLog = [];
  /** @type {object[]} */
  const scoreHistory = [];

  /**
   * Render + capture current visualTsx, then one AI call (score + optional repaired tsx).
   * @returns {Promise<object|null>}
   */
  async function captureAndScoreRegenerate() {
    const scoreRound = scoreRounds + 1;
    const attemptDir = path.join(outRoot, `attempt-${scoreRound}`);
    await mkdir(attemptDir, { recursive: true });
    const attemptAiDebug = path.join(attemptDir, 'ai-debug');
    const workDir = path.join(attemptDir, 'preview');
    await mkdir(workDir, { recursive: true });

    const safeName = String(componentName || 'Visual')
      .replace(/[^\w.-]+/g, '_')
      .slice(0, 80);
    const tsxPath = path.join(workDir, `${safeName}.tsx`);
    await writeFile(
      tsxPath,
      visualTsx.endsWith('\n') ? visualTsx : `${visualTsx}\n`,
      'utf8',
    );

    let server;
    /** @type {Record<string, object>} */
    let captureResults = {};
    try {
      logVerbose(
        `  · visual TSX fidelity ${componentName}: building preview (score ${scoreRound}/${maxScoreRounds})…`,
      );
      await buildStandaloneTsxPreview({ workDir, tsxPath });
      server = await startPreviewServer(workDir);
      logVerbose(
        `  · visual TSX fidelity ${componentName}: preview ready at ${server.baseUrl} — capturing…`,
      );
      captureResults = await captureAndCompare({
        baseUrl: server.baseUrl,
        pageDir,
        sectionFolder,
        info: info || {},
        outDir: path.join(attemptDir, 'shots'),
      });
      logVerbose(
        `  · visual TSX fidelity ${componentName}: compare+regenerate vs crops…`,
      );
    } catch (err) {
      console.warn(
        `  ⚠ visual TSX fidelity: render/capture failed for ${componentName}: ${err.message}`,
      );
      lastNotes = `render failed: ${err.message}`;
      if (server) await server.close().catch(() => {});
      await cleanupWorkDir(workDir);
      captureResults = {};
    } finally {
      if (server) await server.close().catch(() => {});
    }

    let scored;
    if (Object.keys(captureResults).length) {
      scored = await scoreAndRegenerateVisualTsx({
        componentName,
        minScore,
        visualTsx,
        captureResults,
        ledger,
        sectionFolder,
        iteration: scoreRound,
        aiDebugRoot: attemptAiDebug,
      });
    } else {
      scored = {
        score: 0,
        pass: false,
        preserve: [],
        changes: [],
        issues: [lastNotes || 'render failed'],
        notes: lastNotes,
        tsx: null,
      };
    }

    scoreRounds = scoreRound;
    lastScore = scored.score;
    lastNotes = scored.notes;
    lastPass = scored.pass;

    const histRow = pushFidelityHistory(scoreHistory, {
      score: scored.score,
      pass: scored.pass,
      generation: scoreRound,
      notes: scored.notes,
      error: Object.keys(captureResults).length ? null : lastNotes || 'render failed',
    });
    if (ledger?.recordFidelityScore) {
      ledger.recordFidelityScore({
        mode: 'visual',
        section: sectionFolder,
        componentName,
        ...histRow,
        minScore,
      });
    }

    logFidelityAttempt({
      mode: 'visual',
      componentName,
      score: scored.score,
      minScore,
      label: histRow.label,
      generation: scoreRound,
      maxIters: maxScoreRounds,
      pass: scored.pass,
      extra: scored.issues?.length
        ? scored.issues.slice(0, 2).join('; ')
        : scored.changes?.length
          ? scored.changes.slice(0, 2).join('; ')
          : undefined,
    });
    if (scored.preserve?.length) {
      logVerbose(`    preserve: ${scored.preserve.slice(0, 3).join('; ')}`);
    }
    if (scored.issues?.length) {
      logVerbose(`    issues: ${scored.issues.slice(0, 4).join('; ')}`);
    }

    attemptLog.push({
      generation: scoreRound,
      label: histRow.label,
      score: histRow.score,
      percent: histRow.percent,
      pass: scored.pass,
      preserve: scored.preserve,
      changes: scored.changes,
      issues: scored.issues,
      regenerated: Boolean(scored.tsx),
    });

    await writeFile(
      path.join(attemptDir, `directives-${scoreRound}.json`),
      JSON.stringify(
        {
          label: histRow.label,
          score: histRow.score,
          percent: histRow.percent,
          pass: scored.pass,
          preserve: scored.preserve || [],
          changes: scored.changes || [],
          issues: scored.issues,
          regenerated: Boolean(scored.tsx),
        },
        null,
        2,
      ),
      'utf8',
    );

    return {
      scored,
      attemptDir,
      captureResults,
      previousTsx: visualTsx,
    };
  }

  let ctx = await captureAndScoreRegenerate();
  if (ctx) {
    while (
      shouldRepairAfterVisualScore({
        scoreRound: scoreRounds,
        maxIters,
        passed: lastPass,
        dryRun,
      })
    ) {
      const repairedTsx = ctx.scored?.tsx;
      if (!repairedTsx || !String(repairedTsx).trim()) {
        console.warn(
          `  ⚠ visual TSX fidelity ${componentName}: score failed but no repaired tsx returned — stopping`,
        );
        break;
      }

      const scoreBefore = Number(ctx.scored?.score);
      const snapshot = ctx.previousTsx;
      const nextRepair = repairs + 1;

      if (dryRun) {
        logVerbose(
          `  · visual TSX fidelity ${componentName}: dry-run — skip applying regenerate (repair ${nextRepair}/${maxIters})`,
        );
        repairs = nextRepair;
        break;
      }

      logVerbose(
        `  · visual TSX fidelity ${componentName}: applying one-call regenerate (repair ${nextRepair}/${maxIters})…`,
      );
      visualTsx = repairedTsx.endsWith('\n') ? repairedTsx : `${repairedTsx}\n`;
      await persistVisualTsxDump(aiDebugRoot, componentName, visualTsx);
      repairs = nextRepair;
      applied = true;

      // Fresh candidates from new TSX, then score(+maybe another regenerate).
      ctx = await captureAndScoreRegenerate();
      if (!ctx) break;

      const scoreAfter = Number(ctx.scored?.score);
      if (
        Number.isFinite(scoreBefore) &&
        Number.isFinite(scoreAfter) &&
        scoreAfter < scoreBefore
      ) {
        const msg = `keep-best: rejected regression before=${Math.round(scoreBefore)}% after=${Math.round(scoreAfter)}% — restored previous visual TSX`;
        console.warn(`  ⚠ visual TSX fidelity ${componentName}: ${msg}`);
        logVerbose(`  · visual TSX fidelity ${componentName}: ${msg}`);
        regressionNotes.push(msg);
        visualTsx = snapshot;
        await persistVisualTsxDump(aiDebugRoot, componentName, visualTsx);
        lastScore = scoreBefore;
        lastPass = scoreBefore >= minScore;
        lastNotes = [lastNotes, msg].filter(Boolean).join(' | ');
        attemptLog.push({
          generation: scoreRounds,
          label: 'keep-best-restore',
          score: scoreBefore,
          percent: `${Math.round(scoreBefore)}%`,
          pass: lastPass,
          notes: msg,
        });
        break;
      }
    }
  }

  const fidelityCost = ledger?.fidelityCostSnapshot
    ? ledger.fidelityCostSnapshot({
        mode: 'visual',
        section: sectionFolder,
        componentName,
      })
    : null;

  logFidelityHistory({
    mode: 'visual',
    componentName,
    minScore,
    history: scoreHistory,
    pass: lastPass,
  });

  const report = {
    componentName,
    sectionFolder,
    mode: 'visual-tsx-one-call-regenerate',
    minScore,
    maxIters,
    maxScoreRounds,
    generations: scoreRounds,
    repairs,
    score: lastScore,
    percent:
      lastScore != null && Number.isFinite(Number(lastScore))
        ? `${Math.round(Number(lastScore))}%`
        : null,
    pass: lastPass,
    notes: [lastNotes, ...regressionNotes].filter(Boolean).join(' | '),
    scoreHistory,
    attempts: attemptLog,
    regressionNotes,
    fidelityCost,
  };
  await writeFile(path.join(outRoot, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
  await writeFile(
    path.join(outRoot, 'score-history.json'),
    JSON.stringify(
      { minScore, pass: lastPass, scoreHistory, regressionNotes },
      null,
      2,
    ),
    'utf8',
  );

  if (ledger?.printFidelityTotals) {
    ledger.printFidelityTotals({
      mode: 'visual',
      section: sectionFolder,
      componentName,
      scoreHistory,
      minScore,
    });
  }

  return {
    visualTsx,
    applied,
    iterations: scoreRounds,
    repairs,
    score: lastScore,
    percent: report.percent,
    notes: report.notes,
    pass: lastPass,
    minScore,
    scoreHistory,
    reportPath: path.join(outRoot, 'report.json'),
    outRoot,
  };
}
