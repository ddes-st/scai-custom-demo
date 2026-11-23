/**
 * Normalize computed style snapshots for clustering / emission.
 */
import { rgbToHex, toColorValue, isNeutralHex, hexToHsl } from './normalize-color.mjs';
import { UA_LINK_COLORS } from './constants.mjs';

export function parsePx(value) {
  if (value == null || value === 'auto' || value === 'none' || value === 'normal') return null;
  const m = String(value).match(/^(-?[\d.]+)px$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function formatPx(n) {
  if (n == null || !Number.isFinite(n)) return null;
  const r = Math.round(n * 100) / 100;
  return `${r}px`;
}

export function snapPx(n, step = 2) {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n / step) * step;
}

export function boxFromSides(top, right, bottom, left) {
  const t = formatPx(typeof top === 'number' ? top : parsePx(top));
  const r = formatPx(typeof right === 'number' ? right : parsePx(right));
  const b = formatPx(typeof bottom === 'number' ? bottom : parsePx(bottom));
  const l = formatPx(typeof left === 'number' ? left : parsePx(left));
  if (!t && !r && !b && !l) return null;
  return { top: t ?? '0px', right: r ?? '0px', bottom: b ?? '0px', left: l ?? '0px' };
}

export function normalizeColor(raw) {
  if (!raw || raw === 'transparent') return 'transparent';
  if (raw === 'rgba(0, 0, 0, 0)' || raw === 'rgba(0,0,0,0)') return 'transparent';
  const hex = rgbToHex(raw);
  return hex?.startsWith('#') ? hex : null;
}

export function isUaLinkColor(hex) {
  return hex && UA_LINK_COLORS.has(hex.toLowerCase());
}

export function colorLabel(hex) {
  if (!hex || hex === 'transparent') return 'Transparent';
  const h = hex.toLowerCase();
  if (h === '#000000' || h === '#000') return 'Black';
  if (h === '#ffffff' || h === '#fff') return 'White';
  if (isNeutralHex(h)) {
    const { l } = hexToHsl(h);
    if (l < 40) return 'DarkGray';
    if (l > 70) return 'LightGray';
    return 'Gray';
  }
  const { h: hue } = hexToHsl(h);
  if (hue >= 40 && hue < 70) return 'Yellow';
  if (hue >= 70 && hue < 160) return 'Green';
  if (hue >= 160 && hue < 250) return 'Blue';
  if (hue >= 250 && hue < 320) return 'Purple';
  if (hue >= 320 || hue < 40) return 'Red';
  return 'Chromatic';
}

export function isTransparent(hex) {
  return !hex || hex === 'transparent';
}

export function appearanceClass({ backgroundColor, borderWidth, borderColor }) {
  const bw = parsePx(borderWidth) ?? 0;
  const hasBorder = bw > 0 && borderColor && borderColor !== 'transparent';
  if (!isTransparent(backgroundColor)) return 'Filled';
  if (hasBorder) return 'Outline';
  return 'Ghost';
}

/**
 * Cluster key — look identity (no margin/width).
 */
export function clusterKey(snap) {
  return [
    snap.color || '',
    snap.backgroundColor || '',
    snap.borderColor || '',
    snap.borderWidth || '',
    snap.fontFamily || '',
    snap.fontSize || '',
    snap.fontWeight || '',
    snap.borderRadius || '',
    snap.padding?.top || '',
    snap.padding?.right || '',
    snap.padding?.bottom || '',
    snap.padding?.left || '',
    snap.textDecoration || '',
  ].join('|');
}

export function normalizeFamily(family) {
  if (!family) return null;
  return (
    family
      .split(',')[0]
      .trim()
      .replace(/^['"]|['"]$/g, '')
      .replace(/\\+$/g, '') || null
  );
}

export function compactVariant(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    if (v === 'none' || v === 'normal') {
      if (k === 'boxShadow' || k === 'textDecoration' || k === 'textTransform') continue;
    }
    if (typeof v === 'object' && !Array.isArray(v)) {
      const nested = compactVariant(v);
      if (Object.keys(nested).length) out[k] = nested;
      continue;
    }
    out[k] = v;
  }
  return out;
}

export function modeValue(values) {
  const counts = new Map();
  for (const v of values) {
    if (v == null) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best = null;
  let bestN = -1;
  for (const [v, n] of counts) {
    if (n > bestN) {
      best = v;
      bestN = n;
    }
  }
  return best;
}

export { rgbToHex, toColorValue, isNeutralHex };
