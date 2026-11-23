/**
 * Pixel comparison using sharp (no extra root deps).
 * Mimics pixelmatch: thresholded RGB delta, mismatch ratio, heatmap PNG.
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * @param {string} candidatePath
 * @param {string} referencePath
 * @param {{ outDiffPath?: string, threshold?: number, maxHeight?: number }} [opts]
 */
export async function comparePngs(candidatePath, referencePath, opts = {}) {
  const threshold = opts.threshold ?? 0.1;
  const maxHeight = opts.maxHeight ?? 12000;

  const refMeta = await sharp(referencePath).metadata();
  const candMeta = await sharp(candidatePath).metadata();

  const width = refMeta.width || candMeta.width;
  let height = refMeta.height || candMeta.height;
  if (!width || !height) {
    throw new Error(`Missing image dimensions: ref=${referencePath} cand=${candidatePath}`);
  }

  // Cap extremely tall full-page compares for speed; crop from top
  const cropH = Math.min(height, maxHeight);
  height = cropH;

  const [refRaw, candRaw] = await Promise.all([
    sharp(referencePath)
      .resize(width, height, { fit: 'cover', position: 'top' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true }),
    sharp(candidatePath)
      .resize(width, height, { fit: 'cover', position: 'top' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true }),
  ]);

  const ref = refRaw.data;
  const cand = candRaw.data;
  const n = width * height;
  const diff = Buffer.alloc(n * 4);
  let mismatched = 0;
  let sumAbs = 0;
  const maxChannelDelta = threshold * 255;

  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const dr = Math.abs(ref[o] - cand[o]);
    const dg = Math.abs(ref[o + 1] - cand[o + 1]);
    const db = Math.abs(ref[o + 2] - cand[o + 2]);
    const maxD = Math.max(dr, dg, db);
    sumAbs += (dr + dg + db) / 3;
    const bad = maxD > maxChannelDelta;
    if (bad) mismatched += 1;
    // Heatmap: magenta on mismatch, dark otherwise
    if (bad) {
      diff[o] = 255;
      diff[o + 1] = 0;
      diff[o + 2] = 180;
      diff[o + 3] = 255;
    } else {
      const g = Math.round((ref[o] + ref[o + 1] + ref[o + 2]) / 6);
      diff[o] = g;
      diff[o + 1] = g;
      diff[o + 2] = g;
      diff[o + 3] = 255;
    }
  }

  const mismatchRatio = mismatched / n;
  const meanAbsError = sumAbs / n;

  if (opts.outDiffPath) {
    await mkdir(path.dirname(opts.outDiffPath), { recursive: true });
    await sharp(diff, { raw: { width, height, channels: 4 } })
      .png()
      .toFile(opts.outDiffPath);
  }

  return {
    width,
    height,
    pixels: n,
    mismatched,
    mismatchRatio,
    mismatchPercent: Math.round(mismatchRatio * 10000) / 100,
    meanAbsError: Math.round(meanAbsError * 100) / 100,
    candidateSize: { width: candMeta.width, height: candMeta.height },
    referenceSize: { width: refMeta.width, height: refMeta.height },
    threshold,
  };
}
