/**
 * Programmed role classification + semantic tokens map.
 * High-confidence CSS variables skip AI; low confidence flagged for optional AI.
 */

const PRIMARY_VAR =
  /^--(primary|brand-primary|brand-main|theme-color|color-primary|sc-(purple|blue|violet)-[456]00|main-cta)/i;
const SECONDARY_VAR = /^--(secondary|brand-secondary|color-secondary)/i;
const ACCENT_VAR = /^--(accent|cta|action|highlight|sc-main-cta)/i;
const NEUTRAL_VAR = /^--(neutral|gray|grey|slate|black|white|color-neutral)/i;

const AMBIGUITY_THRESHOLD = 0.7;

/**
 * @param {{ colors: object, cssVariables?: Record<string, string>, colorClusters?: object[] }} input
 */
export function classifyRoles(input) {
  const { colors, cssVariables = {}, colorClusters = [] } = input;
  const ambiguous = [];

  const varHits = { primary: [], secondary: [], accent: [], neutrals: [] };
  for (const [key, value] of Object.entries(cssVariables)) {
    const text = String(value).trim();
    if (!text || /gradient/i.test(text)) continue;
    if (PRIMARY_VAR.test(key)) varHits.primary.push({ key, value: text });
    else if (SECONDARY_VAR.test(key)) varHits.secondary.push({ key, value: text });
    else if (ACCENT_VAR.test(key)) varHits.accent.push({ key, value: text });
    else if (NEUTRAL_VAR.test(key)) varHits.neutrals.push({ key, value: text });
  }

  const roleMeta = {};
  for (const role of ['primary', 'secondary', 'accent', 'neutrals']) {
    const hexList = colors?.[role]?.hex ?? [];
    const hasVar = varHits[role].length > 0;
    const topCluster = colorClusters[0];
    const topInRole = hexList[0] && colorClusters.find((c) => c.hex === hexList[0]);
    let confidence = hasVar ? 0.92 : hexList.length ? 0.55 : 0.2;
    if (topInRole) {
      confidence = Math.max(confidence, Math.min(0.9, 0.4 + Math.log10(topInRole.score + 1) / 3));
    }
    if (hasVar) confidence = Math.max(confidence, 0.92);

    // Competing primaries among top clusters
    if (role === 'primary' && colorClusters.length >= 2) {
      const a = colorClusters[0]?.score ?? 0;
      const b = colorClusters[1]?.score ?? 0;
      if (a > 0 && b / a > 0.75) {
        confidence = Math.min(confidence, 0.55);
      }
    }

    roleMeta[role] = {
      confidence,
      source: hasVar ? 'css-variable' : 'heuristic',
      cssVariables: varHits[role].slice(0, 4).map((v) => v.key),
    };

    if (confidence < AMBIGUITY_THRESHOLD && hexList.length > 0) {
      ambiguous.push({
        role,
        confidence,
        candidates: hexList.slice(0, 5),
        competing: colorClusters.slice(0, 5).map((c) => ({ hex: c.hex, score: c.score })),
      });
    }
  }

  return {
    roleMeta,
    ambiguous,
    needsAi: ambiguous.length > 0,
  };
}

/**
 * Build semantic token map from classified colors + components.
 */
export function buildTokens({ colors, buttons, links, typography }) {
  const primary = colors?.primary?.hex?.[0] ?? null;
  const secondary = colors?.secondary?.hex?.[0] ?? null;
  const accent = colors?.accent?.hex?.[0] ?? buttons?.variants?.[0]?.background ?? null;
  const neutrals = colors?.neutrals?.hex ?? [];
  const text =
    typography?.roles?.body?.color ||
    typography?.roles?.h1?.color ||
    neutrals.find((h) => h === '#000000' || /^#1[0-9a-f]{5}$/i.test(h)) ||
    neutrals[0] ||
    null;
  const background =
    neutrals.find((h) => /^#f/i.test(h) || h === '#ffffff') || neutrals[neutrals.length - 1] || null;
  const border = neutrals.find((h) => !/^#(fff|000)/i.test(h)) ?? neutrals[1] ?? null;

  return {
    color: {
      text,
      background,
      border,
      primary,
      secondary,
      accent,
      interactive: accent || links?.variants?.[0]?.color || primary,
    },
    semantic: colors?.semantic ?? {},
  };
}

export { AMBIGUITY_THRESHOLD };
