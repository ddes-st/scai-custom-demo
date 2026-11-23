/**
 * Box-shadow clusters (exact observed strings, scored by area).
 */

export function extractShadows(inspect) {
  const map = new Map();
  for (const s of inspect.samples ?? []) {
    const shadow = s.boxShadow;
    if (!shadow || shadow === 'none') continue;
    const score = Math.min(8, Math.log10((s.area || 1) + 1) + 1);
    const existing = map.get(shadow) ?? { value: shadow, score: 0, count: 0, selectors: [] };
    existing.score += score;
    existing.count += 1;
    if (existing.selectors.length < 4 && s.selector) existing.selectors.push(s.selector);
    map.set(shadow, existing);
  }

  const values = [...map.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ value, score, count, selectors }) => ({
      value,
      score: Math.round(score * 10) / 10,
      count,
      sources: selectors,
    }));

  return {
    values,
    common: values[0]?.value ?? null,
  };
}
