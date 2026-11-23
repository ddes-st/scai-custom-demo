/**
 * Typography roles from inspected heading/body/button/nav samples.
 */
import { clusterNumbers, formatPx } from './cluster.mjs';
import { rgbToHex } from './normalize-color.mjs';

function normalizeFamily(family) {
  if (!family) return null;
  const first = family
    .split(',')[0]
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\\+$/g, '')
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"');
  if (!first || first === 'inherit' || first === 'initial') return null;
  return first;
}

function parsePx(value) {
  const m = String(value || '').match(/^([\d.]+)px$/);
  return m ? Number(m[1]) : null;
}

export function extractTypography(inspect, { fontFamilies = [] } = {}) {
  const byRole = new Map();

  for (const row of inspect.typography ?? []) {
    const role = row.role || 'body';
    const list = byRole.get(role) ?? [];
    list.push(row);
    byRole.set(role, list);
  }

  const roles = {};
  for (const [role, rows] of byRole) {
    const families = new Map();
    const sizes = [];
    const weights = new Map();
    const lineHeights = [];
    const colors = new Map();

    for (const row of rows) {
      const family = normalizeFamily(row.fontFamily);
      if (family) families.set(family, (families.get(family) ?? 0) + (row.area || 1));
      const size = parsePx(row.fontSize);
      if (size) sizes.push({ value: size, score: row.area || 1 });
      if (row.fontWeight) weights.set(row.fontWeight, (weights.get(row.fontWeight) ?? 0) + 1);
      const lh = parsePx(row.lineHeight);
      if (lh && size) lineHeights.push({ value: Math.round((lh / size) * 100) / 100, score: 1 });
      const hex = rgbToHex(row.color);
      if (hex) colors.set(hex, (colors.get(hex) ?? 0) + 1);
    }

    const sizeClusters = clusterNumbers(sizes, { tolerance: 1 });
    const lhClusters = clusterNumbers(lineHeights, { tolerance: 0.05 });
    const topFamily = [...families.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const topWeight = [...weights.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const topColor = [...colors.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    roles[role] = {
      fontFamily: topFamily,
      fontSize: sizeClusters[0] ? formatPx(sizeClusters[0].value) : null,
      fontWeight: topWeight,
      lineHeight: lhClusters[0]?.value ?? null,
      color: topColor,
      sampleCount: rows.length,
      confidence: Math.min(0.95, 0.4 + rows.length / 40),
    };
  }

  const familyList =
    fontFamilies.length > 0
      ? fontFamilies.map((f) => (typeof f === 'string' ? { family: f } : { family: f.family, count: f.count }))
      : [...new Set((inspect.typography ?? []).map((t) => normalizeFamily(t.fontFamily)).filter(Boolean))].map(
          (family) => ({ family }),
        );

  return {
    families: familyList,
    roles,
    note: 'Font binaries catalogued in detected-fonts.json',
  };
}
