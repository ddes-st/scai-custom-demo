/**
 * Button component heuristics from inspected button samples.
 */
import { clusterNumbers, formatPx, clusterColors as clusterColorItems } from './cluster.mjs';
import { rgbToHex } from './normalize-color.mjs';

function parsePx(value) {
  const m = String(value || '').match(/^([\d.]+)px$/);
  return m ? Number(m[1]) : null;
}

function normalizeFamily(family) {
  if (!family) return null;
  return (
    family
      .split(',')[0]
      .trim()
      .replace(/^['"]|['"]$/g, '')
      .replace(/\\+$/g, '') || null
  );
}

export function extractButtons(inspect) {
  const buttons = inspect.buttons ?? [];
  if (!buttons.length) {
    return { variants: [], note: 'No button-like elements sampled' };
  }

  const bgItems = [];
  const fgItems = [];
  const radii = [];
  const padsY = [];
  const padsX = [];
  const sizes = [];
  const weights = new Map();
  const families = new Map();

  for (const b of buttons) {
    const score = Math.min(8, Math.log10((b.area || 1) + 1) + 1);
    const bg = rgbToHex(b.backgroundColor);
    const fg = rgbToHex(b.color);
    if (bg && b.backgroundColor !== 'rgba(0, 0, 0, 0)') {
      bgItems.push({ value: bg, score, meta: { selector: b.selector } });
    }
    if (fg) fgItems.push({ value: fg, score, meta: { selector: b.selector } });
    const r = parsePx(b.borderRadius);
    if (r != null) radii.push({ value: r, score });
    const pt = parsePx(b.paddingTop);
    const pr = parsePx(b.paddingRight);
    if (pt != null) padsY.push({ value: pt, score });
    if (pr != null) padsX.push({ value: pr, score });
    const fs = parsePx(b.fontSize);
    if (fs != null) sizes.push({ value: fs, score });
    if (b.fontWeight) weights.set(b.fontWeight, (weights.get(b.fontWeight) ?? 0) + 1);
    const fam = normalizeFamily(b.fontFamily);
    if (fam) families.set(fam, (families.get(fam) ?? 0) + 1);
  }

  const bgClusters = clusterColorItems(bgItems).slice(0, 4);
  const fgClusters = clusterColorItems(fgItems).slice(0, 3);
  const radius = clusterNumbers(radii, { tolerance: 1.5 })[0];
  const padY = clusterNumbers(padsY, { tolerance: 1.5 })[0];
  const padX = clusterNumbers(padsX, { tolerance: 1.5 })[0];
  const fontSize = clusterNumbers(sizes, { tolerance: 1 })[0];

  const variants = bgClusters.map((c, i) => ({
    name: i === 0 ? 'primary' : i === 1 ? 'secondary' : `variant-${i + 1}`,
    background: c.hex,
    color: fgClusters[0]?.hex ?? null,
    borderRadius: radius ? formatPx(radius.value) : null,
    padding:
      padY && padX
        ? `${formatPx(padY.value)} ${formatPx(padX.value)}`
        : padY
          ? formatPx(padY.value)
          : null,
    fontSize: fontSize ? formatPx(fontSize.value) : null,
    fontWeight: [...weights.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    fontFamily: [...families.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    confidence: Math.min(0.95, 0.45 + c.score / 40),
    sampleCount: c.count,
  }));

  return {
    variants,
    sampleCount: buttons.length,
  };
}
