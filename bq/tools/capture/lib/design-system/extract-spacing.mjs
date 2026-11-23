/**
 * Spacing scale from padding/margin/gap samples.
 */
import { clusterNumbers, formatPx } from './cluster.mjs';

function parsePx(value) {
  const m = String(value || '').match(/^([\d.]+)px$/);
  return m ? Number(m[1]) : null;
}

const SPACE_PROPS = [
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'marginTop',
  'marginBottom',
  'gap',
];

export function extractSpacing(inspect) {
  const items = [];
  for (const s of inspect.samples ?? []) {
    const score = Math.min(8, Math.log10((s.area || 1) + 1) + 1);
    for (const prop of SPACE_PROPS) {
      const n = parsePx(s[prop]);
      if (n == null || n === 0 || n > 200) continue;
      items.push({ value: n, score, meta: { prop, selector: s.selector } });
    }
  }

  const clusters = clusterNumbers(items, { tolerance: 2 }).filter((c) => c.score >= 3).slice(0, 16);
  const scale = {};
  const names = ['3xs', '2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl'];
  clusters.slice(0, names.length).forEach((c, i) => {
    scale[names[i]] = formatPx(c.value);
  });

  return {
    scale: Object.keys(scale).length >= 3 ? scale : {},
    topValues: clusters.slice(0, 12).map((c) => ({
      value: formatPx(c.value),
      score: Math.round(c.score * 10) / 10,
      count: c.count,
    })),
    note: Object.keys(scale).length < 3 ? 'Weak spacing evidence; see topValues / evidence file' : undefined,
  };
}
