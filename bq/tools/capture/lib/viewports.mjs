/**
 * Shared capture viewport sizes + overlay-scrollbar helper.
 * Classic Chromium scrollbars shrink clientWidth (~15px); real mobile uses overlay
 * scrollbars so layout stays at the full viewport width (e.g. mobile 370).
 *
 * Sitecore AI / Pages device presets (authoritative for TSX fidelity):
 *   Mobile 370 · Tablet Portrait 768 · Desktop Small 1024 · Desktop Regular 1280 · Desktop Large 1536
 *
 * Capture uses Desktop Small (1024) as the primary desktop layout teacher so codegen
 * matches Pages preview — not a 1440-only crop.
 */

export const VIEWPORTS = {
  /** Sitecore AI Desktop Small — primary desktop capture / critique width */
  desktop: { width: 1024, height: 900 },
  /** Sitecore AI Tablet Portrait */
  tablet: { width: 768, height: 1024 },
  /** Sitecore AI Mobile */
  mobile: { width: 370, height: 844 },
  /** Sitecore AI Desktop Regular (Tailwind xl:) */
  desktopRegular: { width: 1280, height: 900 },
  /** Sitecore AI Desktop Large (Tailwind 2xl:) */
  desktopLarge: { width: 1536, height: 900 },
};

/**
 * Full Sitecore AI preview catalog (not Flexible — that is a mode).
 * CSS style bands stay mobile/tablet/desktop; wider desktops share ≥1024 authored CSS.
 * Runtime capture/AI lists come from {@link resolveScreenshotDevices} /
 * {@link resolveEvidenceViewportOrder} (env `BQ_SCREENSHOT_VIEWPORTS`).
 */
export const SCREENSHOT_DEVICES = [
  'mobile',
  'tablet',
  'desktop',
  'desktopRegular',
  'desktopLarge',
];

/**
 * Default when `BQ_SCREENSHOT_VIEWPORTS` is unset or empty:
 * mobile + tablet + Desktop Small only (not Regular/Large).
 */
export const DEFAULT_SCREENSHOT_DEVICES = ['mobile', 'tablet', 'desktop'];

/**
 * Order for TSX AI multimodal evidence: composition at Desktop Small first,
 * then xl/2xl density, then narrow. Filter via {@link resolveEvidenceViewportOrder}.
 */
export const EVIDENCE_VIEWPORT_ORDER = [
  'desktop',
  'desktopRegular',
  'desktopLarge',
  'tablet',
  'mobile',
];

/** Three media bands used when baking section.html computed overlays. */
export const STYLE_BAND_DEVICES = ['desktop', 'tablet', 'mobile'];

/**
 * PNG / path slug for a device key (desktopRegular → desktop-regular).
 * @param {string} device
 */
export function deviceFileSlug(device) {
  return String(device || '')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}

/**
 * Normalize CLI / loose device names to VIEWPORTS keys.
 * Accepts desktopRegular, desktop-regular, desktopregular.
 * @param {string} raw
 * @returns {string|null}
 */
export function normalizeDeviceKey(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (s in VIEWPORTS) return s;
  const compact = s.toLowerCase().replace(/[-_\s]/g, '');
  for (const key of Object.keys(VIEWPORTS)) {
    if (key.toLowerCase() === compact) return key;
  }
  return null;
}

/**
 * Parse `BQ_SCREENSHOT_VIEWPORTS` (comma / whitespace separated).
 * Unknown tokens are dropped with a warn; order follows first occurrence.
 *
 * @param {string|null|undefined} raw
 * @returns {string[]} Normalized VIEWPORTS keys (may be empty)
 */
export function parseScreenshotViewportEnv(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return [];
  /** @type {string[]} */
  const out = [];
  const seen = new Set();
  for (const part of text.split(/[,;\s]+/)) {
    const token = String(part || '').trim();
    if (!token) continue;
    const key = normalizeDeviceKey(token);
    if (!key) {
      console.warn(
        `  ⚠ BQ_SCREENSHOT_VIEWPORTS: unknown viewport "${token}" (allowed: ${SCREENSHOT_DEVICES.join(', ')})`,
      );
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/**
 * Devices to screenshot during capture (and related PNG backfills).
 * Unset/empty/all-invalid env → {@link DEFAULT_SCREENSHOT_DEVICES}.
 * Otherwise intersection with {@link SCREENSHOT_DEVICES} in catalog order.
 *
 * @param {{ env?: NodeJS.ProcessEnv }} [opts]
 * @returns {string[]}
 */
export function resolveScreenshotDevices(opts = {}) {
  const env = opts.env || process.env;
  const parsed = parseScreenshotViewportEnv(env.BQ_SCREENSHOT_VIEWPORTS);
  if (!parsed.length) {
    return [...DEFAULT_SCREENSHOT_DEVICES];
  }
  const allow = new Set(parsed);
  const filtered = SCREENSHOT_DEVICES.filter((d) => allow.has(d));
  if (!filtered.length) {
    console.warn(
      '  ⚠ BQ_SCREENSHOT_VIEWPORTS: no valid keys — falling back to mobile,tablet,desktop',
    );
    return [...DEFAULT_SCREENSHOT_DEVICES];
  }
  return filtered;
}

/**
 * Viewport order for AI multimodal evidence (desktop-first among selected).
 *
 * @param {{ env?: NodeJS.ProcessEnv }} [opts]
 * @returns {string[]}
 */
export function resolveEvidenceViewportOrder(opts = {}) {
  const allow = new Set(resolveScreenshotDevices(opts));
  return EVIDENCE_VIEWPORT_ORDER.filter((d) => allow.has(d));
}

/** Layout bands for Tailwind / media classification (matches VIEWPORTS contract). */
export const LAYOUT_BANDS = {
  mobileMax: 767,
  tabletMin: 768,
  tabletMax: 1023,
  desktopMin: 1024,
};

const OVERLAY_SCROLLBAR_CSS = `
html {
  scrollbar-gutter: auto !important;
}
html, body {
  scrollbar-width: none !important;
}
* {
  scrollbar-width: none !important;
}
::-webkit-scrollbar {
  width: 0 !important;
  height: 0 !important;
  background: transparent !important;
}
`;

const INIT_SCRIPT = `
(() => {
  const apply = () => {
    if (document.getElementById('bq-overlay-scrollbars')) return;
    const style = document.createElement('style');
    style.id = 'bq-overlay-scrollbars';
    style.textContent = ${JSON.stringify(OVERLAY_SCROLLBAR_CSS)};
    (document.head || document.documentElement).appendChild(style);
  };
  apply();
  document.addEventListener('DOMContentLoaded', apply);
})();
`;

/**
 * Install overlay-scrollbar CSS on every document in this browser context.
 * @param {import('playwright').BrowserContext} context
 */
export async function installOverlayScrollbarsOnContext(context) {
  if (!context) return;
  await context.addInitScript(INIT_SCRIPT);
}

/**
 * Inject CSS so layout width matches setViewportSize (no classic scrollbar gutter).
 * Idempotent per page via #bq-overlay-scrollbars.
 * @param {import('playwright').Page} page
 */
export async function ensureOverlayScrollbars(page) {
  if (!page) return;
  try {
    await page.evaluate((css) => {
      if (document.getElementById('bq-overlay-scrollbars')) return;
      const style = document.createElement('style');
      style.id = 'bq-overlay-scrollbars';
      style.textContent = css;
      (document.head || document.documentElement).appendChild(style);
    }, OVERLAY_SCROLLBAR_CSS);
  } catch {
    /* page may be closed */
  }
}

/**
 * After setting a viewport, warn if clientWidth is still narrower than intended
 * (scrollbar still eating layout space).
 * @param {import('playwright').Page} page
 * @param {{ width: number, height: number }} viewport
 * @param {string} [label]
 */
export async function warnIfLayoutWidthShrunk(page, viewport, label = '') {
  if (!page || !viewport?.width) return;
  try {
    const clientWidth = await page.evaluate(
      () => document.documentElement?.clientWidth || window.innerWidth || 0,
    );
    if (clientWidth > 0 && clientWidth < viewport.width - 2) {
      const tag = label ? ` (${label})` : '';
      console.warn(
        `  ⚠ layout width${tag}: clientWidth=${clientWidth} < viewport=${viewport.width} (scrollbar shrink?)`,
      );
    }
  } catch {
    /* ignore */
  }
}
