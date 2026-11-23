/**
 * Evidence sidecar for detected-design-information.
 */

export function buildEvidence(parts) {
  const {
    inspect,
    colorClusters,
    colorUsage,
    classification,
    gradients,
    aiUsage = null,
    aiRaw = null,
  } = parts;

  return {
    generatedAt: new Date().toISOString(),
    viewport: inspect?.viewport ?? null,
    sampleCounts: {
      elements: inspect?.samples?.length ?? 0,
      buttons: inspect?.buttons?.length ?? 0,
      links: inspect?.links?.length ?? 0,
      typography: inspect?.typography?.length ?? 0,
      pseudos: inspect?.pseudos?.length ?? 0,
    },
    cssVariableCount: Object.keys(inspect?.cssVariables ?? {}).length,
    colorClusters: (colorClusters ?? []).slice(0, 40).map((c) => ({
      hex: c.hex,
      score: Math.round(c.score * 10) / 10,
      count: c.count,
      contexts: [...new Set((c.members ?? []).map((m) => m.meta?.context).filter(Boolean))].slice(0, 8),
      selectors: [...new Set((c.members ?? []).map((m) => m.meta?.selector).filter(Boolean))].slice(0, 8),
    })),
    colorUsageTop: (colorUsage ?? [])
      .slice()
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 50)
      .map((row) => ({
        color: row.color,
        context: row.context,
        weight: Math.round(row.weight * 10) / 10,
        selector: row.selector,
      })),
    gradients: (gradients ?? []).slice(0, 20),
    classification: classification ?? null,
    aiUsage,
    aiRaw: aiRaw ? { roles: aiRaw.roles, note: aiRaw.note } : null,
  };
}
