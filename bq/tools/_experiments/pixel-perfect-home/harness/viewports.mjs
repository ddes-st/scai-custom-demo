/**
 * Scoring viewports.
 *
 * Sitecore AI teacher sizes (from bq/tools/capture/lib/viewports.mjs):
 *   mobile 370 · tablet 768 · desktop 1024
 *
 * This capture's reference PNGs were taken at older widths (desktop 1440, mobile 390).
 * For fair pixelmatch we score at the **reference PNG width** (truth), and also
 * record the Sitecore AI targets for future re-capture alignment.
 */

export const SITECORE_AI_VIEWPORTS = {
  desktop: { width: 1024, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 370, height: 844 },
};

/** Fallback when PNG metadata is unavailable */
export const CAPTURE_REF_FALLBACK = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
};

export const VIEWPORT_KEYS = ['desktop', 'tablet', 'mobile'];
