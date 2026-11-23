/**
 * Cluster observed values; representative stays a real observed value.
 */
import { hexToOklab, oklabDistance, toColorValue } from './normalize-color.mjs';

/**
 * @param {{ value: string, score?: number, meta?: object }[]} items
 * @param {{ distance?: number }} [opts]
 */
export function clusterColors(items, { distance = 0.045 } = {}) {
  /** @type {{ hex: string, oklab: object, score: number, members: object[], representative: string }[]} */
  const clusters = [];

  const sorted = [...items]
    .map((item) => {
      const cv = toColorValue(item.value);
      if (!cv) return null;
      return { ...item, hex: cv.hex, oklab: cv.oklab, score: item.score ?? 1 };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  for (const item of sorted) {
    let best = null;
    let bestDist = Infinity;
    for (const cluster of clusters) {
      const d = oklabDistance(item.oklab, cluster.oklab);
      if (d < bestDist) {
        bestDist = d;
        best = cluster;
      }
    }
    if (best && bestDist <= distance) {
      best.score += item.score;
      best.members.push(item);
    } else {
      clusters.push({
        hex: item.hex,
        oklab: item.oklab ?? hexToOklab(item.hex),
        score: item.score,
        members: [item],
        representative: item.hex,
      });
    }
  }

  return clusters
    .map((c) => {
      const top = c.members.sort((a, b) => b.score - a.score)[0];
      return {
        hex: top.hex,
        score: c.score,
        count: c.members.length,
        members: c.members,
        representative: top.hex,
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Cluster numeric CSS lengths (px). Representative = most common exact value.
 * @param {{ value: number, score?: number, meta?: object }[]} items
 * @param {{ tolerance?: number }} [opts]
 */
export function clusterNumbers(items, { tolerance = 1.5 } = {}) {
  const sorted = [...items]
    .filter((i) => typeof i.value === 'number' && Number.isFinite(i.value) && i.value >= 0)
    .sort((a, b) => (b.score ?? 1) - (a.score ?? 1));

  /** @type {{ value: number, score: number, members: object[] }[]} */
  const clusters = [];
  for (const item of sorted) {
    const score = item.score ?? 1;
    let best = null;
    let bestDist = Infinity;
    for (const cluster of clusters) {
      const d = Math.abs(item.value - cluster.value);
      if (d < bestDist) {
        bestDist = d;
        best = cluster;
      }
    }
    if (best && bestDist <= tolerance) {
      best.score += score;
      best.members.push(item);
    } else {
      clusters.push({ value: item.value, score, members: [item] });
    }
  }

  return clusters
    .map((c) => {
      const counts = new Map();
      for (const m of c.members) {
        const key = m.value;
        counts.set(key, (counts.get(key) ?? 0) + (m.score ?? 1));
      }
      let representative = c.value;
      let bestCount = -1;
      for (const [v, n] of counts) {
        if (n > bestCount) {
          bestCount = n;
          representative = v;
        }
      }
      return {
        value: representative,
        score: c.score,
        count: c.members.length,
        members: c.members,
      };
    })
    .sort((a, b) => b.score - a.score || a.value - b.value);
}

export function formatPx(n) {
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? `${rounded}px` : `${rounded}px`;
}
