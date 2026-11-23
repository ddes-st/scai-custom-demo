/**
 * Containers + breakpoints from DOM + CSS media queries.
 */
import { clusterNumbers, formatPx } from './cluster.mjs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

function parsePx(value) {
  const m = String(value || '').match(/^([\d.]+)px$/);
  return m ? Number(m[1]) : null;
}

function breakpointsFromCssText(cssText, set) {
  if (!cssText) return;
  for (const m of cssText.matchAll(/\(min-width:\s*([\d.]+)px\)/gi)) {
    const n = Number(m[1]);
    if (n >= 320 && n <= 1920) set.add(n);
  }
  for (const m of cssText.matchAll(/\(max-width:\s*([\d.]+)px\)/gi)) {
    const n = Number(m[1]);
    if (n >= 320 && n <= 1920) set.add(n);
  }
}

/**
 * @param {object} inspect
 * @param {{ pageDir?: string, cssFiles?: { file: string }[] }} [opts]
 */
export async function extractLayout(inspect, { pageDir, cssFiles = [] } = {}) {
  const bp = new Set(inspect.breakpoints ?? []);

  if (pageDir) {
    for (const file of cssFiles) {
      try {
        const text = await readFile(path.join(pageDir, file.file), 'utf8');
        breakpointsFromCssText(text, bp);
      } catch {
        /* optional */
      }
    }
    try {
      const inline = await readFile(path.join(pageDir, 'css', 'page-inline.css'), 'utf8');
      breakpointsFromCssText(inline, bp);
    } catch {
      /* optional */
    }
  }

  const maxWidths = [];
  for (const s of inspect.samples ?? []) {
    if (!/^(main|section|article|div)$/.test(s.tag)) continue;
    const mw = parsePx(s.maxWidth);
    if (mw == null || mw < 480 || mw > 1600) continue;
    maxWidths.push({
      value: mw,
      score: Math.min(10, Math.log10((s.area || 1) + 1) + 1),
      meta: { selector: s.selector },
    });
  }
  const containers = clusterNumbers(maxWidths, { tolerance: 16 })
    .slice(0, 6)
    .map((c) => ({
      maxWidth: formatPx(c.value),
      score: Math.round(c.score * 10) / 10,
      count: c.count,
    }));

  const breakpoints = [...bp]
    .sort((a, b) => a - b)
    .slice(0, 12)
    .map((n) => ({ width: formatPx(n), px: n }));

  return {
    containers,
    breakpoints,
    viewport: inspect.viewport ?? null,
  };
}
