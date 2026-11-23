/**
 * Build color usage rows + gradients from DOM inspect evidence.
 */
import { rgbToHex, isNeutralHex, toColorValue } from './normalize-color.mjs';
import { clusterColors } from './cluster.mjs';

const PROP_WEIGHT = {
  backgroundColor: 8,
  color: 5,
  borderColor: 2,
  fill: 3,
  stroke: 2,
};

const ROLE_WEIGHT = {
  hero: 1.6,
  button: 1.5,
  heading: 1.3,
  nav: 1.2,
  footer: 1.1,
  link: 1.1,
  body: 1,
  other: 0.6,
};

export function buildColorUsageFromInspect(inspect) {
  /** @type {{ color: string, context: string, weight: number, selector?: string }[]} */
  const usage = [];
  const gradients = [];

  for (const s of inspect.samples ?? []) {
    const areaScore = Math.min(12, Math.log10((s.area || 1) + 1) + 1);
    const roleMul = ROLE_WEIGHT[s.roleHint] ?? 1;
    const ctxBg =
      s.roleHint === 'button'
        ? 'button'
        : s.roleHint === 'nav'
          ? 'headerBg'
          : s.roleHint === 'footer'
            ? 'footerBg'
            : s.roleHint === 'heading'
              ? 'sectionBg'
              : 'sectionBg';
    const ctxFg =
      s.roleHint === 'button'
        ? 'button'
        : s.roleHint === 'heading'
          ? 'heading'
          : s.roleHint === 'link'
            ? 'link'
            : s.roleHint === 'nav'
              ? 'navText'
              : 'body';

    if (s.backgroundColor && s.backgroundColor !== 'rgba(0, 0, 0, 0)') {
      usage.push({
        color: s.backgroundColor,
        context: ctxBg,
        weight: PROP_WEIGHT.backgroundColor * areaScore * roleMul,
        selector: s.selector,
      });
    }
    if (s.color) {
      usage.push({
        color: s.color,
        context: ctxFg,
        weight: PROP_WEIGHT.color * areaScore * roleMul,
        selector: s.selector,
      });
    }
    if (s.borderColor && s.borderColor !== 'rgba(0, 0, 0, 0)') {
      usage.push({
        color: s.borderColor,
        context: 'body',
        weight: PROP_WEIGHT.borderColor * areaScore,
        selector: s.selector,
      });
    }
    if (s.backgroundImage && /gradient/i.test(s.backgroundImage) && s.backgroundImage !== 'none') {
      gradients.push({ gradient: s.backgroundImage, score: areaScore * roleMul, selector: s.selector });
    }
  }

  for (const p of inspect.pseudos ?? []) {
    if (p.backgroundColor && p.backgroundColor !== 'rgba(0, 0, 0, 0)') {
      usage.push({ color: p.backgroundColor, context: 'sectionBg', weight: 4, selector: p.selector });
    }
    if (p.color) {
      usage.push({ color: p.color, context: 'body', weight: 2, selector: p.selector });
    }
  }

  for (const svg of inspect.svgColors ?? []) {
    usage.push({
      color: svg.value,
      context: 'sectionBg',
      weight: (PROP_WEIGHT[svg.prop] ?? 2) * Math.min(4, Math.log10((svg.area || 1) + 1) + 1),
    });
  }

  return { usage, gradients };
}

export function extractColorClusters(usage) {
  const items = [];
  for (const row of usage) {
    const cv = toColorValue(row.color);
    if (!cv) continue;
    items.push({
      value: cv.hex,
      score: row.weight,
      meta: { context: row.context, selector: row.selector },
    });
  }
  return clusterColors(items);
}

/**
 * Enrich classified colors with confidence / sources from clusters.
 * Keeps { hex, gradients } shape for site-summary compatibility.
 */
export function annotateColorRoles(colors, clusters) {
  const byHex = new Map(clusters.map((c) => [c.hex, c]));
  const out = { ...colors };

  for (const role of ['primary', 'secondary', 'accent', 'neutrals']) {
    const bucket = colors[role] ?? { hex: [], gradients: [] };
    const hex = Array.isArray(bucket) ? bucket : bucket.hex ?? [];
    const gradients = Array.isArray(bucket) ? [] : bucket.gradients ?? [];
    out[role] = {
      hex,
      gradients,
      entries: hex.map((h) => {
        const cluster = byHex.get(h);
        const sources = (cluster?.members ?? [])
          .slice(0, 5)
          .map((m) => m.meta?.selector || m.meta?.context)
          .filter(Boolean);
        return {
          value: h,
          confidence: cluster ? Math.min(0.99, 0.35 + Math.log10(cluster.score + 1) / 4) : 0.4,
          sources: [...new Set(sources)].slice(0, 5),
          neutral: isNeutralHex(h),
        };
      }),
    };
  }
  return out;
}

export { rgbToHex };
