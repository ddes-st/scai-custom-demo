/** Site chrome selectors — top bar, header, nav, utility bars. */
export const TOP_BAR_SELECTORS = [
  '[class*="top-bar"]',
  '[class*="topbar"]',
  '[class*="TopBar"]',
  '.jmheader__utility',
  '[class*="utility-bar"]',
  '[class*="announcement-bar"]',
  'aside[class*="announcement"]',
  '[class*="site-utility"]',
];

export const SITE_CHROME_SELECTORS = [
  'header#banner[role="banner"]',
  '#banner',
  'header[role="banner"]',
  'nav#navigation[role="navigation"]',
  'nav.jmheader__navbar',
  '.jmheader__navbar',
  '[class*="site-header"]',
  ...TOP_BAR_SELECTORS,
];

/** Browser-side: find all visible site chrome bands (top → bottom). */
export function detectAllSiteChromeInPage() {
  function isChromeVisible(el, minW = 120, minH = 16) {
    if (!el || !(el instanceof Element)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = el.getBoundingClientRect();
    return rect.width >= minW && rect.height >= minH;
  }

  const topBarSelectors = [
    '[class*="top-bar"]',
    '[class*="topbar"]',
    '[class*="TopBar"]',
    '.jmheader__utility',
    '[class*="utility-bar"]',
    '[class*="announcement-bar"]',
    'aside[class*="announcement"]',
    '[class*="site-utility"]',
  ];

  /** @type {Array<{found: boolean, selector: string, cmsName: string, type: string, folderName: string}>} */
  const found = [];
  const claimed = new Set();

  function tryAdd(selectors, cmsName, type, folderName, minW = 120, minH = 16) {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el || claimed.has(el)) continue;
      if (!isChromeVisible(el, minW, minH)) continue;
      claimed.add(el);
      found.push({ found: true, selector, cmsName, type, folderName });
      return;
    }
  }

  tryAdd(topBarSelectors, 'TopBar', 'topbar', 'top-bar', 120, 14);
  tryAdd(
    ['header#banner[role="banner"]', '#banner', 'header[role="banner"]', '[class*="site-header"]'],
    'Header',
    'header',
    'header',
    200,
    32
  );
  tryAdd(
    ['nav#navigation[role="navigation"]', 'nav.jmheader__navbar', '.jmheader__navbar'],
    'Navigation',
    'nav',
    'navigation',
    200,
    24
  );

  return found;
}

/** Browser-side: find first visible site chrome (legacy). */
export function detectSiteChromeInPage() {
  const all = detectAllSiteChromeInPage();
  return all[0] ?? { found: false, selector: null, cmsName: null, type: null };
}

/** @deprecated Use hideAllStickyOverlaysInPage from sticky-overlays.mjs */
export { hideAllStickyOverlaysInPage as hideSiteChromeInPage } from './sticky-overlays.mjs';
