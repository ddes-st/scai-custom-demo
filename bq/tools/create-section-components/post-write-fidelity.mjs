/**
 * After writeComponentPackage: run visual-fidelity (preferred) or source-fidelity.
 * When visual fidelity is off, still capture rendered TSX screenshots unless
 * BQ_VISUAL_CAPTURE_ONLY=false.
 *
 * Pre-sitecoreize sets visualFidelityHandled — post-write still scores/repairs
 * the *composed Sitecore packages* under sitecoreize-proof/ when VF is on.
 * When capture-only, proof shots only (no visual-chrome CONTRACT).
 */
import path from 'node:path';
import {
  fidelityMaxItersForMode,
  isFidelityModeEnabled,
  isSourceFidelityEnvEnabled,
  isVisualCaptureOnlyEnvEnabled,
  isVisualFidelityEnvEnabled,
} from './fidelity-iters.mjs';
import { critiqueAndPatchComponentLayout } from './layout-critique.mjs';
import { captureRenderedPreview } from './visual-fidelity/capture-rendered-preview.mjs';
import {
  runVisualFidelityLoop,
  shouldSkipVisualFidelity,
} from './visual-fidelity/run-visual-fidelity.mjs';

/** Distinct from pre-sitecoreize attempt-* shot trees. */
export const SITECOREIZE_PROOF_SUBDIR = 'sitecoreize-proof';

/**
 * @param {object} opts — shared + mode-specific fields for visual/source loops
 */
export async function runPostWriteFidelity(opts) {
  const role = String(opts.role || '').toLowerCase();
  const isCompositeChild =
    role === 'child' && String(opts.plan?.mode || '').toLowerCase() === 'composite';
  const visualHandled = Boolean(opts.visualFidelityHandled);

  const visualMax = fidelityMaxItersForMode('visual');
  const visualFidelityOn = isFidelityModeEnabled({
    maxIters: visualMax,
    cliOrEnvEnable: isVisualFidelityEnvEnabled(),
    skip: false,
  });

  // Pre-sitecoreize handled visual TSX; still score *composed Sitecore packages*
  // under sitecoreize-proof when VF is enabled.
  if (
    visualHandled &&
    visualFidelityOn &&
    !shouldSkipVisualFidelity() &&
    !isCompositeChild
  ) {
    const runLoop = opts.runVisualFidelityLoop || runVisualFidelityLoop;
    const proofRoot = path.join(
      opts.pageDir,
      'sections',
      opts.sectionFolder,
      'visual-fidelity',
      SITECOREIZE_PROOF_SUBDIR,
    );
    const result = await runLoop({
      ...opts,
      outRoot: proofRoot,
      minScore: opts.visualMinScore ?? opts.minScore ?? null,
    });
    console.log(
      `  Visual fidelity (sitecoreize proof): score=${result?.percent ?? result?.score ?? 'n/a'} pass=${result?.pass} — ${result?.notes || 'done'}`,
    );
    return { ...result, proofSubdir: SITECOREIZE_PROOF_SUBDIR };
  }

  // Legacy path: VF on and not yet handled → score pre-write style (rare).
  if (
    !visualHandled &&
    visualFidelityOn &&
    !shouldSkipVisualFidelity()
  ) {
    if (isCompositeChild) {
      return {
        applied: false,
        iterations: 0,
        notes: 'skip visual fidelity for composite child (composed parent pass owns scoring)',
      };
    }
    const runLoop = opts.runVisualFidelityLoop || runVisualFidelityLoop;
    return runLoop({
      ...opts,
      minScore: opts.visualMinScore ?? opts.minScore ?? null,
    });
  }

  /** @type {object|null} */
  let captureResult = null;
  if (!isCompositeChild && isVisualCaptureOnlyEnvEnabled()) {
    const captureFn = opts.captureRenderedPreview || captureRenderedPreview;
    const captureOpts = {
      pageDir: opts.pageDir,
      sectionFolder: opts.sectionFolder,
      info: opts.info,
      hostSlug: opts.hostSlug,
      componentName: opts.componentName,
      childComponentNames: opts.childComponentNames || [],
      instancePlan: opts.instancePlan || null,
      layoutSketch: opts.layoutSketch || null,
      placeholderKey:
        opts.placeholderKey || opts.plan?.section?.placeholderKey || null,
      plan: opts.plan,
      attempt: 1,
    };
    if (visualHandled) {
      captureOpts.outSubdir = SITECOREIZE_PROOF_SUBDIR;
    }
    captureResult = await captureFn(captureOpts);
    const rel = captureResult?.outDir || '';
    if (visualHandled) {
      console.log(
        `  Visual capture (sitecoreize proof): shots → ${rel || '(none)'}`,
      );
    } else {
      console.log(
        `  Visual capture: shots → ${rel || '(none)'} (AI compare skipped; set BQ_VISUAL_FIDELITY=true)`,
      );
    }
  } else if (visualHandled && isCompositeChild) {
    console.log(
      '  Visual fidelity: skipped post-write score; proof capture skipped for composite child',
    );
  }

  const sourceMax = fidelityMaxItersForMode('source');
  const sourceEnabled = isFidelityModeEnabled({
    maxIters: sourceMax,
    cliOrEnvEnable: isSourceFidelityEnvEnabled(),
    skip: false,
  });

  if (!sourceEnabled) {
    return {
      applied: false,
      iterations: 0,
      notes: captureResult
        ? `visual capture only (${captureResult.notes || 'done'}); no fidelity mode enabled`
        : 'no fidelity mode enabled',
      capture: captureResult,
    };
  }

  if (isCompositeChild) {
    return {
      applied: false,
      iterations: 0,
      notes: 'skip source fidelity for composite child (composed parent pass owns scoring)',
      capture: captureResult,
    };
  }

  const sourceResult = await critiqueAndPatchComponentLayout({
    pageDir: opts.pageDir,
    sectionFolder: opts.sectionFolder,
    info: opts.info,
    sectionHtml: opts.sectionHtml,
    tsxPath: opts.tsxPath,
    clientTsxPath: opts.clientTsxPath,
    componentName: opts.componentName,
    hostSlug: opts.hostSlug,
    ledger: opts.ledger,
    dryRun: opts.dryRun,
    minScore: opts.sourceMinScore ?? opts.minScore ?? null,
  });
  return { ...sourceResult, capture: captureResult };
}
