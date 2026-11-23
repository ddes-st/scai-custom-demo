/**
 * Detect, capture, and hide sticky/fixed overlay UI (cookie, nav, chat, side buttons, …).
 * All browser-side functions must be self-contained for page.evaluate().
 */

/** Browser-side: detect sticky overlay components worth capturing separately. */
export function detectAllStickyOverlaysInPage() {
  function isVisible(el, minW = 40, minH = 24) {
    if (!el || !(el instanceof Element)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    return rect.width >= minW && rect.height >= minH;
  }

  function isInPageNav(el) {
    if (!(el instanceof Element)) return false;
    if (el.getAttribute('role') === 'tablist') return true;
    if (el.closest('[role="tablist"], [aria-label*="Slide navigation" i], [aria-label*="slide navigation" i]')) {
      return true;
    }
    // Content inside the main landmark — not site chrome.
    if (el.closest('main, [role="main"], #main-content, #main')) return true;
    if (el.closest('footer, [class*="footer" i]')) return true;
    return false;
  }

  function buildSelector(el) {
    if (!(el instanceof Element)) return null;
    if (el.id) return `#${CSS.escape(el.id)}`;

    const stableClasses = [...el.classList].filter(
      (c) =>
        c &&
        !c.startsWith('lfr-layout-structure-item-') &&
        !/^js-/.test(c) &&
        !/^is-/.test(c) &&
        !/^col-/.test(c) &&
        !c.includes('module__') &&
        c.length < 64
    );
    if (stableClasses.length) {
      const sel = `${el.tagName.toLowerCase()}.${stableClasses.slice(0, 2).map((c) => CSS.escape(c)).join('.')}`;
      if (document.querySelectorAll(sel).length === 1) return sel;
    }

    const parts = [];
    let node = el;
    while (node && node.nodeType === Node.ELEMENT_NODE && parts.length < 6) {
      let part = node.tagName.toLowerCase();
      if (node.id) {
        parts.unshift(`#${CSS.escape(node.id)}`);
        break;
      }
      const parent = node.parentElement;
      if (parent) {
        const siblings = [...parent.children].filter((s) => s.tagName === node.tagName);
        if (siblings.length > 1) {
          part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
        }
      }
      parts.unshift(part);
      node = parent;
    }
    return parts.join(' > ');
  }

  function tryAdd(found, claimed, selector, cmsName, type, folderName, minW, minH) {
    const el = document.querySelector(selector);
    if (!el || claimed.has(el) || !isVisible(el, minW, minH) || isInPageNav(el)) return;
    claimed.add(el);
    found.push({ selector, cmsName, type, folderName });
  }

  function tryAddElement(found, claimed, el, cmsName, type, folderName) {
    if (!el || claimed.has(el) || !isVisible(el) || isInPageNav(el)) return false;
    const selector = buildSelector(el);
    if (!selector) return false;
    try {
      if (document.querySelector(selector) !== el) return false;
    } catch {
      return false;
    }
    claimed.add(el);
    found.push({ selector, cmsName, type, folderName });
    return true;
  }

  function looksLikePageHero(el) {
    if (!(el instanceof Element)) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    const vh = window.innerHeight || 900;
    const isChromePosition =
      style.position === 'fixed' || style.position === 'sticky' || style.position === 'absolute';
    // Tall in-flow bands are page heroes/carousels, not site chrome overlays.
    if (isChromePosition && rect.height <= 160) return false;
    const tall = rect.height >= Math.min(420, vh * 0.45);
    if (!tall) return false;
    const cls = String(el.className || '');
    if (/pageHeader|hero|slider|carousel|ContentZone__pageHeader|HeroEditorial/i.test(cls)) return true;
    if (
      el.querySelector(
        '.HeroEditorial, .SliderTransition, [aria-roledescription="carousel"], [class*="hero" i]',
      )
    ) {
      return true;
    }
    // Tall relative/static header landmark without chrome position
    if (!isChromePosition && (el.tagName === 'HEADER' || /header/i.test(cls))) return true;
    return false;
  }

  function hasChromeSignals(el) {
    if (!(el instanceof Element)) return false;
    const hasLogo =
      !!el.querySelector(
        'img, svg, [class*="logo" i], [aria-label*="logo" i], a[href="/"], a[href="./"]',
      );
    const hasMenu =
      !!el.querySelector(
        'nav, [role="navigation"], button, [class*="menu" i], [class*="hamburger" i], [aria-label*="menu" i], [aria-label*="zoek" i], [aria-label*="search" i], a[href]',
      );
    return hasLogo || hasMenu;
  }

  function isShortTopChrome(el) {
    if (!(el instanceof Element) || !isVisible(el, 120, 24)) return false;
    if (looksLikePageHero(el)) return false;
    // Never treat in-page content bands as site chrome.
    if (el.closest('main, [role="main"], #main-content, #main')) return false;
    const style = window.getComputedStyle(el);
    const pos = style.position;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth || 1440;
    if (rect.top > 100) return false;
    if (rect.height < 28 || rect.height > 220) return false;
    if (rect.width < vw * 0.7) return false;

    const cls = String(el.className || '');
    const id = String(el.id || '');
    const role = (el.getAttribute('role') || '').toLowerCase();
    const landmarkHint =
      el.tagName === 'HEADER' ||
      el.tagName === 'NAV' ||
      role === 'banner' ||
      role === 'navigation' ||
      /header|navbar|main-?nav|site-?header|global-?header/i.test(`${cls} ${id}`);
    const overlayHint =
      /overlap|overlapping|minimize|fixed-top|sticky-header|main.?header|site.?header|global.?header|primary.?nav|main.?nav/i.test(
        cls,
      );

    const isOverlayPos = ['fixed', 'sticky', 'absolute'].includes(pos);
    const isInFlowPos = pos === 'relative' || pos === 'static' || pos === '';

    if (isOverlayPos) {
      const z = Number.parseInt(style.zIndex, 10);
      // Sticky often uses auto z-index; absolute/fixed chrome usually stacks ≥10.
      if (pos !== 'sticky' && Number.isFinite(z) && z < 10) return false;
      if (!overlayHint && !hasChromeSignals(el)) return false;
      return true;
    }

    // Document-flow site headers (logo + menu) — same concept as fixed chrome, no brand classes.
    if (isInFlowPos) {
      if (!landmarkHint) return false;
      if (!hasChromeSignals(el)) return false;
      return true;
    }

    return false;
  }

  function detectFixedSiteChrome(found, claimed) {
    const vw = window.innerWidth || 1440;
    /** @type {Array<{ el: Element, score: number }>} */
    const chromeCandidates = [];

    const pushCandidate = (el) => {
      if (!(el instanceof Element) || claimed.has(el) || isInPageNav(el)) return;
      if (!isShortTopChrome(el)) return;
      const rect = el.getBoundingClientRect();
      // Prefer shorter full-bleed bands (true chrome over slightly taller wrappers)
      const score = 1000 - rect.height + rect.width / vw;
      chromeCandidates.push({ el, score });
    };

    // Explicit short chrome selectors (skip if they resolve to tall heroes)
    const explicit = [
      'section.main-nav',
      'section.nav.main-nav',
      '[class*="MainNavigation"]',
      'header[role="banner"]',
      'header#banner',
      '#banner',
      '[class*="GlobalHeader"]',
      '[class*="global-header"]',
      '[class*="site-header"]',
      '[class*="MainHeader"]',
      '[class*="main-header"]',
      '[data-component-name="Header"]',
      '[data-component-name="GlobalHeader"]',
      '[class*="sticky-header"]',
      '[class*="fixed-top"]',
    ];
    for (const selector of explicit) {
      try {
        for (const el of document.querySelectorAll(selector)) {
          if (looksLikePageHero(el)) continue;
          pushCandidate(el);
        }
      } catch {
        /* ignore */
      }
    }

    // Geometry sweep: absolute/fixed/sticky short bands at top (catches overlapping chrome)
    for (const el of document.querySelectorAll('body *')) {
      if (!(el instanceof HTMLElement)) continue;
      if (claimed.has(el) || isInPageNav(el)) continue;
      const style = window.getComputedStyle(el);
      if (!['fixed', 'sticky', 'absolute'].includes(style.position)) continue;
      pushCandidate(el);
    }

    // Landmark pass for short fixed/sticky headers only (never tall heroes)
    for (const el of document.querySelectorAll(
      'header, nav, [role="banner"], [class*="header" i]',
    )) {
      if (looksLikePageHero(el)) continue;
      pushCandidate(el);
    }

    // Prefer outermost short chrome (avoid nested logo/nav strips), then shortest band.
    const outermost = chromeCandidates.filter(
      ({ el }) => !chromeCandidates.some(({ el: other }) => other !== el && other.contains(el)),
    );
    outermost.sort((a, b) => b.score - a.score);
    for (const { el } of outermost) {
      if (found.some((f) => f.cmsName === 'Header')) break;
      tryAddElement(found, claimed, el, 'Header', 'header', 'header');
    }

    // Skip-link parent climb — only if still no header and parent is short chrome
    if (!found.some((f) => f.cmsName === 'Header')) {
      const skipLink = document.querySelector(
        'a[href="#main-content"], a[href="#main"], a[href="#content"], a[class*="skip" i]',
      );
      if (skipLink) {
        let node = skipLink.parentElement;
        for (let depth = 0; node && depth < 5; depth++) {
          if (!looksLikePageHero(node) && isShortTopChrome(node)) {
            if (tryAddElement(found, claimed, node, 'Header', 'header', 'header')) break;
          }
          node = node.parentElement;
        }
      }
    }
  }

  const found = [];
  const claimed = new Set();

  /**
   * Prefer full CMP dialog/container nodes over small controls (close buttons,
   * floating cookie icons). Collect candidates and keep the largest visible box.
   */
  function climbToConsentContainer(el) {
    if (!(el instanceof Element)) return null;
    const dialog =
      el.closest(
        '[role="dialog"], [role="alertdialog"], .osano-cm-dialog, .osano-cm-window__dialog, #onetrust-banner-sdk, #CybotCookiebotDialog, #didomi-popup, .qc-cmp2-container',
      ) || null;
    if (dialog) return dialog;
    let node = el;
    for (let depth = 0; node && depth < 8; depth++) {
      const id = (node.id || '').toLowerCase();
      const cls = (node.className?.toString?.() || '').toLowerCase();
      const aria = (node.getAttribute('aria-label') || '').toLowerCase();
      const role = (node.getAttribute('role') || '').toLowerCase();
      if (
        /osano-cm-dialog|osano-cm-window|cookie-banner|consent-banner|privacy-banner|onetrust|cookiebot|didomi|usercentrics|qc-cmp/.test(
          `${id} ${cls}`,
        ) ||
        ((role === 'dialog' || role === 'alertdialog') && /cookie|consent|privacy|storage/.test(aria))
      ) {
        return node;
      }
      node = node.parentElement;
    }
    return el;
  }

  function addCookieCandidate(candidates, el, preferredSelector = null) {
    if (!(el instanceof Element) || !isVisible(el, 80, 32)) return;
    // Cookie banners may mount under <main> in SPAs — do not use isInPageNav here.
    if (el.closest('footer, [class*="footer" i]:not([class*="cookie" i])')) {
      const st = window.getComputedStyle(el);
      if (st.position === 'static' || st.position === 'relative') return;
    }
    const container = climbToConsentContainer(el);
    if (!container || claimed.has(container) || !isVisible(container, 80, 32)) return;
    const rect = container.getBoundingClientRect();
    const area = rect.width * rect.height;
    // Ignore tiny cookie icons / toggles unless they are the only hit later.
    if (area < 80 * 40) return;
    const selector =
      preferredSelector && document.querySelector(preferredSelector) === container
        ? preferredSelector
        : buildSelector(container);
    if (!selector) return;
    candidates.push({ el: container, selector, area, width: rect.width, height: rect.height });
  }

  const cookieSelectors = [
    // Prefer known CMP dialog/containers first (full banner, not controls).
    '.osano-cm-dialog',
    '.osano-cm-window__dialog',
    '.osano-cm-window',
    '#onetrust-banner-sdk',
    '#onetrust-consent-sdk',
    '#tc-privacy-wrapper',
    '.tc-privacy-wrapper',
    '[class*="tc-privacy-wrapper"]',
    '[class*="tc-privacy-banner"]',
    '#didomi-host',
    '#didomi-popup',
    '#CybotCookiebotDialog',
    '#usercentrics-root',
    '[id*="uc-central-banner"]',
    '#sp-cc',
    '.qc-cmp2-container',
    '#js-gdpr-consent-banner',
    '[class*="cookie-banner"]',
    '[class*="cookie-consent"]',
    '[class*="cookie-notice"]',
    '[class*="consent-banner"]',
    '[class*="privacy-banner"]',
    '[class*="privacy-wrapper"]',
    '[class*="gdpr"]',
    '[id*="cookie-banner"]',
    '[id*="privacy-wrapper"]',
    '[id*="gdpr" i]',
    '[id*="consent-banner" i]',
    '[id*="consent" i][class*="gdpr" i]',
    '[role="dialog"][aria-label*="cookie" i]',
    '[role="dialog"][aria-label*="consent" i]',
    '[aria-label*="Cookie Consent" i]',
    // Loose aria matches last — often hit a button/control; climbToConsentContainer expands them.
    '[aria-label*="cookie" i]',
    '[aria-label*="consent" i]',
  ];

  const cookieCandidates = [];
  for (const selector of cookieSelectors) {
    try {
      for (const el of document.querySelectorAll(selector)) {
        addCookieCandidate(cookieCandidates, el, selector);
      }
    } catch {
      /* invalid selector */
    }
  }

  if (cookieCandidates.length === 0) {
    const heuristic = detectCookieBannerHeuristic();
    if (heuristic) {
      const el = document.querySelector(heuristic.selector);
      if (el) addCookieCandidate(cookieCandidates, el, heuristic.selector);
    }
  }

  // Classless Tailwind / custom CMP: scan fixed layers by consent copy + CTAs
  if (cookieCandidates.length === 0) {
    const byCopy = detectConsentOverlayByCopy();
    if (byCopy) {
      const el = document.querySelector(byCopy.selector);
      if (el) addCookieCandidate(cookieCandidates, el, byCopy.selector);
    }
  }

  if (cookieCandidates.length > 0) {
    cookieCandidates.sort((a, b) => b.area - a.area || b.width - a.width);
    const best = cookieCandidates[0];
    claimed.add(best.el);
    found.push({
      selector: best.selector,
      cmsName: 'CookieBanner',
      type: 'cookie-banner',
      folderName: 'cookie-banner',
    });
  }

  function detectConsentOverlayByCopy() {
    const copyRe =
      /cookies?|cookiebeleid|gebruikt cookies|we use cookies|this site uses|cookie policy|gdpr|consentement|accepteer|weiger|instellingen|ablehnen|akzeptieren|alle cookies|niet-essenti|non-essential|strictly necessary|strikt noodzakelijk/i;
    const ctaRe =
      /accept(eer)?|accepteer|allow all|i agree|akkoord|agree|reject|weiger|deny|refuse|instellingen|settings|manage|voorkeuren|customize|personali/i;
    const vw = window.innerWidth || 1;
    const vh = window.innerHeight || 1;

    function countCtas(el) {
      let n = 0;
      for (const btn of el.querySelectorAll('button, a, [role="button"]')) {
        const t = (btn.innerText || btn.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
        if (t && ctaRe.test(t) && t.length < 64) n += 1;
      }
      return n;
    }

    function climbOutermost(el) {
      let best = el;
      let cur = el.parentElement;
      for (let i = 0; cur && i < 6; i++) {
        if (!(cur instanceof HTMLElement)) break;
        const st = window.getComputedStyle(cur);
        if (!['fixed', 'sticky', 'absolute'].includes(st.position)) break;
        if (!isVisible(cur, 80, 40)) break;
        if (!copyRe.test((cur.innerText || '').slice(0, 500))) break;
        best = cur;
        cur = cur.parentElement;
      }
      return best;
    }

    /** @type {{ el: Element, score: number, area: number }[]} */
    const scored = [];
    for (const el of document.querySelectorAll(
      'div, section, aside, dialog, [role="dialog"], [role="alertdialog"]',
    )) {
      if (!(el instanceof HTMLElement)) continue;
      const st = window.getComputedStyle(el);
      if (!['fixed', 'sticky', 'absolute'].includes(st.position)) continue;
      if (!isVisible(el, 80, 40)) continue;
      if (el.closest('footer, [class*="Footer" i]')) continue;
      const r = el.getBoundingClientRect();
      if (!(r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw)) continue;
      const nearEdge =
        r.bottom >= vh - 120 || r.top <= 140 || r.left <= 48 || r.right >= vw - 48;
      if (!nearEdge && el.getAttribute('role') !== 'dialog') continue;
      if (r.width < Math.min(200, vw * 0.2) || r.height < 48) continue;
      if (r.width >= vw * 0.95 && r.height >= vh * 0.85) continue;
      const text = (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 600);
      if (!copyRe.test(text)) continue;
      const ctas = countCtas(el);
      if (ctas < 1 && !/accepteer|accept all|allow all|akkoord/i.test(text)) continue;
      let score = ctas * 3;
      if (/cookies?/i.test(text)) score += 2;
      if (st.position === 'fixed') score += 2;
      const z = parseInt(st.zIndex, 10);
      if (!Number.isNaN(z) && z >= 40) score += 1;
      if (r.bottom >= vh - 120 || r.left <= 48) score += 1;
      if (ctas >= 2) score += 2;
      if (score < 4) continue;
      const outer = climbOutermost(el);
      scored.push({
        el: outer,
        score,
        area: outer.getBoundingClientRect().width * outer.getBoundingClientRect().height,
      });
    }
    if (!scored.length) return null;
    scored.sort((a, b) => b.score - a.score || b.area - a.area);
    const best = scored[0].el;
    const selector = buildSelector(best);
    if (!selector) return null;
    try {
      if (document.querySelector(selector) !== best) return null;
    } catch {
      return null;
    }
    return { selector, cmsName: 'CookieBanner', type: 'cookie-banner', folderName: 'cookie-banner' };
  }

  function detectCookieBannerHeuristic() {
    function nameLooksLikeConsent(el) {
      const id = (el.id || '').toLowerCase();
      const cls = (el.className?.toString?.() || '').toLowerCase();
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
      const role = (el.getAttribute('role') || '').toLowerCase();
      const text = (el.textContent || '').slice(0, 280).toLowerCase();
      const nameHit = /cookie|consent|privacy|gdpr|didomi|quantcast|usercentrics|onetrust|osano|cookiebot|trustcommander|tc-privacy|sp-cc|cmp-/.test(
        `${id} ${cls} ${aria} ${role}`
      );
      // Fixed bottom bars that talk about cookies/privacy even with terse class names.
      const copyHit = /cookie|cookies|privacy policy|gdpr|we use cookies|this site uses|gebruikt cookies|cookiebeleid|accepteer|weiger/.test(text);
      return nameHit || copyHit;
    }

    function looksLikeOverlayBanner(el) {
      if (!isVisible(el) || !nameLooksLikeConsent(el)) return false;
      // Custom React apps often mount banners under main — rely on fixed layering.
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const zIndex = parseInt(style.zIndex, 10);
      const highStack = !Number.isNaN(zIndex) && zIndex >= 40;
      const fixedLike = style.position === 'fixed' || style.position === 'sticky' || style.position === 'absolute';
      const wide = rect.width >= window.innerWidth * 0.2;
      const atEdge =
        rect.bottom >= window.innerHeight - 120 ||
        rect.top <= 140 ||
        rect.left <= 48 ||
        (rect.top >= 0 && rect.top <= window.innerHeight * 0.15);
      return (
        fixedLike &&
        wide &&
        rect.height >= 40 &&
        atEdge &&
        (highStack || style.position === 'fixed' || style.position === 'sticky')
      );
    }

    const candidates = [
      ...document.querySelectorAll(
        '[id*="privacy" i], [class*="privacy" i], [id*="cookie" i], [class*="cookie" i], [id*="consent" i], [class*="consent" i], [id*="gdpr" i], [class*="gdpr" i], [role="dialog"], [role="alertdialog"], [role="banner"]'
      ),
    ];
    let best = null;
    let bestArea = 0;
    for (const el of candidates) {
      if (!looksLikeOverlayBanner(el)) continue;
      // role=banner headers are common — only keep consent-like ones.
      if (el.getAttribute('role') === 'banner' && !nameLooksLikeConsent(el)) continue;
      const area = el.getBoundingClientRect().width * el.getBoundingClientRect().height;
      if (area > bestArea) {
        best = el;
        bestArea = area;
      }
    }
    if (!best) return null;
    const selector = buildSelector(best);
    if (!selector || document.querySelector(selector) !== best) return null;
    return { selector, cmsName: 'CookieBanner', type: 'cookie-banner', folderName: 'cookie-banner' };
  }

  const topBarSelectors = [
    '[class*="top-bar"]',
    '[class*="topbar"]',
    '[class*="TopBar"]',
    '.jmheader__utility',
    '[class*="utility-bar"]',
    '[class*="announcement-bar"]',
    '.sc-announcement-bar',
    'aside[class*="announcement"]',
    '[class*="site-utility"]',
  ];
  for (const selector of topBarSelectors) {
    tryAdd(found, claimed, selector, 'TopBar', 'topbar', 'top-bar', 120, 14);
    if (found.some((f) => f.cmsName === 'TopBar')) break;
  }

  // Generic language / locale suggestion bars (not brand-specific class names).
  // Heuristic: short full-width strip near the top whose text/controls look like a lang picker.
  (function detectLangLocaleBanner() {
    if (found.some((f) => f.cmsName === 'LangSelector')) return;
    const vw = window.innerWidth || 1440;
    // Layout tokens like Drupal `region` / `region-header-inner` are NOT locale evidence.
    const langWordClsId =
      /\b(lang(uage|ue)?|locale|taal|sprache|idioma|lingua|country|market)\b/i;
    // `region` / `région` only count in visible copy / aria (market chooser), never class/id alone.
    const langWordText =
      /\b(lang(uage|ue)?|locale|taal|sprache|idioma|lingua|country|région|region|market)\b/i;
    const langChoice =
      /\b(english|anglais|français|francais|nederlands|dutch|deutsch|german|español|espanol|italiano|português|portugues|中文|日本語|한국어|العربية|continue|doorgaan|continuer|weiter|continuar|select\s+(your\s+)?(language|country|market))\b/i;
    const candidates = [
      ...document.querySelectorAll('div, section, aside, nav, form, dialog, [role="dialog"], [role="region"]'),
    ];
    let best = null;
    let bestScore = 0;
    for (const el of candidates) {
      if (!el || claimed.has(el) || !isVisible(el, Math.min(280, vw * 0.4), 28)) continue;
      if (el.closest('footer, [class*="footer" i], [role="tablist"]')) continue;
      // Already covered if nested under a detected header/cookie.
      if ([...claimed].some((c) => c.contains(el) || el.contains(c))) continue;
      const rect = el.getBoundingClientRect();
      if (rect.top > 160) continue;
      if (rect.height < 28 || rect.height > 140) continue;
      if (rect.width < vw * 0.55) continue;
      const cls = String(el.className || '');
      const id = String(el.id || '');
      const aria = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('data-testid') || ''}`;
      const text = (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 240);
      const clsId = `${cls} ${id}`;
      const textAria = `${aria} ${text}`;
      const clsIdLang =
        langWordClsId.test(clsId) || /(?:^|[^a-z])lang(?:uage)?(?:[^a-z]|$)|locale/i.test(clsId);
      const textLang =
        langWordText.test(textAria) ||
        langChoice.test(text) ||
        /lang|locale|language/i.test(aria);
      if (!clsIdLang && !textLang) continue;
      const buttons = el.querySelectorAll('button, a, [role="button"], input[type="submit"]').length;
      const score =
        (langChoice.test(text) ? 3 : 0) +
        (langWordText.test(textAria) ? 2 : 0) +
        (langWordClsId.test(clsId) ? 2 : 0) +
        (buttons >= 2 ? 2 : buttons >= 1 ? 1 : 0) +
        (rect.width / vw) +
        (rect.top < 80 ? 1 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    }
    if (best && bestScore >= 4) {
      tryAddElement(found, claimed, best, 'LangSelector', 'lang-selector', 'lang-selector');
    }
  })();

  detectFixedSiteChrome(found, claimed);

  const navSelectors = [
    'nav#navigation[role="navigation"]',
    'nav#navigation',
    'nav.jmheader__navbar',
    '.jmheader__navbar',
    '[class*="primary-nav"]',
    '[class*="main-nav"]',
    '[class*="MainNav"]',
    'nav[role="navigation"]',
  ];
  for (const selector of navSelectors) {
    const el = document.querySelector(selector);
    if (!el || claimed.has(el) || !isVisible(el, 200, 24) || isInPageNav(el)) continue;
    const headerEl = document.querySelector('header#banner, #banner, header[role="banner"], header');
    if (headerEl && headerEl.contains(el)) continue;
    claimed.add(el);
    found.push({ selector, cmsName: 'Navigation', type: 'nav', folderName: 'navigation' });
    break;
  }

  const chatSelectors = [
    '#hubspot-messages-iframe-container',
    '#drift-widget',
    '#intercom-container',
    '.intercom-lightweight-app',
    '[class*="intercom"]',
    '[id*="live-chat"]',
    '[class*="chat-widget"]',
    '[class*="chat-button"]',
    '[aria-label*="chat" i]',
    '[data-testid*="chat"]',
    '#qualified-chat',
    '[class*="qualified"]',
  ];
  for (const selector of chatSelectors) {
    tryAdd(found, claimed, selector, 'ChatWidget', 'chat-widget', 'chat-widget', 32, 32);
    if (found.some((f) => f.cmsName === 'ChatWidget')) break;
  }

  const sideButtonSelectors = [
    '[class*="back-to-top"]',
    '[class*="scroll-to-top"]',
    '[class*="scroll-top"]',
    'button[class*="floating"]',
    '[class*="sticky-cta"]',
    '[class*="side-tab"]',
    '[class*="feedback-button"]',
    '[class*="feedback_icon"]',
    '[class*="feedback-icon"]',
    '.feedback_icon',
    '[class*="feedback"][data-toggle="modal"]',
    '[aria-label*="feedback" i]',
    '[title*="feedback" i]',
    '[aria-label*="back to top" i]',
  ];
  for (const selector of sideButtonSelectors) {
    tryAdd(found, claimed, selector, 'FloatingActionButton', 'floating-action', 'floating-action-button', 24, 24);
    if (found.some((f) => f.cmsName === 'FloatingActionButton')) break;
  }

  // Generic fixed/absolute edge widgets (feedback, chat, share) missed by class lists.
  if (!found.some((f) => f.cmsName === 'FloatingActionButton' || f.cmsName === 'ChatWidget')) {
    const vw = window.innerWidth || 1440;
    const vh = window.innerHeight || 900;
    let best = null;
    let bestScore = 0;
    for (const el of document.querySelectorAll('body *')) {
      if (!(el instanceof HTMLElement) || claimed.has(el) || isInPageNav(el)) continue;
      const style = window.getComputedStyle(el);
      if (!['fixed', 'absolute'].includes(style.position)) continue;
      if (!isVisible(el, 24, 24)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width > 120 || rect.height > 120) continue;
      if (rect.width < 28 || rect.height < 28) continue;
      const onRight = rect.left >= vw * 0.82;
      const onLeft = rect.right <= vw * 0.18;
      if (!onRight && !onLeft) continue;
      if (rect.top < 40 || rect.bottom > vh - 8) continue;
      const blob = `${el.id} ${el.className} ${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''} ${el.querySelector?.('img')?.alt || ''}`.toLowerCase();
      const named = /feedback|chat|help|survey|usabilla|thumb|share|widget|float|fab/.test(blob);
      const score = (named ? 4 : 1) + (onRight ? 1 : 0) + Math.min(2, (rect.width * rect.height) / 2000);
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    }
    if (best && bestScore >= 2) {
      tryAddElement(found, claimed, best, 'FloatingActionButton', 'floating-action', 'floating-action-button');
    }
  }

  // Drop TopBar / LangSelector / Navigation when nested inside an already-claimed Header
  // (e.g. AXA header.head > .topbar; Drupal header.region > .region-header-inner false Lang).
  const headerEls = found
    .filter((f) => f.cmsName === 'Header')
    .map((f) => {
      try {
        return document.querySelector(f.selector);
      } catch {
        return null;
      }
    })
    .filter((el) => el instanceof Element);
  if (headerEls.length) {
    const nestDropNames = new Set(['TopBar', 'LangSelector', 'Navigation']);
    for (let i = found.length - 1; i >= 0; i--) {
      if (!nestDropNames.has(found[i].cmsName)) continue;
      let el = null;
      try {
        el = document.querySelector(found[i].selector);
      } catch {
        el = null;
      }
      if (el && headerEls.some((h) => h.contains(el))) {
        claimed.delete(el);
        found.splice(i, 1);
      }
    }
  }

  return found;
}

/** Browser-side: hide cookie/consent UI and dimming backdrops only (not header/nav). */
export function hideCookieBannerAndBackdropInPage() {
  function hideElement(el) {
    if (!(el instanceof HTMLElement)) return;
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    el.style.setProperty('opacity', '0', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('data-screenshot-hidden', 'cookie');
  }

  const cookieSelectors = [
    '#onetrust-banner-sdk',
    '#onetrust-consent-sdk',
    '.onetrust-pc-dark-filter',
    '#onetrust-pc-sdk',
    '#tc-privacy-wrapper',
    '.tc-privacy-wrapper',
    '[class*="tc-privacy-wrapper"]',
    '[class*="tc-privacy-banner"]',
    '[class*="tc-privacy-overlay"]',
    '#tc-privacy-overlay',
    '#didomi-host',
    '#didomi-popup',
    '#CybotCookiebotDialog',
    '#usercentrics-root',
    '[id*="uc-central-banner"]',
    '#sp-cc',
    '.qc-cmp2-container',
    '#js-gdpr-consent-banner',
    '[class*="cookie-banner"]',
    '[class*="cookie-consent"]',
    '[class*="cookie-notice"]',
    '[class*="consent-banner"]',
    '[class*="privacy-banner"]',
    '[class*="privacy-wrapper"]',
    '[class*="privacy-overlay"]',
    '[class*="consent-overlay"]',
    '[class*="gdpr"]',
    '[id*="privacy-wrapper"]',
    '[id*="cookie-banner"]',
    '[id*="gdpr" i]',
    '[id*="consent-banner" i]',
    '.osano-cm-window',
  ];

  for (const selector of cookieSelectors) {
    document.querySelectorAll(selector).forEach(hideElement);
  }

  for (const el of document.querySelectorAll(
    '[id*="privacy" i], [class*="privacy" i], [id*="cookie" i], [class*="cookie" i], [id*="consent" i], [class*="consent" i], [id*="gdpr" i], [class*="gdpr" i], [role="dialog"], [role="alertdialog"]',
  )) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.getAttribute('data-screenshot-hidden') === 'cookie') continue;
    if (el.closest('footer, [class*="footer" i]')) continue;
    const id = (el.id || '').toLowerCase();
    const cls = (el.className?.toString?.() || '').toLowerCase();
    const text = (el.textContent || '').slice(0, 280).toLowerCase();
    if (
      !/cookie|consent|privacy|gdpr|didomi|tc-privacy|onetrust|osano|cookiebot|cmp-/.test(`${id} ${cls}`) &&
      !/cookie|cookies|privacy policy|this site uses|gebruikt cookies|cookiebeleid|accepteer|weiger/.test(text)
    ) {
      continue;
    }
    hideElement(el);
  }

  {
    const copyRe =
      /cookies?|cookiebeleid|gebruikt cookies|we use cookies|this site uses|accepteer|weiger|niet-essenti|alle cookies|aanvaard/i;
    const ctaRe = /accept(eer)?|accepteer|aanvaard|weiger|instellingen|settings|akkoord|allow all/i;
    const vw = window.innerWidth || 1;
    const vh = window.innerHeight || 1;
    for (const el of document.querySelectorAll('div, section, aside, dialog')) {
      if (!(el instanceof HTMLElement)) continue;
      if (el.getAttribute('data-screenshot-hidden') === 'cookie') continue;
      if (el.closest('footer, [class*="Footer" i]')) continue;
      const st = window.getComputedStyle(el);
      if (!['fixed', 'sticky', 'absolute'].includes(st.position)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 80 || r.height < 40) continue;
      if (r.width >= vw * 0.95 && r.height >= vh * 0.85) continue;
      const nearEdge =
        r.bottom >= vh - 120 || r.top <= 140 || r.left <= 48 || r.right >= vw - 48;
      if (!nearEdge) continue;
      const text = (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 500);
      if (!copyRe.test(text)) continue;
      let ctas = 0;
      for (const btn of el.querySelectorAll('button, a, [role="button"]')) {
        const t = (btn.innerText || '').replace(/\s+/g, ' ').trim();
        if (ctaRe.test(t) && t.length < 64) ctas += 1;
      }
      if (ctas < 1) continue;
      hideElement(el);
    }
  }

  for (const el of document.querySelectorAll('body > div, body > aside')) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.getAttribute('data-screenshot-hidden') === 'cookie') continue;
    const style = window.getComputedStyle(el);
    if (!['fixed', 'absolute'].includes(style.position)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < window.innerWidth * 0.9 || rect.height < window.innerHeight * 0.9) continue;
    const bg = style.backgroundColor;
    const opacity = parseFloat(style.opacity);
    const isDim =
      (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') ||
      (style.backdropFilter && style.backdropFilter !== 'none') ||
      (opacity > 0 && opacity < 1);
    const id = (el.id || '').toLowerCase();
    const cls = (el.className?.toString?.() || '').toLowerCase();
    const looksLikeOverlay =
      isDim ||
      /overlay|backdrop|modal|privacy|consent|cookie|tc-privacy|onetrust|didomi/.test(`${id} ${cls}`);
    if (looksLikeOverlay) hideElement(el);
  }

  document.body.style.setProperty('overflow', '', 'important');
  document.documentElement.style.setProperty('overflow', '', 'important');
  for (const cls of [...document.body.classList, ...document.documentElement.classList]) {
    if (/modal|overlay|privacy|consent|no-scroll|noscroll|overflow-hidden|cmp-/.test(cls)) {
      document.body.classList.remove(cls);
      document.documentElement.classList.remove(cls);
    }
  }
}

/**
 * Browser-side: hide CMP + chat/FAB for full-page clean shots / hybrid detect.
 * Keeps site Header / TopBar / Nav visible so chrome appears in clean PNGs and section detection.
 * Self-contained for page.evaluate (no sibling export calls).
 */
export function hideTransientOverlaysInPage() {
  function hideElement(el, tag = 'cookie') {
    if (!(el instanceof HTMLElement)) return;
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    el.style.setProperty('opacity', '0', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('data-screenshot-hidden', tag);
  }

  const cookieSelectors = [
    '#onetrust-banner-sdk',
    '#onetrust-consent-sdk',
    '.onetrust-pc-dark-filter',
    '#onetrust-pc-sdk',
    '#tc-privacy-wrapper',
    '.tc-privacy-wrapper',
    '[class*="tc-privacy-wrapper"]',
    '[class*="tc-privacy-banner"]',
    '[class*="tc-privacy-overlay"]',
    '#tc-privacy-overlay',
    '#didomi-host',
    '#didomi-popup',
    '#CybotCookiebotDialog',
    '#usercentrics-root',
    '[id*="uc-central-banner"]',
    '#sp-cc',
    '.qc-cmp2-container',
    '#js-gdpr-consent-banner',
    '[class*="cookie-banner"]',
    '[class*="cookie-consent"]',
    '[class*="cookie-notice"]',
    '[class*="consent-banner"]',
    '[class*="privacy-banner"]',
    '[class*="privacy-wrapper"]',
    '[class*="privacy-overlay"]',
    '[class*="consent-overlay"]',
    '[class*="gdpr"]',
    '[id*="privacy-wrapper"]',
    '[id*="cookie-banner"]',
    '[id*="gdpr" i]',
    '[id*="consent-banner" i]',
    '.osano-cm-window',
  ];

  for (const selector of cookieSelectors) {
    document.querySelectorAll(selector).forEach((el) => hideElement(el, 'cookie'));
  }

  for (const el of document.querySelectorAll(
    '[id*="privacy" i], [class*="privacy" i], [id*="cookie" i], [class*="cookie" i], [id*="consent" i], [class*="consent" i], [id*="gdpr" i], [class*="gdpr" i], [role="dialog"], [role="alertdialog"]',
  )) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.getAttribute('data-screenshot-hidden') === 'cookie') continue;
    if (el.closest('footer, [class*="footer" i]')) continue;
    const id = (el.id || '').toLowerCase();
    const cls = (el.className?.toString?.() || '').toLowerCase();
    const text = (el.textContent || '').slice(0, 280).toLowerCase();
    if (
      !/cookie|consent|privacy|gdpr|didomi|tc-privacy|onetrust|osano|cookiebot|cmp-/.test(`${id} ${cls}`) &&
      !/cookie|cookies|privacy policy|this site uses|gebruikt cookies|cookiebeleid|accepteer|weiger/.test(text)
    ) {
      continue;
    }
    hideElement(el, 'cookie');
  }

  {
    const copyRe =
      /cookies?|cookiebeleid|gebruikt cookies|we use cookies|this site uses|accepteer|weiger|niet-essenti|alle cookies|aanvaard/i;
    const ctaRe = /accept(eer)?|accepteer|aanvaard|weiger|instellingen|settings|akkoord|allow all/i;
    const vw = window.innerWidth || 1;
    const vh = window.innerHeight || 1;
    for (const el of document.querySelectorAll('div, section, aside, dialog')) {
      if (!(el instanceof HTMLElement)) continue;
      if (el.getAttribute('data-screenshot-hidden') === 'cookie') continue;
      if (el.closest('footer, [class*="Footer" i]')) continue;
      const st = window.getComputedStyle(el);
      if (!['fixed', 'sticky', 'absolute'].includes(st.position)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 80 || r.height < 40) continue;
      if (r.width >= vw * 0.95 && r.height >= vh * 0.85) continue;
      const nearEdge =
        r.bottom >= vh - 120 || r.top <= 140 || r.left <= 48 || r.right >= vw - 48;
      if (!nearEdge) continue;
      const text = (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 500);
      if (!copyRe.test(text)) continue;
      let ctas = 0;
      for (const btn of el.querySelectorAll('button, a, [role="button"]')) {
        const t = (btn.innerText || '').replace(/\s+/g, ' ').trim();
        if (ctaRe.test(t) && t.length < 64) ctas += 1;
      }
      if (ctas < 1) continue;
      hideElement(el, 'cookie');
    }
  }

  for (const el of document.querySelectorAll('body > div, body > aside')) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.getAttribute('data-screenshot-hidden') === 'cookie') continue;
    const style = window.getComputedStyle(el);
    if (!['fixed', 'absolute'].includes(style.position)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < window.innerWidth * 0.9 || rect.height < window.innerHeight * 0.9) continue;
    const bg = style.backgroundColor;
    const opacity = parseFloat(style.opacity);
    const isDim =
      (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') ||
      (style.backdropFilter && style.backdropFilter !== 'none') ||
      (opacity > 0 && opacity < 1);
    const id = (el.id || '').toLowerCase();
    const cls = (el.className?.toString?.() || '').toLowerCase();
    const looksLikeOverlay =
      isDim ||
      /overlay|backdrop|modal|privacy|consent|cookie|tc-privacy|onetrust|didomi/.test(`${id} ${cls}`);
    if (looksLikeOverlay) hideElement(el, 'cookie');
  }

  const floatingSelectors = [
    '#hubspot-messages-iframe-container',
    '#drift-widget',
    '#intercom-container',
    '.intercom-lightweight-app',
    '[class*="intercom"]',
    '[id*="live-chat"]',
    '[class*="chat-widget"]',
    '[class*="chat-button"]',
    '#qualified-chat',
    '[class*="qualified"]',
    '[class*="back-to-top"]',
    '[class*="scroll-to-top"]',
    '[class*="scroll-top"]',
    'button[class*="floating"]',
    '[class*="sticky-cta"]',
    '[class*="side-tab"]',
    '[class*="feedback-button"]',
    '[class*="feedback_icon"]',
    '[class*="feedback-icon"]',
    '.feedback_icon',
    '[class*="feedback"][data-toggle="modal"]',
    '[aria-label*="feedback" i]',
    '[title*="feedback" i]',
    '[aria-label*="chat" i]',
    '[aria-label*="whatsapp" i]',
  ];
  for (const selector of floatingSelectors) {
    try {
      document.querySelectorAll(selector).forEach((el) => hideElement(el, 'floating'));
    } catch {
      /* invalid selector */
    }
  }

  {
    const vw = window.innerWidth || 1440;
    const vh = window.innerHeight || 900;
    for (const el of document.querySelectorAll('body *')) {
      if (!(el instanceof HTMLElement)) continue;
      if (el.getAttribute('data-screenshot-hidden')) continue;
      if (el.closest('header, nav, [role="banner"], [role="navigation"], footer')) continue;
      // Never treat in-flow carousel / logo-wall media as FABs (baked into section.html).
      if (
        el.tagName === 'IMG' ||
        el.closest(
          '[aria-roledescription="carousel"], [class*="LogoCarousel" i], [class*="logo-carousel" i], [class*="LogoWall" i], [class*="LogoSkeleton" i]',
        )
      ) {
        continue;
      }
      const style = window.getComputedStyle(el);
      if (!['fixed', 'absolute'].includes(style.position)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width > 120 || rect.height > 120 || rect.width < 28 || rect.height < 28) continue;
      const onRight = rect.left >= vw * 0.82;
      const onLeft = rect.right <= vw * 0.18;
      if (!onRight && !onLeft) continue;
      if (rect.top < 40 || rect.bottom > vh - 8) continue;
      const blob = `${el.id} ${el.className} ${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''}`.toLowerCase();
      if (
        /feedback|chat|help|survey|usabilla|thumb|widget|float|fab/.test(blob) ||
        (onRight && rect.width <= 80 && rect.height <= 80)
      ) {
        hideElement(el, 'floating-action');
      }
    }
  }

  document.body.style.setProperty('overflow', '', 'important');
  document.documentElement.style.setProperty('overflow', '', 'important');
  for (const cls of [...document.body.classList, ...document.documentElement.classList]) {
    if (/modal|overlay|privacy|consent|no-scroll|noscroll|overflow-hidden|cmp-/.test(cls)) {
      document.body.classList.remove(cls);
      document.documentElement.classList.remove(cls);
    }
  }
}

/**
 * Browser-side: hide all sticky/fixed overlays so content bands are unobstructed.
 * Includes CMP + site Header/TopBar/Nav (for content-section export under overlapping chrome).
 * Self-contained for page.evaluate — inlines transient hide (cannot call sibling exports).
 */
export function hideAllStickyOverlaysInPage() {
  // --- Transient: CMP + floating (keep in sync with hideTransientOverlaysInPage) ---
  (function hideTransientInline() {
    function hideCookieOnly(el) {
      if (!(el instanceof HTMLElement)) return;
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('opacity', '0', 'important');
      el.style.setProperty('pointer-events', 'none', 'important');
      el.setAttribute('aria-hidden', 'true');
      el.setAttribute('data-screenshot-hidden', 'cookie');
    }

    const cookieSelectors = [
      '#onetrust-banner-sdk',
      '#onetrust-consent-sdk',
      '.onetrust-pc-dark-filter',
      '#onetrust-pc-sdk',
      '#tc-privacy-wrapper',
      '.tc-privacy-wrapper',
      '[class*="tc-privacy-wrapper"]',
      '[class*="tc-privacy-banner"]',
      '[class*="tc-privacy-overlay"]',
      '#tc-privacy-overlay',
      '#didomi-host',
      '#didomi-popup',
      '#CybotCookiebotDialog',
      '#usercentrics-root',
      '[id*="uc-central-banner"]',
      '#sp-cc',
      '.qc-cmp2-container',
      '#js-gdpr-consent-banner',
      '[class*="cookie-banner"]',
      '[class*="cookie-consent"]',
      '[class*="cookie-notice"]',
      '[class*="consent-banner"]',
      '[class*="privacy-banner"]',
      '[class*="privacy-wrapper"]',
      '[class*="privacy-overlay"]',
      '[class*="consent-overlay"]',
      '[class*="gdpr"]',
      '[id*="privacy-wrapper"]',
      '[id*="cookie-banner"]',
      '[id*="gdpr" i]',
      '[id*="consent-banner" i]',
      '.osano-cm-window',
    ];
    for (const selector of cookieSelectors) {
      document.querySelectorAll(selector).forEach(hideCookieOnly);
    }

    for (const el of document.querySelectorAll(
      '[id*="privacy" i], [class*="privacy" i], [id*="cookie" i], [class*="cookie" i], [id*="consent" i], [class*="consent" i], [id*="gdpr" i], [class*="gdpr" i], [role="dialog"], [role="alertdialog"]',
    )) {
      if (!(el instanceof HTMLElement)) continue;
      if (el.getAttribute('data-screenshot-hidden') === 'cookie') continue;
      if (el.closest('footer, [class*="footer" i]')) continue;
      const id = (el.id || '').toLowerCase();
      const cls = (el.className?.toString?.() || '').toLowerCase();
      const text = (el.textContent || '').slice(0, 280).toLowerCase();
      if (
        !/cookie|consent|privacy|gdpr|didomi|tc-privacy|onetrust|osano|cookiebot|cmp-/.test(`${id} ${cls}`) &&
        !/cookie|cookies|privacy policy|this site uses|gebruikt cookies|cookiebeleid|accepteer|weiger/.test(text)
      ) {
        continue;
      }
      hideCookieOnly(el);
    }

    {
      const copyRe =
        /cookies?|cookiebeleid|gebruikt cookies|we use cookies|this site uses|accepteer|weiger|niet-essenti|alle cookies|aanvaard/i;
      const ctaRe = /accept(eer)?|accepteer|aanvaard|weiger|instellingen|settings|akkoord|allow all/i;
      const vw = window.innerWidth || 1;
      const vh = window.innerHeight || 1;
      for (const el of document.querySelectorAll('div, section, aside, dialog')) {
        if (!(el instanceof HTMLElement)) continue;
        if (el.getAttribute('data-screenshot-hidden') === 'cookie') continue;
        if (el.closest('footer, [class*="Footer" i]')) continue;
        const st = window.getComputedStyle(el);
        if (!['fixed', 'sticky', 'absolute'].includes(st.position)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 80 || r.height < 40) continue;
        if (r.width >= vw * 0.95 && r.height >= vh * 0.85) continue;
        const nearEdge =
          r.bottom >= vh - 120 || r.top <= 140 || r.left <= 48 || r.right >= vw - 48;
        if (!nearEdge) continue;
        const text = (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 500);
        if (!copyRe.test(text)) continue;
        let ctas = 0;
        for (const btn of el.querySelectorAll('button, a, [role="button"]')) {
          const t = (btn.innerText || '').replace(/\s+/g, ' ').trim();
          if (ctaRe.test(t) && t.length < 64) ctas += 1;
        }
        if (ctas < 1) continue;
        hideCookieOnly(el);
      }
    }

    for (const el of document.querySelectorAll('body > div, body > aside')) {
      if (!(el instanceof HTMLElement)) continue;
      if (el.getAttribute('data-screenshot-hidden') === 'cookie') continue;
      const style = window.getComputedStyle(el);
      if (!['fixed', 'absolute'].includes(style.position)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < window.innerWidth * 0.9 || rect.height < window.innerHeight * 0.9) continue;
      const bg = style.backgroundColor;
      const opacity = parseFloat(style.opacity);
      const isDim =
        (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') ||
        (style.backdropFilter && style.backdropFilter !== 'none') ||
        (opacity > 0 && opacity < 1);
      const id = (el.id || '').toLowerCase();
      const cls = (el.className?.toString?.() || '').toLowerCase();
      const looksLikeOverlay =
        isDim ||
        /overlay|backdrop|modal|privacy|consent|cookie|tc-privacy|onetrust|didomi/.test(`${id} ${cls}`);
      if (looksLikeOverlay) hideCookieOnly(el);
    }

    document.body.style.setProperty('overflow', '', 'important');
    document.documentElement.style.setProperty('overflow', '', 'important');
    for (const cls of [...document.body.classList, ...document.documentElement.classList]) {
      if (/modal|overlay|privacy|consent|no-scroll|noscroll|overflow-hidden|cmp-/.test(cls)) {
        document.body.classList.remove(cls);
        document.documentElement.classList.remove(cls);
      }
    }
  })();

  function hideElement(el, tag = 'true') {
    if (!(el instanceof HTMLElement)) return;
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    el.style.setProperty('position', 'static', 'important');
    el.style.setProperty('height', '0', 'important');
    el.style.setProperty('overflow', 'hidden', 'important');
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('data-screenshot-hidden', tag);
  }

  function isInPageNav(el) {
    if (!(el instanceof Element)) return false;
    if (el.getAttribute('role') === 'tablist') return true;
    if (el.closest('[role="tablist"], [aria-label*="Slide navigation" i], [aria-label*="slide navigation" i]')) {
      return true;
    }
    // Content inside the main landmark — not site chrome.
    if (el.closest('main, [role="main"], #main-content, #main')) return true;
    if (el.closest('footer, [class*="footer" i]')) return true;
    return false;
  }

  const selectors = [
    '#hubspot-messages-iframe-container',
    '#drift-widget',
    '#intercom-container',
    '.intercom-lightweight-app',
    '[class*="intercom"]',
    '[id*="live-chat"]',
    '[class*="chat-widget"]',
    '[class*="chat-button"]',
    '#qualified-chat',
    '[class*="qualified"]',
    '[class*="back-to-top"]',
    '[class*="scroll-to-top"]',
    '[class*="scroll-top"]',
    'button[class*="floating"]',
    '[class*="sticky-cta"]',
    '[class*="side-tab"]',
    '[class*="feedback-button"]',
    '[class*="feedback_icon"]',
    '[class*="feedback-icon"]',
    '.feedback_icon',
    '[class*="feedback"][data-toggle="modal"]',
    '[aria-label*="feedback" i]',
    '[title*="feedback" i]',
    '[class*="top-bar"]',
    '[class*="topbar"]',
    '[class*="TopBar"]',
    '.jmheader__utility',
    '[class*="utility-bar"]',
    '[class*="announcement-bar"]',
    'aside[class*="announcement"]',
    '[class*="site-utility"]',
    'header#banner',
    '#banner',
    'header[role="banner"]',
    'header',
    '[class*="GlobalHeader"]',
    '[class*="global-header"]',
    '[class*="site-header"]',
    '[class*="MainNavigation"]',
    'section.main-nav',
    'section.nav.main-nav',
    '[data-component-name="Header"]',
    '[data-component-name="GlobalHeader"]',
    'nav#navigation',
    'nav.jmheader__navbar',
    '.jmheader__navbar',
    '.jmheader__navlinks',
    '[class*="primary-nav"]',
    '[class*="main-nav"]',
    '[class*="MainNav"]',
    'nav[role="navigation"]',
    '[class*="sticky-header"]',
    '[class*="fixed-top"]',
    '.product-navigation',
  ];

  function looksLikePageHeroForHide(el) {
    if (!(el instanceof HTMLElement)) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    const vh = window.innerHeight || 900;
    const isChromePosition =
      style.position === 'fixed' || style.position === 'sticky' || style.position === 'absolute';
    if (isChromePosition && rect.height <= 160) return false;
    const tall = rect.height >= Math.min(420, vh * 0.45);
    if (!tall) return false;
    const cls = String(el.className || '');
    if (/pageHeader|hero|slider|carousel|ContentZone__pageHeader|HeroEditorial/i.test(cls)) return true;
    if (
      el.querySelector(
        '.HeroEditorial, .SliderTransition, [aria-roledescription="carousel"], [class*="hero" i]',
      )
    ) {
      return true;
    }
    if (!isChromePosition && (el.tagName === 'HEADER' || /header/i.test(cls))) return true;
    return false;
  }

  function isShortOverlappingChrome(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (looksLikePageHeroForHide(el)) return false;
    const style = window.getComputedStyle(el);
    if (!['fixed', 'sticky', 'absolute'].includes(style.position)) return false;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth || 1440;
    if (rect.top > 100 || rect.height < 28 || rect.height > 160) return false;
    if (rect.width < vw * 0.7) return false;
    const z = Number.parseInt(style.zIndex, 10);
    if (style.position !== 'sticky' && Number.isFinite(z) && z < 10) return false;
    const cls = String(el.className || '');
    const hint =
      /overlap|overlapping|minimize|fixed-top|sticky-header|main.?header|site.?header|global.?header|primary.?nav|main.?nav/i.test(
        cls,
      );
    const hasChrome =
      !!el.querySelector(
        'img, svg, [class*="logo" i], nav, [role="navigation"], button, [class*="menu" i], a[href]',
      );
    return hint || hasChrome;
  }

  for (const selector of selectors) {
    document.querySelectorAll(selector).forEach((el) => {
      if (isInPageNav(el)) return;
      // Keep tall in-flow page heroes (e.g. Renault ContentZone__pageHeader carousel).
      if (looksLikePageHeroForHide(el)) return;
      hideElement(el);
    });
  }

  // Short absolute/fixed overlapping top chrome (may not match header selectors).
  {
    const chromeHits = [];
    for (const el of document.querySelectorAll('body *')) {
      if (!(el instanceof HTMLElement)) continue;
      if (el.getAttribute('data-screenshot-hidden')) continue;
      if (isInPageNav(el)) continue;
      if (!isShortOverlappingChrome(el)) continue;
      chromeHits.push(el);
    }
    const outermost = chromeHits.filter(
      (el) => !chromeHits.some((other) => other !== el && other.contains(el)),
    );
    for (const el of outermost) hideElement(el, 'overlapping-top-chrome');
  }

  // Fixed edge FABs (feedback / chat) without known class names.
  {
    const vw = window.innerWidth || 1440;
    const vh = window.innerHeight || 900;
    for (const el of document.querySelectorAll('body *')) {
      if (!(el instanceof HTMLElement)) continue;
      if (el.getAttribute('data-screenshot-hidden')) continue;
      if (isInPageNav(el)) continue;
      if (
        el.tagName === 'IMG' ||
        el.closest(
          '[aria-roledescription="carousel"], [class*="LogoCarousel" i], [class*="logo-carousel" i], [class*="LogoWall" i], [class*="LogoSkeleton" i]',
        )
      ) {
        continue;
      }
      const style = window.getComputedStyle(el);
      if (!['fixed', 'absolute'].includes(style.position)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width > 120 || rect.height > 120 || rect.width < 28 || rect.height < 28) continue;
      const onRight = rect.left >= vw * 0.82;
      const onLeft = rect.right <= vw * 0.18;
      if (!onRight && !onLeft) continue;
      if (rect.top < 40 || rect.bottom > vh - 8) continue;
      const blob = `${el.id} ${el.className} ${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''} ${el.querySelector?.('img')?.alt || ''}`.toLowerCase();
      if (/feedback|chat|help|survey|usabilla|thumb|widget|float|fab/.test(blob) || (onRight && rect.width <= 80 && rect.height <= 80)) {
        hideElement(el, 'floating-action');
      }
    }
  }

  // Generic language / locale suggestion bars (same heuristic as detect — no brand classes).
  (function hideLangLocaleBanner() {
    const vw = window.innerWidth || 1440;
    const langWord =
      /\b(lang(uage|ue)?|locale|taal|sprache|idioma|lingua|country|région|region|market)\b/i;
    const langChoice =
      /\b(english|anglais|français|francais|nederlands|dutch|deutsch|german|español|espanol|italiano|português|portugues|continue|doorgaan|continuer|weiter|continuar|select\s+(your\s+)?(language|country|market))\b/i;
    for (const el of document.querySelectorAll(
      'div, section, aside, nav, form, dialog, [role="dialog"], [role="region"]',
    )) {
      if (!(el instanceof HTMLElement)) continue;
      if (el.getAttribute('data-screenshot-hidden')) continue;
      if (el.closest('footer, [class*="footer" i], [role="tablist"]')) continue;
      const rect = el.getBoundingClientRect();
      if (rect.top > 160 || rect.height < 28 || rect.height > 140) continue;
      if (rect.width < vw * 0.55) continue;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
      const cls = String(el.className || '');
      const id = String(el.id || '');
      const aria = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('data-testid') || ''}`;
      const text = (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 240);
      const blob = `${cls} ${id} ${aria} ${text}`;
      if (!langWord.test(blob) && !langChoice.test(text) && !/lang|locale|language/i.test(cls + id + aria)) {
        continue;
      }
      const buttons = el.querySelectorAll('button, a, [role="button"], input[type="submit"]').length;
      const score =
        (langChoice.test(text) ? 3 : 0) +
        (langWord.test(blob) ? 2 : 0) +
        (buttons >= 2 ? 2 : buttons >= 1 ? 1 : 0) +
        (rect.top < 80 ? 1 : 0);
      if (score >= 4) hideElement(el);
    }
  })();

  // Hide any remaining fixed/sticky top chrome (e.g. Next.js header wrappers).
  for (const el of document.querySelectorAll('*')) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.getAttribute('data-screenshot-hidden') === 'true') continue;
    if (isInPageNav(el)) continue;
    if (el.closest('[class*="modal" i], .osano-cm-window')) continue;
    if (el.closest('section.sc-section:not(.main-nav):not(.nav)')) {
      const inMain = el.closest('main, [role="main"], #main-content, #main');
      if (inMain) continue;
    }

    const style = window.getComputedStyle(el);
    if (!['fixed', 'sticky'].includes(style.position)) continue;

    const rect = el.getBoundingClientRect();
    if (rect.top > 120 || rect.height < 20 || rect.width < window.innerWidth * 0.35) continue;
    if (rect.bottom < 0) continue;

    hideElement(el);
  }

  document.body.style.setProperty('padding-top', '0', 'important');
  document.documentElement.style.setProperty('scroll-padding-top', '0', 'important');
}

/**
 * Browser-side: snapshot of top chrome candidates (fixed/sticky/absolute near top).
 * Used to detect bars that only appear after scrolling up.
 */
export function collectTopChromeCandidatesInPage() {
  function isVisible(el, minW = 40, minH = 20) {
    if (!el || !(el instanceof Element)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width >= minW && rect.height >= minH && rect.bottom > 0 && rect.top < window.innerHeight;
  }

  function buildSelector(el) {
    if (!(el instanceof Element)) return null;
    if (el.id && !/^[0-9]/.test(el.id)) return `#${CSS.escape(el.id)}`;
    const stableClasses = [...el.classList].filter(
      (c) => c && !/^js-/.test(c) && !/^is-/.test(c) && !c.includes('module__') && c.length < 64,
    );
    if (stableClasses.length) {
      const sel = `${el.tagName.toLowerCase()}.${stableClasses
        .slice(0, 2)
        .map((c) => CSS.escape(c))
        .join('.')}`;
      try {
        if (document.querySelectorAll(sel).length === 1) return sel;
      } catch {
        /* ignore */
      }
    }
    const parts = [];
    let node = el;
    while (node && node.nodeType === Node.ELEMENT_NODE && parts.length < 6) {
      let part = node.tagName.toLowerCase();
      if (node.id && !/^[0-9]/.test(node.id)) {
        parts.unshift(`#${CSS.escape(node.id)}`);
        break;
      }
      const parent = node.parentElement;
      if (parent) {
        const siblings = [...parent.children].filter((s) => s.tagName === node.tagName);
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
      }
      parts.unshift(part);
      node = parent;
    }
    return parts.join(' > ');
  }

  const vw = window.innerWidth || 1440;
  const out = [];
  const seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    if (!(el instanceof HTMLElement) || seen.has(el)) continue;
    if (el.closest('#onetrust-consent-sdk, #onetrust-banner-sdk, [id*="cookie" i]')) continue;
    if (el.closest('footer, [class*="footer" i], [role="tablist"]')) continue;
    const style = window.getComputedStyle(el);
    const pos = style.position;
    if (!['fixed', 'sticky', 'absolute'].includes(pos)) continue;
    if (!isVisible(el, Math.min(200, vw * 0.35), 24)) continue;
    const rect = el.getBoundingClientRect();
    // Top chrome / floating bars — not full-page modals.
    if (rect.top > 140) continue;
    if (rect.height > Math.min(220, window.innerHeight * 0.35)) continue;
    if (rect.width < vw * 0.35 && rect.width < 280) continue;
    // Skip elements that are basically the whole viewport width *and* tall page shells.
    if (rect.height > 180 && rect.width > vw * 0.9) continue;
    const selector = buildSelector(el);
    if (!selector) continue;
    try {
      if (document.querySelector(selector) !== el) continue;
    } catch {
      continue;
    }
    seen.add(el);
    out.push({
      key: selector,
      selector,
      cmsName: 'ScrollRevealBar',
      type: 'scroll-reveal-bar',
      folderName: 'scroll-reveal-bar',
      position: pos,
      top: Math.round(rect.top),
      height: Math.round(rect.height),
      width: Math.round(rect.width),
    });
  }
  return out;
}

/**
 * Find overlay bars that appear when scrolling up (hidden mid-page, visible after upward scroll).
 * Playwright-side: scrolls down, snapshots, scrolls up, diffs newly visible top chrome.
 * @param {import('playwright').Page} page
 * @returns {Promise<Array<{ selector: string, cmsName: string, type: string, folderName: string }>>}
 */
export async function detectScrollRevealOverlaysInPage(page) {
  const { waitUntilPageReady } = await import('./page-ready.mjs');

  // Mid-page snapshot (top chrome often hidden), then scroll up to top only — not a second full down/up.
  await page.evaluate(async () => {
    const maxY = Math.max(
      document.body?.scrollHeight || 0,
      document.documentElement.scrollHeight || 0,
    );
    const mid = Math.max(0, Math.floor(maxY * 0.65));
    window.scrollTo(0, mid);
    await new Promise((r) => requestAnimationFrame(r));
  });
  await waitUntilPageReady(page, {
    light: true,
    skipNetworkIdle: true,
    imagesTimeoutMs: 2000,
    timeoutMs: 5000,
    label: 'scroll-reveal/mid',
  });

  const atMid = await page.evaluate(collectTopChromeCandidatesInPage);
  const midKeys = new Set((atMid || []).map((o) => o.key));

  await page.evaluate(async () => {
    const upStep = Math.max(200, Math.floor(window.innerHeight * 0.4));
    let y = window.scrollY || 0;
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    while (y > 0) {
      y = Math.max(0, y - upStep);
      window.scrollTo(0, y);
      await frame();
    }
    window.scrollTo(0, 0);
    await frame();
  });
  await waitUntilPageReady(page, {
    light: true,
    skipImages: true,
    skipNetworkIdle: true,
    timeoutMs: 5000,
    label: 'scroll-reveal/top',
  });

  const atTop = await page.evaluate(collectTopChromeCandidatesInPage);
  const revealed = (atTop || []).filter((o) => !midKeys.has(o.key));

  return revealed.map(({ selector, cmsName, type, folderName }) => ({
    selector,
    cmsName,
    type,
    folderName,
  }));
}

/**
 * Scroll fully to the bottom, then step upward and settle at top.
 * Prefer {@link preparePageForScreenshot} / {@link scrollPageOnceDownThenUp}
 * for capture; this remains for overlay detection that needs the gesture.
 *
 * @param {import('playwright').Page} page
 * @param {{ settleAtTopMs?: number }} [options] settleAtTopMs ignored — uses readiness instead
 */
export async function revealStickyTopChromeInPage(page, _options = {}) {
  const { scrollPageOnceDownThenUp, waitUntilPageReady } = await import('./page-ready.mjs');
  await scrollPageOnceDownThenUp(page);
  await waitUntilPageReady(page, { timeoutMs: 20000, networkIdleMs: 8000 });
}

const SCROLL_LOCK_CLASS_RE = /modal|overlay|privacy|consent|no-scroll|noscroll|overflow-hidden|cmp-/i;

/**
 * Temporarily clear CMP document scroll-locks without hiding the banner.
 * Enables full-page paint (lazy sections) while ConsentBanner stays visible.
 * @param {import('playwright').Page} page
 * @returns {Promise<object>} snapshot for {@link restoreDocumentScrollLock}
 */
export async function unlockDocumentScrollForCapture(page) {
  return page.evaluate((classReSource) => {
    const classRe = new RegExp(classReSource, 'i');
    const html = document.documentElement;
    const body = document.body;
    /** @type {{ htmlOverflow: string, bodyOverflow: string, htmlOverflowY: string, bodyOverflowY: string, htmlClasses: string[], bodyClasses: string[] }} */
    const snapshot = {
      htmlOverflow: html.style.getPropertyValue('overflow') || '',
      bodyOverflow: body.style.getPropertyValue('overflow') || '',
      htmlOverflowY: html.style.getPropertyValue('overflow-y') || '',
      bodyOverflowY: body.style.getPropertyValue('overflow-y') || '',
      htmlClasses: [],
      bodyClasses: [],
    };
    for (const cls of [...html.classList]) {
      if (classRe.test(cls)) {
        snapshot.htmlClasses.push(cls);
        html.classList.remove(cls);
      }
    }
    for (const cls of [...body.classList]) {
      if (classRe.test(cls)) {
        snapshot.bodyClasses.push(cls);
        body.classList.remove(cls);
      }
    }
    html.style.setProperty('overflow', 'auto', 'important');
    body.style.setProperty('overflow', 'auto', 'important');
    html.style.setProperty('overflow-y', 'auto', 'important');
    body.style.setProperty('overflow-y', 'auto', 'important');
    return snapshot;
  }, SCROLL_LOCK_CLASS_RE.source);
}

/**
 * Restore scroll-lock styles/classes saved by {@link unlockDocumentScrollForCapture}.
 * @param {import('playwright').Page} page
 * @param {object|null|undefined} snapshot
 */
export async function restoreDocumentScrollLock(page, snapshot) {
  if (!snapshot) return;
  await page.evaluate((snap) => {
    const html = document.documentElement;
    const body = document.body;
    if (snap.htmlOverflow) html.style.setProperty('overflow', snap.htmlOverflow);
    else html.style.removeProperty('overflow');
    if (snap.bodyOverflow) body.style.setProperty('overflow', snap.bodyOverflow);
    else body.style.removeProperty('overflow');
    if (snap.htmlOverflowY) html.style.setProperty('overflow-y', snap.htmlOverflowY);
    else html.style.removeProperty('overflow-y');
    if (snap.bodyOverflowY) body.style.setProperty('overflow-y', snap.bodyOverflowY);
    else body.style.removeProperty('overflow-y');
    for (const cls of snap.htmlClasses || []) {
      if (cls) html.classList.add(cls);
    }
    for (const cls of snap.bodyClasses || []) {
      if (cls) body.classList.add(cls);
    }
  }, snapshot);
}

/**
 * Browser-side: hide sticky/fixed layover siblings so only `keepSelector` (and its
 * ancestors/descendants) remain visible for an isolated overlay screenshot.
 * Marks hides with data-screenshot-hidden="sibling-overlay" for restore.
 * Self-contained for page.evaluate().
 * @param {string} keepSelector
 */
export function hideStickyOverlaysExceptInPage(keepSelector) {
  const keep = (() => {
    try {
      return document.querySelector(keepSelector);
    } catch {
      return null;
    }
  })();
  if (!(keep instanceof Element)) return 0;

  function isKeepTree(el) {
    if (!(el instanceof Element)) return false;
    if (el === keep) return true;
    if (keep.contains(el)) return true;
    if (el.contains(keep)) return true;
    return false;
  }

  function hideSibling(el) {
    if (!(el instanceof HTMLElement)) return;
    if (el.getAttribute('data-screenshot-hidden')) return;
    if (isKeepTree(el)) return;
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    el.style.setProperty('opacity', '0', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('data-screenshot-hidden', 'sibling-overlay');
  }

  function looksLikePageHero(el) {
    if (!(el instanceof Element)) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    const vh = window.innerHeight || 900;
    const isChromePosition =
      style.position === 'fixed' || style.position === 'sticky' || style.position === 'absolute';
    if (isChromePosition && rect.height <= 160) return false;
    const tall = rect.height >= Math.min(420, vh * 0.45);
    if (!tall) return false;
    const cls = String(el.className || '');
    if (/pageHeader|hero|slider|carousel|ContentZone__pageHeader|HeroEditorial/i.test(cls)) {
      return true;
    }
    return !!el.querySelector(
      '.HeroEditorial, .SliderTransition, [aria-roledescription="carousel"], [class*="hero" i]',
    );
  }

  const known = [
    '.osano-cm-window',
    '.osano-cm-dialog',
    '#onetrust-banner-sdk',
    '#onetrust-consent-sdk',
    '#CybotCookiebotDialog',
    '#didomi-host',
    '[class*="announcement-bar"]',
    '[class*="AnnouncementBar"]',
    'section.sc-section.nav',
    'section.sc-section.main-nav',
    'header',
    '[role="banner"]',
  ];
  let hidden = 0;
  for (const sel of known) {
    try {
      for (const el of document.querySelectorAll(sel)) {
        if (isKeepTree(el)) continue;
        if (looksLikePageHero(el)) continue;
        hideSibling(el);
        hidden += 1;
      }
    } catch {
      /* invalid */
    }
  }

  const vw = window.innerWidth || 1440;
  const vh = window.innerHeight || 900;
  const hits = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.getAttribute('data-screenshot-hidden')) continue;
    if (isKeepTree(el)) continue;
    if (looksLikePageHero(el)) continue;
    if (el.closest('main, [role="main"], #main-content, #main, footer, [class*="footer" i]')) {
      continue;
    }
    const style = window.getComputedStyle(el);
    if (!['fixed', 'sticky', 'absolute'].includes(style.position)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 20) continue;
    // Top chrome / edge docks / CMP shells
    const nearTop = rect.top <= 140 && rect.height <= 220 && rect.width >= vw * 0.35;
    const edgeFab =
      rect.width <= 120 &&
      rect.height <= 120 &&
      (rect.left >= vw * 0.82 || rect.right <= vw * 0.18);
    const fullBleedDialog =
      rect.width >= vw * 0.5 &&
      rect.height >= 80 &&
      rect.height < vh * 0.95 &&
      (rect.bottom >= vh - 40 || rect.top <= 80);
    if (!nearTop && !edgeFab && !fullBleedDialog) continue;
    hits.push(el);
  }
  const outermost = hits.filter((el) => !hits.some((o) => o !== el && o.contains(el)));
  for (const el of outermost) {
    hideSibling(el);
    hidden += 1;
  }
  return hidden;
}

/**
 * Browser-side: restore elements hidden by {@link hideStickyOverlaysExceptInPage}.
 */
export function restoreSiblingOverlayHidesInPage() {
  let restored = 0;
  for (const el of document.querySelectorAll('[data-screenshot-hidden="sibling-overlay"]')) {
    if (!(el instanceof HTMLElement)) continue;
    el.style.removeProperty('display');
    el.style.removeProperty('visibility');
    el.style.removeProperty('opacity');
    el.style.removeProperty('pointer-events');
    if (el.getAttribute('aria-hidden') === 'true') el.removeAttribute('aria-hidden');
    el.removeAttribute('data-screenshot-hidden');
    restored += 1;
  }
  return restored;
}

/**
 * Hide sibling sticky overlays around `keepSelector`, run fn, then restore.
 * @template T
 * @param {import('playwright').Page} page
 * @param {string} keepSelector
 * @param {() => Promise<T>} fn
 */
export async function withSiblingOverlaysHidden(page, keepSelector, fn) {
  if (!keepSelector) return fn();
  await page.evaluate(hideStickyOverlaysExceptInPage, keepSelector).catch(() => {});
  try {
    return await fn();
  } finally {
    await page.evaluate(restoreSiblingOverlayHidesInPage).catch(() => {});
  }
}

