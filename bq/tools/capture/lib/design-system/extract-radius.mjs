/**
 * Border-radius clusters from visible elements.
 */
import { clusterNumbers, formatPx } from './cluster.mjs';

function parsePx(value) {
  if (!value || value === '0px') return value === '0px' ? 0 : null;
  // take first radius token
  const first = String(value).split(/\s+/)[0];
  const m = first.match(/^([\d.]+)px$/);
  return m ? Number(m[1]) : null;
}

export function extractRadius(inspect) {
  const items = [];
  for (const s of inspect.samples ?? []) {
    const n = parsePx(s.borderTopLeftRadius || s.borderRadius);
    if (n == null || n > 999) continue;
    const score =
      (s.roleHint === 'button' ? 3 : 1) * Math.min(6, Math.log10((s.area || 1) + 1) + 1);
    items.push({ value: n, score, meta: { selector: s.selector, role: s.roleHint } });
  }
  for (const b of inspect.buttons ?? []) {
    const n = parsePx(b.borderRadius);
    if (n == null) continue;
    items.push({ value: n, score: 5, meta: { selector: b.selector, role: 'button' } });
  }

  const clusters = clusterNumbers(items, { tolerance: 1.5 }).slice(0, 10);
  return {
    values: clusters.map((c) => ({
      value: formatPx(c.value),
      score: Math.round(c.score * 10) / 10,
      count: c.count,
    })),
    common: clusters[0] ? formatPx(clusters[0].value) : null,
    button: (() => {
      const btn = clusterNumbers(
        items.filter((i) => i.meta?.role === 'button'),
        { tolerance: 1.5 },
      )[0];
      return btn ? formatPx(btn.value) : null;
    })(),
  };
}
