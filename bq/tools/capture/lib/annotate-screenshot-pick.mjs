/**
 * Pick the best full-page PNG as the canvas for detected-sections.png.
 *
 * TrustCommander (AXA): dirty overlay is blank; unlock annotate or clean is rich.
 * Cookiebot SPA (Voetbal): dirty overlay is rich; unlock annotate can blank mid-page.
 * Score by file size (same PNG height), with CMP-aware tie-breaks.
 */
import { access, stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pageScreenshotPath } from './page-layout.mjs';

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readPngSize(filePath) {
  const buf = await readFile(filePath);
  if (buf.length < 24 || buf.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error(`Not a PNG: ${filePath}`);
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/**
 * @param {string} kind annotate | dirty | clean
 * @param {boolean} hasCmp
 * @returns {number} lower = preferred among similar sizes
 */
function kindRank(kind, hasCmp) {
  if (hasCmp) {
    if (kind === 'annotate') return 0;
    if (kind === 'dirty') return 1;
    return 2;
  }
  if (kind === 'clean') return 0;
  if (kind === 'dirty') return 1;
  return 2;
}

/**
 * @param {string} pageDir
 * @param {{
 *   annotateScreenshotPath?: string|null,
 *   hasCmp?: boolean,
 *   minSizeRatio?: number,
 * }} [options]
 * @returns {Promise<{ path: string|null, kind: string|null, size: number, rejected: object[], log: string }>}
 */
export async function pickAnnotationScreenshotPath(pageDir, options = {}) {
  const hasCmp = options.hasCmp === true;
  // ~85%: AXA annotate is ~89% of clean; Voetbal annotate is ~33% of dirty (still rejected).
  const minSizeRatio = Number.isFinite(options.minSizeRatio) ? options.minSizeRatio : 0.85;

  /** @type {Array<{ kind: string, path: string }>} */
  const candidates = [];
  const seen = new Set();

  const push = (kind, filePath) => {
    if (!filePath || seen.has(filePath)) return;
    seen.add(filePath);
    candidates.push({ kind, path: filePath });
  };

  // Prefer canonical screenshots/ paths; allow optional override from capture.
  if (options.annotateScreenshotPath) {
    push('annotate', options.annotateScreenshotPath);
  }
  push('annotate', pageScreenshotPath(pageDir, 'desktop-annotate.png'));
  push('dirty', pageScreenshotPath(pageDir, 'desktop.png'));
  push('clean', pageScreenshotPath(pageDir, 'desktop-clean.png'));
  // Legacy root fallbacks
  push('dirty', path.join(pageDir, 'desktop.png'));
  push('clean', path.join(pageDir, 'desktop-clean.png'));

  /** @type {Array<{ kind: string, path: string, size: number, width: number, height: number }>} */
  const existing = [];
  for (const c of candidates) {
    if (!(await fileExists(c.path))) continue;
    try {
      const st = await stat(c.path);
      const dims = await readPngSize(c.path);
      existing.push({
        kind: c.kind,
        path: c.path,
        size: st.size,
        width: dims.width,
        height: dims.height,
      });
    } catch {
      /* skip unreadable */
    }
  }

  if (existing.length === 0) {
    return {
      path: null,
      kind: null,
      size: 0,
      rejected: [],
      log: 'detected-sections base: none (no screenshots found)',
    };
  }

  // Prefer majority height (full-page shots should match).
  const heightCounts = new Map();
  for (const e of existing) {
    heightCounts.set(e.height, (heightCounts.get(e.height) || 0) + 1);
  }
  let targetHeight = existing[0].height;
  let bestCount = 0;
  for (const [h, n] of heightCounts) {
    if (n > bestCount) {
      bestCount = n;
      targetHeight = h;
    }
  }

  const sameHeight = existing.filter((e) => e.height === targetHeight);
  const pool = sameHeight.length > 0 ? sameHeight : existing;
  const maxSize = Math.max(...pool.map((e) => e.size));

  // Primary: largest file. Within minSizeRatio of max, prefer CMP-friendly kind.
  const eligible = pool.filter((e) => e.size >= maxSize * minSizeRatio);
  eligible.sort((a, b) => {
    // Among near-max canvases, CMP sites prefer annotate (cookie visible in pixels).
    const rankDiff = kindRank(a.kind, hasCmp) - kindRank(b.kind, hasCmp);
    if (rankDiff !== 0) return rankDiff;
    return b.size - a.size;
  });

  const winner = eligible[0] || pool.sort((a, b) => b.size - a.size)[0];
  const rejected = pool
    .filter((e) => e.path !== winner.path)
    .map((e) => ({
      kind: e.kind,
      path: e.path,
      size: e.size,
      reason:
        e.size < maxSize * 0.55
          ? `much smaller (${Math.round(e.size / 1024)}KB vs max ${Math.round(maxSize / 1024)}KB)`
          : `lost tie-break (kind=${e.kind}, size=${Math.round(e.size / 1024)}KB)`,
    }));

  const rejectNote =
    rejected.length > 0
      ? ` (${rejected.map((r) => `${r.kind} ${Math.round(r.size / 1024)}KB`).join(', ')} not chosen)`
      : '';

  return {
    path: winner.path,
    kind: winner.kind,
    size: winner.size,
    rejected,
    log: `detected-sections base: ${path.basename(winner.path)} (${Math.round(winner.size / 1024)}KB)${rejectNote}`,
  };
}

/**
 * True when annotate shot is too sparse vs dirty overlay (same height).
 * Used at capture time to discard misleading desktop-annotate.png.
 *
 * @param {string} annotatePath
 * @param {string} dirtyPath
 * @param {{ ratio?: number }} [options]
 * @returns {Promise<{ discard: boolean, annotateSize: number, dirtySize: number, reason: string }>}
 */
export async function shouldDiscardAnnotateShot(annotatePath, dirtyPath, options = {}) {
  const ratio = Number.isFinite(options.ratio) ? options.ratio : 0.55;
  if (!(await fileExists(annotatePath)) || !(await fileExists(dirtyPath))) {
    return {
      discard: false,
      annotateSize: 0,
      dirtySize: 0,
      reason: 'missing file',
    };
  }
  try {
    const [aStat, dStat, aDims, dDims] = await Promise.all([
      stat(annotatePath),
      stat(dirtyPath),
      readPngSize(annotatePath),
      readPngSize(dirtyPath),
    ]);
    if (aDims.height !== dDims.height) {
      return {
        discard: false,
        annotateSize: aStat.size,
        dirtySize: dStat.size,
        reason: `different height (${aDims.height} vs ${dDims.height})`,
      };
    }
    if (dStat.size <= 0) {
      return {
        discard: false,
        annotateSize: aStat.size,
        dirtySize: dStat.size,
        reason: 'dirty empty',
      };
    }
    const discard = aStat.size < dStat.size * ratio;
    return {
      discard,
      annotateSize: aStat.size,
      dirtySize: dStat.size,
      reason: discard
        ? `annotate ${Math.round(aStat.size / 1024)}KB < ${Math.round(ratio * 100)}% of dirty ${Math.round(dStat.size / 1024)}KB`
        : 'ok',
    };
  } catch (err) {
    return {
      discard: false,
      annotateSize: 0,
      dirtySize: 0,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
