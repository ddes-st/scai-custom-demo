/**
 * Sitecore AI teacher viewport sizes for visual-fidelity Playwright shots.
 * Which keys are shot/scored follows `BQ_SCREENSHOT_VIEWPORTS` via
 * {@link resolveVisualFidelityViewportKeys}.
 */
import {
  EVIDENCE_VIEWPORT_ORDER,
  VIEWPORTS,
  resolveEvidenceViewportOrder,
} from '../../capture/lib/viewports.mjs';

export const SITECORE_AI_VIEWPORTS = {
  desktop: VIEWPORTS.desktop,
  desktopRegular: VIEWPORTS.desktopRegular,
  desktopLarge: VIEWPORTS.desktopLarge,
  tablet: VIEWPORTS.tablet,
  mobile: VIEWPORTS.mobile,
};

/**
 * Full desktop-first catalog (documentation / fallback). Prefer
 * {@link resolveVisualFidelityViewportKeys} at capture/score time.
 */
export const VIEWPORT_KEYS = [...EVIDENCE_VIEWPORT_ORDER];

/**
 * Viewport keys for VF capture + scoring (same filter as capture evidence).
 * Honors `BQ_SCREENSHOT_VIEWPORTS` (default mobile,tablet,desktop).
 *
 * @param {{ env?: NodeJS.ProcessEnv }} [opts]
 * @returns {string[]}
 */
export function resolveVisualFidelityViewportKeys(opts = {}) {
  return resolveEvidenceViewportOrder(opts);
}
