/**
 * Visual fidelity loop: render → score → (fail) surgical repair → re-score.
 * BQ_VISUAL_FIDELITY_MAX_ITERS = max repair attempts (score→repair→re-score rounds).
 * N=1 → score once, fix once, re-score. N=0 disables.
 *
 * Repairs are preserve-first surgical edits (not full codegen). Keep-best restores
 * the previous package when after-N score drops.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  logFidelityAttempt,
  logFidelityHistory,
  pushFidelityHistory,
} from '../fidelity-history.mjs';
import {
  fidelityMaxItersForMode,
  fidelityMinScoreForMode,
  isFidelityModeEnabled,
  isVisualFidelityEnvEnabled,
} from '../fidelity-iters.mjs';
import { writeComponentPackage } from '../write-component.mjs';
import { logVerbose } from '../create-log.mjs';
import { toKebabCase } from '../naming.mjs';
import { loadComponentPackages } from './compose-tree.mjs';
import { captureAndCompare } from './capture-and-compare.mjs';
import {
  buildPreviewBundle,
  cleanupWorkDir,
  startPreviewServer,
} from './preview-server.mjs';
import { scoreRenderedAgainstRefs } from './score-and-directives.mjs';
import { repairVisualFidelityPackage } from './repair-from-directives.mjs';

/**
 * @returns {boolean}
 */
export function shouldSkipVisualFidelity() {
  const maxIters = fidelityMaxItersForMode('visual');
  return !isFidelityModeEnabled({
    maxIters,
    cliOrEnvEnable: isVisualFidelityEnvEnabled(),
    skip: false,
  });
}

/**
 * After score round `scoreRound` (1 = before, 2 = after-1, …), may we still repair?
 * maxIters is the repair budget (not the number of score-only passes).
 *
 * @param {{
 *   scoreRound: number,
 *   maxIters: number,
 *   passed: boolean,
 *   dryRun?: boolean,
 * }} opts
 * @returns {boolean}
 */
export function shouldRepairAfterVisualScore(opts) {
  const scoreRound = Math.trunc(Number(opts.scoreRound));
  const maxIters = Math.trunc(Number(opts.maxIters));
  if (!Number.isFinite(scoreRound) || scoreRound < 1) return false;
  if (!Number.isFinite(maxIters) || maxIters <= 0) return false;
  if (opts.passed) return false;
  if (opts.dryRun) return false;
  // After before (round 1), repairsDone=0; allow while scoreRound <= maxIters
  return scoreRound <= maxIters;
}

/**
 * Max score rounds for a given repair budget (initial + one re-score per repair).
 * @param {number} maxIters
 * @returns {number}
 */
export function visualFidelityMaxScoreRounds(maxIters) {
  const n = Math.trunc(Number(maxIters));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n + 1;
}

/**
 * @param {{
 *   pageDir: string,
 *   sectionFolder: string,
 *   info: object,
 *   hostSlug: string,
 *   componentName: string,
 *   definitionKey: string,
 *   tsxPath: string,
 *   clientTsxPath?: string|null,
 *   definitionPath: string,
 *   childComponentNames?: string[],
 *   placeholderKey?: string|null,
 *   plan: object,
 *   role: 'section'|'child',
 *   parent?: object|null,
 *   collectionSystem: string,
 *   siteSystem: string,
 *   designMd?: string,
 *   sharedDesignPrefix?: string,
 *   ledger?: object,
 *   dryRun?: boolean,
 *   minScore?: number|null,
 *   kebab?: string,
 *   imageInventory?: object,
 *   sectionHtml?: string|null,
 *   captureMeta?: object,
 *   finalizeDefinition?: (generated: object) => Promise<string>,
 * }} opts
 */
export async function runVisualFidelityLoop(opts) {
  const maxIters = fidelityMaxItersForMode('visual');
  if (maxIters <= 0) {
    return {
      applied: false,
      iterations: 0,
      score: null,
      notes: 'disabled (BQ_VISUAL_FIDELITY_MAX_ITERS=0)',
      pass: false,
    };
  }
  if (shouldSkipVisualFidelity()) {
    return {
      applied: false,
      iterations: 0,
      score: null,
      notes: 'skipped (not enabled)',
      pass: false,
    };
  }

  const minScore = fidelityMinScoreForMode('visual', opts.minScore);
  const maxScoreRounds = visualFidelityMaxScoreRounds(maxIters);
  const {
    pageDir,
    sectionFolder,
    info,
    hostSlug,
    componentName,
    definitionKey,
    ledger = null,
    dryRun = false,
    plan,
  } = opts;

  let tsxPath = opts.tsxPath;
  let clientTsxPath = opts.clientTsxPath || null;
  let definitionPath = opts.definitionPath;
  let applied = false;
  let lastScore = null;
  let lastNotes = '';
  let lastPass = false;
  let scoreRounds = 0;
  let repairs = 0;
  /** @type {string[]} */
  const regressionNotes = [];

  if (!pageDir || !sectionFolder) {
    throw new Error('visual fidelity requires pageDir and sectionFolder');
  }
  // One VF tree per section — do not nest under component Pascal name.
  // opts.outRoot: e.g. …/visual-fidelity/sitecoreize-proof for post-sitecoreize score.
  const outRoot =
    opts.outRoot != null && String(opts.outRoot).trim()
      ? String(opts.outRoot).trim()
      : path.join(pageDir, 'sections', sectionFolder, 'visual-fidelity');
  await mkdir(outRoot, { recursive: true });

  const kebab = opts.kebab || toKebabCase(componentName);

  /** @type {object[]} */
  const attemptLog = [];
  /** @type {object[]} */
  const scoreHistory = [];

  /**
   * Capture + score current TSX. Returns scored result or null on compose failure.
   * @returns {Promise<object|null>}
   */
  async function scoreCurrent() {
    const scoreRound = scoreRounds + 1;
    const attemptDir = path.join(outRoot, `attempt-${scoreRound}`);
    await mkdir(attemptDir, { recursive: true });
    const aiDebugRoot = path.join(attemptDir, 'ai-debug');

    let tree;
    try {
      tree = await loadComponentPackages({
        hostSlug,
        parentComponentName: componentName,
        childComponentNames: opts.childComponentNames || [],
        instancePlan: opts.instancePlan || null,
        layoutSketch: opts.layoutSketch || null,
        placeholderKey: opts.placeholderKey || plan?.section?.placeholderKey || null,
      });
    } catch (err) {
      console.warn(`  ⚠ Visual fidelity: compose failed for ${componentName}: ${err.message}`);
      lastNotes = err.message;
      return null;
    }

    const workDir = path.join(attemptDir, 'preview');
    let server;
    /** @type {Record<string, object>} */
    let captureResults = {};
    try {
      logVerbose(
        `  · Visual fidelity ${componentName}: building preview (score ${scoreRound}/${maxScoreRounds})…`,
      );
      await buildPreviewBundle({ workDir, tree });
      server = await startPreviewServer(workDir);
      logVerbose(
        `  · Visual fidelity ${componentName}: preview ready at ${server.baseUrl} — capturing…`,
      );
      captureResults = await captureAndCompare({
        baseUrl: server.baseUrl,
        pageDir,
        sectionFolder,
        info,
        outDir: path.join(attemptDir, 'shots'),
      });
      logVerbose(`  · Visual fidelity ${componentName}: scoring against crops…`);
    } catch (err) {
      console.warn(`  ⚠ Visual fidelity: render/capture failed for ${componentName}: ${err.message}`);
      lastNotes = `render failed: ${err.message}`;
      if (server) await server.close().catch(() => {});
      await cleanupWorkDir(workDir);
      captureResults = {};
    } finally {
      if (server) await server.close().catch(() => {});
    }

    const tsx = await readFile(tsxPath, 'utf8');
    const clientTsx = clientTsxPath ? await readFile(clientTsxPath, 'utf8') : null;
    let definitionTs = '';
    try {
      if (definitionPath) definitionTs = await readFile(definitionPath, 'utf8');
    } catch {
      /* optional */
    }

    let scored;
    if (Object.keys(captureResults).length) {
      scored = await scoreRenderedAgainstRefs({
        componentName,
        minScore,
        tsx,
        clientTsx,
        captureResults,
        ledger,
        sectionFolder,
        iteration: scoreRound,
        aiDebugRoot,
      });
    } else {
      scored = {
        score: 0,
        pass: false,
        preserve: [],
        changes: [
          'Preview render failed — repair TSX so the section mounts cleanly with Tailwind matching Sitecore AI crops; ensure AppPlaceholder children and field wiring remain valid.',
        ],
        issues: [lastNotes || 'render failed'],
        notes: lastNotes,
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
      extra: scored.changes?.length
        ? scored.changes.slice(0, 2).join('; ')
        : undefined,
    });
    if (scored.preserve?.length) {
      logVerbose(`    preserve: ${scored.preserve.slice(0, 3).join('; ')}`);
    }
    if (scored.changes?.length) {
      logVerbose(`    changes: ${scored.changes.slice(0, 4).join('; ')}`);
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
          changes: scored.changes,
          issues: scored.issues,
        },
        null,
        2,
      ),
      'utf8',
    );

    return {
      scored,
      tsx,
      clientTsx,
      definitionTs,
      attemptDir,
      captureResults,
      scoreBeforeRepair: scored.score,
    };
  }

  /**
   * Surgical repair from score directives. Keep-best: caller restores if re-score drops.
   * @param {{
   *   scored: object,
   *   tsx: string,
   *   clientTsx: string|null,
   *   definitionTs: string,
   *   attemptDir: string,
   *   captureResults: Record<string, object>,
   * }} ctx
   * @returns {Promise<{ appliedRepair: boolean, snapshot: { tsx: string, clientTsx: string|null, definitionTs: string } }>}
   */
  async function regenerateFromScore(ctx) {
    const { scored, tsx, clientTsx, definitionTs, attemptDir, captureResults } = ctx;
    const nextRepair = repairs + 1;

    const changes = scored.changes || [];

    const snapshot = {
      tsx,
      clientTsx,
      definitionTs,
    };

    logVerbose(
      `  · Visual fidelity ${componentName}: surgical repair (repair ${nextRepair}/${maxIters})…`,
    );

    const repaired = await repairVisualFidelityPackage({
      componentName,
      minScore,
      iteration: nextRepair,
      changes,
      preserve: scored.preserve || [],
      previousTsx: tsx,
      previousClientTsx: clientTsx,
      previousDefinitionTs: definitionTs || '',
      captureResults,
      ledger,
      sectionFolder,
      aiDebugRoot: path.join(attemptDir, 'ai-debug'),
    });

    if (!repaired.ok || !repaired.tsx) {
      console.warn(
        `  ⚠ Visual fidelity repair failed for ${componentName}: ${repaired.skipReason || repaired.notes}`,
      );
      lastNotes = repaired.skipReason || repaired.notes || lastNotes;
      return { appliedRepair: false, snapshot };
    }

    let nextDefinition = repaired.definitionTs;
    if (nextDefinition == null || !String(nextDefinition).trim()) {
      nextDefinition = definitionTs;
    }
    if (typeof opts.finalizeDefinition === 'function' && nextDefinition) {
      nextDefinition = await opts.finalizeDefinition({
        definitionTs: nextDefinition,
        tsx: repaired.tsx,
        clientTsx: repaired.clientTsx,
        definitionKey,
        componentName,
      });
    }

    if (dryRun) {
      logVerbose(`  · Visual fidelity ${componentName}: dry-run — skip write after repair`);
      repairs = nextRepair;
      return { appliedRepair: false, snapshot };
    }

    const paths = await writeComponentPackage({
      hostSlug,
      componentName,
      kebab,
      tsx: repaired.tsx,
      clientTsx: repaired.clientTsx || null,
      definitionTs: nextDefinition,
      definitionKey,
      imageInventory: opts.imageInventory,
      sectionInfo: info,
      sectionHtml: opts.sectionHtml,
      planMode: plan?.mode,
      plan,
      role: opts.role,
      captureMeta: {
        ...(opts.captureMeta || {}),
        visualFidelityGeneration: scoreRounds + 1,
        visualFidelityRepair: nextRepair,
        visualFidelityMode: 'surgical-repair',
        generatedAt: new Date().toISOString(),
      },
      dryRun: false,
    });

    tsxPath = paths.tsx;
    clientTsxPath = paths.clientTsx;
    definitionPath = paths.definition;
    repairs = nextRepair;
    applied = true;
    return { appliedRepair: true, snapshot };
  }

  /**
   * Restore package files from snapshot after a score regression.
   * @param {{ tsx: string, clientTsx: string|null, definitionTs: string }} snapshot
   */
  async function restoreSnapshot(snapshot) {
    if (dryRun) return;
    const paths = await writeComponentPackage({
      hostSlug,
      componentName,
      kebab,
      tsx: snapshot.tsx,
      clientTsx: snapshot.clientTsx,
      definitionTs: snapshot.definitionTs,
      definitionKey,
      imageInventory: opts.imageInventory,
      sectionInfo: info,
      sectionHtml: opts.sectionHtml,
      planMode: plan?.mode,
      plan,
      role: opts.role,
      captureMeta: {
        ...(opts.captureMeta || {}),
        visualFidelityKeepBest: true,
        generatedAt: new Date().toISOString(),
      },
      dryRun: false,
    });
    tsxPath = paths.tsx;
    clientTsxPath = paths.clientTsx;
    definitionPath = paths.definition;
  }

  // Initial score (before), then up to maxIters repair → re-score cycles
  let ctx = await scoreCurrent();
  if (!ctx) {
    // compose failed before any usable score
  } else {
    while (
      shouldRepairAfterVisualScore({
        scoreRound: scoreRounds,
        maxIters,
        passed: lastPass,
        dryRun,
      })
    ) {
      const scoreBefore = Number(ctx.scored?.score);
      const { appliedRepair, snapshot } = await regenerateFromScore(ctx);
      if (!appliedRepair) break;

      ctx = await scoreCurrent();
      if (!ctx) break;

      const scoreAfter = Number(ctx.scored?.score);
      if (
        Number.isFinite(scoreBefore) &&
        Number.isFinite(scoreAfter) &&
        scoreAfter < scoreBefore
      ) {
        const msg = `keep-best: rejected regression before=${Math.round(scoreBefore)}% after=${Math.round(scoreAfter)}% — restored previous package`;
        console.warn(`  ⚠ Visual fidelity ${componentName}: ${msg}`);
        logVerbose(`  · Visual fidelity ${componentName}: ${msg}`);
        regressionNotes.push(msg);
        await restoreSnapshot(snapshot);
        // Re-align in-memory score to restored baseline for report honesty
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
  };
}
