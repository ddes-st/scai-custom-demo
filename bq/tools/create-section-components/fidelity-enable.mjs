/**
 * Shared CLI/env enable wiring for source + visual fidelity (create + fidelity:component).
 */
import {
  fidelityMaxItersForMode,
  fidelityMaxItersSkipMessage,
  isSourceFidelityEnvEnabled,
  isVisualFidelityEnvEnabled,
} from './fidelity-iters.mjs';

/**
 * Parse `--flag`, `--flag=N`, or `--flag N` (optional numeric threshold).
 * @param {string[]} argv
 * @param {number} i
 * @param {string} name e.g. '--source-fidelity'
 * @returns {{ hit: true, nextIndex: number, value: number|null } | { hit: false }}
 */
export function consumeOptionalNumberFlag(argv, i, name) {
  const a = argv[i];
  if (a === name) {
    const next = argv[i + 1];
    if (next && /^\d+$/.test(next)) {
      return { hit: true, nextIndex: i + 2, value: Number(next) };
    }
    return { hit: true, nextIndex: i + 1, value: null };
  }
  if (a.startsWith(`${name}=`)) {
    const raw = a.slice(name.length + 1).trim();
    if (raw === '') return { hit: true, nextIndex: i + 1, value: null };
    const n = Number(raw);
    return { hit: true, nextIndex: i + 1, value: Number.isFinite(n) ? n : null };
  }
  return { hit: false };
}

/**
 * Apply fidelity CLI/env flags to process.env and log enablement.
 *
 * @param {{
 *   enableSourceFidelity?: boolean,
 *   enableVisualFidelity?: boolean,
 *   sourceFidelityMinScore?: number|null,
 *   visualFidelityMinScore?: number|null,
 * }} args
 * @returns {{
 *   sourceRequested: boolean,
 *   visualRequested: boolean,
 *   sourceEnabled: boolean,
 *   visualEnabled: boolean,
 * }}
 */
export function applyFidelityCliFlags(args) {
  const sourceMaxIters = fidelityMaxItersForMode('source');
  const visualMaxIters = fidelityMaxItersForMode('visual');

  const sourceEnvOn = isSourceFidelityEnvEnabled();
  const sourceRequested = Boolean(args.enableSourceFidelity) || sourceEnvOn;

  let sourceEnabled = false;
  if (sourceMaxIters <= 0 && sourceRequested) {
    process.env.BQ_SOURCE_FIDELITY = 'false';
    console.log(fidelityMaxItersSkipMessage('source'));
  } else if (args.enableSourceFidelity) {
    process.env.BQ_SOURCE_FIDELITY = 'true';
    if (args.sourceFidelityMinScore != null) {
      process.env.BQ_SOURCE_FIDELITY_MIN_SCORE = String(args.sourceFidelityMinScore);
    }
    console.log(
      `Source fidelity: enabled (--source-fidelity) — min score ${args.sourceFidelityMinScore ?? process.env.BQ_SOURCE_FIDELITY_MIN_SCORE ?? 90}`,
    );
    sourceEnabled = true;
  } else if (sourceEnvOn) {
    console.log('Source fidelity: enabled (BQ_SOURCE_FIDELITY)');
    sourceEnabled = true;
  }

  const visualEnvOn = isVisualFidelityEnvEnabled();
  const visualRequested = Boolean(args.enableVisualFidelity) || visualEnvOn;

  let visualEnabled = false;
  if (visualMaxIters <= 0 && visualRequested) {
    process.env.BQ_VISUAL_FIDELITY = 'false';
    console.log(fidelityMaxItersSkipMessage('visual'));
  } else if (args.enableVisualFidelity) {
    process.env.BQ_VISUAL_FIDELITY = 'true';
    if (args.visualFidelityMinScore != null) {
      process.env.BQ_VISUAL_FIDELITY_MIN_SCORE = String(args.visualFidelityMinScore);
    }
    console.log(
      `Visual fidelity: enabled (--visual-fidelity) — min score ${args.visualFidelityMinScore ?? process.env.BQ_VISUAL_FIDELITY_MIN_SCORE ?? 95}`,
    );
    visualEnabled = true;
  } else if (visualEnvOn) {
    console.log('Visual fidelity: enabled (BQ_VISUAL_FIDELITY)');
    visualEnabled = true;
  }

  return {
    sourceRequested,
    visualRequested,
    sourceEnabled,
    visualEnabled,
  };
}
