/** Sticky / fixed navigation selectors. */
export const STICKY_NAV_CANDIDATES = [
  'header#banner[role="banner"]',
  '#banner',
  'header[role="banner"]',
  'nav#navigation[role="navigation"]',
  'nav.jmheader__navbar',
  'nav[role="navigation"]',
];

/** Browser-side: detect sticky/fixed header or nav. */
export function detectStickyNavigationInPage() {
  const candidates = [
    'header#banner[role="banner"]',
    '#banner',
    'header[role="banner"]',
    'nav#navigation[role="navigation"]',
    'nav.jmheader__navbar',
    'nav[role="navigation"]',
    'header',
  ];

  for (const selector of candidates) {
    const el = document.querySelector(selector);
    if (!el || !(el instanceof Element)) continue;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 200 || rect.height < 32) continue;

    const position = style.position;
    const isStickyClass = [...el.classList].some((c) =>
      /sticky|fixed-top|navbar-fixed|is-sticky/i.test(c)
    );
    const isFixed = position === 'fixed' || position === 'sticky' || isStickyClass;

    if (!isFixed) continue;

    const isNav = el.tagName === 'NAV' || el.matches('nav, [role="navigation"]');
    const cmsName = isNav ? 'Navigation' : 'Header';

    return { sticky: true, selector, cmsName, position };
  }

  return { sticky: false, selector: null, cmsName: null, position: null };
}

/** Browser-side: hide sticky navigation before section discovery. */
export function hideStickyNavigationInPage() {
  const selectors = [
    'header#banner',
    '#banner',
    'header[role="banner"]',
    'nav#navigation',
    'nav.jmheader__navbar',
    '.jmheader__navbar',
    '[class*="sticky-header"]',
    '[class*="fixed-top"]',
  ];
  for (const selector of selectors) {
    document.querySelectorAll(selector).forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const style = window.getComputedStyle(el);
      if (style.position !== 'fixed' && style.position !== 'sticky') {
        const hasStickyClass = [...el.classList].some((c) =>
          /sticky|fixed-top|navbar-fixed/i.test(c)
        );
        if (!hasStickyClass && selector !== '#banner' && selector !== 'header#banner') return;
      }
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('position', 'static', 'important');
      el.setAttribute('aria-hidden', 'true');
    });
  }
}
