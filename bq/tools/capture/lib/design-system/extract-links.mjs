/**
 * Link styles from content links (outside nav/header).
 */
import { rgbToHex } from './normalize-color.mjs';
import { clusterColors } from './cluster.mjs';

export function extractLinks(inspect) {
  const links = inspect.links ?? [];
  if (!links.length) {
    return { variants: [], note: 'No content links sampled' };
  }

  const colorItems = [];
  const decorations = new Map();
  const weights = new Map();

  for (const link of links) {
    const hex = rgbToHex(link.color);
    const score = Math.min(6, Math.log10((link.area || 1) + 1) + 1);
    if (hex) colorItems.push({ value: hex, score, meta: { selector: link.selector } });
    if (link.textDecoration) {
      decorations.set(link.textDecoration, (decorations.get(link.textDecoration) ?? 0) + 1);
    }
    if (link.fontWeight) {
      weights.set(link.fontWeight, (weights.get(link.fontWeight) ?? 0) + 1);
    }
  }

  const colors = clusterColors(colorItems).slice(0, 3);
  return {
    variants: colors.map((c, i) => ({
      name: i === 0 ? 'default' : `variant-${i + 1}`,
      color: c.hex,
      textDecoration: [...decorations.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
      fontWeight: [...weights.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
      confidence: Math.min(0.95, 0.4 + c.score / 30),
      sampleCount: c.count,
    })),
    sampleCount: links.length,
  };
}
