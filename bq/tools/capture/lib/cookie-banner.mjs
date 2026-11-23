/**
 * Cookie / CMP banner detect + hide.
 * Includes classless Tailwind overlays found by consent copy + CTAs + geometry.
 */

/** Multi-language consent copy (EN/NL/FR/DE + common CMP words). */
export const CONSENT_COPY_RE =
  /cookies?|cookiebeleid|gebruikt cookies|we use cookies|this site uses|cookie policy|privacy policy|gdpr|consentement|cookies? (sur|op)|accepteer|aanvaard|weiger|instellingen|préférences|ablehnen|akzeptieren|alle cookies|niet-essenti[eë]le|non-essential|strictly necessary|strikt noodzakelijk|uw cookies|votre choix/i;

/**
 * Accept / allow-all CTA labels (EN/NL/FR/DE). Prefer these over Settings / Reject.
 * Used by acceptCookieConsent and menu chrome dismiss.
 */
export const COOKIE_ACCEPT_LABEL_RE =
  /^(accept(\s+all(\s+cookies)?)?|accepteer(\s+alles)?|alle cookies accepteren|ik aanvaard( de| alle)? cookies|allow all|i agree|agree|akkoord|tout accepter|j['’]accepte|accepter( tout)?|alle akzeptieren|akzeptieren|alles accepteren)$/i;

/** Broader CTA matcher (accept + reject + settings) for overlay scoring. */
export const CONSENT_CTA_RE =
  /^(accept(eer)?(\s+all|\s+alles)?|accepteer alles|alle cookies accepteren|ik aanvaard( de)? cookies|allow all|i agree|akkoord|agree|tout accepter|j['’]accepte|accepter|alle akzeptieren|akzeptieren|reject|weiger|weiger(en)?(\s+niet-essenti[eë]le)?|deny|refuse|instellingen|settings|manage|voorkeuren|préférences|customize|personali[sz]e|ik configureer|configureer)$/i;

export const COOKIE_BANNER_SELECTORS = [
  '#onetrust-banner-sdk',
  '#onetrust-consent-sdk',
  '#tc-privacy-wrapper',
  '.tc-privacy-wrapper',
  '[class*="tc-privacy-wrapper"]',
  '[class*="tc-privacy-banner"]',
  '#didomi-host',
  '#didomi-popup',
  '.didomi-popup-container',
  '#CybotCookiebotDialog',
  '#usercentrics-root',
  '[id*="uc-central-banner"]',
  '#sp-cc',
  '.qc-cmp2-container',
  '[class*="cookie-banner"]',
  '[class*="cookie-consent"]',
  '[class*="cookie-notice"]',
  '[class*="consent-banner"]',
  '[class*="privacy-banner"]',
  '[class*="privacy-wrapper"]',
  '[id*="cookie-banner"]',
  '[id*="privacy-wrapper"]',
  '[aria-label*="cookie" i]',
  '[aria-label*="consent" i]',
  '.osano-cm-window',
];

/** Known CMP accept control selectors (CSS / Playwright). */
export const COOKIE_ACCEPT_SELECTORS = [
  '#onetrust-accept-btn-handler',
  '#accept-recommended-btn-handler',
  '#popin_tc_privacy_button', // TrustCommander primary accept (AXA)
  '#tc-privacy-button',
  '.tc-privacy-button',
  '[class*="tc-privacy"] button[class*="accept" i]',
  '.osano-cm-accept-all',
  '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
  '#CybotCookiebotDialogBodyButtonAccept',
  'button#didomi-notice-agree-button',
];

/** Human labels for Playwright getByRole / has-text matching. */
export const COOKIE_ACCEPT_LABELS = [
  'Accept All Cookies',
  'Accept All',
  'Accept all',
  'Allow all',
  'I agree',
  'Agree',
  'Alles accepteren',
  'Accepteer alles',
  'ALLE COOKIES ACCEPTEREN',
  'Alle cookies accepteren',
  'Ik aanvaard de cookies',
  'Ik aanvaard alle cookies',
  'Ik aanvaard cookies',
  'IK AANVAARD ALLE COOKIES',
  'Accepteer',
  'Akkoord',
  "J'accepte",
  'Tout accepter',
  'Accepter',
  'Alle akzeptieren',
  'Akzeptieren',
];

/**
 * Click Accept / allow-all on a visible CMP so gated content can load.
 * Prefer real Playwright clicks over CSS hide — many sites defer hydration until consent.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<{ clicked: boolean, label?: string }>}
 */
export async function acceptCookieConsent(page) {
  if (!page || page.isClosed?.()) return { clicked: false };

  const settingsRe =
    /instellingen|settings|manage|voorkeuren|préférences|configureer|personalise|personalize|customize|weiger|reject|deny|refuse|save$/i;

  // 1) Known CMP selectors (skip Settings-like labels on shared classes e.g. .tc-privacy-button)
  for (const sel of COOKIE_ACCEPT_SELECTORS) {
    try {
      const loc = page.locator(sel);
      const n = await loc.count();
      for (let i = 0; i < n; i++) {
        const item = loc.nth(i);
        if (!(await item.isVisible().catch(() => false))) continue;
        const text = ((await item.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
        if (text && settingsRe.test(text) && !COOKIE_ACCEPT_LABEL_RE.test(text)) continue;
        // Shared CMP class: require accept-ish label when text is present
        if (sel.includes('tc-privacy') && text && !COOKIE_ACCEPT_LABEL_RE.test(text) && !/aanvaard|accept/i.test(text)) {
          continue;
        }
        await item.click({ force: true, timeout: 2500 });
        await page.waitForTimeout(400);
        return { clicked: true, label: text || sel };
      }
    } catch {
      /* try next */
    }
  }

  // 2) Playwright role / text labels
  for (const label of COOKIE_ACCEPT_LABELS) {
    try {
      const byRole = page.getByRole('button', { name: label, exact: false });
      if ((await byRole.count()) >= 1 && (await byRole.first().isVisible().catch(() => false))) {
        await byRole.first().click({ force: true, timeout: 2500 });
        await page.waitForTimeout(400);
        return { clicked: true, label };
      }
      const byLink = page.getByRole('link', { name: label, exact: false });
      if ((await byLink.count()) >= 1 && (await byLink.first().isVisible().catch(() => false))) {
        await byLink.first().click({ force: true, timeout: 2500 });
        await page.waitForTimeout(400);
        return { clicked: true, label };
      }
      const byText = page.getByText(label, { exact: false });
      if ((await byText.count()) >= 1) {
        const el = byText.first();
        const tag = await el.evaluate((n) => n.closest('button, a, [role="button"]')?.tagName || n.tagName).catch(() => '');
        if (/BUTTON|A/i.test(tag) && (await el.isVisible().catch(() => false))) {
          await el.click({ force: true, timeout: 2500 });
          await page.waitForTimeout(400);
          return { clicked: true, label };
        }
      }
    } catch {
      /* try next */
    }
  }

  // 3) In-page evaluate: label regex + open shadow roots (Didomi / custom)
  const evalHit = await page
    .evaluate((acceptSource) => {
      const acceptRe = new RegExp(acceptSource, 'i');
      const settingsRe =
        /instellingen|settings|manage|voorkeuren|préférences|configureer|customize|personali|weiger|reject|deny|refuse|save$/i;

      const isShown = (el) => {
        if (!(el instanceof HTMLElement)) return false;
        const st = window.getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) < 0.1) return false;
        const r = el.getBoundingClientRect();
        return r.width >= 8 && r.height >= 8;
      };

      const labelOf = (el) =>
        (el.innerText || el.getAttribute('aria-label') || el.getAttribute('value') || '')
          .replace(/\s+/g, ' ')
          .trim();

      /** @type {HTMLElement[]} */
      const candidates = [];
      const visit = (root) => {
        for (const el of root.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]')) {
          if (el instanceof HTMLElement) candidates.push(el);
        }
        for (const host of root.querySelectorAll('*')) {
          if (host.shadowRoot) visit(host.shadowRoot);
        }
      };
      visit(document);

      // Known CMP ids first
      for (const sel of [
        '#onetrust-accept-btn-handler',
        '.osano-cm-accept-all',
        '#accept-recommended-btn-handler',
        'button#didomi-notice-agree-button',
      ]) {
        const el = document.querySelector(sel);
        if (el instanceof HTMLElement && isShown(el)) {
          el.click();
          return sel;
        }
      }

      let best = null;
      let bestScore = -1;
      for (const el of candidates) {
        if (!isShown(el)) continue;
        const t = labelOf(el);
        if (!t || t.length > 80) continue;
        if (settingsRe.test(t) && !acceptRe.test(t)) continue;
        if (!acceptRe.test(t)) continue;
        let score = 2;
        if (/all|alles|aanvaard|accept all|tout|alle /i.test(t)) score += 3;
        if (el.tagName === 'BUTTON') score += 1;
        if (score > bestScore) {
          bestScore = score;
          best = el;
        }
      }
      if (best) {
        best.click();
        return labelOf(best).slice(0, 60);
      }
      return null;
    }, COOKIE_ACCEPT_LABEL_RE.source)
    .catch(() => null);

  if (evalHit) {
    await page.waitForTimeout(500);
    return { clicked: true, label: String(evalHit) };
  }

  return { clicked: false };
}

/**
 * Browser-side: find a classless fixed/sticky consent overlay by copy + CTAs.
 * Returns { selector, cmsName, type, folderName } or null.
 * Must stay self-contained for page.evaluate (no imports).
 */
export function detectConsentOverlayByCopyInPage() {
  function isVisible(el, minW = 80, minH = 40) {
    if (!el || !(el instanceof Element)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width >= minW && rect.height >= minH;
  }

  const copyRe =
    /cookies?|cookiebeleid|gebruikt cookies|we use cookies|this site uses|cookie policy|privacy policy|gdpr|consentement|accepteer|weiger|instellingen|ablehnen|akzeptieren|alle cookies|niet-essenti|non-essential|strictly necessary|strikt noodzakelijk/i;
  const ctaRe =
    /accept(eer)?|accepteer|allow all|i agree|akkoord|agree|reject|weiger|deny|refuse|instellingen|settings|manage|voorkeuren|customize|personali/i;

  function countCtas(el) {
    let n = 0;
    for (const btn of el.querySelectorAll('button, a, [role="button"]')) {
      const t = (btn.innerText || btn.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
      if (t && ctaRe.test(t) && t.length < 64) n += 1;
    }
    return n;
  }

  function buildSelector(el) {
    if (!(el instanceof Element)) return null;
    if (el.id && !/\d{5,}/.test(el.id)) return `#${CSS.escape(el.id)}`;
    // Prefer structural path — Tailwind utility classes are unstable / non-unique
    const parts = [];
    let cur = el;
    for (let i = 0; i < 7 && cur && cur !== document.body; i++) {
      let part = cur.tagName.toLowerCase();
      if (cur.id && !/\d{5,}/.test(cur.id)) {
        parts.unshift(`#${CSS.escape(cur.id)}`);
        break;
      }
      const parent = cur.parentElement;
      if (parent) {
        const siblings = [...parent.children].filter((c) => c.tagName === cur.tagName);
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(cur) + 1})`;
      }
      parts.unshift(part);
      cur = parent;
    }
    const sel = parts.join(' > ');
    try {
      if (document.querySelector(sel) === el) return sel;
    } catch {
      /* ignore */
    }
    return null;
  }

  function climbOutermost(el) {
    let best = el;
    let cur = el.parentElement;
    for (let i = 0; cur && i < 6; i++) {
      if (!(cur instanceof HTMLElement)) break;
      const st = window.getComputedStyle(cur);
      if (!['fixed', 'sticky', 'absolute'].includes(st.position)) break;
      if (!isVisible(cur, 80, 40)) break;
      const text = (cur.innerText || '').slice(0, 500);
      if (!copyRe.test(text)) break;
      best = cur;
      cur = cur.parentElement;
    }
    return best;
  }

  const vw = window.innerWidth || 1;
  const vh = window.innerHeight || 1;
  /** @type {{ el: Element, score: number, area: number }[]} */
  const scored = [];

  for (const el of document.querySelectorAll('div, section, aside, dialog, [role="dialog"], [role="alertdialog"]')) {
    if (!(el instanceof HTMLElement)) continue;
    const st = window.getComputedStyle(el);
    if (!['fixed', 'sticky', 'absolute'].includes(st.position)) continue;
    if (!isVisible(el, 80, 40)) continue;
    // Skip footer legal strips (static footer cookie links)
    if (el.closest('footer, [class*="Footer" i]')) {
      const fr = el.closest('footer, [class*="Footer" i]')?.getBoundingClientRect();
      if (fr && fr.top > vh * 0.7 && st.position === 'static') continue;
    }
    const r = el.getBoundingClientRect();
    // Must intersect viewport and sit near an edge / corner (not a full-page sheet unless dialog)
    const inView = r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
    if (!inView) continue;
    const nearEdge =
      r.bottom >= vh - 120 ||
      r.top <= 140 ||
      r.left <= 48 ||
      r.right >= vw - 48;
    if (!nearEdge && el.getAttribute('role') !== 'dialog') continue;
    if (r.width < Math.min(200, vw * 0.2) || r.height < 48) continue;
    // Avoid claiming the whole page
    if (r.width >= vw * 0.95 && r.height >= vh * 0.85) continue;

    const text = (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 600);
    if (!copyRe.test(text)) continue;
    // Footer cookie-policy links only — no accept CTA cluster
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
  return {
    selector,
    cmsName: 'CookieBanner',
    type: 'cookie-banner',
    folderName: 'cookie-banner',
  };
}

/** Browser-side: detect visible cookie banner element. */
export function detectCookieBannerInPage() {
  function isVisible(el, minW = 100, minH = 40) {
    if (!el || !(el instanceof Element)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    return rect.width >= minW && rect.height >= minH;
  }

  const selectors = [
    '#onetrust-banner-sdk',
    '#onetrust-consent-sdk',
    '#tc-privacy-wrapper',
    '.tc-privacy-wrapper',
    '[class*="tc-privacy-wrapper"]',
    '#didomi-host',
    '#CybotCookiebotDialog',
    '#usercentrics-root',
    '[class*="cookie-banner"]',
    '[class*="cookie-consent"]',
    '[id*="cookie-banner"]',
    '[id*="privacy-wrapper"]',
    '[aria-label*="cookie" i]',
    '.osano-cm-window',
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (!el || !isVisible(el)) continue;
    return { visible: true, selector };
  }

  const heuristic = detectCookieBannerHeuristicInPage();
  if (heuristic) return { visible: true, selector: heuristic.selector };
  const byCopy = detectConsentOverlayByCopyInPage();
  if (byCopy) return { visible: true, selector: byCopy.selector };
  return { visible: false, selector: null };
}

/** Browser-side heuristic when explicit selectors miss. */
export function detectCookieBannerHeuristicInPage() {
  function isVisible(el, minW = 100, minH = 40) {
    if (!el || !(el instanceof Element)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    return rect.width >= minW && rect.height >= minH;
  }

  function nameLooksLikeConsent(el) {
    const id = (el.id || '').toLowerCase();
    const cls = (el.className?.toString?.() || '').toLowerCase();
    const aria = (el.getAttribute('aria-label') || '').toLowerCase();
    const role = (el.getAttribute('role') || '').toLowerCase();
    const haystack = `${id} ${cls} ${aria} ${role}`;
    return /cookie|consent|privacy|gdpr|didomi|quantcast|usercentrics|onetrust|osano|cookiebot|trustcommander|tc-privacy|sp-cc|cmp-/.test(
      haystack,
    );
  }

  function looksLikeOverlayBanner(el) {
    if (!isVisible(el)) return false;
    if (!nameLooksLikeConsent(el)) return false;
    // Do not reject solely for being under main — custom apps mount banners there.

    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const zIndex = parseInt(style.zIndex, 10);
    const highStack = !Number.isNaN(zIndex) && zIndex >= 40;
    const fixedLike = style.position === 'fixed' || style.position === 'sticky' || style.position === 'absolute';
    const wide = rect.width >= window.innerWidth * 0.2;
    const tallEnough = rect.height >= 40;
    const atViewportEdge =
      rect.bottom >= window.innerHeight - 120 ||
      rect.top <= 140 ||
      rect.left <= 48 ||
      (rect.top >= 0 && rect.top <= window.innerHeight * 0.15);

    return (
      fixedLike &&
      wide &&
      tallEnough &&
      atViewportEdge &&
      (highStack || style.position === 'fixed' || style.position === 'sticky')
    );
  }

  function buildSelector(el) {
    if (!(el instanceof Element)) return null;
    if (el.id) return `#${CSS.escape(el.id)}`;
    const parts = [];
    let cur = el;
    for (let i = 0; i < 7 && cur && cur !== document.body; i++) {
      let part = cur.tagName.toLowerCase();
      if (cur.id) {
        parts.unshift(`#${CSS.escape(cur.id)}`);
        break;
      }
      const parent = cur.parentElement;
      if (parent) {
        const siblings = [...parent.children].filter((c) => c.tagName === cur.tagName);
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(cur) + 1})`;
      }
      parts.unshift(part);
      cur = parent;
    }
    return parts.join(' > ');
  }

  const candidates = [
    ...document.querySelectorAll(
      '[id*="privacy" i], [class*="privacy" i], [id*="cookie" i], [class*="cookie" i], [class*="consent" i], [role="dialog"], [role="alertdialog"]',
    ),
  ];

  let best = null;
  let bestArea = 0;
  for (const el of candidates) {
    if (!looksLikeOverlayBanner(el)) continue;
    if (el.getAttribute('role') === 'banner' && !nameLooksLikeConsent(el)) continue;
    const rect = el.getBoundingClientRect();
    const area = rect.width * rect.height;
    if (area > bestArea) {
      best = el;
      bestArea = area;
    }
  }

  if (best) {
    const selector = buildSelector(best);
    if (selector) {
      try {
        if (document.querySelector(selector) === best) {
          return { selector, cmsName: 'CookieBanner', type: 'cookie-banner', folderName: 'cookie-banner' };
        }
      } catch {
        /* ignore */
      }
    }
  }

  return detectConsentOverlayByCopyInPage();
}

/** Browser-side: hide cookie UI after capture (fallback if accept click fails). */
export function hideCookieBannerInPage() {
  const selectors = [
    '#onetrust-banner-sdk',
    '#onetrust-consent-sdk',
    '.onetrust-pc-dark-filter',
    '#onetrust-pc-sdk',
    '#tc-privacy-wrapper',
    '.tc-privacy-wrapper',
    '[class*="tc-privacy"]',
    '#didomi-host',
    '#didomi-popup',
    '#CybotCookiebotDialog',
    '#usercentrics-root',
    '[class*="cookie-banner"]',
    '[class*="cookie-consent"]',
    '[class*="privacy-wrapper"]',
    '[id*="privacy-wrapper"]',
    '.osano-cm-window',
  ];
  for (const selector of selectors) {
    document.querySelectorAll(selector).forEach((el) => {
      if (el instanceof HTMLElement) {
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        el.setAttribute('aria-hidden', 'true');
      }
    });
  }

  // Classless Tailwind / custom CMP — hide by copy+geometry
  const found = detectConsentOverlayByCopyInPage();
  if (found?.selector) {
    try {
      const el = document.querySelector(found.selector);
      if (el instanceof HTMLElement) {
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('pointer-events', 'none', 'important');
        el.setAttribute('aria-hidden', 'true');
        el.setAttribute('data-screenshot-hidden', 'cookie');
      }
    } catch {
      /* ignore */
    }
  }
}
