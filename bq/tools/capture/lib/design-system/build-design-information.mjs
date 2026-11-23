/**
 * Build compact detected-design-information.json payload.
 */

export const EXTRACTOR_VERSION = '1.0.0';

/**
 * @param {object} parts
 */
export function buildDesignInformation(parts) {
  const {
    url,
    colors,
    typography,
    spacing,
    radius,
    shadows,
    layout,
    buttons,
    links,
    tokens,
    roleMeta,
    aiUsed = false,
    aiUsage = null,
    aiSkipReason = null,
  } = parts;

  return {
    meta: {
      url: url ?? null,
      generatedAt: new Date().toISOString(),
      extractorVersion: EXTRACTOR_VERSION,
      aiUsed: Boolean(aiUsed),
      ...(aiUsed && aiUsage ? { aiUsage } : {}),
      ...(aiSkipReason ? { aiSkipReason } : {}),
      classification: roleMeta ?? undefined,
    },
    colors,
    typography,
    spacing,
    radius,
    shadows,
    layout: {
      containers: layout?.containers ?? [],
      breakpoints: layout?.breakpoints ?? [],
      viewport: layout?.viewport ?? null,
    },
    components: {
      buttons: buttons ?? { variants: [] },
      links: links ?? { variants: [] },
    },
    tokens: tokens ?? {},
    assets: {
      fonts: 'detected-fonts.json',
      css: 'detected-css.json',
    },
  };
}
