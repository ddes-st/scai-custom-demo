/**
 * Detect and capture interactive UI states (tabs, FAQ/accordion, nav menus L1→L2→L3)
 * inside an already-exported section folder. Live DOM screenshots + open-state HTML.
 */
import { mkdir, writeFile, readFile, rename } from 'node:fs/promises';
import path from 'node:path';
import {
  VIEWPORTS,
  resolveScreenshotDevices,
  deviceFileSlug,
  ensureOverlayScrollbars,
} from './viewports.mjs';
import { reassertChromeCaptureModeInPage } from './overlay-chrome-capture.mjs';
import { acceptCookieConsent } from './cookie-banner.mjs';
import {
  ORIGINAL_SECTION_HTML,
  SECTION_HTML,
} from './section-html-files.mjs';
import { saveSectionStyledHtml } from './save-section-styled-html.mjs';
import { screenshotSectionHtmlDevices } from './screenshot-section-html.mjs';
import { syncOpenStateFromLivePage } from './sync-open-state-into-html.mjs';

/** Hide chat / FAB widgets that obscure section & menu shots (site-agnostic). */
function hideFloatingWidgetsInPage() {
  const sels = [
    '#hubspot-messages-iframe-container',
    '#drift-widget',
    '#intercom-container',
    '.intercom-lightweight-app',
    '[class*="intercom" i]',
    '[id*="live-chat" i]',
    '[class*="chat-widget" i]',
    '[class*="chat-button" i]',
    '[class*="ChatWidget" i]',
    '#qualified-chat',
    '[class*="qualified" i]',
    '[class*="whatsapp" i]',
    '[aria-label*="chat" i]',
    '[aria-label*="whatsapp" i]',
    'iframe[title*="chat" i]',
    '[class*="floating" i][class*="button" i]',
    '[class*="FloatingButton" i]',
  ];
  for (const sel of sels) {
    try {
      for (const el of document.querySelectorAll(sel)) {
        if (!(el instanceof HTMLElement)) continue;
        if (el.closest('[data-bq-chrome-capture="1"]')) continue;
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('opacity', '0', 'important');
        el.style.setProperty('pointer-events', 'none', 'important');
        el.setAttribute('data-bq-float-hidden', '1');
      }
    } catch {
      /* ignore */
    }
  }
  // Open chat panels often lack chat-widget class — hide large fixed right-edge dialogs
  for (const el of document.querySelectorAll('body *')) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.dataset.bqFloatHidden === '1') continue;
    if (el.closest('[data-bq-chrome-capture="1"]')) continue;
    const st = getComputedStyle(el);
    if (st.position !== 'fixed' && st.position !== 'absolute') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 180 || r.height < 180) continue;
    if (r.left < (window.innerWidth || 0) * 0.4) continue;
    const blob = `${el.id} ${el.className?.toString?.() || ''} ${el.getAttribute('aria-label') || ''} ${(el.innerText || '').slice(0, 120)}`;
    if (
      /chat|whatsapp|intercom|drift|hulp nodig|help you|live.?agent|messenger/i.test(blob)
    ) {
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('opacity', '0', 'important');
      el.style.setProperty('pointer-events', 'none', 'important');
      el.setAttribute('data-bq-float-hidden', '1');
    }
  }
}

const MAX_MENU_STATES = 12;
const MAX_NON_MENU_STATES = 5;
const MAX_L1 = 5;
const MAX_L2_PER_L1 = 2;

const CMP_RE =
  /cookie|consent|onetrust|cmp|didomi|osano|cookiebot|gdpr|privacy.?banner|trustcommander|usercentrics/i;

function slugify(text) {
  return (
    String(text || 'state')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'state'
  );
}

function uniqueSlug(base, used) {
  let s = base || 'state';
  if (!used.has(s)) {
    used.add(s);
    return s;
  }
  let n = 2;
  while (used.has(`${s}-${n}`)) n += 1;
  const next = `${s}-${n}`;
  used.add(next);
  return next;
}

/**
 * Browser-side: discover expandable / tab / menu triggers inside a section root.
 * @returns {object}
 */
function discoverTriggersInBrowser(rootSelector) {
  const resolveRoot = (sel) => {
    try {
      const hit = document.querySelector(sel);
      if (hit instanceof HTMLElement) return hit;
    } catch {
      /* ignore */
    }
    const softened = String(sel || '')
      .replace(/\.(sticky|fixed|scrolled|is-sticky|is-fixed|is-scrolled|stuck|pinned)\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (softened && softened !== sel) {
      try {
        const hit = document.querySelector(softened);
        if (hit instanceof HTMLElement) return hit;
      } catch {
        /* ignore */
      }
    }
    try {
      const marked = document.querySelector('[data-bq-chrome-capture="1"]');
      if (marked instanceof HTMLElement) return marked;
    } catch {
      /* ignore */
    }
    return null;
  };
  const root = resolveRoot(rootSelector);
  if (!root || !(root instanceof HTMLElement)) {
    return { tabs: [], accordion: [], menuL1: [] };
  }

  const isVisible = (el) => {
    if (!(el instanceof HTMLElement)) return false;
    const st = window.getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 8 && r.height >= 8;
  };

  const idDupCount = (id) => {
    try {
      return document.querySelectorAll(`#${CSS.escape(id)}`).length;
    } catch {
      return 99;
    }
  };
  const canBareId = (id) =>
    Boolean(id) && !/\d{4,}/.test(id) && idDupCount(id) <= 1;

  const cssPath = (el) => {
    if (!(el instanceof Element)) return '';
    // Never emit bare #id when the same id is duplicated (MediaSlider tablists).
    if (el.id && canBareId(el.id)) return `#${CSS.escape(el.id)}`;
    const parts = [];
    let cur = el;
    for (let i = 0; i < 6 && cur && cur.nodeType === 1 && cur !== document.body; i++) {
      let part = cur.tagName.toLowerCase();
      if (cur.id && canBareId(cur.id)) {
        parts.unshift(`#${CSS.escape(cur.id)}`);
        break;
      }
      const cls = [...cur.classList]
        .filter((c) => c && !/^(is-|has-|js-|active|open|selected|current|hover)/i.test(c))
        .slice(0, 2);
      if (cls.length) part += cls.map((c) => `.${CSS.escape(c)}`).join('');
      const parent = cur.parentElement;
      if (parent) {
        // Disambiguate siblings that share the same tag (+ classes) — otherwise
        // every L1/tab button collapses to one selector and only the first is kept.
        const siblings = [...parent.children].filter((c) => {
          if (c.tagName !== cur.tagName) return false;
          if (!cls.length) return true;
          return cls.every((cl) => c.classList.contains(cl));
        });
        if (siblings.length > 1) part += `:nth-of-type(${[...parent.children].filter((c) => c.tagName === cur.tagName).indexOf(cur) + 1})`;
      }
      parts.unshift(part);
      cur = parent;
    }
    return parts.join(' > ');
  };

  const labelOf = (el) =>
    (el.getAttribute('aria-label') ||
      el.getAttribute('title') ||
      el.textContent ||
      '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);

  const controlledPanel = (el) => {
    const id = el.getAttribute('aria-controls');
    if (!id) return null;
    try {
      const p = document.getElementById(id);
      if (!p) return null;
      // Keep menu panels inside this section — foreign aria-controls often
      // point at unrelated page landmarks (hero tabs, etc.).
      if (root.contains(p)) return p;
      return null;
    } catch {
      return null;
    }
  };

  const hasNestedSubmenu = (liOrTrigger) => {
    const scope = liOrTrigger.closest('li') || liOrTrigger.parentElement || liOrTrigger;
    return Boolean(
      scope.querySelector(
        ':scope > ul, :scope > [class*="dropdown" i], :scope > [class*="mega" i], :scope > [class*="submenu" i], :scope > [class*="flyout" i], :scope > [role="menu"]',
      ),
    );
  };

  /** Nested submenu under the item, or aria-controls (panel may mount on open). */
  const hasSubmenu = (liOrTrigger) => {
    if (hasNestedSubmenu(liOrTrigger)) return true;
    if (controlledPanel(liOrTrigger)) return true;
    // Many mega-menus declare aria-controls before the panel is mounted.
    if (
      liOrTrigger.hasAttribute('aria-controls') &&
      liOrTrigger.hasAttribute('aria-expanded') &&
      liOrTrigger.closest('ul > li, [role="menuitem"]')
    ) {
      return true;
    }
    return false;
  };

  const isSkipNavNoise = (el) => {
    const aria = (el.getAttribute('aria-label') || '').toLowerCase();
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (/open menu|close menu|hamburger|toggle (nav|menu|navigation)/i.test(aria)) return true;
    if (el.getAttribute('aria-haspopup') === 'listbox') return true;
    if (/^search$/i.test(text) || /open search/i.test(aria)) return true;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.width < 44 && r.height < 44 && text.length < 2 && !aria) return true;
    // Pure in-page jump / external with no panel
    if (el.tagName === 'A') {
      const href = el.getAttribute('href') || '';
      if (!controlledPanel(el) && !hasNestedSubmenu(el) && (href === '#' || href === '')) return true;
    }
    return false;
  };

  /** @type {Array<object>} */
  const tabs = [];
  const tablists = [
    ...root.querySelectorAll('[role="tablist"]'),
    ...root.querySelectorAll('[class*="tabs" i], [class*="tablist" i], [data-tabs]'),
  ];
  {
    const seen = new Set();
    const seenLabels = new Set();
    for (const tablist of tablists) {
      if (!(tablist instanceof Element)) continue;
      // Skip wholly hidden tablists (e.g. mobile lg:hidden at desktop width)
      if (tablist instanceof HTMLElement && !isVisible(tablist)) continue;
      const tabEls = [
        ...tablist.querySelectorAll('[role="tab"]'),
        ...tablist.querySelectorAll(
          'button[class*="tab" i], a[class*="tab" i], button.CustomScroll__tabButton',
        ),
      ];
      // Prefer real controls over wrapping <li class*="tab"> shells
      const preferred = tabEls.filter(
        (el) =>
          el instanceof HTMLElement &&
          (el.matches('button, a, [role="tab"]') || el.getAttribute('role') === 'tab'),
      );
      const list = preferred.length ? preferred : tabEls;
      for (const el of list) {
        if (!(el instanceof HTMLElement) || !isVisible(el)) continue;
        const sel = cssPath(el);
        if (!sel || seen.has(sel)) continue;
        const label = labelOf(el) || 'Tab';
        const labelKey = label.toLowerCase();
        if (seenLabels.has(labelKey)) continue;
        seen.add(sel);
        seenLabels.add(labelKey);
        const selected =
          el.getAttribute('aria-selected') === 'true' ||
          /(?:^|\s)(?:is-)?(?:active|selected|current)(?:\s|$)/i.test(el.className || '');
        tabs.push({
          kind: 'tab',
          label,
          selector: sel,
          selected,
          method: 'click',
        });
      }
    }
  }

  /** Landmark / geometry chrome — not FAQ content (mega drawers use accordion classes). */
  const isNavChromeContext = (el) => {
    if (!(el instanceof Element)) return false;
    try {
      return Boolean(
        el.closest(
          [
            'nav',
            'header',
            '[role="navigation"]',
            '[role="banner"]',
            '[class*="navigation" i]',
            '[class*="nav-wrapper" i]',
            '[class*="main-nav" i]',
            '[class*="site-header" i]',
            '[class*="main-header" i]',
          ].join(', '),
        ),
      );
    } catch {
      return false;
    }
  };

  /** @type {Array<object>} */
  const accordion = [];
  const accRoots = root.querySelectorAll(
    '[class*="accordion" i], [class*="accordeon" i], [class*="faq" i], details',
  );
  const accSeen = new Set();
  for (const block of accRoots) {
    // Nav megas often reuse accordion markup — capture them as menu-*, not faq-*
    if (isNavChromeContext(block)) continue;
    if (block.tagName === 'DETAILS') {
      const summary = block.querySelector('summary');
      if (summary instanceof HTMLElement && isVisible(summary)) {
        if (isNavChromeContext(summary)) continue;
        const sel = cssPath(summary);
        if (sel && !accSeen.has(sel)) {
          accSeen.add(sel);
          accordion.push({
            kind: 'accordion',
            label: labelOf(summary) || 'Details',
            selector: sel,
            method: 'click',
            open: block.open === true,
          });
        }
      }
      continue;
    }
    const headers = block.querySelectorAll(
      'button[aria-expanded], [aria-expanded="false"], [aria-expanded="true"], [class*="header" i], [class*="title" i], h2, h3, h4, button, a',
    );
    for (const el of headers) {
      if (!(el instanceof HTMLElement) || !isVisible(el)) continue;
      if (isNavChromeContext(el)) continue;
      const sel = cssPath(el);
      if (!sel || accSeen.has(sel)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 40 || r.height < 16) continue;
      accSeen.add(sel);
      accordion.push({
        kind: 'accordion',
        label: labelOf(el) || 'Item',
        selector: sel,
        method: 'click',
        open:
          el.getAttribute('aria-expanded') === 'true' ||
          /open|active|expanded/i.test(el.className || ''),
      });
      if (accordion.length >= 12) break;
    }
    if (accordion.length >= 12) break;
  }

  /** @type {Array<object>} */
  const menuL1 = [];
  const navScope =
    root.matches('nav, header, [role="navigation"], [role="banner"]') ||
    root.querySelector('nav, [role="navigation"], [class*="menu" i], [class*="nav" i]');
  const menuRoot = root.matches('nav, header, [role="navigation"], [role="banner"]')
    ? root
    : root.querySelector('nav, [role="navigation"], [class*="menu" i], [class*="nav" i]') || root;
  if (navScope || menuRoot) {
    const l1Items = [
      ...menuRoot.querySelectorAll(
        [
          'ul > li > a',
          'ul > li > button',
          '[role="menubar"] > [role="menuitem"]',
          'a[aria-expanded][aria-controls]',
          'button[aria-expanded][aria-controls]',
        ].join(', '),
      ),
    ];
    const seen = new Set();
    for (const el of l1Items) {
      if (!(el instanceof HTMLElement) || !isVisible(el)) continue;
      if (isSkipNavNoise(el)) continue;
      if (!hasSubmenu(el)) continue;
      const sel = cssPath(el);
      if (!sel || seen.has(sel)) continue;
      seen.add(sel);
      const useClick =
        el.hasAttribute('aria-expanded') || el.hasAttribute('aria-controls') || el.tagName === 'BUTTON';
      menuL1.push({
        kind: 'menu',
        depth: 1,
        label: labelOf(el) || 'Menu',
        selector: sel,
        method: useClick ? 'click' : 'hover',
        panelSelector: (() => {
          const p = controlledPanel(el);
          return p ? cssPath(p) || (p.id ? `#${CSS.escape(p.id)}` : null) : null;
        })(),
      });
      if (menuL1.length >= 8) break;
    }
  }

  return { tabs, accordion, menuL1 };
}

/**
 * Find nested submenu triggers under an open panel (browser).
 */
function findChildMenuTriggersInBrowser(parentTriggerSelector) {
  const trigger = (() => {
    try {
      return document.querySelector(parentTriggerSelector);
    } catch {
      return null;
    }
  })();
  if (!trigger) return [];

  const li = trigger.closest('li') || trigger.parentElement;
  let panel = null;
  if (li) {
    panel = li.querySelector(
      ':scope > ul, :scope > [class*="dropdown" i], :scope > [class*="mega" i], :scope > [class*="submenu" i], :scope > [class*="flyout" i], :scope > [role="menu"]',
    );
  }
  if (!panel) {
    const id = trigger.getAttribute('aria-controls');
    if (id) {
      try {
        panel = document.getElementById(id);
      } catch {
        panel = null;
      }
    }
  }
  if (!panel) return [];

  const cssPath = (el) => {
    if (!(el instanceof Element)) return '';
    if (el.id && !/\d{4,}/.test(el.id) && (() => { try { return document.querySelectorAll(`#${CSS.escape(el.id)}`).length; } catch { return 99; } })() <= 1) return `#${CSS.escape(el.id)}`;
    const parts = [];
    let cur = el;
    for (let i = 0; i < 6 && cur && cur.nodeType === 1 && cur !== document.body; i++) {
      let part = cur.tagName.toLowerCase();
      if (cur.id && !/\d{4,}/.test(cur.id) && (() => { try { return document.querySelectorAll(`#${CSS.escape(cur.id)}`).length; } catch { return 99; } })() <= 1) {
        parts.unshift(`#${CSS.escape(cur.id)}`);
        break;
      }
      const parent = cur.parentElement;
      if (parent) {
        const siblings = [...parent.children].filter((c) => c.tagName === cur.tagName);
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(cur) + 1})`;
      }
      const cls = [...cur.classList]
        .filter((c) => c && !/^(is-|has-|js-|active|open|selected|current|hover)/i.test(c))
        .slice(0, 2);
      if (cls.length) part += cls.map((c) => `.${CSS.escape(c)}`).join('');
      parts.unshift(part);
      cur = parent;
    }
    return parts.join(' > ');
  };

  const labelOf = (el) =>
    (el.getAttribute('aria-label') || el.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);

  const hasSub = (el) => {
    const scope = el.closest('li') || el.parentElement || el;
    if (
      scope.querySelector(
        ':scope > ul, :scope > [class*="dropdown" i], :scope > [class*="submenu" i], :scope > [class*="mega" i], :scope > [role="menu"]',
      )
    ) {
      return true;
    }
    const id = el.getAttribute('aria-controls');
    if (!id) return false;
    try {
      return Boolean(document.getElementById(id));
    } catch {
      return false;
    }
  };

  const out = [];
  const seen = new Set();
  for (const el of panel.querySelectorAll(
    ':scope > li > a, :scope > li > button, a, button, [role="menuitem"], [aria-expanded][aria-controls]',
  )) {
    if (!(el instanceof HTMLElement)) continue;
    if (!hasSub(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;
    const sel = cssPath(el);
    if (!sel || seen.has(sel)) continue;
    seen.add(sel);
    const useClick = el.hasAttribute('aria-expanded') || el.tagName === 'BUTTON';
    out.push({
      kind: 'menu',
      label: labelOf(el) || 'Submenu',
      selector: sel,
      method: useClick ? 'click' : 'hover',
    });
    if (out.length >= 8) break;
  }
  return out;
}

/**
 * Pick a visible DOM node for a trigger selector/label (handles duplicate ids).
 * @returns {Promise<string|null>} unique CSS path of the clicked/hovered element
 */
async function resolveVisibleTriggerPath(page, trigger) {
  return page
    .evaluate(
      ({ sel, label }) => {
        const norm = (s) =>
          String(s || '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
        const isShown = (el) => {
          if (!(el instanceof HTMLElement)) return false;
          const st = window.getComputedStyle(el);
          if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) < 0.1) {
            return false;
          }
          const r = el.getBoundingClientRect();
          const vh = window.innerHeight || 1;
          const vw = window.innerWidth || 1;
          return r.width >= 8 && r.height >= 8 && r.bottom > 0 && r.top < vh && r.left < vw;
        };
        const idDupCount = (id) => {
          try {
            return document.querySelectorAll(`#${CSS.escape(id)}`).length;
          } catch {
            return 99;
          }
        };
        const canBareId = (id) =>
          Boolean(id) && !/\d{4,}/.test(id) && idDupCount(id) <= 1;
        const cssPath = (el) => {
          if (!(el instanceof Element)) return '';
          if (el.id && canBareId(el.id)) return `#${CSS.escape(el.id)}`;
          const parts = [];
          let cur = el;
          for (let i = 0; i < 8 && cur && cur.nodeType === 1 && cur !== document.body; i++) {
            let part = cur.tagName.toLowerCase();
            if (cur.id && canBareId(cur.id)) {
              parts.unshift(`#${CSS.escape(cur.id)}`);
              break;
            }
            const cls = [...cur.classList]
              .filter((c) => c && !/^(is-|has-|js-|active|open|selected|current|hover)/i.test(c))
              .slice(0, 2);
            if (cls.length) part += cls.map((c) => `.${CSS.escape(c)}`).join('');
            const parent = cur.parentElement;
            if (parent) {
              const sameTag = [...parent.children].filter((c) => c.tagName === cur.tagName);
              if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(cur) + 1})`;
            }
            parts.unshift(part);
            cur = parent;
          }
          return parts.join(' > ');
        };
        const score = (el) => {
          let s = 0;
          if (el.getAttribute('role') === 'tab') s += 8;
          if (el.closest('[role="tablist"]') && isShown(el.closest('[role="tablist"]'))) s += 6;
          if (el.hasAttribute('aria-expanded')) s += 4;
          if (el.tagName === 'BUTTON') s += 2;
          // Prefer text-nav tabs (h3) over logo-only tabs for MediaSlider desktop
          if (el.querySelector('h3, h2, h4')) s += 5;
          const r = el.getBoundingClientRect();
          s += Math.min(4, Math.floor((r.width * r.height) / 8000));
          return s;
        };
        /** @type {HTMLElement[]} */
        const candidates = [];
        if (sel) {
          try {
            for (const el of document.querySelectorAll(sel)) {
              if (el instanceof HTMLElement && isShown(el)) candidates.push(el);
            }
          } catch {
            /* ignore */
          }
        }
        const want = norm(label);
        if (want) {
          for (const el of document.querySelectorAll(
            '[role="tab"], button[aria-expanded], button, a[role="button"], [role="button"]',
          )) {
            if (!(el instanceof HTMLElement) || !isShown(el)) continue;
            const text = norm(el.getAttribute('aria-label') || el.innerText || el.textContent);
            if (
              text === want ||
              text.startsWith(want) ||
              want.startsWith(text.slice(0, 24))
            ) {
              candidates.push(el);
            }
          }
        }
        const uniq = [...new Set(candidates)];
        uniq.sort((a, b) => score(b) - score(a));
        if (uniq[0]) return cssPath(uniq[0]);
        // Last resort: first match even if hidden (menus sometimes off-screen)
        if (sel) {
          try {
            const el = document.querySelector(sel);
            if (el instanceof HTMLElement) return cssPath(el);
          } catch {
            /* ignore */
          }
        }
        return null;
      },
      { sel: trigger.selector || null, label: trigger.label || null },
    )
    .catch(() => null);
}

async function activateTrigger(page, trigger) {
  if (!trigger?.selector && !trigger?.label) return false;
  try {
    const resolved = await resolveVisibleTriggerPath(page, trigger);
    const sel = resolved || trigger.selector;
    if (!sel) return false;

    await page.evaluate((s) => {
      try {
        const el = document.querySelector(s);
        if (!(el instanceof HTMLElement)) return;
        el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'instant' });
        let cur = el.parentElement;
        for (let i = 0; i < 6 && cur; i++) {
          const st = getComputedStyle(cur);
          if (/(auto|scroll|overlay)/.test(st.overflowX) || /(auto|scroll|overlay)/.test(st.overflow)) {
            const er = el.getBoundingClientRect();
            const cr = cur.getBoundingClientRect();
            if (er.left < cr.left || er.right > cr.right) {
              cur.scrollLeft += er.left - cr.left - cr.width / 2 + er.width / 2;
            }
            break;
          }
          cur = cur.parentElement;
        }
      } catch {
        /* ignore */
      }
    }, sel);

    const loc = page.locator(sel).first();
    if ((await loc.count()) < 1) return false;
    await loc.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});

    const visible = await isTriggerVisible(page, sel);
    if (trigger.method === 'hover') {
      await loc.hover({ timeout: 2500 });
      await page.waitForTimeout(350);
      const expanded = await page.evaluate((s) => {
        const el = document.querySelector(s);
        if (!el) return false;
        if (el.getAttribute('aria-expanded') === 'true') return true;
        const id = el.getAttribute('aria-controls');
        if (id) {
          const controlled = document.getElementById(id);
          if (controlled) {
            const st = window.getComputedStyle(controlled);
            const r = controlled.getBoundingClientRect();
            if (st.display !== 'none' && st.visibility !== 'hidden' && r.height > 4) return true;
          }
        }
        const li = el.closest('li') || el.parentElement;
        if (!li) return false;
        const panel = li.querySelector(
          'ul, [class*="dropdown" i], [class*="mega" i], [class*="submenu" i], [role="menu"]',
        );
        if (!panel) return false;
        const st = window.getComputedStyle(panel);
        const r = panel.getBoundingClientRect();
        return st.display !== 'none' && st.visibility !== 'hidden' && r.height > 4;
      }, sel);
      if (!expanded) {
        await loc.click({ timeout: 2500, force: !visible }).catch(() => {});
        await page.waitForTimeout(300);
      }
    } else {
      // Prefer real click when visible; force only as last resort (hidden duplicates)
      await loc.click({ timeout: 2500, force: !visible });
      await page.waitForTimeout(350);
    }

    // Assert tab/accordion actually opened; retry via label if still closed
    const opened = await page.evaluate((s) => {
      try {
        const el = document.querySelector(s);
        if (!(el instanceof HTMLElement)) return false;
        if (el.getAttribute('aria-selected') === 'true') return true;
        if (el.getAttribute('aria-expanded') === 'true') return true;
        const id = el.getAttribute('aria-controls');
        if (id) {
          const panel = document.getElementById(id);
          if (panel && panel.getAttribute('aria-hidden') === 'false') return true;
          if (panel && /SlideActive|AccordionItemActive|active/i.test(panel.className || '')) {
            return true;
          }
        }
        return /NavButtonActive|AccordionItemActive|active|selected/i.test(el.className || '');
      } catch {
        return false;
      }
    }, sel);

    if (!opened && trigger.label) {
      const retryPath = await resolveVisibleTriggerPath(page, {
        selector: null,
        label: trigger.label,
      });
      if (retryPath && retryPath !== sel) {
        await page.locator(retryPath).first().click({ timeout: 2500 }).catch(() => {});
        await page.waitForTimeout(350);
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Narrow L1 drill: click the expandable row (chevron / aria-expanded), not only focus.
 * Returns true if a click was attempted.
 */
async function activateNarrowL1Drill(page, { sectionSelector, drawerSelector, preferredSelector, label }) {
  const stepSelector =
    (await resolveVisibleL1Selector(
      page,
      sectionSelector,
      preferredSelector,
      label,
      drawerSelector,
    )) || preferredSelector;

  // Prefer a control inside the drawer whose text matches and that looks expandable
  const drilled = await page
    .evaluate(
      ({ drawerSel, want, preferred }) => {
        const norm = (s) =>
          String(s || '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
        const target = norm(want);
        const vh = window.innerHeight || 1;
        const vw = window.innerWidth || 1;
        const scope = (() => {
          try {
            if (drawerSel) {
              const d = document.querySelector(drawerSel);
              if (d instanceof HTMLElement) return d;
            }
          } catch {
            /* ignore */
          }
          return document.body;
        })();
        const isShown = (el) => {
          if (!(el instanceof HTMLElement)) return false;
          const st = window.getComputedStyle(el);
          if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) < 0.1) {
            return false;
          }
          const r = el.getBoundingClientRect();
          return r.width >= 8 && r.height >= 8 && r.bottom > 0 && r.top < vh && r.left < vw;
        };
        const cssPath = (el) => {
          if (!(el instanceof Element)) return '';
          if (el.id && !/\d{4,}/.test(el.id) && (() => { try { return document.querySelectorAll(`#${CSS.escape(el.id)}`).length; } catch { return 99; } })() <= 1) return `#${CSS.escape(el.id)}`;
          const parts = [];
          let cur = el;
          for (let i = 0; i < 6 && cur && cur !== document.body; i++) {
            let part = cur.tagName.toLowerCase();
            if (cur.id && !/\d{4,}/.test(cur.id) && (() => { try { return document.querySelectorAll(`#${CSS.escape(cur.id)}`).length; } catch { return 99; } })() <= 1) {
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
        };

        /** @type {HTMLElement[]} */
        const candidates = [];
        for (const el of scope.querySelectorAll('button, a, [role="button"], [role="menuitem"]')) {
          if (!isShown(el)) continue;
          const text = norm(el.getAttribute('aria-label') || el.innerText || '');
          if (!target || !(text === target || text.startsWith(target) || target.startsWith(text.slice(0, 24)))) {
            continue;
          }
          candidates.push(el);
        }
        // Prefer expandable / chevron rows
        candidates.sort((a, b) => {
          const score = (el) => {
            let s = 0;
            if (el.hasAttribute('aria-expanded')) s += 5;
            if (el.hasAttribute('aria-controls')) s += 3;
            const blob = `${el.className} ${el.innerHTML?.slice?.(0, 200) || ''}`;
            if (/chevron|arrow|caret|expand|submenu|has-children/i.test(blob)) s += 4;
            if (el.tagName === 'BUTTON') s += 2;
            return s;
          };
          return score(b) - score(a);
        });
        const pick = candidates[0];
        if (pick) {
          // Already drilled — do not toggle closed
          if (pick.getAttribute('aria-expanded') === 'true') {
            return cssPath(pick);
          }
          // Nested already open if a go-back control is visible in scope
          for (const el of scope.querySelectorAll('button, a, [role="button"]')) {
            if (!isShown(el)) continue;
            const t = norm(el.getAttribute('aria-label') || el.innerText || '');
            if (/^(terug|go\s*back|retour|back)\b/.test(t) && t.length < 28) {
              return cssPath(pick);
            }
          }
          pick.click();
          return cssPath(pick);
        }
        if (preferred) {
          try {
            const el = document.querySelector(preferred);
            if (el instanceof HTMLElement) {
              el.click();
              return preferred;
            }
          } catch {
            /* ignore */
          }
        }
        return null;
      },
      { drawerSel: drawerSelector, want: label, preferred: stepSelector },
    )
    .catch(() => null);

  if (drilled) {
    await page.waitForTimeout(450);
    // Do NOT Playwright-click again — a second click toggles many drawers closed
    return true;
  }

  if (stepSelector) {
    return activateTrigger(page, { selector: stepSelector, method: 'click' });
  }
  if (label) {
    try {
      await page
        .getByRole('button', {
          name: new RegExp(`^${String(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        })
        .first()
        .click({ force: true, timeout: 2500 });
      await page.waitForTimeout(400);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Drop focus rings before PNG — blur activeElement and suppress outline for the shot.
 * Does not close menus that ignore blur; CSS cover handles focus-visible paint.
 */
async function clearFocusForScreenshot(page) {
  await page
    .evaluate(() => {
      try {
        const ae = document.activeElement;
        if (ae && ae !== document.body && typeof ae.blur === 'function') ae.blur();
      } catch {
        /* ignore */
      }
      if (!document.getElementById('bq-capture-no-focus-ring')) {
        const style = document.createElement('style');
        style.id = 'bq-capture-no-focus-ring';
        style.textContent =
          '*:focus,*:focus-visible,*:focus-within{outline:none!important;box-shadow:none!important;}';
        document.documentElement.appendChild(style);
      }
    })
    .catch(() => {});
}

async function removeFocusRingStyle(page) {
  await page
    .evaluate(() => {
      document.getElementById('bq-capture-no-focus-ring')?.remove();
    })
    .catch(() => {});
}

/**
 * Find a visible mobile/tablet nav toggle (hamburger) in the section, else document.
 * @returns {{ selector: string, alreadyOpen: boolean }|null}
 */
function findHamburgerInBrowser(rootSelector) {
  /**
   * Capture selectors often include transient chrome classes (sticky/fixed/scrolled)
   * that site JS toggles by viewport or scroll. Soften + chrome-capture marker fallback.
   */
  const resolveRoot = (sel) => {
    try {
      const hit = document.querySelector(sel);
      if (hit instanceof HTMLElement) return hit;
    } catch {
      /* ignore */
    }
    const softened = String(sel || '')
      .replace(/\.(sticky|fixed|scrolled|is-sticky|is-fixed|is-scrolled|stuck|pinned)\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (softened && softened !== sel) {
      try {
        const hit = document.querySelector(softened);
        if (hit instanceof HTMLElement) return hit;
      } catch {
        /* ignore */
      }
    }
    try {
      const marked = document.querySelector('[data-bq-chrome-capture="1"]');
      if (marked instanceof HTMLElement) return marked;
    } catch {
      /* ignore */
    }
    return null;
  };

  const root = resolveRoot(rootSelector);

  const isVisible = (el) => {
    if (!(el instanceof HTMLElement)) return false;
    const st = window.getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 8 && r.height >= 8;
  };

  const cssPath = (el) => {
    if (!(el instanceof Element)) return '';
    if (el.id && !/\d{4,}/.test(el.id) && (() => { try { return document.querySelectorAll(`#${CSS.escape(el.id)}`).length; } catch { return 99; } })() <= 1) return `#${CSS.escape(el.id)}`;
    const parts = [];
    let cur = el;
    for (let i = 0; i < 6 && cur && cur.nodeType === 1 && cur !== document.body; i++) {
      let part = cur.tagName.toLowerCase();
      if (cur.id && !/\d{4,}/.test(cur.id) && (() => { try { return document.querySelectorAll(`#${CSS.escape(cur.id)}`).length; } catch { return 99; } })() <= 1) {
        parts.unshift(`#${CSS.escape(cur.id)}`);
        break;
      }
      const parent = cur.parentElement;
      if (parent) {
        const siblings = [...parent.children].filter((c) => c.tagName === cur.tagName);
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(cur) + 1})`;
      }
      const cls = [...cur.classList]
        .filter((c) => c && !/^(is-|has-|js-|active|open)/i.test(c))
        .slice(0, 2);
      if (cls.length) part += cls.map((c) => `.${CSS.escape(c)}`).join('');
      parts.unshift(part);
      cur = parent;
    }
    return parts.join(' > ');
  };

  const queryToggle = (scope) => {
    if (!(scope instanceof Element) && scope !== document) return [];
    const host = scope === document ? document : scope;
    const sels = [
      '[data-navigation-toggle]',
      '[class*="navigation-toggle" i]',
      'button[aria-label*="open menu" i]',
      'button[aria-label*="close menu" i]',
      'button[aria-label*="menu" i]',
      'button[aria-label*="hoofdmenu" i]',
      'button[aria-label*="navigation" i]',
      'a[aria-label*="open menu" i]',
      'a[aria-label*="close menu" i]',
      'a[aria-label*="menu" i]',
      'a[aria-label*="hoofdmenu" i]',
      '[aria-label*="hoofdmenu" i]',
      '[title*="menu" i]',
      '[title*="hoofdmenu" i]',
      '[class*="hamburger" i] button',
      'button[class*="hamburger" i]',
      '[class*="hamburger" i]',
      '[class*="nav-toggle" i]',
      '[class*="menu-toggle" i]',
      'button[class*="menu" i]',
      'button[class*="Menu" i]',
    ];
    /** @type {Element[]} */
    const fromSel = [];
    for (const sel of sels) {
      try {
        fromSel.push(...host.querySelectorAll(sel));
      } catch {
        /* invalid selector in older engines — skip */
      }
    }
    // Text-only "menu" buttons (no aria-label) — common on mobile chrome
    const fromText = [...host.querySelectorAll('button, a[href], [role="button"]')].filter((el) => {
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      const aria = (el.getAttribute('aria-label') || '').trim();
      const title = (el.getAttribute('title') || '').trim();
      // Prefer dedicated aria/title labels over concatenated icon + sr-only text
      if (aria || title) {
        return /^(menu|meny|menü|menú|navigation|navigatie|hoofdmenu)$/i.test(aria || title) ||
          /menu|hoofdmenu|navigation|navigatie/i.test(aria || title);
      }
      return /^(menu|meny|menü|menú|navigation|navigatie)$/i.test(t);
    });
    return [...new Set([...fromSel, ...fromText])];
  };

  const scoreToggle = (el) => {
    const aria = (el.getAttribute('aria-label') || '').toLowerCase();
    const title = (el.getAttribute('title') || '').toLowerCase();
    const cls = (el.className?.toString?.() || '').toLowerCase();
    const id = (el.id || '').toLowerCase();
    const role = (el.getAttribute('role') || '').toLowerCase();
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const blob = `${aria} ${title} ${cls} ${id} ${text}`;
    // Exclude accordion / tabs / FAQ disclosures — not site hamburgers
    // (do not use full text blob for accordion — icon+label nodes can nest under nav megas)
    const clsIdAria = `${aria} ${title} ${cls} ${id}`;
    if (
      /accordion|tablist|tabpanel|faq|disclosure/i.test(clsIdAria) ||
      role === 'tab' ||
      el.closest('[role="tablist"], [role="accordion"], details')
    ) {
      return -1;
    }
    // Search / account / language toggles that reuse navigation-toggle styling
    if (/zoeken|search|gebruikers|account|login|language|taal|context selector/i.test(aria)) {
      return -1;
    }
    const hasNavToggleAttr = el.hasAttribute('data-navigation-toggle');
    const hasNavToggleClass = /navigation-toggle/i.test(cls);
    // Require explicit menu/nav-toggle signals — do NOT treat every aria-controls as hamburger
    const looksToggle =
      hasNavToggleAttr ||
      hasNavToggleClass ||
      /open menu|close menu|hamburger|nav-toggle|menu-toggle|toggle (nav|menu|navigation)|main.?nav|mobile.?nav|hoofdmenu/i.test(
        blob,
      ) ||
      (/menu|navigation|navigatie|menü|menú|hoofdmenu/i.test(aria || title) &&
        (el.hasAttribute('aria-expanded') || el.hasAttribute('aria-controls'))) ||
      // Visible icon button whose sole label is "menu" / "meny" / etc.
      /^(menu|meny|menü|menú|navigation|navigatie|hoofdmenu)$/i.test(text) ||
      /^(menu|meny|menü|menú|navigation|navigatie|hoofdmenu)$/i.test(title);
    if (!looksToggle) return -1;
    let score = 1;
    if (/open menu/i.test(aria)) score += 5;
    if (/close menu/i.test(aria)) score += 4;
    if (/hoofdmenu/i.test(aria || title)) score += 5;
    if (/^(menu|meny|menü|menú)$/i.test(text) || /^(menu|meny|menü|menú)$/i.test(title)) score += 4;
    if (/hamburger/i.test(cls)) score += 2;
    // Prefer dedicated toggle controls over concatenated icon+sr-only wrappers
    if (hasNavToggleAttr) score += 4;
    if (hasNavToggleClass) score += 3;
    if (el.getAttribute('aria-expanded') === 'true') score += 3;
    // Prefer toggles inside <nav> / banner / known chrome roots
    if (el.closest('nav, [role="navigation"], header, [role="banner"], [class*="Header" i], [class*="header" i], [class*="navigation" i]')) {
      score += 2;
    }
    // Penalize long concatenated text (icon + multiple sr-only strings)
    if (text.length > 48) score -= 2;
    return score;
  };

  const pickBest = (candidates) => {
    /** @type {{ el: HTMLElement, score: number }|null} */
    let bestOpen = null;
    /** @type {{ el: HTMLElement, score: number }|null} */
    let bestClose = null;
    /** @type {{ el: HTMLElement, score: number }|null} */
    let bestOther = null;
    for (const el of candidates) {
      if (!(el instanceof HTMLElement) || !isVisible(el)) continue;
      const score = scoreToggle(el);
      if (score < 0) continue;
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
      const already =
        /close menu/i.test(aria) || el.getAttribute('aria-expanded') === 'true';
      const entry = { el, score };
      if (already && /close menu/i.test(aria)) {
        if (!bestClose || score > bestClose.score) bestClose = entry;
      } else if (!already && /open menu/i.test(aria)) {
        if (!bestOpen || score > bestOpen.score) bestOpen = entry;
      } else if (already) {
        if (!bestClose || score > bestClose.score) bestClose = entry;
      } else if (!bestOther || score > bestOther.score) {
        bestOther = entry;
      }
    }
    // Prefer an open-menu control when closed; if only close is visible, menu is open.
    if (bestOpen) {
      return { selector: cssPath(bestOpen.el), alreadyOpen: false };
    }
    if (bestClose) {
      return { selector: cssPath(bestClose.el), alreadyOpen: true };
    }
    if (bestOther) {
      const aria = (bestOther.el.getAttribute('aria-label') || '').toLowerCase();
      const already =
        bestOther.el.getAttribute('aria-expanded') === 'true' || /close menu/i.test(aria);
      return { selector: cssPath(bestOther.el), alreadyOpen: already };
    }
    return null;
  };

  // ONLY search inside this section — never fall back to document (that made every
  // section inherit the site hamburger and burn minutes on failed menu-open shots).
  if (!(root instanceof HTMLElement)) return null;
  return pickBest(queryToggle(root));
}

/**
 * Browser: prove a nav drawer/dialog is open (ARIA or large overlay geometry).
 * @param {string|null|{hamburgerSelector?: string|null, sectionRootSelector?: string|null}} arg
 * @returns {{ open: boolean, drawerSelector: string|null, heightRatio: number }}
 */
function probeNavDrawerOpenInBrowser(arg) {
  const hamburgerSelector = typeof arg === 'string' || arg == null ? arg : arg?.hamburgerSelector;
  const sectionRootSelector = typeof arg === 'object' && arg ? arg.sectionRootSelector : null;

  const resolveRoot = (sel) => {
    if (!sel) return null;
    try {
      const hit = document.querySelector(sel);
      if (hit instanceof HTMLElement) return hit;
    } catch {
      /* ignore */
    }
    const softened = String(sel)
      .replace(/\.(sticky|fixed|scrolled|is-sticky|is-fixed|is-scrolled|stuck|pinned)\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (softened && softened !== sel) {
      try {
        const hit = document.querySelector(softened);
        if (hit instanceof HTMLElement) return hit;
      } catch {
        /* ignore */
      }
    }
    try {
      const marked = document.querySelector('[data-bq-chrome-capture="1"]');
      if (marked instanceof HTMLElement) return marked;
    } catch {
      /* ignore */
    }
    return null;
  };

  const sectionRoot = resolveRoot(sectionRootSelector);

  const cssPath = (el) => {
    if (!(el instanceof Element)) return '';
    if (el.id && !/\d{4,}/.test(el.id) && (() => { try { return document.querySelectorAll(`#${CSS.escape(el.id)}`).length; } catch { return 99; } })() <= 1) return `#${CSS.escape(el.id)}`;
    const parts = [];
    let cur = el;
    for (let i = 0; i < 6 && cur && cur.nodeType === 1 && cur !== document.body; i++) {
      let part = cur.tagName.toLowerCase();
      if (cur.id && !/\d{4,}/.test(cur.id) && (() => { try { return document.querySelectorAll(`#${CSS.escape(cur.id)}`).length; } catch { return 99; } })() <= 1) {
        parts.unshift(`#${CSS.escape(cur.id)}`);
        break;
      }
      const stable = [...cur.classList]
        .filter((c) => c && !/^(is-|has-|js-|active|open|selected|current|hover)/i.test(c))
        .slice(0, 2);
      if (stable.length) part += stable.map((c) => `.${CSS.escape(c)}`).join('');
      const parent = cur.parentElement;
      if (parent && !stable.length) {
        const siblings = [...parent.children].filter((c) => c.tagName === cur.tagName);
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(cur) + 1})`;
      }
      parts.unshift(part);
      cur = parent;
    }
    return parts.join(' > ');
  };

  const expandedBox = (el) => {
    if (!(el instanceof HTMLElement)) return null;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    const consider = (node) => {
      if (!(node instanceof HTMLElement)) return;
      const st = window.getComputedStyle(node);
      if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return;
      const r = node.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      x0 = Math.min(x0, r.x);
      y0 = Math.min(y0, r.y);
      x1 = Math.max(x1, r.x + r.width);
      y1 = Math.max(y1, r.y + r.height);
    };
    consider(el);
    el.querySelectorAll('*').forEach(consider);
    if (!Number.isFinite(x0)) return null;
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  };

  const vh = window.innerHeight || 1;
  const vw = window.innerWidth || 1;
  /** @type {HTMLElement|null} */
  let bestEl = null;
  let bestRatio = 0;
  let bestInSection = false;

  const considerCandidate = (el) => {
    if (!(el instanceof HTMLElement)) return;
    const inSection = sectionRoot
      ? sectionRoot === el || sectionRoot.contains(el)
      : true;
    // When a section root is known, ignore foreign page landmarks (hero nav, etc.)
    if (sectionRoot && !inSection) return;

    const st = window.getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return;
    if (el.getAttribute('aria-hidden') === 'true') return;
    if (el.hasAttribute('hidden')) return;
    // Nested content inside a closed aria-hidden shell (common mega *Content)
    if (el.closest('[aria-hidden="true"]')) return;
    const box = expandedBox(el);
    if (!box) return;
    // Thin header chrome is not a drawer
    if (box.height < vh * 0.35) return;
    const ratio = box.height / vh;
    const pos = st.position;
    const looksOverlay =
      pos === 'fixed' ||
      pos === 'absolute' ||
      el.getAttribute('role') === 'dialog' ||
      /drawer|sheet|offcanvas|nav.*panel|mobile.*nav|menu.*panel|mega|dropdown|is-open/i.test(
        `${el.id} ${el.className?.toString?.() || ''}`,
      );
    // Do not treat generic role=navigation as a drawer (hero tabs, etc.)
    if (!looksOverlay && ratio < 0.6) return;
    // Closed mega panels often keep a large layout box — require open signals
    const openSignal =
      el.classList.contains('is-open') ||
      /is-open|is-active|is-visible|is-expanded/i.test(String(el.className || '')) ||
      el.getAttribute('aria-hidden') === 'false' ||
      el.getAttribute('data-open') === 'true' ||
      (pos === 'fixed' && ratio >= 0.85 && el.querySelectorAll('a[href], button').length >= 5);
    if (/mega|DropDown|dropdown/i.test(String(el.className || '')) && !openSignal) return;
    if (ratio > bestRatio || (ratio >= bestRatio && inSection && !bestInSection)) {
      bestRatio = ratio;
      bestEl = el;
      bestInSection = inSection;
    }
  };

  try {
    const btn = hamburgerSelector ? document.querySelector(hamburgerSelector) : null;
    if (btn instanceof HTMLElement) {
      const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (/close menu/i.test(aria) || btn.getAttribute('aria-expanded') === 'true') {
        const id = btn.getAttribute('aria-controls');
        if (id) {
          const controlled = document.getElementById(id);
          if (controlled) considerCandidate(controlled);
        }
      }
    }
  } catch {
    /* ignore */
  }

  const searchRoot = sectionRoot || document;
  for (const el of searchRoot.querySelectorAll(
    '[role="dialog"], [aria-modal="true"], [class*="drawer" i], [class*="offcanvas" i], [class*="sheet" i], [class*="mega" i], [class*="dropdown" i], .is-open, [class*="is-open" i], [id$="-content"], [id*="mobile" i][id*="nav" i], [id*="nav" i][id*="menu" i]',
  )) {
    considerCandidate(el);
  }

  // Fixed/absolute large overlays — scoped to section when possible
  const overlayScanRoot = sectionRoot || document.body;
  for (const el of overlayScanRoot.querySelectorAll('*')) {
    if (!(el instanceof HTMLElement)) continue;
    const st = window.getComputedStyle(el);
    if (st.position !== 'fixed' && st.position !== 'absolute') continue;
    const r = el.getBoundingClientRect();
    if (r.width < vw * 0.4 || r.height < vh * 0.5) continue;
    considerCandidate(el);
  }

  const open = bestRatio >= 0.55 || (bestEl && bestRatio >= 0.35);
  return {
    open: Boolean(open),
    drawerSelector: bestEl ? cssPath(bestEl) : null,
    heightRatio: bestRatio,
  };
}

/** @param {string|null|undefined} hamburgerSelector @param {string|null|undefined} sectionRootSelector */
function probeDrawerArg(hamburgerSelector, sectionRootSelector) {
  return {
    hamburgerSelector: hamburgerSelector || null,
    sectionRootSelector: sectionRootSelector || null,
  };
}

async function isTriggerVisible(page, selector) {
  if (!selector) return false;
  return page.evaluate((sel) => {
    try {
      const nodes = document.querySelectorAll(sel);
      for (const el of nodes) {
        if (!(el instanceof HTMLElement)) continue;
        const st = window.getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) {
          continue;
        }
        const r = el.getBoundingClientRect();
        if (r.width >= 8 && r.height >= 8) return true;
      }
      return false;
    } catch {
      return false;
    }
  }, selector);
}

/**
 * On narrow viewports, open the hamburger / nav drawer so L1 items become reachable.
 * Requires geometric/ARIA proof of open — does not claim success for a closed header.
 * @returns {Promise<{ opened: boolean, hamburgerSelector: string|null, drawerSelector: string|null, note: string|null }>}
 */
async function ensureNavChromeOpen(page, sectionSelector, device, l1Selector) {
  const narrow = device === 'tablet' || device === 'mobile';
  if (!narrow) {
    return { opened: false, hamburgerSelector: null, drawerSelector: null, note: null };
  }

  // Dismiss CMP overlays that block hamburger / drawer (OneTrust / Osano / generic)
  await acceptCookieConsent(page).catch(() => {});
  await page
    .evaluate(() => {
      document.querySelector('#onetrust-accept-btn-handler')?.click();
      // Prefer explicit accept controls (never click Osano "Save" alone — it can open prefs)
      const acceptRe =
        /^(accept(\s+all(\s+cookies)?)?|accepteer(\s+alles)?|alle cookies accepteren|ik aanvaard( de)? cookies|allow all|i agree|agree|akkoord|tout accepter|j['’]accepte|accepter( tout)?|alle akzeptieren|akzeptieren)$/i;
      const accept =
        document.querySelector('.osano-cm-accept-all') ||
        document.querySelector('#onetrust-accept-btn-handler') ||
        [...document.querySelectorAll('button, a, [role="button"]')].find((el) => {
          const t = (el.innerText || el.getAttribute('aria-label') || '')
            .replace(/\s+/g, ' ')
            .trim();
          return acceptRe.test(t);
        });
      if (accept instanceof HTMLElement) accept.click();
      for (const el of document.querySelectorAll('button, a, [role="button"]')) {
        const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
        if (acceptRe.test(t)) {
          el.click();
          break;
        }
      }
      // Close lingering Osano dialog / info panel if still covering the page
      const closePrefs = document.querySelector(
        '.osano-cm-info-dialog-header__close, button[aria-label="Close Cookie Preferences"]',
      );
      if (closePrefs instanceof HTMLElement) {
        const dlg = closePrefs.closest('.osano-cm-info-dialog');
        if (dlg && !dlg.classList.contains('osano-cm-info-dialog--hidden')) {
          closePrefs.click();
        }
      }
      const closeBanner = document.querySelector(
        '.osano-cm-dialog__close, button[aria-label="Close this consent banner"]',
      );
      if (closeBanner instanceof HTMLElement) {
        const banner = closeBanner.closest('.osano-cm-dialog');
        if (banner && getComputedStyle(banner).display !== 'none') {
          const stillVisible = banner.getBoundingClientRect().height > 40;
          if (stillVisible && !document.querySelector('.osano-cm-accept-all')) {
            closeBanner.click();
          }
        }
      }
    })
    .catch(() => {});
  await page.waitForTimeout(250);

  // On narrow viewports, never treat desktop primary-link selectors as "L1 already
  // reachable" — they often remain in the DOM (hidden) and skip the hamburger.
  // Only skip the hamburger when an open drawer already exposes the L1 label.
  const probeBefore = await page
    .evaluate(probeNavDrawerOpenInBrowser, probeDrawerArg(null, sectionSelector))
    .catch(() => null);
  if (probeBefore?.open && l1Selector) {
    const l1InOpenDrawer = await page.evaluate(
      ({ drawerSel, l1Sel, want }) => {
        const drawer = (() => {
          try {
            return document.querySelector(drawerSel);
          } catch {
            return null;
          }
        })();
        if (!(drawer instanceof Element)) return false;
        try {
          const preferred = document.querySelector(l1Sel);
          if (preferred && drawer.contains(preferred)) {
            const st = window.getComputedStyle(preferred);
            const r = preferred.getBoundingClientRect();
            if (
              st.display !== 'none' &&
              st.visibility !== 'hidden' &&
              Number(st.opacity) > 0 &&
              r.width >= 8 &&
              r.height >= 8
            ) {
              return true;
            }
          }
        } catch {
          /* ignore */
        }
        if (!want) return false;
        const norm = (s) =>
          String(s || '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
        const target = norm(want);
        for (const el of drawer.querySelectorAll('button, a, [role="menuitem"]')) {
          if (!(el instanceof HTMLElement)) continue;
          const st = window.getComputedStyle(el);
          if (st.display === 'none' || st.visibility === 'hidden') continue;
          const r = el.getBoundingClientRect();
          if (r.width < 8 || r.height < 8) continue;
          const text = norm(el.getAttribute('aria-label') || el.textContent);
          if (text === target || text.startsWith(target)) return true;
        }
        return false;
      },
      {
        drawerSel: probeBefore.drawerSelector,
        l1Sel: l1Selector,
        want: null,
      },
    );
    if (l1InOpenDrawer) {
      return {
        opened: true,
        hamburgerSelector: null,
        drawerSelector: probeBefore.drawerSelector || null,
        note: null,
      };
    }
  }

  const found = await page.evaluate(findHamburgerInBrowser, sectionSelector);
  if (!found?.selector) {
    return {
      opened: false,
      hamburgerSelector: null,
      drawerSelector: null,
      note: `${device}: hamburger-or-skip-if-unavailable`,
    };
  }

  let hamburgerSelector = found.selector;

  /** Soft proof: Close/Open-menu aria OR tall nav content (selector may go stale after open). */
  const softProveDrawer = async () =>
    page
      .evaluate(
        ({ hamSel, rootSel }) => {
          try {
            const root = rootSel ? document.querySelector(rootSel) : document;
            const scope = root || document;
            const isVis = (el) => {
              if (!(el instanceof HTMLElement)) return false;
              const st = window.getComputedStyle(el);
              if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) < 0.1) {
                return false;
              }
              const r = el.getBoundingClientRect();
              return r.width >= 8 && r.height >= 8;
            };
            let closeHit = false;
            let openHit = false;
            let hamExpanded = false;
            try {
              const btn = hamSel ? document.querySelector(hamSel) : null;
              if (btn && isVis(btn)) {
                const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
                hamExpanded =
                  btn.getAttribute('aria-expanded') === 'true' || /close menu/i.test(aria);
              }
            } catch {
              /* stale selector */
            }
            for (const el of scope.querySelectorAll('button, [role="button"], a')) {
              if (!isVis(el)) continue;
              const t = (el.getAttribute('aria-label') || el.textContent || '')
                .replace(/\s+/g, ' ')
                .trim()
                .toLowerCase();
              if (/^close menu$/i.test(t)) closeHit = true;
              if (/^open menu$/i.test(t)) openHit = true;
            }
            // Drawer signal: Close menu visible, or hamburger expanded (Open gone / Close present)
            const drawerSignal = closeHit || hamExpanded || (hamExpanded && !openHit);
            const vh = window.innerHeight || 1;
            const vw = window.innerWidth || 1;
            let best = null;
            let bestH = 0;
            for (const el of scope.querySelectorAll(
              [
                '[class*="NavContent" i]',
                '[class*="nav__content" i]',
                '[class*="MainNavNavContent" i]',
                '[class*="drawer" i]',
                '[class*="offcanvas" i]',
                '[role="dialog"]',
                'nav',
              ].join(', '),
            )) {
              if (!(el instanceof HTMLElement)) continue;
              if (el.getAttribute('aria-hidden') === 'true') continue;
              if (el.closest('[aria-hidden="true"]')) continue;
              if (!isVis(el)) continue;
              const r = el.getBoundingClientRect();
              // Tall panel: ≥35% viewport (chrome-capture relative layouts can be shorter)
              if (r.width < vw * 0.35 || r.height < vh * 0.35) continue;
              if (r.height > bestH) {
                bestH = r.height;
                best = el;
              }
            }
            // Close-menu alone is enough when the L0 list is mid-size (items list < 35% vh)
            if (!best && drawerSignal) {
              for (const el of scope.querySelectorAll(
                '[class*="NavContent" i], [class*="nav__content" i], [class*="ContentItems" i]',
              )) {
                if (!(el instanceof HTMLElement) || !isVis(el)) continue;
                const r = el.getBoundingClientRect();
                if (r.width < vw * 0.35 || r.height < 80) continue;
                if (r.height > bestH) {
                  bestH = r.height;
                  best = el;
                }
              }
            }
            if (!drawerSignal && !best) return null;
            if (!best && drawerSignal) return { open: true, drawerSelector: null };
            const cssPath = (el) => {
              if (!(el instanceof Element)) return '';
              if (el.id && !/\d{4,}/.test(el.id) && (() => { try { return document.querySelectorAll(`#${CSS.escape(el.id)}`).length; } catch { return 99; } })() <= 1) return `#${CSS.escape(el.id)}`;
              const parts = [];
              let cur = el;
              for (let i = 0; i < 6 && cur && cur !== document.body; i++) {
                let part = cur.tagName.toLowerCase();
                if (cur.id && !/\d{4,}/.test(cur.id) && (() => { try { return document.querySelectorAll(`#${CSS.escape(cur.id)}`).length; } catch { return 99; } })() <= 1) {
                  parts.unshift(`#${CSS.escape(cur.id)}`);
                  break;
                }
                const parent = cur.parentElement;
                if (parent) {
                  const siblings = [...parent.children].filter((c) => c.tagName === cur.tagName);
                  if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(cur) + 1})`;
                }
                const cls = [...cur.classList]
                  .filter((c) => c && !/^(is-|has-|js-|active|open)/i.test(c))
                  .slice(0, 2);
                if (cls.length) part += cls.map((c) => `.${CSS.escape(c)}`).join('');
                parts.unshift(part);
                cur = parent;
              }
              return parts.join(' > ');
            };
            return { open: true, drawerSelector: best ? cssPath(best) : null };
          } catch {
            return null;
          }
        },
        { hamSel: hamburgerSelector, rootSel: sectionSelector },
      )
      .catch(() => null);

  const clickHamburgerOpen = async () => {
    // If finder thinks already open, verify soft proof — stale Close aria is common
    if (found.alreadyOpen) {
      const soft = await softProveDrawer();
      if (soft?.open) return true;
      // Fall through: re-find Open menu and click
      const reopen = await page.evaluate(findHamburgerInBrowser, sectionSelector);
      if (reopen?.selector && !reopen.alreadyOpen) {
        hamburgerSelector = reopen.selector;
      }
    }
    // Prefer in-page click — Playwright locators break when CSS-module paths go stale mid-click
    const evalClicked = await page
      .evaluate((sel) => {
        try {
          let el = sel ? document.querySelector(sel) : null;
          if (!(el instanceof HTMLElement)) {
            el =
              document.querySelector('button[aria-label*="Open menu" i]') ||
              document.querySelector('button[aria-label*="open menu" i]');
          }
          if (!(el instanceof HTMLElement)) return false;
          const aria = (el.getAttribute('aria-label') || '').toLowerCase();
          if (/close menu/i.test(aria) || el.getAttribute('aria-expanded') === 'true') {
            return true; // already open
          }
          el.click();
          return true;
        } catch {
          return false;
        }
      }, hamburgerSelector)
      .catch(() => false);
    if (evalClicked) return true;
    return activateTrigger(page, { selector: hamburgerSelector, method: 'click' });
  };

  const waitForOpenProof = async (timeoutMs) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const softOpen = await softProveDrawer();
      if (softOpen?.open) {
        return {
          opened: true,
          drawerSelector: softOpen.drawerSelector || null,
          l1Visible: await isTriggerVisible(page, l1Selector),
        };
      }
      const probe = await page
        .evaluate(probeNavDrawerOpenInBrowser, probeDrawerArg(hamburgerSelector, sectionSelector))
        .catch(() => null);
      if (probe?.open) {
        return {
          opened: true,
          drawerSelector: probe.drawerSelector || null,
          l1Visible: await isTriggerVisible(page, l1Selector),
        };
      }
      // L1 visible alone is not proof (desktop L1 can retain geometry while drawer closed)
      if (await isTriggerVisible(page, l1Selector)) {
        const soft2 = await softProveDrawer();
        if (soft2?.open || probe?.open) {
          return {
            opened: true,
            drawerSelector: soft2?.drawerSelector || probe?.drawerSelector || null,
            l1Visible: true,
          };
        }
      }
      await page.waitForTimeout(100);
    }
    return { opened: false, drawerSelector: null, l1Visible: false };
  };

  let clicked = await clickHamburgerOpen();
  if (!clicked) {
    return {
      opened: false,
      hamburgerSelector,
      drawerSelector: null,
      note: `${device}: hamburger-click-failed`,
    };
  }

  let proof = await waitForOpenProof(3200);
  if (!proof.opened) {
    // Retry: re-resolve hamburger (DOM often reorders on first toggle) and click Open menu
    const again = await page.evaluate(findHamburgerInBrowser, sectionSelector);
    if (again?.selector) hamburgerSelector = again.selector;
    const retried = await page
      .evaluate((sel) => {
        try {
          const el =
            document.querySelector('button[aria-label*="Open menu" i]') ||
            (sel && document.querySelector(sel));
          if (!(el instanceof HTMLElement)) return false;
          const aria = (el.getAttribute('aria-label') || '').toLowerCase();
          // Already open — do not toggle closed
          if (/close menu/i.test(aria) || el.getAttribute('aria-expanded') === 'true') return true;
          el.click();
          return true;
        } catch {
          return false;
        }
      }, hamburgerSelector)
      .catch(() => false);
    if (!retried) {
      await activateTrigger(page, { selector: hamburgerSelector, method: 'click' }).catch(() => {});
    }
    proof = await waitForOpenProof(2400);
  }

  if (!proof.opened) {
    return {
      opened: false,
      hamburgerSelector,
      drawerSelector: null,
      note: `${device}: drawer-failed-to-open`,
    };
  }

  return {
    opened: true,
    hamburgerSelector,
    drawerSelector: proof.drawerSelector,
    note: proof.l1Visible ? null : `${device}: drawer-open-l1-selector-may-differ`,
  };
}

/**
 * If the recorded L1 selector is not visible (common after hamburger opens a
 * different DOM tree), find a same-label button/link in the section, drawer, or document.
 * When a drawer is open, prefer matches inside the drawer (avoid clicking a hidden desktop L1).
 */
async function resolveVisibleL1Selector(page, sectionSelector, preferredSelector, label, drawerSelector) {
  // Open drawer: resolve by label inside the drawer first (desktop L1 may still "look" visible)
  if (drawerSelector && label) {
    const inDrawer = await page.evaluate(
      ({ drawerSel, want }) => {
        const norm = (s) =>
          String(s || '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
        const target = norm(want);
        if (!target) return null;
        const drawer = (() => {
          try {
            return document.querySelector(drawerSel);
          } catch {
            return null;
          }
        })();
        if (!(drawer instanceof Element)) return null;
        const isVisible = (el) => {
          if (!(el instanceof HTMLElement)) return false;
          const st = window.getComputedStyle(el);
          if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) {
            return false;
          }
          const r = el.getBoundingClientRect();
          return r.width >= 8 && r.height >= 8;
        };
        const cssPath = (el) => {
          if (!(el instanceof Element)) return '';
          if (el.id && !/\d{4,}/.test(el.id) && (() => { try { return document.querySelectorAll(`#${CSS.escape(el.id)}`).length; } catch { return 99; } })() <= 1) return `#${CSS.escape(el.id)}`;
          const parts = [];
          let cur = el;
          for (let i = 0; i < 5 && cur && cur !== document.body; i++) {
            let part = cur.tagName.toLowerCase();
            if (cur.id && !/\d{4,}/.test(cur.id) && (() => { try { return document.querySelectorAll(`#${CSS.escape(cur.id)}`).length; } catch { return 99; } })() <= 1) {
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
        };
        for (const el of drawer.querySelectorAll('button, a, [role="menuitem"], [role="button"]')) {
          if (!isVisible(el)) continue;
          const text = norm(el.getAttribute('aria-label') || el.textContent);
          if (text === target || text.startsWith(target) || target.startsWith(text.slice(0, 24))) {
            return cssPath(el);
          }
        }
        return null;
      },
      { drawerSel: drawerSelector, want: label },
    );
    if (inDrawer) return inDrawer;
  }

  if (await isTriggerVisible(page, preferredSelector)) return preferredSelector;
  if (!label) return preferredSelector;
  const found = await page.evaluate(
    ({ rootSel, drawerSel, want }) => {
      const norm = (s) =>
        String(s || '')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();
      const target = norm(want);
      if (!target) return null;

      const isVisible = (el) => {
        if (!(el instanceof HTMLElement)) return false;
        const st = window.getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return false;
        const r = el.getBoundingClientRect();
        return r.width >= 8 && r.height >= 8;
      };

      const cssPath = (el) => {
        if (!(el instanceof Element)) return '';
        if (el.id && !/\d{4,}/.test(el.id) && (() => { try { return document.querySelectorAll(`#${CSS.escape(el.id)}`).length; } catch { return 99; } })() <= 1) return `#${CSS.escape(el.id)}`;
        const parts = [];
        let cur = el;
        for (let i = 0; i < 5 && cur && cur !== document.body; i++) {
          let part = cur.tagName.toLowerCase();
          if (cur.id && !/\d{4,}/.test(cur.id) && (() => { try { return document.querySelectorAll(`#${CSS.escape(cur.id)}`).length; } catch { return 99; } })() <= 1) {
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
      };

      const searchIn = (scope) => {
        if (!(scope instanceof Element) && scope !== document) return null;
        const host = scope === document ? document : scope;
        for (const el of host.querySelectorAll('button, a, [role="menuitem"], [role="button"]')) {
          if (!isVisible(el)) continue;
          const text = norm(el.getAttribute('aria-label') || el.textContent);
          if (text === target || text.startsWith(target) || target.startsWith(text.slice(0, 24))) {
            return cssPath(el);
          }
        }
        return null;
      };

      const drawer = drawerSel
        ? (() => {
            try {
              return document.querySelector(drawerSel);
            } catch {
              return null;
            }
          })()
        : null;
      const root = (() => {
        try {
          return document.querySelector(rootSel);
        } catch {
          return null;
        }
      })();

      return searchIn(drawer) || searchIn(root) || searchIn(document);
    },
    { rootSel: sectionSelector, drawerSel: drawerSelector || null, want: label },
  );
  return found || preferredSelector;
}

async function restoreDefaults(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.mouse.move(2, 2).catch(() => {});
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    document.querySelectorAll('details[open]').forEach((d) => {
      try {
        d.open = false;
      } catch {
        /* ignore */
      }
    });
  }).catch(() => {});
  // Escape / site JS often re-applies overlapping chrome — keep capture mode sticky
  await page.evaluate(reassertChromeCaptureModeInPage, null).catch(() => {});
}

/**
 * Browser: find the panel revealed by a trigger (aria-controls, sibling, nested submenu).
 * Prefers panels inside sectionRootSelector when provided.
 * @param {string|{triggerSelector: string, sectionRootSelector?: string|null}} arg
 * Returns a CSS path string or null.
 */
function resolveVisiblePanelInBrowser(arg) {
  const triggerSelector = typeof arg === 'string' ? arg : arg?.triggerSelector;
  const sectionRootSelector = typeof arg === 'string' ? null : arg?.sectionRootSelector || null;
  const trigger = (() => {
    try {
      return document.querySelector(triggerSelector);
    } catch {
      return null;
    }
  })();
  if (!(trigger instanceof Element)) return null;

  const sectionRoot = sectionRootSelector
    ? (() => {
        try {
          return document.querySelector(sectionRootSelector);
        } catch {
          return null;
        }
      })()
    : trigger.closest('header, nav, [role="banner"], [role="navigation"]') || null;

  const inSection = (el) => {
    if (!(el instanceof Element)) return false;
    if (!sectionRoot) return true;
    return sectionRoot === el || sectionRoot.contains(el);
  };

  const isShown = (el) => {
    if (!(el instanceof HTMLElement)) return false;
    const st = window.getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 8 && r.height >= 16;
  };

  const cssPath = (el) => {
    if (!(el instanceof Element)) return '';
    if (el.id) return `#${CSS.escape(el.id)}`;
    const parts = [];
    let cur = el;
    for (let i = 0; i < 6 && cur && cur.nodeType === 1 && cur !== document.body; i++) {
      let part = cur.tagName.toLowerCase();
      if (cur.id) {
        parts.unshift(`#${CSS.escape(cur.id)}`);
        break;
      }
      const stable = [...cur.classList]
        .filter((c) => c && !/^(is-|has-|js-|active|open|selected|current|hover)/i.test(c))
        .slice(0, 2);
      if (stable.length) part += stable.map((c) => `.${CSS.escape(c)}`).join('');
      const parent = cur.parentElement;
      if (parent && !stable.length) {
        const siblings = [...parent.children].filter((c) => c.tagName === cur.tagName);
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(cur) + 1})`;
      }
      parts.unshift(part);
      cur = parent;
    }
    return parts.join(' > ');
  };

  const id = trigger.getAttribute('aria-controls');
  if (id) {
    try {
      const controlled = document.getElementById(id);
      if (controlled && inSection(controlled)) {
        return controlled.id ? `#${CSS.escape(controlled.id)}` : cssPath(controlled);
      }
    } catch {
      /* ignore */
    }
  }

  const scope = trigger.closest('li') || trigger.parentElement || trigger;
  const nested = scope.querySelector(
    ':scope > ul, :scope > [class*="dropdown" i], :scope > [class*="mega" i], :scope > [class*="submenu" i], :scope > [class*="flyout" i], :scope > [class*="panel" i], :scope > [class*="content" i], :scope > [role="menu"]',
  );
  if (nested && isShown(nested) && inSection(nested)) return cssPath(nested);

  // Deep mega/drawer under the L1 item (common: li > div > div.mega…)
  const deepMega = scope.querySelector(
    '[class*="mega" i], [class*="DropDown" i], [class*="dropdown" i], [class*="flyout" i], [class*="drawer" i], [role="menu"]',
  );
  if (deepMega && isShown(deepMega) && inSection(deepMega)) {
    const dr = deepMega.getBoundingClientRect();
    if (dr.height >= 80 && dr.width >= 160) return cssPath(deepMega);
  }

  let sib = trigger.nextElementSibling;
  for (let i = 0; i < 4 && sib; i++) {
    if (isShown(sib) && inSection(sib)) {
      const sr = sib.getBoundingClientRect();
      const menuLike = /mega|dropdown|flyout|drawer|submenu|panel|menu/i.test(
        `${sib.className || ''} ${sib.getAttribute('role') || ''}`,
      );
      // Skip thin classless wrappers — prefer the section-wide mega scan below
      if (menuLike || sr.height >= 80) return cssPath(sib);
    }
    sib = sib.nextElementSibling;
  }

  // Prefer open mega/drawer panels inside the section root
  const searchRoot = sectionRoot || document;
  const near = searchRoot.querySelectorAll(
    '[role="menu"], [class*="mega" i], [class*="dropdown" i], [class*="submenu" i], [class*="flyout" i], [class*="DropDown" i], [class*="is-open" i], .is-open',
  );
  let best = null;
  let bestScore = 0;
  const tr = trigger.getBoundingClientRect();
  const vh = window.innerHeight || 900;
  for (const el of near) {
    if (!isShown(el) || !inSection(el)) continue;
    const r = el.getBoundingClientRect();
    // Skip tiny "is-open" chrome chips (open L1 label row)
    if (r.height < 48 && r.width < 200) continue;
    if (r.top + 80 < tr.top && r.height < vh * 0.4) continue;
    const area = r.width * r.height;
    const tallBonus = r.height >= vh * 0.25 ? 5_000_000 : r.height >= 120 ? 500_000 : 0;
    const megaBonus = /mega|dropdown|flyout|drawer|submenu|DropDown/i.test(String(el.className || ''))
      ? 1_000_000
      : 0;
    // Penalize open L1 row shells that contain the mega but are themselves short
    const shellPenalty = r.height < 64 && megaBonus === 0 ? -2_000_000 : 0;
    const score = area + tallBonus + megaBonus + shellPenalty;
    if (score > bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best ? cssPath(best) : null;
}

async function waitForPanelOpen(page, triggerSelector, panelSelector, timeoutMs = 2500, sectionRootSelector = null) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ready = await page.evaluate(
      ({ triggerSel, panelSel, rootSel }) => {
        const trigger = (() => {
          try {
            return document.querySelector(triggerSel);
          } catch {
            return null;
          }
        })();
        const expanded = trigger?.getAttribute('aria-expanded') === 'true';
        if (!panelSel) {
          // No panel selector yet — accept expanded only after a short paint
          return expanded;
        }
        try {
          const root = rootSel
            ? (() => {
                try {
                  return document.querySelector(rootSel);
                } catch {
                  return null;
                }
              })()
            : null;
          let panel = null;
          if (root) {
            try {
              panel = root.querySelector(panelSel);
            } catch {
              panel = null;
            }
          }
          if (!panel) {
            try {
              const docHit = document.querySelector(panelSel);
              if (docHit && (!root || root === docHit || root.contains(docHit))) panel = docHit;
            } catch {
              panel = null;
            }
          }
          if (!(panel instanceof HTMLElement)) return false;
          const st = window.getComputedStyle(panel);
          if (st.display === 'none' || st.visibility === 'hidden') return false;
          // Union visible descendants — mega content is often abspos inside a small shell
          let maxBottom = panel.getBoundingClientRect().bottom;
          let minTop = panel.getBoundingClientRect().top;
          let maxRight = panel.getBoundingClientRect().right;
          let minLeft = panel.getBoundingClientRect().left;
          for (const node of panel.querySelectorAll('*')) {
            if (!(node instanceof HTMLElement)) continue;
            const cs = window.getComputedStyle(node);
            if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
            const r = node.getBoundingClientRect();
            if (r.width < 4 || r.height < 4) continue;
            minTop = Math.min(minTop, r.top);
            minLeft = Math.min(minLeft, r.left);
            maxBottom = Math.max(maxBottom, r.bottom);
            maxRight = Math.max(maxRight, r.right);
          }
          const h = maxBottom - minTop;
          const w = maxRight - minLeft;
          return h >= 80 && w >= 120;
        } catch {
          return false;
        }
      },
      { triggerSel: triggerSelector, panelSel: panelSelector, rootSel: sectionRootSelector },
    );
    if (ready) {
      await page.waitForTimeout(120); // settle fade-in
      return true;
    }
    await page.waitForTimeout(80);
  }
  return false;
}

/**
 * Browser-side: panel has enough visible text/links to count as real menu content
 * (not an empty expanded shell / blank mega leaf).
 */
function panelHasRenderableContentInBrowser({ panelSel, rootSel, minLinks = 3, minText = 80 }) {
  try {
    const root = rootSel
      ? (() => {
          try {
            return document.querySelector(rootSel);
          } catch {
            return null;
          }
        })()
      : null;
    let panel = null;
    if (root) {
      try {
        panel = root.querySelector(panelSel);
      } catch {
        panel = null;
      }
    }
    if (!panel) {
      try {
        const docHit = document.querySelector(panelSel);
        if (docHit && (!root || root === docHit || root.contains(docHit))) panel = docHit;
      } catch {
        panel = null;
      }
    }
    if (!(panel instanceof HTMLElement)) return false;
    const st = window.getComputedStyle(panel);
    if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) {
      return false;
    }
    const vh = window.innerHeight || 1;
    const vw = window.innerWidth || 1;
    const pr = panel.getBoundingClientRect();
    // Must intersect viewport meaningfully
    if (pr.bottom < 8 || pr.top > vh - 8 || pr.right < 8 || pr.left > vw - 8) return false;

    let links = 0;
    let textLen = 0;
    let visibleInk = 0;
    const consider = (el) => {
      if (!(el instanceof HTMLElement)) return;
      const cs = window.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      // Count only in/near viewport ink (ignore off-screen desktop mega leaves)
      if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) return;
      visibleInk += 1;
      if (el.matches('a[href], button, [role="button"]')) links += 1;
      if (el.childElementCount === 0 || el.matches('p, span, li, h1, h2, h3, h4, a, button, label')) {
        textLen += (el.textContent || '').replace(/\s+/g, ' ').trim().length;
      }
    };
    consider(panel);
    panel.querySelectorAll('*').forEach(consider);
    textLen = Math.min(textLen, 4000);
    return visibleInk >= 4 && (links >= minLinks || textLen >= minText);
  } catch {
    return false;
  }
}

async function panelHasRenderableContent(page, panelSelector, sectionSelector = null, opts = {}) {
  if (!panelSelector) return false;
  return page
    .evaluate(panelHasRenderableContentInBrowser, {
      panelSel: panelSelector,
      rootSel: sectionSelector,
      minLinks: opts.minLinks ?? 3,
      minText: opts.minText ?? 80,
    })
    .catch(() => false);
}

async function waitForPanelContent(page, panelSelector, sectionSelector, timeoutMs = 2000) {
  if (!panelSelector) return false;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await panelHasRenderableContent(page, panelSelector, sectionSelector)) {
      await page.waitForTimeout(150);
      return true;
    }
    await page.waitForTimeout(100);
  }
  return false;
}

/**
 * Browser-side: narrow L1 nested open — go-back OR L0 list replaced by nested content.
 * Must NOT treat the L0 primary link list as nested (site-agnostic).
 */
function proveNarrowNestedMenuOpenInBrowser({ rootSel, drawerSel, labelHint, debug = false }) {
  const norm = (s) =>
    String(s || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  const root = (() => {
    try {
      return rootSel ? document.querySelector(rootSel) : null;
    } catch {
      return null;
    }
  })();
  const scope = (() => {
    if (drawerSel) {
      try {
        const d = document.querySelector(drawerSel);
        if (d instanceof HTMLElement) return d;
      } catch {
        /* ignore */
      }
    }
    if (root instanceof HTMLElement) return root;
    try {
      return (
        document.querySelector('[class*="__menu"].is-open, [class*="__menu"][aria-hidden="false"]') ||
        document.querySelector('[class*="Header" i] nav, [class*="header" i] nav') ||
        document.querySelector('[class*="Header" i], [class*="header" i]')
      );
    } catch {
      return null;
    }
  })();
  if (!(scope instanceof HTMLElement)) return debug ? { ok: false, reason: 'no-scope' } : false;

  const vh = window.innerHeight || 1;
  const vw = window.innerWidth || 1;

  const inViewport = (r) =>
    r.width >= 8 &&
    r.height >= 8 &&
    r.bottom > 4 &&
    r.top < vh - 4 &&
    r.right > 4 &&
    r.left < vw - 4;

  const isShown = (el) => {
    if (!(el instanceof HTMLElement)) return false;
    if (el.closest('[aria-hidden="true"]')) return false;
    const st = window.getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) < 0.1) {
      return false;
    }
    if (st.pointerEvents === 'none') return false;
    return inViewport(el.getBoundingClientRect());
  };

  // Known L0 keyword packs (NL + common EN mega roots) — optional boost to peer count
  const l0KeywordPacks = [
    ['voertuigen', 'aankoop', 'elektrisch', 'onderhoud', 'wereld van'],
    ['platform', 'solutions', 'partners', 'resources', 'company'],
    ['products', 'solutions', 'developers', 'company', 'pricing'],
    ['shop', 'learn', 'support', 'about', 'account'],
  ];

  // 1) On-screen go-back (not off-canvas sibling)
  let hasBack = false;
  let backText = '';
  for (const el of scope.querySelectorAll(
    'button, a, [role="button"], [class*="back" i], [class*="Back" i]',
  )) {
    if (!isShown(el)) continue;
    const aria = norm(el.getAttribute('aria-label') || '');
    const raw = (el.innerText || '').replace(/\s+/g, ' ').trim();
    const firstLine = norm(raw.split('\n')[0] || raw).slice(0, 40);
    const t = aria || firstLine;
    if (
      /^(terug|go\s*back|retour|back|alle\s+menu|main\s+menu|close\s+submenu)\b/i.test(t) &&
      t.length < 28
    ) {
      hasBack = true;
      backText = t;
      break;
    }
  }

  // 2) Count visible primary L0 peer rows (short top-level nav buttons/links)
  const peerLabels = [];
  const peerSeen = new Set();
  for (const el of scope.querySelectorAll('button, a, [role="menuitem"], [role="button"]')) {
    if (!isShown(el)) continue;
    const r = el.getBoundingClientRect();
    // Primary L0 rows: full-width-ish list items, not tiny icons / CTAs
    if (r.height < 28 || r.height > 72) continue;
    if (r.width < Math.min(160, vw * 0.35)) continue;
    const text = norm(el.innerText || el.getAttribute('aria-label') || '');
    if (!text || text.length < 2 || text.length > 36) continue;
    // Skip utility chrome
    if (
      /^(search|zoek|sluiten|close|menu|request a demo|sign in|log in|en|nl|fr|de)\b/i.test(text) ||
      /cookie|accepteer|accept all|demo/i.test(text)
    ) {
      continue;
    }
    // Skip multi-line blocks (nested cards)
    if ((el.innerText || '').split('\n').filter((l) => l.trim()).length > 2) continue;
    if (peerSeen.has(text)) continue;
    peerSeen.add(text);
    peerLabels.push(text);
  }
  const l0PeerCount = peerLabels.length;

  // Keyword-pack hits (legacy + EN)
  let visibleText = '';
  for (const el of scope.querySelectorAll(
    'a, button, [role="button"], h1, h2, h3, h4, li, span, p',
  )) {
    if (!isShown(el)) continue;
    if (el.childElementCount > 3) continue;
    const t = norm(el.innerText || '').slice(0, 60);
    if (t) visibleText += ` ${t}`;
    if (visibleText.length > 1200) break;
  }
  const bodyText = visibleText || '';
  let l0Hits = 0;
  for (const pack of l0KeywordPacks) {
    const hits = pack.filter((k) => bodyText.includes(k) || peerLabels.some((p) => p.includes(k))).length;
    if (hits > l0Hits) l0Hits = hits;
  }

  // Classic top-nav peer labels (EN + NL packs) — if several remain on-screen, still L0
  const classicL0Re =
    /^(platform|solutions|partners|resources|company|products|developers|pricing|shop|learn|support|about|voertuigen|aankoop|financiering|elektrisch|hybride|onderhoud|services|de wereld van renault)$/i;
  const classicL0Peers = peerLabels.filter((p) => classicL0Re.test(p));
  const classicL0Count = classicL0Peers.length;

  // 3) Open mega/drawer panel in viewport
  /** @type {HTMLElement|null} */
  let openMega = null;
  for (const el of scope.querySelectorAll(
    '[class*="megaDropDown" i], [class*="MegaDropDown" i], [class*="drawer" i], [class*="offcanvas" i], [class*="submenu" i], [class*="ItemContent" i], [class*="item__content" i]',
  )) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.getAttribute('aria-hidden') === 'true') continue;
    const st = window.getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) < 0.1) continue;
    const r = el.getBoundingClientRect();
    if (r.width < vw * 0.5 || r.height < vh * 0.35) continue;
    if (r.left >= vw * 0.4) continue;
    if (r.right <= vw * 0.2) continue;
    openMega = el;
    break;
  }

  const countRoot = openMega || scope;
  let carImages = 0;
  let filterChips = 0;
  let modelTitles = 0;
  let nestedHeadings = 0;
  const hint = norm(labelHint);
  for (const el of countRoot.querySelectorAll(
    'img, button, a, [role="button"], h2, h3, h4, p, span',
  )) {
    if (!isShown(el)) continue;
    if (el.matches('img')) {
      const r = el.getBoundingClientRect();
      if (r.width >= 100 && r.height >= 60) carImages += 1;
      continue;
    }
    const text = norm(el.innerText || el.getAttribute('aria-label') || '');
    if (!text) continue;
    const blob = String(el.className || '');
    const r = el.getBoundingClientRect();
    if (
      r.height <= 48 &&
      r.width <= 180 &&
      text.length <= 28 &&
      /chip|filter|pill|tag|badge|energyButton|Accordion__trigger/i.test(blob)
    ) {
      filterChips += 1;
    }
    if (
      el.matches('h2, h3, h4, p, span, a') &&
      text.length >= 4 &&
      text.length <= 32 &&
      text === text.toUpperCase() &&
      !/VOERTUIGEN|AANKOOP|ELEKTRISCH|ONDERHOUD|WERELD|PLATFORM|SOLUTIONS|PARTNERS|RESOURCES|COMPANY|PARTICULIEREN|PROFESSIONALS|ZOEK|MENU|SLUITEN|NETWERK|CONTACT|SEARCH|REQUEST/i.test(
        text,
      )
    ) {
      modelTitles += 1;
      nestedHeadings += 1;
    }
    // Nested section labels (Capabilities, Services, …) even when not ALL CAPS in CSS
    if (
      el.matches('h2, h3, h4, [class*="heading" i], [class*="title" i]') &&
      text.length >= 4 &&
      text.length <= 40 &&
      hint &&
      !peerLabels.includes(text)
    ) {
      nestedHeadings += 1;
    }
  }

  // Nested content: label hint gone as a peer row, or rich submenu headings/links present
  const hintStillPeer = hint.length >= 3 && peerLabels.some((p) => p === hint || p.startsWith(hint));
  const nestedContentRich =
    nestedHeadings >= 2 ||
    (modelTitles >= 2 && carImages >= 1) ||
    (carImages >= 3 && filterChips >= 2);

  // Still on L0 when ≥3 classic peers remain and nested mega/content is not showing.
  // hasBack alone must not clear this (false positives while L0 list is still painted).
  const stillOnL0 =
    classicL0Count >= 3 && !nestedContentRich && !openMega;

  const diag = {
    hasBack,
    backText,
    l0Hits,
    l0PeerCount,
    classicL0Count,
    peerSample: peerLabels.slice(0, 6).join('|'),
    carImages,
    filterChips,
    modelTitles,
    nestedHeadings,
    stillOnL0,
    openMega: Boolean(openMega),
    scopeTag: scope.tagName,
    scopeClass: String(scope.className || '').slice(0, 80),
    bodySample: bodyText.slice(0, 160),
  };

  // Hard L0 veto first — never accept focused L0 list as nested
  if (stillOnL0) {
    return debug ? { ok: false, reason: 'l0-veto', ...diag } : false;
  }

  // Back only counts when L0 peers have largely left (or nested panel is open)
  if (hasBack && (classicL0Count < 3 || Boolean(openMega) || nestedContentRich)) {
    return debug ? { ok: true, reason: 'back', ...diag } : true;
  }

  // Open mega only if we're no longer on the L0 peer list
  if (openMega && nestedContentRich && !hintStillPeer) {
    return debug ? { ok: true, reason: 'open-mega', ...diag } : true;
  }

  if (carImages >= 4 && (filterChips >= 2 || modelTitles >= 2)) {
    return debug ? { ok: true, reason: 'gallery', ...diag } : true;
  }
  if (carImages >= 3 && filterChips >= 3) {
    return debug ? { ok: true, reason: 'cars+filters', ...diag } : true;
  }
  if (modelTitles >= 4 && carImages >= 2) {
    return debug ? { ok: true, reason: 'models', ...diag } : true;
  }

  // Label drilled: hint no longer a peer, nested headings/links visible
  if (hint.length >= 3 && !hintStillPeer && (nestedHeadings >= 1 || nestedContentRich)) {
    return debug ? { ok: true, reason: 'hint-drilled', ...diag } : true;
  }

  return debug ? { ok: false, reason: 'no-signal', ...diag } : false;
}

/**
 * Hide dialogs, product teasers, and dimmer backdrops that are not the menu panel.
 * Leaves chrome + panel (and their ancestors) visible.
 */
function hideNonMenuOverlaysInPage({ sectionSel, panelSel }) {
  const section = (() => {
    try {
      return sectionSel ? document.querySelector(sectionSel) : null;
    } catch {
      return null;
    }
  })();
  const panel = (() => {
    if (!panelSel) return null;
    try {
      if (section) {
        const scoped = section.querySelector(panelSel);
        if (scoped) return scoped;
      }
      const docHit = document.querySelector(panelSel);
      if (docHit && section && !(section === docHit || section.contains(docHit))) return null;
      return docHit;
    } catch {
      return null;
    }
  })();

  const keep = new Set();
  const markKeep = (el) => {
    let cur = el;
    while (cur && cur !== document.documentElement) {
      keep.add(cur);
      cur = cur.parentElement;
    }
  };
  markKeep(section);
  markKeep(panel);
  if (section instanceof HTMLElement) {
    for (const el of section.querySelectorAll(
      '[class*="mega" i], [class*="DropDown" i], [class*="drawer" i], [class*="__menu" i]',
    )) {
      if (!(el instanceof HTMLElement)) continue;
      if (el.getAttribute('aria-hidden') === 'true') continue;
      const st = window.getComputedStyle(el);
      if (st.display === 'none' || Number(st.opacity) === 0) continue;
      const r = el.getBoundingClientRect();
      if (r.width >= 80 && r.height >= 80) markKeep(el);
    }
  }

  const hide = (el) => {
    if (!(el instanceof HTMLElement)) return;
    if (keep.has(el)) return;
    if (panel && (el === panel || panel.contains(el) || el.contains(panel))) return;
    if (section && (el === section || el.contains(section))) return;
    if (el.dataset.bqMenuOverlayHide === '1' || el.dataset.bqFloatHidden === '1') return;
    el.dataset.bqMenuOverlayHide = '1';
    el.dataset.bqMenuOverlayPrevVis = el.style.visibility || '';
    el.dataset.bqMenuOverlayPrevOp = el.style.opacity || '';
    el.dataset.bqMenuOverlayPrevPe = el.style.pointerEvents || '';
    el.style.setProperty('visibility', 'hidden', 'important');
    el.style.setProperty('opacity', '0', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
  };

  const vh = window.innerHeight || 1;
  const vw = window.innerWidth || 1;

  // Modal dialogs / quick-views that aren't the menu panel
  for (const el of document.querySelectorAll(
    '[role="dialog"], [aria-modal="true"], [class*="modal" i], [class*="quick-view" i], [class*="quickview" i], [class*="lightbox" i], [class*="popover" i]',
  )) {
    if (!(el instanceof HTMLElement)) continue;
    if (panel && (panel === el || panel.contains(el) || el.contains(panel))) continue;
    if (section && section.contains(el) && /mega|DropDown|drawer|__menu/i.test(String(el.className || ''))) {
      continue;
    }
    hide(el);
  }

  // Full-viewport dimmer/backdrop layers (grey the page while a stray modal is open)
  for (const el of document.querySelectorAll('body *')) {
    if (!(el instanceof HTMLElement)) continue;
    if (keep.has(el)) continue;
    if (panel && (panel === el || panel.contains(el) || el.contains(panel))) continue;
    if (section && (section === el || section.contains(el))) continue;
    const st = window.getComputedStyle(el);
    if (st.position !== 'fixed' && st.position !== 'absolute') continue;
    const r = el.getBoundingClientRect();
    if (r.width < vw * 0.85 || r.height < vh * 0.5) continue;
    const bg = st.backgroundColor || '';
    const opacity = Number(st.opacity);
    const isDim =
      opacity > 0 &&
      opacity < 0.95 &&
      (/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0?\.[1-8]/i.test(bg) ||
        /backdrop|overlay|dimmer|scrim/i.test(`${el.className} ${el.id}`));
    const isEmptyShell =
      el.childElementCount === 0 &&
      !(el.textContent || '').trim() &&
      opacity > 0 &&
      opacity < 1;
    if (isDim || isEmptyShell) hide(el);
  }

  // Stray product teaser cards stuck at corners (partial car popups)
  for (const el of document.querySelectorAll(
    '[class*="card" i], [class*="teaser" i], [class*="tooltip" i], [class*="flyer" i]',
  )) {
    if (!(el instanceof HTMLElement)) continue;
    if (panel && (panel === el || panel.contains(el))) continue;
    if (section && section.contains(el)) continue;
    const st = window.getComputedStyle(el);
    if (st.position !== 'fixed' && st.position !== 'absolute') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 120 || r.height < 80 || r.width > vw * 0.7) continue;
    // Corner-stuck partial cards
    if (r.left < 40 && r.top < 120) hide(el);
  }
}

async function withNonMenuOverlaysHidden(page, sectionSelector, panelSelector, fn) {
  await page.evaluate(hideNonMenuOverlaysInPage, {
    sectionSel: sectionSelector,
    panelSel: panelSelector,
  }).catch(() => {});
  try {
    return await fn();
  } finally {
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('[data-bq-menu-overlay-hide="1"]')) {
        if (!(el instanceof HTMLElement)) continue;
        el.style.visibility = el.dataset.bqMenuOverlayPrevVis || '';
        el.style.opacity = el.dataset.bqMenuOverlayPrevOp || '';
        el.style.pointerEvents = el.dataset.bqMenuOverlayPrevPe || '';
        delete el.dataset.bqMenuOverlayHide;
        delete el.dataset.bqMenuOverlayPrevVis;
        delete el.dataset.bqMenuOverlayPrevOp;
        delete el.dataset.bqMenuOverlayPrevPe;
      }
    }).catch(() => {});
  }
}

/**
 * Find a tall visible overlay (drawer / dialog) for open-menu clips when the
 * preferred panel selector is thin chrome (e.g. hamburger wrapper).
 * Scoped to sectionRoot when provided so page heroes are not mistaken for menus.
 * @returns {Promise<string|null>}
 */
async function findTallestOpenOverlay(page, sectionRootSelector = null) {
  return page.evaluate((rootSel) => {
    const vh = window.innerHeight || 1;
    const vw = window.innerWidth || 1;
    const sectionRoot = rootSel
      ? (() => {
          try {
            return document.querySelector(rootSel);
          } catch {
            return null;
          }
        })()
      : null;

    const cssPath = (el) => {
      if (!(el instanceof Element)) return '';
      if (el.id && !/\d{4,}/.test(el.id) && (() => { try { return document.querySelectorAll(`#${CSS.escape(el.id)}`).length; } catch { return 99; } })() <= 1) return `#${CSS.escape(el.id)}`;
      const parts = [];
      let cur = el;
      for (let i = 0; i < 6 && cur && cur !== document.body; i++) {
        let part = cur.tagName.toLowerCase();
        if (cur.id && !/\d{4,}/.test(cur.id) && (() => { try { return document.querySelectorAll(`#${CSS.escape(cur.id)}`).length; } catch { return 99; } })() <= 1) {
          parts.unshift(`#${CSS.escape(cur.id)}`);
          break;
        }
        const stable = [...cur.classList]
          .filter((c) => c && !/^(is-|has-|js-|active|open|selected|current|hover)/i.test(c))
          .slice(0, 2);
        if (stable.length) part += stable.map((c) => `.${CSS.escape(c)}`).join('');
        const parent = cur.parentElement;
        if (parent && !stable.length) {
          const siblings = [...parent.children].filter((c) => c.tagName === cur.tagName);
          if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(cur) + 1})`;
        }
        parts.unshift(part);
        cur = parent;
      }
      return parts.join(' > ');
    };

    /** @type {{ sel: string, h: number, score: number }|null} */
    let best = null;
    const consider = (el) => {
      if (!(el instanceof HTMLElement)) return;
      if (sectionRoot && !(sectionRoot === el || sectionRoot.contains(el))) return;
      const st = window.getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return;
      if (el.getAttribute('aria-hidden') === 'true') return;
      // Nested content inside a closed aria-hidden shell
      if (el.closest('[aria-hidden="true"]')) return;
      const r = el.getBoundingClientRect();
      if (r.width < vw * 0.35 || r.height < vh * 0.35) return;
      const links = el.querySelectorAll('a[href], button').length;
      if (links < 2 && r.height < vh * 0.55) return;
      const blob = `${el.id} ${el.className?.toString?.() || ''} ${el.getAttribute('role') || ''}`;
      if (
        !/mega|dropdown|drawer|flyout|submenu|dialog|offcanvas|is-open|menu/i.test(blob) &&
        el.getAttribute('role') === 'navigation'
      ) {
        return;
      }
      // Prefer open mega panels over the L0 menu shell when both are present.
      let score = r.height;
      const isMenuShell =
        /__menu\b|(^|\s)menu($|\s)|drawer|offcanvas/i.test(blob) &&
        !/mega|DropDown|dropdown/i.test(blob);
      const isMega = /mega|DropDown|dropdown/i.test(blob);
      if (isMenuShell) {
        // Only boost L0 shells that are explicitly open (mobile/tablet drawer)
        if (
          el.classList.contains('is-open') ||
          el.getAttribute('aria-hidden') === 'false'
        ) {
          score += vh * 0.15;
        } else {
          score -= vh; // closed chrome shell — never prefer over an open mega
        }
      }
      if (isMega) {
        // Strongly prefer in-viewport megas (nested L1) over the outer shell
        if (r.left < vw * 0.35 && r.width >= vw * 0.5) score += vh * 0.8;
        else score += vh * 0.25;
      }
      // Reject off-canvas megas parked to the right of the viewport
      if (isMega && r.left >= vw * 0.4) return;
      if (!best || score > best.score) best = { sel: cssPath(el), h: r.height, score };
    };

    const searchRoot = sectionRoot || document;
    for (const el of searchRoot.querySelectorAll(
      '[role="dialog"], [aria-modal="true"], [class*="drawer" i], [class*="mega" i], [class*="dropdown" i], [class*="DropDown" i], [class*="flyout" i], [class*="menu" i], .is-open, [class*="is-open" i], [id$="-content"]',
    )) {
      consider(el);
    }
    for (const el of (sectionRoot || document.body).querySelectorAll('*')) {
      if (!(el instanceof HTMLElement)) continue;
      const st = window.getComputedStyle(el);
      if (st.position !== 'fixed' && st.position !== 'absolute') continue;
      consider(el);
    }
    return best?.sel || null;
  }, sectionRootSelector);
}

async function resolveOpenMegaSelector(page, sectionRootSelector) {
  if (!sectionRootSelector) return null;
  return page
    .evaluate((rootSel) => {
      try {
        const section = document.querySelector(rootSel);
        if (!(section instanceof HTMLElement)) return null;
        const vh = window.innerHeight || 1;
        const vw = window.innerWidth || 1;
        const cssPath = (el) => {
          if (!(el instanceof Element)) return '';
          if (el.id && !/\d{4,}/.test(el.id) && (() => { try { return document.querySelectorAll(`#${CSS.escape(el.id)}`).length; } catch { return 99; } })() <= 1) return `#${CSS.escape(el.id)}`;
          const parts = [];
          let cur = el;
          for (let i = 0; i < 6 && cur && cur !== document.body; i++) {
            let part = cur.tagName.toLowerCase();
            if (cur.id && !/\d{4,}/.test(cur.id) && (() => { try { return document.querySelectorAll(`#${CSS.escape(cur.id)}`).length; } catch { return 99; } })() <= 1) {
              parts.unshift(`#${CSS.escape(cur.id)}`);
              break;
            }
            const stable = [...cur.classList]
              .filter((c) => c && !/^(is-|has-|js-|active|open|selected|current|hover)/i.test(c))
              .slice(0, 2);
            if (stable.length) part += stable.map((c) => `.${CSS.escape(c)}`).join('');
            const parent = cur.parentElement;
            if (parent) {
              const siblings = [...parent.children].filter((c) => c.tagName === cur.tagName);
              if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(cur) + 1})`;
            }
            parts.unshift(part);
            cur = parent;
          }
          return parts.join(' > ');
        };
        let best = null;
        let bestScore = -1;
        for (const el of section.querySelectorAll(
          '[class*="megaDropDown" i], [class*="MegaDropDown" i], [class*="mega" i], [class*="DropDown" i], [class*="dropdown" i], [class*="flyout" i], [class*="submenu" i]',
        )) {
          if (!(el instanceof HTMLElement)) continue;
          if (el.getAttribute('aria-hidden') === 'true') continue;
          if (el.closest('[aria-hidden="true"]')) continue;
          const st = window.getComputedStyle(el);
          if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) < 0.1) {
            continue;
          }
          const r = el.getBoundingClientRect();
          // Must be on-screen (exclude translateX(100%) off-canvas siblings)
          if (r.left >= vw * 0.35 || r.right <= vw * 0.2) continue;
          if (r.width < vw * 0.45 || r.height < vh * 0.3) continue;
          // Prefer the panel root (megaDropDown) over tiny header chips
          const blob = String(el.className || '');
          const links = el.querySelectorAll('a[href], button').length;
          if (links < 1 && r.height < vh * 0.5) continue;
          let score = r.width * r.height * 0.0001 + links * 40;
          if (/megaDropDown(?!Header|Content|Close)/i.test(blob) || /__mega\b/i.test(blob)) {
            score += 5000;
          }
          if (/megaDropDownContent|DropDownContent/i.test(blob)) score += 2000;
          if (score > bestScore) {
            bestScore = score;
            best = el;
          }
        }
        return best ? cssPath(best) : null;
      } catch {
        return null;
      }
    }, sectionRootSelector)
    .catch(() => null);
}

/**
 * Union closed chrome control band + open panel into a viewport clip.
 * Does NOT stretch to full viewport height when the mega ends mid-screen —
 * avoids hero/tabs showing under desktop overlays.
 * @returns {Promise<{ x: number, y: number, width: number, height: number }|null>}
 */
async function measureChromePanelClip(page, sectionSelector, panelSelector, pad = 6) {
  return page.evaluate(
    ({ sectionSel, panelSel, pad: p }) => {
      const boxOf = (el) => {
        if (!(el instanceof HTMLElement)) return null;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return null;
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      };
      const expandedBox = (el) => {
        if (!(el instanceof HTMLElement)) return null;
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        const consider = (node) => {
          if (!(node instanceof HTMLElement)) return;
          const st = window.getComputedStyle(node);
          if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return;
          const r = node.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) return;
          x0 = Math.min(x0, r.x);
          y0 = Math.min(y0, r.y);
          x1 = Math.max(x1, r.x + r.width);
          y1 = Math.max(y1, r.y + r.height);
        };
        consider(el);
        el.querySelectorAll('*').forEach(consider);
        if (!Number.isFinite(x0)) return null;
        return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
      };
      /**
       * Closed header control row only — logo / nav / hamburger.
       * When the section root grows to wrap an open mega, full section box would
       * inflate the clip to viewport height and include page content below.
       */
      const chromeBandBox = (root) => {
        if (!(root instanceof HTMLElement)) return null;
        const r = root.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return null;
        const maxBand = 160;
        const bandBottom = r.top + Math.min(Math.max(r.height, 48), maxBand);
        let x0 = r.left;
        let y0 = r.top;
        let x1 = r.right;
        let y1 = Math.min(r.bottom, bandBottom);
        const pick = (node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.getAttribute('aria-hidden') === 'true') return;
          const st = window.getComputedStyle(node);
          if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) {
            return;
          }
          const br = node.getBoundingClientRect();
          if (br.width < 8 || br.height < 8) return;
          if (br.top < r.top - 4 || br.top > bandBottom) return;
          const blob = `${node.className?.toString?.() || ''} ${node.getAttribute('role') || ''}`;
          if (/mega|DropDown|dropdown|drawer|flyout|offcanvas/i.test(blob) && br.height > 80) {
            return;
          }
          if (br.bottom > bandBottom + 36 && br.height > 48) return;
          x0 = Math.min(x0, br.left);
          y0 = Math.min(y0, br.top);
          x1 = Math.max(x1, br.right);
          y1 = Math.max(y1, Math.min(br.bottom, bandBottom + 12));
        };
        for (const sel of [
          'a[href]',
          'button',
          '[role="button"]',
          'img',
          'svg',
          'nav',
          '[role="navigation"]',
          'input',
        ]) {
          try {
            root.querySelectorAll(sel).forEach(pick);
          } catch {
            /* ignore */
          }
        }
        const h = Math.max(1, y1 - y0);
        const cappedH = Math.min(h, maxBand + 12);
        return {
          x: x0,
          y: y0,
          width: Math.max(1, x1 - x0),
          height: cappedH,
        };
      };
      const resolveEl = (sel, scope) => {
        if (!sel) return null;
        try {
          if (scope) {
            const scoped = scope.querySelector(sel);
            if (scoped) return scoped;
          }
          const docHit = document.querySelector(sel);
          if (docHit && scope && !(scope === docHit || scope.contains(docHit))) {
            return null;
          }
          if (scope && !docHit) return null;
          return docHit;
        } catch {
          return null;
        }
      };
      /** Prefer open mega/dropdown content over a tall L0 __menu shell. */
      const preferContentPanel = (panel) => {
        if (!(panel instanceof HTMLElement)) return panel;
        const vh = window.innerHeight || 1;
        const vw = window.innerWidth || 1;
        const narrow = vw <= 900;
        const panelR = panel.getBoundingClientRect();
        // Narrow nested megas are meant to fill the viewport — keep them.
        const panelBlob = String(panel.className || '');
        if (
          narrow &&
          /mega|DropDown|dropdown/i.test(panelBlob) &&
          panel.getAttribute('aria-hidden') !== 'true' &&
          panelR.width >= vw * 0.5 &&
          panelR.height >= vh * 0.45 &&
          panelR.left < vw * 0.35
        ) {
          return panel;
        }
        let best = null;
        let bestScore = -1;
        const consider = (el) => {
          if (!(el instanceof HTMLElement) || el === panel) return;
          if (el.getAttribute('aria-hidden') === 'true') return;
          if (el.closest('[aria-hidden="true"]') && el.closest('[aria-hidden="true"]') !== panel) {
            return;
          }
          const st = window.getComputedStyle(el);
          if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) {
            return;
          }
          const r = el.getBoundingClientRect();
          if (r.width < 80 || r.height < 80) return;
          if (narrow && r.left >= vw * 0.4) return;
          const blob = `${el.className?.toString?.() || ''} ${el.getAttribute('role') || ''}`;
          const isMega = /mega|DropDown|dropdown|flyout|submenu/i.test(blob);
          const isContent = /content|inner|body|panel|Editorial|ContentWithLinks/i.test(blob);
          if (!isMega && !isContent) return;
          // Never prefer accordion/filter strips over the panel
          if (/Accordion|RangeFilter|energyButton|filterBar/i.test(blob)) return;
          const links = el.querySelectorAll('a[href], button').length;
          if (links < 1 && r.height < 120) return;
          let score = r.width * r.height * 0.0001 + links * 40;
          if (isMega) score += 8000;
          if (isContent) score += 3000;
          if (narrow) {
            // Prefer taller on-screen nested panels
            if (r.height >= vh * 0.5) score += 6000;
            if (r.height < vh * 0.4) score -= 8000;
          } else {
            if (r.height < vh * 0.85) score += 4000;
            if (r.height >= vh * 0.92) score -= 8000;
          }
          if (score > bestScore) {
            bestScore = score;
            best = el;
          }
        };
        panel.querySelectorAll('*').forEach(consider);
        if (best && best.getBoundingClientRect().height >= 80) {
          return best;
        }
        return panel;
      };
      /**
       * Visual ink box — skip transparent viewport-filling overlay shells so the
       * clip ends at the mega content bottom (not full viewport with hero under).
       */
      const inkBox = (el) => {
        if (!(el instanceof HTMLElement)) return null;
        const vh = window.innerHeight || 1;
        const vw = window.innerWidth || 1;
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        let found = false;
        const isTransparentBg = (st) => {
          const bg = st.backgroundColor || '';
          return (
            bg === 'transparent' ||
            bg === 'rgba(0, 0, 0, 0)' ||
            /^rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)$/i.test(bg)
          );
        };
        const consider = (node) => {
          if (!(node instanceof HTMLElement)) return;
          const st = window.getComputedStyle(node);
          if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) {
            return;
          }
          const r = node.getBoundingClientRect();
          if (r.width < 4 || r.height < 4) return;
          const transparent = isTransparentBg(st);
          const fillsVp = r.height >= vh * 0.85 && r.width >= vw * 0.85;
          if (transparent && fillsVp) return; // skip shell; children still walked separately
          const blob = `${node.className?.toString?.() || ''}`;
          const hasInk =
            !transparent ||
            /mega|DropDown|dropdown|content|panel|Editorial/i.test(blob) ||
            node.querySelector('img, svg, a[href], p, h1, h2, h3, h4, li') ||
            (node.textContent || '').replace(/\s+/g, ' ').trim().length > 24;
          if (!hasInk) return;
          x0 = Math.min(x0, r.x);
          y0 = Math.min(y0, r.y);
          x1 = Math.max(x1, r.x + r.width);
          y1 = Math.max(y1, r.y + r.height);
          found = true;
        };
        consider(el);
        el.querySelectorAll('*').forEach(consider);
        if (!found || !Number.isFinite(x0)) return expandedBox(el);
        return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
      };
      const section = (() => {
        try {
          return document.querySelector(sectionSel);
        } catch {
          return null;
        }
      })();
      let panel = resolveEl(panelSel, section);
      if (panel) panel = preferContentPanel(panel);
      // Mega panels are often siblings of the L0 __menu shell, not descendants
      if (section instanceof HTMLElement) {
        const vhLocal = window.innerHeight || 1;
        const vwLocal = window.innerWidth || 1;
        const narrowLocal = vwLocal <= 900;
        let bestMega = null;
        let bestMegaScore = -1;
        for (const el of section.querySelectorAll(
          '[class*="mega" i], [class*="DropDown" i], [class*="dropdown" i], [class*="flyout" i]',
        )) {
          if (!(el instanceof HTMLElement)) continue;
          if (el.getAttribute('aria-hidden') === 'true') continue;
          if (el.closest('[aria-hidden="true"]')) continue;
          const st = window.getComputedStyle(el);
          if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) {
            continue;
          }
          const r = el.getBoundingClientRect();
          if (r.width < 80 || r.height < 80) continue;
          // Off-canvas megas parked to the right
          if (r.left >= vwLocal * 0.4) continue;
          // Desktop: skip full-bleed shells that would include hero underlay.
          // Narrow: full-viewport nested megas are expected — keep them.
          if (!narrowLocal && r.height >= vhLocal * 0.92) continue;
          if (narrowLocal && r.height < vhLocal * 0.35) continue;
          const links = el.querySelectorAll('a[href], button').length;
          if (links < 1) continue;
          let score = r.width * r.height * 0.0001 + links * 50;
          if (narrowLocal) {
            if (r.height >= vhLocal * 0.5) score += 5000;
          } else if (r.height < vhLocal * 0.7) {
            score += 3000;
          }
          if (score > bestMegaScore) {
            bestMegaScore = score;
            bestMega = el;
          }
        }
        if (bestMega) {
          const panelH = panel instanceof HTMLElement ? panel.getBoundingClientRect().height : 0;
          const megaH = bestMega.getBoundingClientRect().height;
          if (!panel || (narrowLocal ? megaH > panelH + 40 : megaH + 40 < panelH || panelH >= vhLocal * 0.85)) {
            panel = bestMega;
          }
        }
      }
      const chromeBox = panel ? chromeBandBox(section) : boxOf(section);
      const panelBox = inkBox(panel);
      const boxes = [chromeBox, panelBox].filter(Boolean);
      if (!boxes.length) return null;
      let x0 = Math.min(...boxes.map((b) => b.x));
      let y0 = Math.min(...boxes.map((b) => b.y));
      let x1 = Math.max(...boxes.map((b) => b.x + b.width));
      let y1 = Math.max(...boxes.map((b) => b.y + b.height));
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      x0 = Math.max(0, Math.floor(x0 - p));
      y0 = Math.max(0, Math.floor(y0 - p));
      x1 = Math.min(vw, Math.ceil(x1 + p));
      y1 = Math.min(vh, Math.ceil(y1 + p));
      return {
        x: x0,
        y: y0,
        width: Math.max(1, x1 - x0),
        height: Math.max(1, y1 - y0),
      };
    },
    { sectionSel: sectionSelector, panelSel: panelSelector, pad },
  );
}

/**
 * Measure section + optional panel boxes; always prefer chrome ∪ panel clip for open menus.
 * @returns {Promise<{ method: string, clip?: object, panelSelector?: string|null, menuOpen?: boolean }>}
 */
async function measureOpenShot(page, sectionSelector, triggerSelector, opts = {}) {
  const { drawerSelector = null, requireMenuOpen = false } = opts;

  const resolvePanel = (trig) =>
    page
      .evaluate(resolveVisiblePanelInBrowser, {
        triggerSelector: trig,
        sectionRootSelector: sectionSelector || null,
      })
      .catch(() => null);

  let panelSelector =
    (triggerSelector ? await resolvePanel(triggerSelector) : null) || drawerSelector || null;

  // Drop preferred panels that live outside the section root (foreign aria-controls).
  if (panelSelector && sectionSelector) {
    const inSection = await page
      .evaluate(
        ({ rootSel, panelSel }) => {
          try {
            const root = document.querySelector(rootSel);
            const panel = document.querySelector(panelSel);
            return Boolean(root && panel && (root === panel || root.contains(panel)));
          } catch {
            return false;
          }
        },
        { rootSel: sectionSelector, panelSel: panelSelector },
      )
      .catch(() => false);
    if (!inSection) panelSelector = drawerSelector || null;
  }

  if (triggerSelector) {
    let opened = await waitForPanelOpen(page, triggerSelector, panelSelector, 2500, sectionSelector);
    // Also treat an already-open drawer as open — do NOT re-click (would toggle closed)
    if (!opened) {
      const probeEarly = await page.evaluate(probeNavDrawerOpenInBrowser, probeDrawerArg(null, sectionSelector)).catch(() => null);
      if (probeEarly?.open) {
        opened = true;
        if (!panelSelector && probeEarly.drawerSelector) {
          panelSelector = probeEarly.drawerSelector;
        }
      }
    }
    if (!opened) {
      // Menu may already be open from a prior path step — do not toggle closed
      const alreadyOpen = await page
        .evaluate(probeNavDrawerOpenInBrowser, probeDrawerArg(null, sectionSelector))
        .catch(() => null);
      const resolvedOpen = triggerSelector
        ? await resolvePanel(triggerSelector)
        : null;
      if (alreadyOpen?.open || resolvedOpen) {
        opened = true;
        panelSelector = resolvedOpen || alreadyOpen?.drawerSelector || panelSelector;
      } else {
        await activateTrigger(page, {
          selector: triggerSelector,
          method: 'click',
        });
        panelSelector =
          (await resolvePanel(triggerSelector)) ||
          panelSelector ||
          drawerSelector ||
          null;
        opened = await waitForPanelOpen(page, triggerSelector, panelSelector, 3000, sectionSelector);
      }
    }
    const again = await resolvePanel(triggerSelector);
    if (again) panelSelector = again;
    if (drawerSelector && !panelSelector) {
      panelSelector = drawerSelector;
    }
  } else if (drawerSelector) {
    panelSelector = drawerSelector;
  }

  // Prefer largest open drawer when still no panel / require open proof
  let probe = await page.evaluate(probeNavDrawerOpenInBrowser, probeDrawerArg(null, sectionSelector)).catch(() => null);
  if (probe?.drawerSelector && sectionSelector) {
    const drawerInSection = await page
      .evaluate(
        ({ rootSel, panelSel }) => {
          try {
            const root = document.querySelector(rootSel);
            const panel = document.querySelector(panelSel);
            return Boolean(root && panel && (root === panel || root.contains(panel)));
          } catch {
            return false;
          }
        },
        { rootSel: sectionSelector, panelSel: probe.drawerSelector },
      )
      .catch(() => false);
    if (!drawerInSection) {
      // Ignore foreign page drawers (hero bands, etc.)
      probe = { ...probe, drawerSelector: null, open: Boolean(panelSelector) };
    }
  }
  if (probe?.open && probe.drawerSelector) {
    if (!panelSelector) {
      panelSelector = probe.drawerSelector;
    } else if (probe.drawerSelector !== panelSelector) {
      // Prefer the visibly taller / richer candidate (avoids hamburger chrome as "panel")
      const richer = await page.evaluate(
        ({ a, b }) => {
          const score = (sel) => {
            try {
              const el = document.querySelector(sel);
              if (!(el instanceof HTMLElement)) return 0;
              const st = window.getComputedStyle(el);
              if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) {
                return 0;
              }
              const r = el.getBoundingClientRect();
              if (r.width < 40 || r.height < 40) return 0;
              const links = el.querySelectorAll('a[href]').length;
              const textLen = (el.textContent || '').replace(/\s+/g, ' ').trim().length;
              // Visual area only — scrollHeight prefers inner content wrappers
              const area = r.width * r.height;
              const vh = window.innerHeight || 1;
              const tallBonus = r.height >= vh * 0.35 ? 5000 : r.height >= 160 ? 1000 : 0;
              const cls = String(el.className || '');
              const shellBonus = /mega|DropDown|dropdown|drawer|flyout/i.test(cls)
                ? /content|inner|body|scroll/i.test(cls)
                  ? -2000
                  : 3000
                : 0;
              return links * 50 + Math.min(textLen, 1500) * 0.05 + area * 0.0001 + tallBonus + shellBonus;
            } catch {
              return 0;
            }
          };
          const sa = score(a);
          const sb = score(b);
          if (sb <= 0 && sa <= 0) return a;
          return sb >= sa ? b : a;
        },
        { a: panelSelector, b: probe.drawerSelector },
      );
      panelSelector = richer || panelSelector;
    }
  }

  // If requireMenuOpen and chosen panel is still thin chrome, force drawer
  if (requireMenuOpen && panelSelector && probe?.drawerSelector) {
    const tooThin = await page.evaluate((sel) => {
      try {
        const el = document.querySelector(sel);
        if (!(el instanceof HTMLElement)) return true;
        const r = el.getBoundingClientRect();
        return r.height < (window.innerHeight || 1) * 0.2;
      } catch {
        return true;
      }
    }, panelSelector);
    if (tooThin) panelSelector = probe.drawerSelector;
  }

  const geometry = await page.evaluate(
    ({ sectionSel, panelSel }) => {
      const boxOf = (el) => {
        if (!(el instanceof HTMLElement)) return null;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return null;
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      };
      const expandedBox = (el) => {
        if (!(el instanceof HTMLElement)) return null;
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        const consider = (node) => {
          if (!(node instanceof HTMLElement)) return;
          const st = window.getComputedStyle(node);
          if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return;
          const r = node.getBoundingClientRect();
          if (r.width < 4 || r.height < 4) return;
          x0 = Math.min(x0, r.x);
          y0 = Math.min(y0, r.y);
          x1 = Math.max(x1, r.x + r.width);
          y1 = Math.max(y1, r.y + r.height);
        };
        consider(el);
        el.querySelectorAll('*').forEach(consider);
        if (!Number.isFinite(x0)) return null;
        return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
      };
      const section = (() => {
        try {
          return document.querySelector(sectionSel);
        } catch {
          return null;
        }
      })();
      const panel = panelSel
        ? (() => {
            try {
              return document.querySelector(panelSel);
            } catch {
              return null;
            }
          })()
        : null;
      const sectionBox = boxOf(section);
      const panelBox = expandedBox(panel);
      let panelOutside = Boolean(section && panel && panelBox && sectionBox && !section.contains(panel));
      if (!panelOutside && sectionBox && panelBox) {
        const overflowBottom = panelBox.y + panelBox.height > sectionBox.y + sectionBox.height + 24;
        const overflowRight = panelBox.x + panelBox.width > sectionBox.x + sectionBox.width + 24;
        const overflowLeft = panelBox.x < sectionBox.x - 24;
        const muchTaller = panelBox.height > sectionBox.height * 1.25;
        const muchBiggerArea =
          panelBox.width * panelBox.height > sectionBox.width * sectionBox.height * 0.5;
        panelOutside =
          overflowBottom || overflowRight || overflowLeft || muchTaller || muchBiggerArea;
      }
      const links = panel ? panel.querySelectorAll('a[href]').length : 0;
      const textLen = panel
        ? (panel.textContent || '').replace(/\s+/g, ' ').trim().length
        : 0;
      const vh = window.innerHeight || 1;
      // Soft open proof: tall drawer OR rich mega panel (desktop) OR mid-size overlay
      const menuOpen = Boolean(
        panelBox &&
          panelBox.width >= 80 &&
          (panelBox.height >= vh * 0.25 ||
            (panelBox.height >= 100 && (links >= 2 || textLen >= 80)) ||
            panelBox.height >= 160),
      );
      return {
        sectionBox,
        panelBox,
        panelOutside: Boolean(panelOutside),
        menuOpen,
        vw: window.innerWidth,
        vh,
      };
    },
    { sectionSel: sectionSelector, panelSel: panelSelector },
  );

  const drawerOpen = Boolean(probe?.open);
  if (requireMenuOpen && !geometry?.menuOpen && !drawerOpen) {
    return { method: 'failed-closed', panelSelector, menuOpen: false };
  }

  if (!geometry?.sectionBox && !geometry?.panelBox) {
    return { method: requireMenuOpen ? 'failed-closed' : 'viewport', panelSelector, menuOpen: false };
  }

  // Always union section chrome + open panel when panel is present
  if (geometry.panelBox && (geometry.menuOpen || geometry.panelOutside || requireMenuOpen || drawerOpen)) {
    const clip = await measureChromePanelClip(page, sectionSelector, panelSelector, 6);
    if (clip && clip.height >= 40) {
      console.log(`    … open-shot chrome∪panel ${clip.width}x${clip.height}`);
      return {
        method: 'union-clip',
        clip,
        panelSelector,
        menuOpen: Boolean(geometry.menuOpen || drawerOpen),
      };
    }
  }

  return {
    method: 'section',
    panelSelector,
    menuOpen: Boolean(geometry.menuOpen || drawerOpen),
  };
}

/**
 * Temporarily hide main page content behind an open menu popup so the shot
 * does not show blurred hero/body through the mega-menu backdrop.
 */
async function withPageContentHiddenBehindMenu(page, sectionSelector, panelSelector, fn) {
  await page.evaluate(
    ({ sectionSel, panelSel }) => {
      const section = (() => {
        try {
          return document.querySelector(sectionSel);
        } catch {
          return null;
        }
      })();
      const panel = panelSel
        ? (() => {
            try {
              if (section) {
                const scoped = section.querySelector(panelSel);
                if (scoped) return scoped;
              }
              const docHit = document.querySelector(panelSel);
              if (docHit && section && (section === docHit || section.contains(docHit))) {
                return docHit;
              }
              if (section) return null;
              return docHit;
            } catch {
              return null;
            }
          })()
        : null;
      const keep = new Set();
      const markKeep = (el) => {
        let cur = el;
        while (cur && cur !== document.documentElement) {
          keep.add(cur);
          cur = cur.parentElement;
        }
      };
      markKeep(section);
      markKeep(panel);

      // Mega panels may be siblings of the L0 drawer shell — always keep open megas
      if (section instanceof HTMLElement) {
        const vh = window.innerHeight || 1;
        for (const el of section.querySelectorAll(
          '[class*="mega" i], [class*="DropDown" i], [class*="dropdown" i], [class*="flyout" i]',
        )) {
          if (!(el instanceof HTMLElement)) continue;
          if (el.getAttribute('aria-hidden') === 'true') continue;
          const st = window.getComputedStyle(el);
          if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) {
            continue;
          }
          const r = el.getBoundingClientRect();
          if (r.width >= 80 && r.height >= 80 && r.height < vh * 0.92) {
            markKeep(el);
          }
        }
      }

      // Also keep only chrome-band + panel descendants inside the section —
      // hide sibling content (e.g. in-section promo) that would show under the mega.
      if (section instanceof HTMLElement && panel instanceof HTMLElement) {
        const root = section.getBoundingClientRect();
        const bandBottom = root.top + Math.min(Math.max(root.height, 48), 160);
        for (const child of section.querySelectorAll('*')) {
          if (!(child instanceof HTMLElement)) continue;
          if (panel === child || panel.contains(child) || child.contains(panel)) {
            markKeep(child);
            continue;
          }
          const r = child.getBoundingClientRect();
          if (r.top >= root.top - 2 && r.bottom <= bandBottom + 24 && r.height <= 160) {
            markKeep(child);
          }
        }
      }

      const hide = (el) => {
        if (!(el instanceof HTMLElement)) return;
        if (keep.has(el)) return;
        if (panel && (el === panel || el.contains(panel) || panel.contains(el))) return;
        // Do not hide ancestors of section/panel (layout would collapse)
        if (section && (el === section || el.contains(section))) return;
        if (el.dataset.bqMenuShotHide === '1') return;
        el.dataset.bqMenuShotHide = '1';
        el.dataset.bqMenuShotPrevVis = el.style.visibility || '';
        el.dataset.bqMenuShotPrevOp = el.style.opacity || '';
        el.dataset.bqMenuShotPrevPe = el.style.pointerEvents || '';
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('opacity', '0', 'important');
        el.style.setProperty('pointer-events', 'none', 'important');
      };

      // Hide non-kept descendants of the section (underlay under translucent mega)
      if (section instanceof HTMLElement) {
        for (const child of section.querySelectorAll('*')) {
          if (!(child instanceof HTMLElement)) continue;
          if (keep.has(child)) continue;
          if (panel && (panel === child || panel.contains(child) || child.contains(panel))) continue;
          hide(child);
        }
      }

      for (const sel of [
        'main',
        '[role="main"]',
        '#main-content',
        '#content',
        '[id="__next"] > *:not(header):not(nav)',
      ]) {
        try {
          document.querySelectorAll(sel).forEach(hide);
        } catch {
          /* ignore */
        }
      }

      for (const child of document.body.children) {
        if (!(child instanceof HTMLElement)) continue;
        if (keep.has(child)) continue;
        if (section && child.contains(section)) continue;
        if (panel && child.contains(panel)) continue;
        if (child.matches('script, style, link, noscript, template')) continue;
        if (child.matches('header, [role="banner"], nav, [role="navigation"]')) continue;
        // Hide main content / app shells / footers that sit behind the popup
        const blob = `${child.id} ${child.className?.toString?.() || ''} ${child.tagName}`;
        if (
          child.matches('main, [role="main"], footer, [role="contentinfo"], aside') ||
          /main|content|page|app|root|wrapper|layout|hero/i.test(blob)
        ) {
          hide(child);
        }
      }

      // Hide siblings of the section (and ancestors' siblings) so heroes under the
      // same #Page shell do not paint into the chrome∪panel clip.
      let climb = section?.parentElement || null;
      for (let depth = 0; climb && depth < 6; depth += 1) {
        for (const sib of climb.children) {
          if (!(sib instanceof HTMLElement)) continue;
          if (section && (sib === section || sib.contains(section))) continue;
          if (panel && (sib === panel || sib.contains(panel) || panel.contains(sib))) continue;
          if (keep.has(sib)) continue;
          if (sib.matches('script, style, link, noscript, template')) continue;
          hide(sib);
        }
        climb = climb.parentElement;
      }
    },
    { sectionSel: sectionSelector, panelSel: panelSelector },
  );

  try {
    return await fn();
  } finally {
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('[data-bq-menu-shot-hide="1"]')) {
        if (!(el instanceof HTMLElement)) continue;
        el.style.visibility = el.dataset.bqMenuShotPrevVis || '';
        el.style.opacity = el.dataset.bqMenuShotPrevOp || '';
        el.style.pointerEvents = el.dataset.bqMenuShotPrevPe || '';
        delete el.dataset.bqMenuShotHide;
        delete el.dataset.bqMenuShotPrevVis;
        delete el.dataset.bqMenuShotPrevOp;
        delete el.dataset.bqMenuShotPrevPe;
      }
    });
  }
}

/**
 * Temporarily expand a scrollable menu/drawer (panel + descendants only).
 * Does NOT expand ancestors — that breaks nav layout and ghosts sibling L1 labels.
 * Skips expand when the panel is already fully visible (typical desktop mega).
 */
async function withFullScrollableMenuContent(page, panelSelector, fn, sectionRootSelector = null) {
  if (!panelSelector) return fn({ expanded: false });

  const prevVp = page.viewportSize() || { width: 390, height: 844 };

  const meta = await page.evaluate(({ sel, rootSel }) => {
    const rootScope = rootSel
      ? (() => {
          try {
            return document.querySelector(rootSel);
          } catch {
            return null;
          }
        })()
      : null;
    const root = (() => {
      try {
        if (rootScope) {
          const scoped = rootScope.querySelector(sel);
          if (scoped) return scoped;
        }
        const docHit = document.querySelector(sel);
        if (docHit && rootScope && !(rootScope === docHit || rootScope.contains(docHit))) {
          return null;
        }
        return docHit;
      } catch {
        return null;
      }
    })();
    if (!(root instanceof HTMLElement)) return null;

    const rootSt = window.getComputedStyle(root);
    const rootRect = root.getBoundingClientRect();
    const isOverlayShell =
      rootSt.position === 'fixed' || rootSt.position === 'absolute';
    const overlayMostlyVisible =
      isOverlayShell &&
      rootRect.height >= Math.min(360, (window.innerHeight || 1) * 0.4) &&
      rootRect.width >= (window.innerWidth || 1) * 0.5;
    // Only unroll scrollports on narrow viewports — desktop megas stay as painted.
    const narrowVp = (window.innerWidth || 1) <= 900;

    let needsExpand = root.scrollHeight > root.clientHeight + 8;
    if (!needsExpand && narrowVp) {
      for (const node of root.querySelectorAll('*')) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.scrollHeight > node.clientHeight + 8) {
          needsExpand = true;
          break;
        }
      }
    }
    // Desktop overlay mega: never inflate to full scrollHeight of inner lists
    if (!narrowVp && overlayMostlyVisible) {
      needsExpand = root.scrollHeight > root.clientHeight + 8;
    }
    if (!needsExpand) {
      return { skip: true, width: 0, height: 0, needsGrow: false, contentBottom: 0 };
    }

    const mark = (el) => {
      if (!(el instanceof HTMLElement) || el.dataset.bqMenuExpand === '1') return false;
      el.dataset.bqMenuExpand = '1';
      el.dataset.bqMenuExpandH = el.style.height || '';
      el.dataset.bqMenuExpandMh = el.style.maxHeight || '';
      el.dataset.bqMenuExpandOv = el.style.overflow || '';
      el.dataset.bqMenuExpandOy = el.style.overflowY || '';
      el.dataset.bqMenuExpandPos = el.style.position || '';
      el.dataset.bqMenuExpandTop = el.style.top || '';
      el.dataset.bqMenuExpandBottom = el.style.bottom || '';
      el.dataset.bqMenuExpandInset = el.style.inset || '';
      return true;
    };

    const expandEl = (el, explicitHeight) => {
      if (!(el instanceof HTMLElement)) return;
      mark(el);
      const st = window.getComputedStyle(el);
      // Break fixed/absolute viewport fills that pin height to the screen
      if (st.position === 'fixed' || st.position === 'absolute') {
        el.style.setProperty('bottom', 'auto', 'important');
        el.style.setProperty('inset', 'auto 0 auto 0', 'important');
        el.style.setProperty('top', `${Math.max(0, el.getBoundingClientRect().top)}px`, 'important');
      }
      el.style.setProperty('max-height', 'none', 'important');
      el.style.setProperty('overflow', 'visible', 'important');
      el.style.setProperty('overflow-y', 'visible', 'important');
      if (explicitHeight && explicitHeight > 0) {
        el.style.setProperty('height', `${Math.ceil(explicitHeight)}px`, 'important');
      } else {
        el.style.setProperty('height', 'auto', 'important');
      }
    };

    // Panel + descendants only — never ancestors (avoids sibling L1 bleed)
    /** @type {HTMLElement[]} */
    const scrollports = [];
    const considerScroll = (el) => {
      if (!(el instanceof HTMLElement)) return;
      if (el === root && isOverlayShell && rootRect.height >= (window.innerHeight || 1) * 0.75) {
        // Do not treat the fixed viewport-filling drawer shell as a scrollport to
        // "unfix" — breaking its position creates huge empty white + stray cards.
        return;
      }
      const st = window.getComputedStyle(el);
      const oy = st.overflowY;
      const ox = st.overflowX;
      const vertClip =
        (/(auto|scroll|overlay)/.test(oy) || el.scrollHeight > el.clientHeight + 8) &&
        el.scrollHeight > el.clientHeight + 24;
      const horizOnly =
        /(auto|scroll|overlay)/.test(ox) &&
        el.scrollWidth > el.clientWidth + 24 &&
        el.scrollHeight <= el.clientHeight + 24;
      if (vertClip && !horizOnly) scrollports.push(el);
    };
    for (const node of root.querySelectorAll('*')) considerScroll(node);
    // Only expand the root itself when it is an in-flow scroll container (not a fixed shell)
    if (!isOverlayShell || rootRect.height < (window.innerHeight || 1) * 0.75) {
      considerScroll(root);
    }

    const unique = [...new Set(scrollports)];
    if (!unique.length) {
      return { skip: true, width: 0, height: 0, needsGrow: false, contentBottom: 0 };
    }
    unique.sort((a, b) => b.scrollHeight - a.scrollHeight);
    for (const el of unique) {
      const sh = Math.max(el.scrollHeight, el.getBoundingClientRect().height);
      expandEl(el, sh);
    }
    // Grow fixed shell height to fit expanded inner content without changing position mode
    if (isOverlayShell) {
      mark(root);
      root.style.setProperty('max-height', 'none', 'important');
      root.style.setProperty('overflow', 'visible', 'important');
      root.style.setProperty('overflow-y', 'visible', 'important');
      const needed = Math.ceil(
        Math.max(
          root.scrollHeight,
          ...unique.map((el) => el.getBoundingClientRect().bottom - root.getBoundingClientRect().top),
        ),
      );
      if (needed > rootRect.height + 8) {
        root.style.setProperty('height', `${needed}px`, 'important');
        root.style.setProperty('bottom', 'auto', 'important');
      }
    }

    void root.offsetHeight;

    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    const consider = (node) => {
      if (!(node instanceof HTMLElement)) return;
      const st = window.getComputedStyle(node);
      if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return;
      const r = node.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      x0 = Math.min(x0, r.x);
      y0 = Math.min(y0, r.y);
      x1 = Math.max(x1, r.x + r.width);
      y1 = Math.max(y1, r.y + r.height);
    };
    consider(root);
    root.querySelectorAll('*').forEach(consider);
    if (!Number.isFinite(x0)) {
      return { width: 0, height: 0, needsGrow: false, contentBottom: 0 };
    }

    const width = Math.ceil(x1 - x0);
    const height = Math.ceil(y1 - y0);
    return {
      width,
      height,
      needsGrow: height > window.innerHeight + 4 || y1 > window.innerHeight + 4,
      contentBottom: Math.ceil(y1),
    };
  }, { sel: panelSelector, rootSel: sectionRootSelector });

  if (!meta || meta.skip || meta.height < 40) {
    return fn({ expanded: false });
  }

  const MAX_H = 8000;
  let grew = false;
  try {
    if (meta.needsGrow || meta.height > prevVp.height + 4) {
      const nextH = Math.min(
        MAX_H,
        Math.max(prevVp.height, meta.height + 32, meta.contentBottom + 24),
      );
      if (nextH > prevVp.height + 4) {
        await page.setViewportSize({ width: prevVp.width, height: nextH });
        await page.waitForTimeout(100);
        grew = true;
        // Re-expand panel only after viewport grow
        await page.evaluate(
          ({ sel, rootSel }) => {
            const rootScope = rootSel
              ? (() => {
                  try {
                    return document.querySelector(rootSel);
                  } catch {
                    return null;
                  }
                })()
              : null;
            const root = (() => {
              try {
                if (rootScope) {
                  const scoped = rootScope.querySelector(sel);
                  if (scoped) return scoped;
                }
                return document.querySelector(sel);
              } catch {
                return null;
              }
            })();
            if (!(root instanceof HTMLElement)) return;
            const sh = Math.max(root.scrollHeight, root.getBoundingClientRect().height);
            root.style.setProperty('height', `${Math.ceil(sh)}px`, 'important');
            root.style.setProperty('max-height', 'none', 'important');
            root.style.setProperty('overflow', 'visible', 'important');
          },
          { sel: panelSelector, rootSel: sectionRootSelector },
        );
        await page.waitForTimeout(40);
      }
    }
    return await fn({
      expanded: true,
      grew,
      contentHeight: meta.height,
      panelSelector,
    });
  } finally {
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('[data-bq-menu-expand="1"]')) {
        if (!(el instanceof HTMLElement)) continue;
        el.style.height = el.dataset.bqMenuExpandH || '';
        el.style.maxHeight = el.dataset.bqMenuExpandMh || '';
        el.style.overflow = el.dataset.bqMenuExpandOv || '';
        el.style.overflowY = el.dataset.bqMenuExpandOy || '';
        el.style.position = el.dataset.bqMenuExpandPos || '';
        el.style.top = el.dataset.bqMenuExpandTop || '';
        el.style.bottom = el.dataset.bqMenuExpandBottom || '';
        el.style.inset = el.dataset.bqMenuExpandInset || '';
        delete el.dataset.bqMenuExpand;
        delete el.dataset.bqMenuExpandH;
        delete el.dataset.bqMenuExpandMh;
        delete el.dataset.bqMenuExpandOv;
        delete el.dataset.bqMenuExpandOy;
        delete el.dataset.bqMenuExpandPos;
        delete el.dataset.bqMenuExpandTop;
        delete el.dataset.bqMenuExpandBottom;
        delete el.dataset.bqMenuExpandInset;
      }
    });
    if (grew) {
      await page.setViewportSize(prevVp);
      await page.waitForTimeout(40);
    }
  }
}

async function liveOpenScreenshot(page, sectionSelector, triggerSelector, filePath, opts = {}) {
  const {
    drawerSelector = null,
    requireMenuOpen = false,
    skipExpand = false,
    interactionKind = null,
  } = opts;
  const isTabLike = interactionKind === 'tab' || interactionKind === 'accordion';
  try {
    const plan = await measureOpenShot(page, sectionSelector, triggerSelector, {
      drawerSelector,
      requireMenuOpen,
    });

    if (plan.method === 'failed-closed') {
      console.warn(`    … open-shot refused: menu still closed (${path.basename(filePath)})`);
      return { ok: false, method: 'failed-closed', panelSelector: plan.panelSelector };
    }

    // Menu shots: require real renderable content before expand/screenshot
    if (requireMenuOpen && plan.panelSelector && !isTabLike) {
      const megaSel = await resolveOpenMegaSelector(page, sectionSelector);
      if (megaSel) plan.panelSelector = megaSel;
      let contentOk = await waitForPanelContent(
        page,
        plan.panelSelector,
        sectionSelector,
        2000,
      );
      if (!contentOk && drawerSelector && drawerSelector !== plan.panelSelector) {
        contentOk = await waitForPanelContent(page, drawerSelector, sectionSelector, 800);
        if (contentOk) plan.panelSelector = drawerSelector;
      }
      if (!contentOk) {
        const tall = await findTallestOpenOverlay(page, sectionSelector);
        if (tall) {
          plan.panelSelector = tall;
          contentOk = await waitForPanelContent(page, tall, sectionSelector, 800);
        }
      }
      if (!contentOk) {
        console.warn(
          `    … open-shot refused: panel content empty (${path.basename(filePath)})`,
        );
        return { ok: false, method: 'failed-closed', panelSelector: plan.panelSelector };
      }
    }

    const takeShot = async (expandInfo = { expanded: false }) => {
      // Drop focus rings from Playwright clicks before painting the PNG
      await clearFocusForScreenshot(page);
      try {
      // Tabs/accordions: always shoot the section band (same W×H as closed section PNG).
      // Never expand absolute carousel slides into multi-thousand-px strips.
      if (isTabLike && sectionSelector) {
        const sectionClip = await page.evaluate((sel) => {
          try {
            const el = document.querySelector(sel);
            if (!(el instanceof HTMLElement)) return null;
            const r = el.getBoundingClientRect();
            if (r.width < 2 || r.height < 2) return null;
            const vw = window.innerWidth || 1;
            const vh = window.innerHeight || 1;
            const x = Math.max(0, Math.floor(r.left));
            const y = Math.max(0, Math.floor(r.top));
            return {
              x,
              y,
              width: Math.max(1, Math.min(vw - x, Math.ceil(r.width))),
              // Cap to viewport — tab heroes are viewport bands, not document stacks
              height: Math.max(1, Math.min(vh - y, Math.ceil(r.height), vh)),
            };
          } catch {
            return null;
          }
        }, sectionSelector);
        if (sectionClip) {
          try {
            await page.screenshot({ path: filePath, clip: sectionClip, fullPage: false });
            console.log(
              `    … open-shot section-band ${sectionClip.width}x${sectionClip.height}`,
            );
            return { ok: true, method: 'section-band', panelSelector: plan.panelSelector };
          } catch (err) {
            console.warn(
              `    … section-band screenshot failed (${err instanceof Error ? err.message : err}); falling back`,
            );
          }
        }
        const loc = page.locator(sectionSelector).first();
        if ((await loc.count()) >= 1) {
          try {
            await loc.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
            await loc.screenshot({ path: filePath, timeout: 4000 });
            return { ok: true, method: 'section', panelSelector: plan.panelSelector };
          } catch {
            /* fall through */
          }
        }
      }

      const panelSel = plan.panelSelector;

      // Always prefer section chrome ∪ panel clip (never panel-only element shots —
      // those drop the logo/X bar and can paint ghost sibling L1 labels).
      if (panelSel && sectionSelector) {
        let clip = await measureChromePanelClip(page, sectionSelector, panelSel, 6);
        // Safety: thin clip on open-menu shots → re-probe tall drawer/overlay and remeasure
        if (requireMenuOpen && clip && clip.height < 160) {
          const probe = await page.evaluate(probeNavDrawerOpenInBrowser, probeDrawerArg(null, sectionSelector)).catch(() => null);
          let alt = probe?.drawerSelector || null;
          if (!alt || alt === panelSel) {
            alt = await findTallestOpenOverlay(page, sectionSelector);
          }
          if (alt && alt !== panelSel) {
            const retry = await measureChromePanelClip(page, sectionSelector, alt, 6);
            if (retry && retry.height > clip.height) {
              clip = retry;
              plan.panelSelector = alt;
            }
          }
        }
        if (clip && clip.height >= 40) {
          try {
            await page.screenshot({ path: filePath, clip, fullPage: false });
            const method = expandInfo.expanded ? 'chrome-panel-full' : 'union-clip';
            console.log(
              `    … open-shot ${method} ${clip.width}x${clip.height}` +
                (expandInfo.grew ? ' (viewport grown)' : ''),
            );
            return { ok: true, method, panelSelector: plan.panelSelector || panelSel };
          } catch (err) {
            console.warn(
              `    … chrome∪panel screenshot failed (${err instanceof Error ? err.message : err}); falling back`,
            );
          }
        }
      }

      if (plan.method === 'union-clip' && plan.clip) {
        try {
          await page.screenshot({ path: filePath, clip: plan.clip, fullPage: false });
          return { ok: true, method: 'union-clip', panelSelector: plan.panelSelector };
        } catch (err) {
          console.warn(
            `    … union-clip screenshot failed (${err instanceof Error ? err.message : err}); falling back`,
          );
        }
      }

      if (plan.panelSelector && plan.method === 'section') {
        const panelH = await page.evaluate((sel) => {
          try {
            const el = document.querySelector(sel);
            return el ? el.getBoundingClientRect().height : 0;
          } catch {
            return 0;
          }
        }, plan.panelSelector);
        if (panelH < 40) {
          if (requireMenuOpen) {
            return { ok: false, method: 'failed-closed', panelSelector: plan.panelSelector };
          }
        }
      }

      // Section element shot still includes chrome when panel is inside section
      const loc = page.locator(sectionSelector).first();
      if ((await loc.count()) >= 1) {
        try {
          await loc.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
          await loc.screenshot({ path: filePath, timeout: 4000 });
          return { ok: true, method: 'section', panelSelector: plan.panelSelector };
        } catch {
          /* fall through */
        }
      }

      if (requireMenuOpen && plan.panelSelector) {
        // Last resort for open drawer: still try chrome∪panel once more
        const clip = await measureChromePanelClip(page, sectionSelector, plan.panelSelector, 6);
        if (clip && clip.height >= 40) {
          try {
            await page.screenshot({ path: filePath, clip, fullPage: false });
            return { ok: true, method: 'union-clip', panelSelector: plan.panelSelector };
          } catch {
            /* fall through */
          }
        }
        return { ok: false, method: 'failed-closed', panelSelector: plan.panelSelector };
      }
      if (requireMenuOpen) {
        return { ok: false, method: 'failed-closed', panelSelector: plan.panelSelector };
      }
      await page.screenshot({ path: filePath, fullPage: false });
      return { ok: true, method: 'viewport', panelSelector: plan.panelSelector };
      } finally {
        await removeFocusRingStyle(page);
      }
    };

    const runWithExpand = async () => {
      // Nested mobile drill-ins: expanding the outer shell can reset the drawer to L0
      // Tabs must never expand — absolute carousel slides inflate to thousands of px.
      if (skipExpand || isTabLike) {
        return takeShot({ expanded: false });
      }
      // Never expand empty / content-poor shells into multi-thousand-px white strips
      const expandCandidate =
        plan.panelSelector || drawerSelector;
      if (
        requireMenuOpen &&
        expandCandidate &&
        !(await panelHasRenderableContent(page, expandCandidate, sectionSelector))
      ) {
        return takeShot({ expanded: false });
      }
      const expandSel =
        drawerSelector && plan.panelSelector && drawerSelector !== plan.panelSelector
          ? plan.panelSelector
          : plan.panelSelector || drawerSelector;
      let target = expandSel;
      if (drawerSelector && plan.panelSelector && drawerSelector !== plan.panelSelector) {
        const taller = await page.evaluate(
          ({ a, b }) => {
            const score = (sel) => {
              try {
                const el = document.querySelector(sel);
                if (!(el instanceof HTMLElement)) return -1;
                const st = window.getComputedStyle(el);
                if (st.display === 'none') return -1;
                const r = el.getBoundingClientRect();
                const vh = window.innerHeight || 1;
                let s = r.height;
                if (
                  (st.position === 'fixed' || st.position === 'absolute') &&
                  r.height >= vh * 0.5
                ) {
                  s += vh;
                }
                const cls = String(el.className || '');
                if (/__menu\b|drawer|offcanvas/i.test(cls) && !/mega|DropDown|content/i.test(cls)) {
                  s += vh * 0.5;
                }
                if (/content|inner|scroll/i.test(cls)) s -= vh * 0.25;
                return s;
              } catch {
                return -1;
              }
            };
            const sa = score(a);
            const sb = score(b);
            if (sb < 0 && sa < 0) return a;
            return sb >= sa ? b : a;
          },
          { a: plan.panelSelector, b: drawerSelector },
        );
        target = taller || expandSel;
      }
      // Only expand for open menus — never because union-clip was chosen for a tab panel
      if (target && (plan.menuOpen || requireMenuOpen)) {
        return withFullScrollableMenuContent(page, target, takeShot, sectionSelector);
      }
      return takeShot({ expanded: false });
    };

    // Always hide page content behind for menu shots with a panel (desktop mega too)
    if (
      !isTabLike &&
      plan.panelSelector &&
      (plan.menuOpen || plan.method === 'union-clip' || requireMenuOpen)
    ) {
      // Mega is often a sibling of the L0 __menu shell — keep that for hide+clip
      const megaSel = await resolveOpenMegaSelector(page, sectionSelector);
      if (megaSel) plan.panelSelector = megaSel;
      return await withNonMenuOverlaysHidden(
        page,
        sectionSelector,
        plan.panelSelector,
        () =>
          withPageContentHiddenBehindMenu(
            page,
            sectionSelector,
            plan.panelSelector,
            runWithExpand,
          ),
      );
    }
    return await runWithExpand();
  } catch {
    return { ok: false, method: null, panelSelector: null };
  }
}

/**
 * Resolve the best open panel for HTML dump (aria-controls, tabpanel, drawer, explicit).
 * Works for menu / tab / accordion — prefer richest content, not thin chrome.
 * @returns {Promise<string|null>}
 */
async function resolveOpenPanelForHtml(page, sectionSelector, triggerSelector, preferredPanel) {
  const fromTrigger = triggerSelector
    ? await page
        .evaluate(resolveVisiblePanelInBrowser, {
          triggerSelector,
          sectionRootSelector: sectionSelector || null,
        })
        .catch(() => null)
    : null;
  const probe = await page.evaluate(probeNavDrawerOpenInBrowser, probeDrawerArg(null, sectionSelector)).catch(() => null);
  const fromExpanded = await page.evaluate((rootSel) => {
    const root = (() => {
      try {
        return document.querySelector(rootSel);
      } catch {
        return null;
      }
    })();
    if (!root) return null;
    const cssPath = (el) => {
      if (!(el instanceof Element)) return '';
      if (el.id && !/\d{4,}/.test(el.id) && (() => { try { return document.querySelectorAll(`#${CSS.escape(el.id)}`).length; } catch { return 99; } })() <= 1) return `#${CSS.escape(el.id)}`;
      const parts = [];
      let cur = el;
      for (let i = 0; i < 6 && cur && cur !== document.body; i++) {
        let part = cur.tagName.toLowerCase();
        if (cur.id && !/\d{4,}/.test(cur.id) && (() => { try { return document.querySelectorAll(`#${CSS.escape(cur.id)}`).length; } catch { return 99; } })() <= 1) {
          parts.unshift(`#${CSS.escape(cur.id)}`);
          break;
        }
        const stable = [...cur.classList]
          .filter((c) => c && !/^(is-|has-|js-|active|open|selected|current|hover)/i.test(c))
          .slice(0, 2);
        if (stable.length) part += stable.map((c) => `.${CSS.escape(c)}`).join('');
        const parent = cur.parentElement;
        if (parent && !stable.length) {
          const siblings = [...parent.children].filter((c) => c.tagName === cur.tagName);
          if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(cur) + 1})`;
        }
        parts.unshift(part);
        cur = parent;
      }
      return parts.join(' > ');
    };

    const inRoot = (panel) => root === panel || root.contains(panel);

    /** @type {{ sel: string, area: number }|null} */
    let best = null;
    const consider = (panel, minArea = 80 * 40) => {
      if (!(panel instanceof HTMLElement)) return;
      if (!inRoot(panel)) return;
      const st = window.getComputedStyle(panel);
      if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return;
      if (panel.hasAttribute('hidden') || panel.getAttribute('aria-hidden') === 'true') return;
      const r = panel.getBoundingClientRect();
      // Prefer on-screen visual area — scrollHeight inflates inner content shells
      const area = r.width * r.height;
      if (area < minArea) return;
      const cls = String(panel.className || '');
      // Prefer outer mega/drawer shells over inner *Content wrappers
      const shellBonus = /mega|DropDown|dropdown|drawer|flyout|submenu/i.test(cls)
        ? /content|inner|body|scroll/i.test(cls)
          ? 0
          : area * 0.5
        : 0;
      const score = area + shellBonus;
      const sel = panel.id ? `#${CSS.escape(panel.id)}` : cssPath(panel);
      if (!best || score > best.area) best = { sel, area: score };
    };

    // Expanded / selected triggers → aria-controls panels (must stay in section)
    for (const el of root.querySelectorAll(
      '[aria-expanded="true"][aria-controls], [aria-selected="true"][aria-controls], [role="tab"][aria-selected="true"]',
    )) {
      const id = el.getAttribute('aria-controls');
      if (id) consider(document.getElementById(id));
    }

    for (const d of root.querySelectorAll('details[open]')) {
      consider(d);
    }

    // Open mega / drawer / menu panels inside the section
    for (const panel of root.querySelectorAll(
      '[role="menu"], [role="dialog"], [class*="mega" i], [class*="dropdown" i], [class*="drawer" i], .is-open, [class*="is-open" i]',
    )) {
      consider(panel, 40 * 40);
    }

    // Tabpanels only when they live under this section (content tabs, not foreign page tabs)
    for (const panel of root.querySelectorAll('[role="tabpanel"]')) {
      consider(panel, 40 * 40);
    }

    return best?.sel || null;
  }, sectionSelector);

  const candidates = [preferredPanel, fromTrigger, fromExpanded, probe?.drawerSelector].filter(
    Boolean,
  );
  if (!candidates.length) return null;

  // Prefer panels that belong to the section root (avoids hero/page landmarks).
  const scoped = await page.evaluate(
    ({ rootSel, sels }) => {
      let root = null;
      try {
        root = document.querySelector(rootSel);
      } catch {
        root = null;
      }
      const inRoot = (sel) => {
        try {
          const el = document.querySelector(sel);
          if (!(el instanceof Element) || !root) return false;
          return root === el || root.contains(el);
        } catch {
          return false;
        }
      };
      const inside = sels.filter(inRoot);
      return inside.length ? inside : [];
    },
    { rootSel: sectionSelector, sels: candidates },
  );

  const pool = scoped.length ? scoped : candidates;

  const scored = await page.evaluate((sels) => {
    let best = null;
    let bestScore = 0;
    for (const sel of sels) {
      try {
        const el = document.querySelector(sel);
        if (!(el instanceof HTMLElement)) continue;
        const st = window.getComputedStyle(el);
        if (st.display === 'none') continue;
        const links = el.querySelectorAll('a[href]').length;
        const imgs = el.querySelectorAll('img[src]').length;
        const textLen = (el.textContent || '').replace(/\s+/g, ' ').trim().length;
        const r = el.getBoundingClientRect();
        const area = Math.max(r.width * r.height, el.scrollWidth * el.scrollHeight);
        const score = links * 50 + imgs * 20 + Math.min(textLen, 2000) * 0.1 + area * 0.0001;
        if (score > bestScore) {
          bestScore = score;
          best = sel;
        }
      } catch {
        /* skip */
      }
    }
    return best;
  }, pool);

  return scored || pool[0] || null;
}

/**
 * Save open-state HTML for any interaction kind: section snapshot + outside open panels.
 * Menus often portal mega-panels; tabs/FAQ usually keep panels in-section (activation is enough).
 */
async function saveOpenHtml(page, sectionSelector, panelSelector, filePath) {
  const html = await page.evaluate(
    ({ sectionSel, panelSel }) => {
      const outer = (el) => (el instanceof Element ? el.outerHTML : '');

      let sectionHtml = '';
      let section = null;
      try {
        section = document.querySelector(sectionSel);
        sectionHtml = outer(section);
      } catch {
        sectionHtml = '';
      }

      /** @type {Element[]} */
      const extras = [];
      const seen = new Set();
      const pushExtra = (el) => {
        if (!(el instanceof Element)) return;
        if (seen.has(el)) return;
        if (section && (el === section || section.contains(el))) return;
        seen.add(el);
        extras.push(el);
      };

      const trySel = (sel) => {
        if (!sel) return;
        try {
          pushExtra(document.querySelector(sel));
        } catch {
          /* ignore */
        }
      };

      trySel(panelSel);

      if (section) {
        for (const el of section.querySelectorAll(
          '[aria-expanded="true"][aria-controls], [aria-selected="true"][aria-controls], [role="tab"][aria-selected="true"][aria-controls]',
        )) {
          const id = el.getAttribute('aria-controls');
          if (!id) continue;
          pushExtra(document.getElementById(id));
        }
      }

      // Visible tabpanels / dialogs / mega panels outside the section only
      for (const panel of document.querySelectorAll(
        '[role="tabpanel"], [id$="-content"], [role="dialog"], [aria-modal="true"], [class*="mega" i], [class*="drawer" i]',
      )) {
        if (!(panel instanceof HTMLElement)) continue;
        if (section && section.contains(panel)) continue;
        const st = window.getComputedStyle(panel);
        if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) continue;
        if (panel.hasAttribute('hidden') || panel.getAttribute('aria-hidden') === 'true') continue;
        const links = panel.querySelectorAll('a[href]').length;
        const textLen = (panel.textContent || '').replace(/\s+/g, ' ').trim().length;
        const r = panel.getBoundingClientRect();
        const tall = Math.max(r.height, panel.scrollHeight);
        if (links >= 1 || textLen >= 40 || tall >= 120) pushExtra(panel);
      }

      if (!extras.length) return sectionHtml || '<!-- empty -->';

      extras.sort((a, b) => {
        const score = (el) =>
          el.querySelectorAll('a[href]').length * 50 +
          el.querySelectorAll('img[src]').length * 20 +
          Math.min((el.textContent || '').length, 2000);
        return score(b) - score(a);
      });

      // Keep the richest outside panel(s) — avoid dumping every site dialog
      const keep = extras.slice(0, 3);
      const parts = [sectionHtml || '<!-- empty section -->'];
      for (const el of keep) {
        parts.push(`\n\n<!-- open-panel (outside section) -->\n${outer(el)}`);
      }
      return parts.join('');
    },
    { sectionSel: sectionSelector, panelSel: panelSelector },
  );
  await writeFile(filePath, html || '<!-- empty -->\n', 'utf8');
  return filePath;
}


/**
 * Snapshot sizable / menu-like nodes under section (+ body for portals).
 * Used for before/after click mutation panel detection.
 * @returns {Record<string, object>}
 */
function snapshotInteractiveCandidatesInBrowser(rootSel) {
  const cssPath = (el) => {
    if (!(el instanceof Element)) return '';
    if (el.id && !/\d{4,}/.test(el.id) && (() => { try { return document.querySelectorAll(`#${CSS.escape(el.id)}`).length; } catch { return 99; } })() <= 1) return `#${CSS.escape(el.id)}`;
    const parts = [];
    let cur = el;
    for (let i = 0; i < 7 && cur && cur !== document.body; i++) {
      let part = cur.tagName.toLowerCase();
      if (cur.id && !/\d{4,}/.test(cur.id) && (() => { try { return document.querySelectorAll(`#${CSS.escape(cur.id)}`).length; } catch { return 99; } })() <= 1) {
        parts.unshift(`#${CSS.escape(cur.id)}`);
        break;
      }
      const stable = [...cur.classList]
        .filter((c) => c && !/^(is-|has-|js-|active|open|selected|current|hover)/i.test(c))
        .slice(0, 2);
      if (stable.length) part += stable.map((c) => `.${CSS.escape(c)}`).join('');
      const parent = cur.parentElement;
      if (parent) {
        const siblings = [...parent.children].filter((c) => c.tagName === cur.tagName);
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(cur) + 1})`;
      }
      parts.unshift(part);
      cur = parent;
    }
    return parts.join(' > ');
  };

  const root = (() => {
    try {
      return rootSel ? document.querySelector(rootSel) : null;
    } catch {
      return null;
    }
  })();

  /** @type {Record<string, object>} */
  const map = {};
  const seen = new Set();
  const scopes = [];
  if (root) scopes.push(root);
  scopes.push(document.body);

  for (const scope of scopes) {
    if (!scope) continue;
    const nodes = scope === document.body && root
      ? [...scope.children]
      : [...scope.querySelectorAll('*')];
    // For body, also walk portal-like fixed/absolute descendants lightly
    const walk = scope === document.body && root
      ? [
          ...nodes,
          ...document.querySelectorAll(
            'body > [class*="mega" i], body > [class*="drawer" i], body > [class*="menu" i], body > [role="dialog"], body > [aria-modal="true"]',
          ),
        ]
      : nodes;

    for (const el of walk) {
      if (!(el instanceof HTMLElement) || seen.has(el)) continue;
      if (root && scope === document.body && (root === el || root.contains(el))) continue;
      seen.add(el);
      const st = window.getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const ariaHidden = el.getAttribute('aria-hidden') === 'true';
      const visible =
        st.display !== 'none' &&
        st.visibility !== 'hidden' &&
        Number(st.opacity) > 0 &&
        !ariaHidden &&
        !el.hasAttribute('hidden');
      const area = Math.max(0, r.width) * Math.max(0, r.height);
      const blob = `${el.id} ${el.className?.toString?.() || ''} ${el.getAttribute('role') || ''}`;
      const menuLike = /mega|dropdown|drawer|flyout|submenu|dialog|offcanvas|menu/i.test(blob);
      // Never treat chat / messenger widgets as menu panels
      if (/messenger|intercom|hubspot|chat-widget|web-messenger|drift|qualified/i.test(blob)) {
        continue;
      }
      if (area < 800 && !menuLike) continue;
      if (area < 200) continue;
      const key = cssPath(el);
      if (!key || key === 'body' || key === 'html') continue;
      map[key] = {
        area: visible ? area : 0,
        w: Math.round(r.width),
        h: Math.round(r.height),
        ariaHidden,
        display: st.display,
        opacity: Number(st.opacity),
        visible,
        links: el.querySelectorAll('a[href], button').length,
        menuLike,
        fingerprint: `${el.tagName}:${String(el.className || '').slice(0, 96)}`,
      };
    }
  }
  return map;
}

/**
 * Diff before/after snapshots → best appeared / revealed panel selector.
 * @returns {{ selector: string, score: number, reason: string, area: number, links: number }|null}
 */
function pickAppearedPanelFromSnapshotsInBrowser({ before, after }) {
  const vh = window.innerHeight || 1;
  const vw = window.innerWidth || 1;
  const narrow = vw <= 900;
  /** @type {{ selector: string, score: number, reason: string, area: number, links: number }[]} */
  const candidates = [];

  for (const [key, a] of Object.entries(after || {})) {
    if (!a || typeof a !== 'object') continue;
    const b = before?.[key];
    let score = 0;
    let reason = '';
    if (!b) {
      if (a.visible && a.area >= 4000) {
        score = a.area;
        reason = 'new';
      }
    } else if (b.ariaHidden && !a.ariaHidden && a.visible) {
      score = a.area + 12000;
      reason = 'aria-reveal';
    } else if (!b.visible && a.visible && a.area >= 2000) {
      score = a.area + 6000;
      reason = 'became-visible';
    } else if (a.visible && a.area > (b.area || 0) * 2 && a.area - (b.area || 0) > 6000) {
      score = a.area - (b.area || 0);
      reason = 'grew';
    }
    if (score <= 0) continue;
    if (a.h < 60 || a.w < 80) continue;
    if (/messenger|intercom|hubspot|chat|drift|qualified/i.test(key)) continue;
    // Reject filter/accordion strips — they "appear" on L1 open but aren't the menu panel
    if (/Accordion|RangeFilter|energyButton|filterBar|FilterBar/i.test(key)) continue;
    // Reject full-page shells that are just <body> children with no menu signal
    if (a.h >= vh * 0.98 && a.w >= vw * 0.98 && !a.menuLike && a.links < 3) continue;
    // Reject high-area but content-poor nodes (blank mega leaves)
    if ((a.links || 0) < 2 && a.area > 50000) continue;
    // On narrow, reject short strips (filter bars) even if content-rich
    if (narrow && a.h < vh * 0.4 && !a.menuLike) continue;

    let liveOk = true;
    let inViewport = false;
    let isDrawer = false;
    let isDesktopMega = false;
    try {
      const el = document.querySelector(key);
      if (el instanceof HTMLElement) {
        const r = el.getBoundingClientRect();
        inViewport = r.bottom > 8 && r.top < vh - 8 && r.right > 8 && r.left < vw - 8;
        const blob = `${el.className?.toString?.() || ''} ${el.id || ''}`;
        isDrawer = /__menu\b|drawer|offcanvas/i.test(blob) && !/mega|DropDown|dropdown/i.test(blob);
        isDesktopMega = /mega|DropDown|dropdown|ContentWithLinks|EditorialContent/i.test(blob);
        // Live content check in viewport
        let liveLinks = 0;
        let liveText = 0;
        for (const node of el.querySelectorAll('a[href], button, p, span, li, h1, h2, h3')) {
          if (!(node instanceof HTMLElement)) continue;
          const cs = window.getComputedStyle(node);
          if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          const nr = node.getBoundingClientRect();
          if (nr.bottom < 0 || nr.top > vh) continue;
          if (node.matches('a[href], button')) liveLinks += 1;
          liveText += (node.textContent || '').replace(/\s+/g, ' ').trim().length;
        }
        if (liveLinks < 2 && liveText < 60) liveOk = false;
      } else {
        liveOk = false;
      }
    } catch {
      liveOk = false;
    }
    if (!liveOk) continue;
    if (!inViewport && narrow) continue;

    if (a.menuLike) score += 9000;
    score += Math.min(a.links || 0, 40) * 60;
    if (a.area >= 20000) score += 2000;
    if (narrow) {
      if (isDrawer) score += 15000;
      // Prefer open megaDropDown panels (nested L1) over filter strips
      if (isDesktopMega && inViewport && a.h >= vh * 0.45) score += 18000;
      else if (isDesktopMega && !isDrawer) score -= 20000;
      if (inViewport && a.h >= vh * 0.4) score += 5000;
      if (reason === 'aria-reveal') score += 10000;
    } else if (isDesktopMega) {
      score += 4000;
    }
    candidates.push({
      selector: key,
      score,
      reason,
      area: a.area,
      links: a.links || 0,
    });
  }

  candidates.sort((x, y) => y.score - x.score);

  // Drop candidates that are ancestors of a higher-scoring descendant (prefer leaf mega)
  const filtered = [];
  for (const c of candidates.slice(0, 12)) {
    let dominated = false;
    try {
      const el = document.querySelector(c.selector);
      if (!(el instanceof HTMLElement)) continue;
      // On narrow, prefer drawer shells over nested desktop mega leaves
      if (narrow) {
        const blob = String(el.className || '');
        const isMegaLeaf = /mega|DropDown|ContentWithLinks|EditorialContent/i.test(blob);
        if (isMegaLeaf) {
          const drawerBetter = candidates.find((o) => {
            if (o.selector === c.selector || o.score < c.score * 0.5) return false;
            try {
              const oel = document.querySelector(o.selector);
              return (
                oel instanceof HTMLElement &&
                /__menu\b|drawer|offcanvas/i.test(String(oel.className || ''))
              );
            } catch {
              return false;
            }
          });
          if (drawerBetter) continue;
        }
      }
      for (const other of candidates.slice(0, 12)) {
        if (other.selector === c.selector) continue;
        if (other.score < c.score * 0.7) continue;
        try {
          const oel = document.querySelector(other.selector);
          if (oel instanceof HTMLElement && el.contains(oel) && oel !== el) {
            dominated = true;
            break;
          }
        } catch {
          /* ignore */
        }
      }
    } catch {
      continue;
    }
    if (!dominated) filtered.push(c);
  }

  return filtered[0] || candidates[0] || null;
}

async function snapshotMenuCandidates(page, sectionSelector) {
  return page.evaluate(snapshotInteractiveCandidatesInBrowser, sectionSelector).catch(() => ({}));
}

async function resolvePanelByMutation(page, before, after) {
  return page
    .evaluate(pickAppearedPanelFromSnapshotsInBrowser, { before: before || {}, after: after || {} })
    .catch(() => null);
}

/**
 * Capture one activated state across viewports.
 */
async function captureStateArtifacts(page, opts) {
  const {
    pageDir,
    sectionDir,
    folderName,
    sectionSelector,
    devices,
    state,
    statesSubdir = 'states',
    detectionMode = 'heuristic',
  } = opts;

  const absStateDir = path.join(sectionDir, statesSubdir, state.slug);
  await mkdir(absStateDir, { recursive: true });

  const triggerSelector = state.trigger?.selector || state.path?.[0]?.selector || null;
  /** L0 hamburger-open: no L1 path; desktop top-level is already in closed section PNGs. */
  const chromeOnly = state.kind === 'menu' && (Number(state.depth) === 0 || state.narrowOnly);
  /** @type {string|null} */
  let resolvedPanelSelector = state.panel?.selector || null;
  /** @type {Record<string, string>} */
  const viewportNotes = { ...(state.viewportNotes || {}) };
  /** @type {string|null} */
  let lastOpenDevice = null;
  /** @type {string|null} */
  let lastOpenTrigger = null;
  /** @type {string|null} */
  let lastOpenDrawer = null;
  /** @type {object|null} */
  let mutationMeta = null;
  let usedMutationFallback = false;

  const outputs = {};
  for (const device of devices) {
    if (chromeOnly && device === 'desktop') {
      outputs.desktop = {
        path: null,
        method: 'not-applicable',
        note: 'l0-hamburger-narrow-only',
      };
      viewportNotes.desktop = 'desktop: not-applicable-l0-hamburger';
      continue;
    }

    await page.setViewportSize(VIEWPORTS[device] || VIEWPORTS.desktop);
    await ensureOverlayScrollbars(page);
    await page.waitForTimeout(150);
    await page.evaluate(hideFloatingWidgetsInPage).catch(() => {});
    // Fresh open per viewport — avoids toggle-closing a menu left open from discovery/prior device
    if (state.kind === 'menu') {
      await restoreDefaults(page);
      await page.waitForTimeout(80);
      await page.evaluate(hideFloatingWidgetsInPage).catch(() => {});
    }

    const narrow = device === 'tablet' || device === 'mobile';
    /** @type {Record<string, object>|null} */
    let beforeSnap = null;
    // L0 mutation: snapshot closed chrome before hamburger opens the drawer
    if (detectionMode === 'mutation' && state.kind === 'menu' && chromeOnly) {
      beforeSnap = await snapshotMenuCandidates(page, sectionSelector);
    }
    // For L0, pass null as L1 so we do not treat the visible hamburger as "already open"
    const chrome =
      state.kind === 'menu'
        ? await ensureNavChromeOpen(
            page,
            sectionSelector,
            device,
            chromeOnly ? null : triggerSelector,
          )
        : { opened: false, hamburgerSelector: null, drawerSelector: null, note: null };
    if (chrome.note) viewportNotes[device] = chrome.note;

    /** @type {string|null} */
    let drawerSelector = chrome.drawerSelector || null;
    let pathActivated = false;

    // Narrow L1 without an open drawer — do not force-click desktop L1 and fake a shot
    if (
      state.kind === 'menu' &&
      narrow &&
      !chromeOnly &&
      (state.path || []).length &&
      !chrome.opened
    ) {
      viewportNotes[device] = viewportNotes[device]
        ? `${viewportNotes[device]}; refused-drawer-closed`
        : `${device}: refused-drawer-closed`;
      outputs[device] = {
        path: null,
        method: 'failed-closed',
        error: 'menu-drawer-not-open',
      };
      console.warn(
        `    … open-shot refused: drawer not open (${state.slug}-${device})`,
      );
      try {
        const stale = path.join(
          absStateDir,
          `${folderName}-${state.slug}-${deviceFileSlug(device)}.png`,
        );
        await import('node:fs/promises').then((fs) => fs.unlink(stale)).catch(() => {});
      } catch {
        /* ignore */
      }
      continue;
    }

    // Prefer the tall open overlay as the drawer scope for L1 label resolve
    if (state.kind === 'menu' && narrow && chrome.opened) {
      const tall = await findTallestOpenOverlay(page, sectionSelector);
      if (tall) drawerSelector = tall;
      await page.waitForTimeout(400);
    }

    // L1+ mutation: snapshot after chrome/drawer settle, before path clicks
    if (detectionMode === 'mutation' && state.kind === 'menu' && !chromeOnly) {
      beforeSnap = await snapshotMenuCandidates(page, sectionSelector);
    }

    // Re-activate path after viewport change (and after hamburger when needed)
    // depth 0: path empty — stay on L0 drawer
    let nestedPanelOpen = false;
    for (const step of state.path || []) {
      if (!step.selector) continue;
      let stepSelector = step.selector;
      if (step.depth === 1 || step === (state.path || [])[0]) {
        stepSelector = await resolveVisibleL1Selector(
          page,
          sectionSelector,
          step.selector,
          step.label || state.label,
          drawerSelector,
        );
      } else if (narrow && drawerSelector) {
        stepSelector = await resolveVisibleL1Selector(
          page,
          sectionSelector,
          step.selector,
          step.label,
          drawerSelector,
        );
      }
      const method =
        narrow && state.kind === 'menu'
          ? 'click'
          : step.method || state.trigger?.method || 'click';
      let ok = await activateTrigger(page, {
        selector: stepSelector,
        method,
        label: step.label || state.label || null,
      });
      // Fallback: label-based click inside open drawer (desktop css paths often miss mobile L1)
      if (!ok && state.kind === 'menu' && (step.label || state.label)) {
        const label = step.label || state.label;
        try {
          const byRole = page.getByRole('button', {
            name: new RegExp(
              `^${String(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
              'i',
            ),
          });
          if ((await byRole.count()) >= 1) {
            await byRole.first().click({ force: true, timeout: 2500 });
            ok = true;
            stepSelector = null;
            await page.waitForTimeout(400);
          }
        } catch {
          /* ignore */
        }
      }
      // Narrow drawers: Playwright click sometimes only focuses — drill via chevron/row
      if (ok && narrow && state.kind === 'menu') {
        await activateNarrowL1Drill(page, {
          sectionSelector,
          drawerSelector,
          preferredSelector: stepSelector || step.selector,
          label: step.label || state.label || '',
        });
        await page.waitForTimeout(300);
      }
      if (ok) pathActivated = true;
      // After L1 click, refresh drawer probe (submenu may replace L0 list)
      if (narrow && state.kind === 'menu') {
        await page.waitForTimeout(350);
        const probe = await page.evaluate(probeNavDrawerOpenInBrowser, probeDrawerArg(chrome.hamburgerSelector, sectionSelector));
        if (probe?.drawerSelector) drawerSelector = probe.drawerSelector;
        if (stepSelector) {
          await waitForPanelOpen(page, stepSelector, drawerSelector, 2500, sectionSelector);
          await page.waitForTimeout(narrow ? 550 : 120);
        }
        // Narrow nested proof: go-back OR L0 peers replaced by nested content
        {
          const proof = await page
            .evaluate(proveNarrowNestedMenuOpenInBrowser, {
              rootSel: sectionSelector,
              drawerSel: drawerSelector,
              labelHint: step.label || state.label || '',
              debug: true,
            })
            .catch(() => ({ ok: false, reason: 'eval-error' }));
          const solid =
            proof?.ok &&
            ['back', 'open-mega', 'gallery', 'cars+filters', 'models', 'hint-drilled'].includes(
              proof?.reason,
            ) &&
            !proof?.stillOnL0;
          nestedPanelOpen = Boolean(solid);
          if (!nestedPanelOpen) {
            console.log(
              `    … nested-proof [${device}] ${proof?.reason || 'no'} peers=${proof?.l0PeerCount ?? '?'} l0=${proof?.l0Hits ?? '?'} cars=${proof?.carImages ?? '?'} back=${proof?.hasBack ? 1 : 0}`,
            );
          } else {
            console.log(
              `    … nested-proof [${device}] ok reason=${proof?.reason || '?'} peers=${proof?.l0PeerCount ?? '?'}`,
            );
          }
        }
        if (nestedPanelOpen) {
          const mega = await resolveOpenMegaSelector(page, sectionSelector);
          const tall = await findTallestOpenOverlay(page, sectionSelector);
          drawerSelector = mega || tall || drawerSelector;
        }
      }
    }

    if (narrow && state.kind === 'menu' && !chromeOnly && (state.path || []).length) {
      viewportNotes[device] = viewportNotes[device]
        ? `${viewportNotes[device]}; path=${pathActivated ? 1 : 0}; nested=${nestedPanelOpen ? 1 : 0}`
        : `${device}: path=${pathActivated ? 1 : 0}; nested=${nestedPanelOpen ? 1 : 0}`;
    }

    // Narrow menu: if L1 path failed but drawer is open, still shoot the L0 drawer
    if (state.kind === 'menu' && narrow && chrome.opened && !pathActivated && !chromeOnly) {
      viewportNotes[device] = viewportNotes[device]
        ? `${viewportNotes[device]}; l1-activate-failed-shot-drawer`
        : `${device}: l1-activate-failed-shot-drawer`;
      if (!drawerSelector) {
        const probe = await page.evaluate(probeNavDrawerOpenInBrowser, probeDrawerArg(chrome.hamburgerSelector, sectionSelector));
        drawerSelector = probe?.drawerSelector || null;
      }
    }

    // Narrow L1 claimed success but nested panel not proven — chevron/row drill + wait
    if (
      state.kind === 'menu' &&
      narrow &&
      pathActivated &&
      !nestedPanelOpen &&
      !chromeOnly &&
      (state.path || []).length
    ) {
      const step = state.path[state.path.length - 1];
      const label = step.label || state.label || '';
      await activateNarrowL1Drill(page, {
        sectionSelector,
        drawerSelector,
        preferredSelector: step.selector,
        label,
      });
      await page.waitForTimeout(600);
      {
        const proof = await page
          .evaluate(proveNarrowNestedMenuOpenInBrowser, {
            rootSel: sectionSelector,
            drawerSel: drawerSelector,
            labelHint: label,
            debug: true,
          })
          .catch(() => ({ ok: false, reason: 'eval-error' }));
        // Only accept solid nested signals — never soft "hint" on L0 peers
        const solid =
          proof?.ok &&
          ['back', 'open-mega', 'gallery', 'cars+filters', 'models', 'hint-drilled'].includes(
            proof?.reason,
          ) &&
          !(proof?.stillOnL0);
        nestedPanelOpen = Boolean(solid);
        console.log(
          `    … nested-retry [${device}] ${proof?.reason || 'no'} ok=${nestedPanelOpen ? 1 : 0} peers=${proof?.l0PeerCount ?? '?'}`,
        );
      }
      if (nestedPanelOpen) {
        const mega = await resolveOpenMegaSelector(page, sectionSelector);
        const tall = await findTallestOpenOverlay(page, sectionSelector);
        drawerSelector = mega || tall || drawerSelector;
        viewportNotes[device] = viewportNotes[device]
          ? `${viewportNotes[device]}; l1-nested-retry-ok`
          : `${device}: l1-nested-retry-ok`;
      } else {
        viewportNotes[device] = viewportNotes[device]
          ? `${viewportNotes[device]}; l1-nested-unproven`
          : `${device}: l1-nested-unproven`;
      }
    }

    if (chromeOnly && !drawerSelector) {
      const probe = await page.evaluate(
        probeNavDrawerOpenInBrowser,
        chrome.hamburgerSelector || triggerSelector,
      );
      drawerSelector = probe?.drawerSelector || null;
    }

    // L0 / already-open path: do not re-click the L1 trigger (would toggle closed)
    const skipTriggerClick =
      chromeOnly ||
      (state.kind === 'menu' && pathActivated) ||
      (narrow && state.kind === 'menu' && chrome.opened && !pathActivated);
    // After a successful path open, resolve the live mega/drawer panel for clipping
    if (state.kind === 'menu' && pathActivated) {
      const fromTrigger = triggerSelector
        ? await page
            .evaluate(resolveVisiblePanelInBrowser, {
              triggerSelector,
              sectionRootSelector: sectionSelector || null,
            })
            .catch(() => null)
        : null;
      const tall = await findTallestOpenOverlay(page, sectionSelector);
      // Prefer trigger-resolved mega over a generic L0 __menu shell
      drawerSelector = fromTrigger || tall || drawerSelector || null;
    }

    // Mutation path: prefer what appeared on click over heuristic panel resolve
    if (detectionMode === 'mutation' && state.kind === 'menu' && beforeSnap) {
      await page.waitForTimeout(narrow ? 500 : 350);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const afterSnap = await snapshotMenuCandidates(page, sectionSelector);
      const picked = await resolvePanelByMutation(page, beforeSnap, afterSnap);
      let pickedOk = false;
      if (picked?.selector) {
        pickedOk = await panelHasRenderableContent(
          page,
          picked.selector,
          sectionSelector,
          { minLinks: narrow ? 3 : 2, minText: 60 },
        );
        // On narrow, reject desktop mega leaves even if they have some links off-layout
        if (pickedOk && narrow) {
          const isBadMega = await page
            .evaluate((sel) => {
              try {
                const el = document.querySelector(sel);
                if (!(el instanceof HTMLElement)) return true;
                const blob = String(el.className || '');
                if (/Accordion|RangeFilter|energyButton|filterBar/i.test(blob)) return true;
                const isMega = /mega|DropDown|ContentWithLinks|EditorialContent/i.test(blob);
                const isDrawer = /__menu\b|drawer|offcanvas/i.test(blob);
                if (!isMega || isDrawer) {
                  // Non-mega: still reject short filter strips
                  const vh = window.innerHeight || 1;
                  const r = el.getBoundingClientRect();
                  return r.height < vh * 0.4;
                }
                const vh = window.innerHeight || 1;
                const r = el.getBoundingClientRect();
                // Mega leaf that doesn't fill the drawer viewport → likely wrong panel
                return r.height < vh * 0.35 || r.left >= (window.innerWidth || 1) * 0.4;
              } catch {
                return true;
              }
            }, picked.selector)
            .catch(() => true);
          if (isBadMega) pickedOk = false;
        }
        // Never promote an off-screen / desktop mega leaf when L1 drill was not proven
        if (pickedOk && narrow && !nestedPanelOpen) {
          pickedOk = false;
        }
        // When nested is proven, mutation pick must still be on-screen (not a parked mega)
        if (pickedOk && narrow && nestedPanelOpen) {
          const onScreen = await page
            .evaluate((sel) => {
              try {
                const el = document.querySelector(sel);
                if (!(el instanceof HTMLElement)) return false;
                const r = el.getBoundingClientRect();
                const vw = window.innerWidth || 1;
                const vh = window.innerHeight || 1;
                return r.left < vw * 0.35 && r.width >= vw * 0.4 && r.height >= vh * 0.3;
              } catch {
                return false;
              }
            }, picked.selector)
            .catch(() => false);
          if (!onScreen) pickedOk = false;
        }
      }
      if (picked?.selector && pickedOk) {
        drawerSelector = picked.selector;
        mutationMeta = {
          detection: 'mutation',
          reason: picked.reason,
          selector: picked.selector,
          score: picked.score,
          area: picked.area,
          links: picked.links,
          device,
        };
        console.log(
          `    … mutation panel [${device}] ${picked.reason} score=${Math.round(picked.score)} ${String(picked.selector).slice(0, 72)}`,
        );
      } else {
        usedMutationFallback = true;
        const mega = nestedPanelOpen
          ? await resolveOpenMegaSelector(page, sectionSelector)
          : null;
        const tall = await findTallestOpenOverlay(page, sectionSelector);
        if (mega || tall) drawerSelector = mega || tall;
        mutationMeta = {
          detection: 'mutation',
          fallback: 'heuristic',
          selector: drawerSelector,
          device,
          ...(picked?.selector ? { rejected: picked.selector } : {}),
        };
        console.log(`    … mutation fallback→heuristic [${device}] ${drawerSelector || '(none)'}`);
      }
    }

    // After mutation/heuristic resolve: if nested L1 is proven, prefer the on-screen mega
    if (state.kind === 'menu' && narrow && nestedPanelOpen) {
      const mega = await resolveOpenMegaSelector(page, sectionSelector);
      if (mega) drawerSelector = mega;
    }

    // Narrow L1 unproven → refuse (don't expand L0 shell into blank white / grey mess).
    // Do NOT re-prove against a mutation-picked desktop mega leaf — that falsely
    // "rescued" empty on-screen drawers (blank elektrisch / grey voertuigen).
    if (
      state.kind === 'menu' &&
      narrow &&
      !chromeOnly &&
      (state.path || []).length &&
      !nestedPanelOpen
    ) {
      viewportNotes[device] = viewportNotes[device]
        ? `${viewportNotes[device]}; refused-unproven-l1`
        : `${device}: refused-unproven-l1`;
      outputs[device] = {
        path: null,
        method: 'failed-closed',
        error: 'menu-l1-nested-unproven',
      };
      console.warn(
        `    … open-shot refused: L1 nested unproven (${state.slug}-${device})`,
      );
      // Remove stale PNG from a prior run so bad shots don't linger
      try {
        const stale = path.join(
          absStateDir,
          `${folderName}-${state.slug}-${deviceFileSlug(device)}.png`,
        );
        await import('node:fs/promises').then((fs) => fs.unlink(stale)).catch(() => {});
      } catch {
        /* ignore */
      }
      continue;
    }

    const activeTrigger = skipTriggerClick
      ? null
      : (await resolveVisibleL1Selector(
          page,
          sectionSelector,
          triggerSelector,
          state.label,
          drawerSelector,
        )) || triggerSelector;

    const fileName = `${folderName}-${state.slug}-${deviceFileSlug(device)}.png`;
    const filePath = path.join(absStateDir, fileName);
    const requireMenuOpen = state.kind === 'menu';
    // Narrow L1: never grow the viewport — many sites reset the drawer on resize
    // (Sitecore mutation shots became L0 clones after chrome-panel-full).
    // L0 hamburger may still expand to fit the full drawer.
    const allowExpand =
      chromeOnly || (!narrow && state.kind === 'menu') || state.kind !== 'menu';
    let shot = await liveOpenScreenshot(page, sectionSelector, activeTrigger, filePath, {
      drawerSelector,
      requireMenuOpen,
      interactionKind: state.kind || null,
      skipExpand: !allowExpand,
    });

    // One retry: re-open chrome (+ path unless L0) if we refused a closed shot
    if (requireMenuOpen && shot.method === 'failed-closed') {
      await restoreDefaults(page);
      await page.waitForTimeout(100);
      const chrome2 = await ensureNavChromeOpen(
        page,
        sectionSelector,
        device,
        chromeOnly ? null : triggerSelector,
      );
      drawerSelector = chrome2.drawerSelector || drawerSelector;
      let retryTrigger = null;
      if (!chromeOnly) {
        let retryPathOk = false;
        for (const step of state.path || []) {
          if (!step.selector) continue;
          if (narrow) {
            const drilled = await activateNarrowL1Drill(page, {
              sectionSelector,
              drawerSelector,
              preferredSelector: step.selector,
              label: step.label || state.label || '',
            });
            if (drilled) {
              retryPathOk = true;
              retryTrigger = step.selector;
            }
          } else {
            const stepSelector = await resolveVisibleL1Selector(
              page,
              sectionSelector,
              step.selector,
              step.label || state.label,
              drawerSelector,
            );
            const ok = await activateTrigger(page, {
              selector: stepSelector,
              method: 'click',
            });
            if (ok) {
              retryPathOk = true;
              retryTrigger = stepSelector;
            }
          }
          await page.waitForTimeout(200);
        }
        // If L1 still failed but drawer is open, shoot chrome ∪ drawer (write PNG)
        if (!retryPathOk && chrome2.opened) {
          retryTrigger = null;
          viewportNotes[device] = viewportNotes[device]
            ? `${viewportNotes[device]}; retry-shot-drawer`
            : `${device}: retry-shot-drawer`;
        }
      }
      await page.waitForTimeout(narrow ? 400 : 200);
      let retryNested = chromeOnly;
      if (!chromeOnly && narrow) {
        const proof = await page
          .evaluate(proveNarrowNestedMenuOpenInBrowser, {
            rootSel: sectionSelector,
            drawerSel: drawerSelector,
            labelHint: state.label || '',
            debug: true,
          })
          .catch(() => ({ ok: false }));
        retryNested =
          Boolean(proof?.ok) &&
          ['back', 'open-mega', 'gallery', 'cars+filters', 'models', 'hint-drilled'].includes(
            proof?.reason,
          ) &&
          !proof?.stillOnL0;
        if (retryNested) nestedPanelOpen = true;
      }
      // Never re-shoot an unproven L1 as a "drawer" success — that produced blank whites
      if (!chromeOnly && narrow && (state.path || []).length && !retryNested) {
        shot = {
          ok: false,
          method: 'failed-closed',
          error: 'menu-l1-nested-unproven-retry',
          panelSelector: drawerSelector || null,
        };
        viewportNotes[device] = viewportNotes[device]
          ? `${viewportNotes[device]}; refused-unproven-l1-retry`
          : `${device}: refused-unproven-l1-retry`;
        console.warn(
          `    … open-shot refused on retry: L1 nested unproven (${state.slug}-${device})`,
        );
      } else {
        shot = await liveOpenScreenshot(page, sectionSelector, retryTrigger, filePath, {
          drawerSelector,
          requireMenuOpen: true,
          interactionKind: state.kind || null,
          skipExpand: Boolean(narrow && !chromeOnly && !retryNested),
        });
      }
      // Soft L0 drawer fallback only for hamburger-open (L0), never as a fake L1 shot
      if (shot.method === 'failed-closed' && drawerSelector && chromeOnly) {
        shot = await liveOpenScreenshot(page, sectionSelector, null, filePath, {
          drawerSelector,
          requireMenuOpen: false,
          interactionKind: state.kind || null,
        });
        if (shot.ok) {
          viewportNotes[device] = viewportNotes[device]
            ? `${viewportNotes[device]}; soft-drawer-shot`
            : `${device}: soft-drawer-shot`;
        }
      }
      if (shot.method === 'failed-closed') {
        viewportNotes[device] = viewportNotes[device]
          ? `${viewportNotes[device]}; failed-closed`
          : `${device}: failed-closed`;
      }
    }

    if (shot.panelSelector) resolvedPanelSelector = shot.panelSelector;
    else if (drawerSelector) resolvedPanelSelector = drawerSelector;

    if (shot.ok) {
      lastOpenDevice = device;
      lastOpenTrigger = activeTrigger;
      lastOpenDrawer = drawerSelector || shot.panelSelector || lastOpenDrawer;
    }

    outputs[device] = shot.ok
      ? {
          path: path.relative(pageDir, filePath).replace(/\\/g, '/'),
          method: shot.method || 'live-dom',
        }
      : shot.method === 'failed-closed'
        ? {
            path: null,
            method: 'failed-closed',
            error: 'menu-drawer-not-open',
          }
        : null;
  }

  // Open-state HTML (menu / tab / accordion): re-activate on a viewport where the
  // open shot succeeded, then dump section + any live panel outside the section.
  const htmlDevice =
    chromeOnly
      ? 'mobile'
      : lastOpenDevice ||
        (devices.includes('desktop') ? 'desktop' : devices[devices.length - 1] || 'desktop');
  const narrowHtml = htmlDevice === 'tablet' || htmlDevice === 'mobile';

  await page.setViewportSize(VIEWPORTS[htmlDevice] || VIEWPORTS.desktop);
  await page.waitForTimeout(120);
  await restoreDefaults(page);

  // Menus on narrow viewports need the hamburger drawer before L1/L2 path steps
  if (state.kind === 'menu') {
    const chromeHtml = await ensureNavChromeOpen(
      page,
      sectionSelector,
      htmlDevice,
      chromeOnly ? null : triggerSelector,
    );
    if (chromeHtml.drawerSelector) {
      resolvedPanelSelector = chromeHtml.drawerSelector;
      lastOpenDrawer = chromeHtml.drawerSelector;
    }
  }

  let htmlTrigger = lastOpenTrigger || triggerSelector;
  const pathSteps = state.path?.length
    ? state.path
    : triggerSelector
      ? [{ selector: triggerSelector, label: state.label, method: state.trigger?.method || 'click' }]
      : [];

  for (const step of pathSteps) {
    if (!step.selector) continue;
    let stepSelector = step.selector;
    // Label re-resolve helps menus after hamburger remount; also helps tabs/FAQ if DOM shifted
    if (step.label || state.label) {
      stepSelector = await resolveVisibleL1Selector(
        page,
        sectionSelector,
        step.selector,
        step.label || state.label,
        state.kind === 'menu' ? lastOpenDrawer : null,
      );
    }
    const method =
      state.kind === 'menu' && narrowHtml
        ? 'click'
        : step.method || state.trigger?.method || 'click';
    await activateTrigger(page, {
      selector: stepSelector,
      method,
      label: step.label || state.label || null,
    });
    htmlTrigger = stepSelector;
    await page.waitForTimeout(250);
  }

  if (htmlTrigger) {
    await waitForPanelOpen(page, htmlTrigger, resolvedPanelSelector, 3000, sectionSelector);
  }

  const panelForHtml = await resolveOpenPanelForHtml(
    page,
    sectionSelector,
    htmlTrigger,
    resolvedPanelSelector || lastOpenDrawer,
  );
  if (panelForHtml) resolvedPanelSelector = panelForHtml;

  const ensureOpen = async (_p, device) => {
    await ensureStateOpenOnPage(page, {
      sectionSelector,
      state,
      device,
      drawerSelector: lastOpenDrawer,
    });
  };

  const { sectionHtmlRel } = await writeStateSectionHtmlArtifacts(page, {
    pageDir,
    absStateDir,
    sectionSelector,
    panelSelector: resolvedPanelSelector,
    folderName: `${folderName}-${state.slug}`,
    beforeViewportSnapshot: ensureOpen,
    preferredOpenLabel: state.label || '',
  });

  // Tab/accordion: prefer PNGs rendered from styled section.html (matches AI evidence).
  // Exception: triggers under header/nav chrome are mega/drawer menus — offline
  // section.html is desktop mega DOM and collapses when shot at 370/768. Keep live
  // union-clip / live-dom outputs for those (same path as menu-* states).
  if (state.kind === 'tab' || state.kind === 'accordion') {
    const triggerSel =
      state.trigger?.selector || state.path?.[0]?.selector || null;
    const underNavChrome = triggerSel
      ? await page
          .evaluate((sel) => {
            try {
              const el = document.querySelector(sel);
              if (!(el instanceof Element)) return false;
              return Boolean(
                el.closest(
                  [
                    'nav',
                    'header',
                    '[role="navigation"]',
                    '[role="banner"]',
                    '[class*="navigation" i]',
                    '[class*="nav-wrapper" i]',
                    '[class*="main-nav" i]',
                    '[class*="site-header" i]',
                    '[class*="main-header" i]',
                  ].join(', '),
                ),
              );
            } catch {
              return false;
            }
          }, triggerSel)
          .catch(() => false)
      : false;

    if (underNavChrome) {
      console.log(
        `    … skip section-html for nav-chrome ${state.kind} (${state.slug}); keeping live shots`,
      );
    } else {
      const htmlAbs = path.join(absStateDir, SECTION_HTML);
      const htmlShot = await screenshotSectionHtmlDevices(page, {
        htmlPath: htmlAbs,
        sectionDir: absStateDir,
        folderName: `${folderName}-${state.slug}`,
        pageDir,
        devices,
        baseURL: page.url(),
        preferredOpenLabel: state.label || '',
        liveSectionSelector: sectionSelector,
        ensureLiveOpen: ensureOpen,
      });
      for (const device of devices) {
        if (htmlShot.outputs[device]) {
          outputs[device] = htmlShot.outputs[device];
        }
      }
      for (const e of htmlShot.errors || []) {
        console.warn(`    ! state section-html shot (${state.slug}): ${e}`);
      }
    }
  }

  const entry = {
    ...state,
    sectionHtml: sectionHtmlRel,
    panel: {
      ...(state.panel || {}),
      selector: resolvedPanelSelector,
      htmlPath: sectionHtmlRel,
    },
    outputs,
    detection: detectionMode === 'mutation' ? 'mutation' : 'heuristic',
    ...(statesSubdir !== 'states' ? { stateRoot: `${statesSubdir}/` } : {}),
    ...(mutationMeta ? { mutation: mutationMeta } : {}),
    ...(usedMutationFallback ? { fallback: 'heuristic' } : {}),
    ...(Object.keys(viewportNotes).length ? { viewportNotes } : {}),
  };

  await writeFile(path.join(absStateDir, 'state.json'), `${JSON.stringify(entry, null, 2)}\n`, 'utf8');
  return entry;
}

/**
 * Same HTML contract as a normal section folder, for one open interactive state:
 * - original-section.html — raw open-state DOM (section + outside panels)
 * - section.html — self-contained styled snapshot (section root, open state)
 *
 * @param {import('playwright').Page} page
 * @param {{
 *   pageDir: string,
 *   absStateDir: string,
 *   sectionSelector: string,
 *   panelSelector?: string|null,
 *   folderName?: string,
 * }} opts
 * @returns {Promise<{ sectionHtmlRel: string, originalHtmlRel: string, styledErrors: string[] }>}
 */
export async function writeStateSectionHtmlArtifacts(page, opts) {
  const {
    pageDir,
    absStateDir,
    sectionSelector,
    panelSelector = null,
    folderName = 'state',
    beforeViewportSnapshot = null,
    preferredOpenLabel = '',
  } = opts;

  await mkdir(absStateDir, { recursive: true });

  const originalAbs = path.join(absStateDir, ORIGINAL_SECTION_HTML);
  const styledAbs = path.join(absStateDir, SECTION_HTML);
  await saveOpenHtml(page, sectionSelector, panelSelector, originalAbs);

  // Align original-section.html with dual-chrome open state (narrow accordion etc.)
  if (preferredOpenLabel || beforeViewportSnapshot) {
    try {
      const raw = await readFile(originalAbs, 'utf8');
      const synced = await syncOpenStateFromLivePage(page, {
        sectionSelector,
        structureHtml: raw,
        devices: ['desktop', 'tablet', 'mobile'],
        beforeDevice: beforeViewportSnapshot,
        preferredOpenLabel,
      });
      if (synced.html && synced.patched) {
        await writeFile(originalAbs, synced.html, 'utf8');
      }
    } catch (err) {
      console.warn(
        `    ! state original open-sync (${folderName}): ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /** @type {string[]} */
  const styledErrors = [];
  let sectionHtmlRel = path.relative(pageDir, styledAbs).replace(/\\/g, '/');

  try {
    const styled = await saveSectionStyledHtml(page, {
      pageDir,
      sectionDir: absStateDir,
      sectionSelector,
      folderName,
      writeLegacySiblings: false,
      beforeViewportSnapshot,
      preferredOpenLabel,
    });
    if (styled.errors?.length) styledErrors.push(...styled.errors);
    if (styled.sectionHtml) {
      sectionHtmlRel = styled.sectionHtml;
    } else {
      const raw = await readFile(originalAbs, 'utf8').catch(() => '');
      await writeFile(styledAbs, raw || '<!-- empty state section -->\n', 'utf8');
      styledErrors.push('styled: empty — fell back to original-section.html copy');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    styledErrors.push(`styled: ${msg}`);
    try {
      const raw = await readFile(originalAbs, 'utf8').catch(() => '');
      await writeFile(styledAbs, raw || '<!-- empty state section -->\n', 'utf8');
    } catch {
      /* ignore */
    }
  }

  for (const e of styledErrors) {
    console.warn(`    ! state styled-html (${folderName}): ${e}`);
  }

  return {
    sectionHtmlRel,
    originalHtmlRel: path.relative(pageDir, originalAbs).replace(/\\/g, '/'),
    styledErrors,
  };
}

/**
 * Re-open a saved interaction state for HTML-only capture (backfill).
 * Uses label re-resolve when selectors remount (React ids).
 *
 * @returns {Promise<{ panelSelector: string|null }>}
 */
export async function reactivateSavedStateForHtml(page, opts) {
  const {
    sectionSelector,
    state,
    device = 'desktop',
  } = opts;

  const narrow = device === 'tablet' || device === 'mobile';
  await page.setViewportSize(VIEWPORTS[device] || VIEWPORTS.desktop);
  await page.waitForTimeout(120);
  await restoreDefaults(page);

  let resolvedPanelSelector = state.panel?.selector || null;
  let lastOpenDrawer = null;

  if (state.kind === 'menu') {
    const chromeHtml = await ensureNavChromeOpen(
      page,
      sectionSelector,
      device,
      null,
    );
    if (chromeHtml.drawerSelector) {
      resolvedPanelSelector = chromeHtml.drawerSelector;
      lastOpenDrawer = chromeHtml.drawerSelector;
    }
  }

  const triggerSelector = state.trigger?.selector || state.path?.[0]?.selector || null;
  let htmlTrigger = triggerSelector;
  const pathSteps = state.path?.length
    ? state.path
    : triggerSelector
      ? [{ selector: triggerSelector, label: state.label, method: state.trigger?.method || 'click' }]
      : [];

  for (const step of pathSteps) {
    if (!step.selector && !(step.label || state.label)) continue;
    let stepSelector = step.selector || triggerSelector;
    if (step.label || state.label) {
      stepSelector = await resolveVisibleL1Selector(
        page,
        sectionSelector,
        step.selector || triggerSelector,
        step.label || state.label,
        state.kind === 'menu' ? lastOpenDrawer : null,
      );
    }
    if (!stepSelector) continue;
    const method =
      state.kind === 'menu' && narrow
        ? 'click'
        : step.method || state.trigger?.method || 'click';
    await activateTrigger(page, {
      selector: stepSelector,
      method,
      label: step.label || state.label || null,
    });
    htmlTrigger = stepSelector;
    await page.waitForTimeout(250);
  }

  if (htmlTrigger) {
    await waitForPanelOpen(page, htmlTrigger, resolvedPanelSelector, 3000, sectionSelector);
  }

  const panelForHtml = await resolveOpenPanelForHtml(
    page,
    sectionSelector,
    htmlTrigger,
    resolvedPanelSelector || lastOpenDrawer,
  );
  if (panelForHtml) resolvedPanelSelector = panelForHtml;

  return { panelSelector: resolvedPanelSelector };
}

/**
 * Re-click path steps so open tab/accordion survives viewport resize during styled HTML.
 * Does NOT restoreDefaults (would close the panel we need).
 * On narrow viewports, prefer visible accordion / aria-expanded controls by label.
 */
export async function ensureStateOpenOnPage(page, opts) {
  const { sectionSelector, state, device = 'desktop', drawerSelector = null } = opts;
  const narrow = device === 'tablet' || device === 'mobile';
  let lastOpenDrawer = drawerSelector;
  const label = state.label || state.path?.[0]?.label || null;

  if (state.kind === 'menu') {
    const chromeHtml = await ensureNavChromeOpen(page, sectionSelector, device, null);
    if (chromeHtml.drawerSelector) lastOpenDrawer = chromeHtml.drawerSelector;
  }

  // Narrow: click visible accordion header / expanded control by label first
  if (narrow && label && (state.kind === 'tab' || state.kind === 'accordion')) {
    const accordionSel = await page
      .evaluate(
        ({ rootSel, want }) => {
          const norm = (s) =>
            String(s || '')
              .replace(/\s+/g, ' ')
              .trim()
              .toLowerCase();
          const target = norm(want);
          const root = (() => {
            try {
              return document.querySelector(rootSel);
            } catch {
              return null;
            }
          })();
          if (!(root instanceof Element)) return null;
          const isShown = (el) => {
            if (!(el instanceof HTMLElement)) return false;
            const st = window.getComputedStyle(el);
            if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) < 0.1) {
              return false;
            }
            const r = el.getBoundingClientRect();
            return r.width >= 8 && r.height >= 8;
          };
          const cssPath = (el) => {
            if (!(el instanceof Element)) return '';
            if (el.id) {
              try {
                if (document.querySelectorAll(`#${CSS.escape(el.id)}`).length === 1) {
                  return `#${CSS.escape(el.id)}`;
                }
              } catch {
                /* fall through */
              }
            }
            const parts = [];
            let cur = el;
            for (let i = 0; i < 6 && cur && cur !== document.body; i++) {
              let part = cur.tagName.toLowerCase();
              if (cur.id) {
                try {
                  if (document.querySelectorAll(`#${CSS.escape(cur.id)}`).length === 1) {
                    parts.unshift(`#${CSS.escape(cur.id)}`);
                    break;
                  }
                } catch {
                  /* ignore */
                }
              }
              const parent = cur.parentElement;
              if (parent) {
                const same = [...parent.children].filter((c) => c.tagName === cur.tagName);
                if (same.length > 1) part += `:nth-of-type(${same.indexOf(cur) + 1})`;
              }
              parts.unshift(part);
              cur = parent;
            }
            return parts.join(' > ');
          };
          /** @type {HTMLElement[]} */
          const candidates = [];
          for (const el of root.querySelectorAll(
            'button[aria-expanded], [aria-expanded], [role="tab"], summary',
          )) {
            if (!isShown(el)) continue;
            const text = norm(el.getAttribute('aria-label') || el.innerText || el.textContent);
            if (
              text === target ||
              text.startsWith(target) ||
              target.startsWith(text.slice(0, 24))
            ) {
              candidates.push(el);
            }
          }
          // Prefer accordion headers (aria-expanded) over hidden/duplicate tabs
          candidates.sort((a, b) => {
            const score = (el) => {
              let s = 0;
              if (el.hasAttribute('aria-expanded')) s += 10;
              if (/accordion-header/i.test(el.id || '')) s += 8;
              if (el.getAttribute('role') === 'tab') s += 3;
              return s;
            };
            return score(b) - score(a);
          });
          return candidates[0] ? cssPath(candidates[0]) : null;
        },
        { rootSel: sectionSelector, want: label },
      )
      .catch(() => null);

    if (accordionSel) {
      const alreadyOpen = await page.evaluate((sel) => {
        try {
          const el = document.querySelector(sel);
          if (!el) return false;
          return (
            el.getAttribute('aria-expanded') === 'true' ||
            el.getAttribute('aria-selected') === 'true'
          );
        } catch {
          return false;
        }
      }, accordionSel);
      if (!alreadyOpen) {
        await activateTrigger(page, {
          selector: accordionSel,
          method: 'click',
          label,
        });
        await page.waitForTimeout(250);
      }
      const opened = await page.evaluate((sel) => {
        try {
          const el = document.querySelector(sel);
          return (
            el &&
            (el.getAttribute('aria-expanded') === 'true' ||
              el.getAttribute('aria-selected') === 'true')
          );
        } catch {
          return false;
        }
      }, accordionSel);
      if (opened) return { panelSelector: lastOpenDrawer };
    }
  }

  const triggerSelector = state.trigger?.selector || state.path?.[0]?.selector || null;
  const pathSteps = state.path?.length
    ? state.path
    : triggerSelector
      ? [{ selector: triggerSelector, label: state.label, method: state.trigger?.method || 'click' }]
      : [];

  for (const step of pathSteps) {
    if (!step.selector && !(step.label || state.label)) continue;
    let stepSelector = step.selector || triggerSelector;
    if (step.label || state.label) {
      stepSelector = await resolveVisibleL1Selector(
        page,
        sectionSelector,
        step.selector || triggerSelector,
        step.label || state.label,
        state.kind === 'menu' ? lastOpenDrawer : null,
      );
    }
    if (!stepSelector && !(step.label || state.label)) continue;
    const method =
      state.kind === 'menu' && narrow
        ? 'click'
        : step.method || state.trigger?.method || 'click';
    await activateTrigger(page, {
      selector: stepSelector,
      method,
      label: step.label || state.label || null,
    });
    await page.waitForTimeout(200);
  }

  return { panelSelector: lastOpenDrawer };
}

/**
 * One-shot: ensure original-section.html exists (rename legacy section.html if needed),
 * reactivate state, write styled section.html. Does not touch PNGs.
 */
export async function backfillStateSectionHtml(page, opts) {
  const {
    pageDir,
    sectionDir,
    sectionSelector,
    stateSlug,
    statesSubdir = 'states',
    device = 'desktop',
  } = opts;

  const absStateDir = path.join(sectionDir, statesSubdir, stateSlug);
  const stateJsonPath = path.join(absStateDir, 'state.json');
  const state = JSON.parse(await readFile(stateJsonPath, 'utf8'));

  const originalAbs = path.join(absStateDir, ORIGINAL_SECTION_HTML);
  const styledAbs = path.join(absStateDir, SECTION_HTML);
  try {
    await readFile(originalAbs, 'utf8');
  } catch {
    try {
      await rename(styledAbs, originalAbs);
    } catch {
      /* no section.html either — reactivate will write both */
    }
  }

  const { panelSelector } = await reactivateSavedStateForHtml(page, {
    sectionSelector,
    state,
    device,
  });

  const folderName = path.basename(sectionDir);
  const ensureOpen = async (_p, vpDevice) => {
    await ensureStateOpenOnPage(page, {
      sectionSelector,
      state,
      device: vpDevice || device,
    });
  };

  const { sectionHtmlRel, styledErrors } = await writeStateSectionHtmlArtifacts(page, {
    pageDir,
    absStateDir,
    sectionSelector,
    panelSelector,
    folderName: `${folderName}-${state.slug || stateSlug}`,
    beforeViewportSnapshot: ensureOpen,
    preferredOpenLabel: state.label || '',
  });

  const next = {
    ...state,
    sectionHtml: sectionHtmlRel,
    panel: {
      ...(state.panel || {}),
      selector: panelSelector || state.panel?.selector || null,
      htmlPath: sectionHtmlRel,
    },
  };
  await writeFile(stateJsonPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return { state: next, styledErrors };
}

/**
 * Same early-exit predicate used by interactive state capture (pure; testable).
 * @param {object|null|undefined} discovered — discoverTriggersInBrowser result
 * @param {object|null|undefined} hamPreview — findHamburgerInBrowser result
 */
export function hasInteractiveFromDiscovery(discovered, hamPreview = null) {
  const tabCandidatesPreview = (discovered?.tabs || []).filter((t) => !t.selected);
  const accCandidatesPreview = (discovered?.accordion || []).filter((a) => !a.open);
  const menuL1Preview = discovered?.menuL1 || [];
  return {
    hasInteractive:
      tabCandidatesPreview.length > 0 ||
      accCandidatesPreview.length > 0 ||
      menuL1Preview.length > 0 ||
      Boolean(hamPreview?.selector),
    tabCandidatesPreview,
    accCandidatesPreview,
    menuL1Preview,
  };
}

/** True when section meta looks like CMP/consent (skip interactive states). */
export function isCmpSectionMeta(sectionMeta = {}, sectionSelector = '') {
  const blob = [sectionMeta.cmsName, sectionMeta.folderName, sectionSelector].join(' ');
  return CMP_RE.test(blob);
}

/**
 * Lightweight probe: same predicates as captureInteractiveStatesForSection early-exit,
 * without writing state artifacts. Used to choose live vs section.html resting screenshots.
 *
 * @param {import('playwright').Page} page
 * @param {string} sectionSelector
 * @param {object} [sectionMeta] — cmsName / folderName for CMP skip
 * @returns {Promise<{
 *   hasInteractive: boolean,
 *   discovered: object|null,
 *   tabCandidatesPreview: object[],
 *   accCandidatesPreview: object[],
 *   menuL1Preview: object[],
 *   hamPreview: object|null,
 * }>}
 */
export async function sectionHasInteractiveTriggers(
  page,
  sectionSelector,
  sectionMeta = {},
) {
  const empty = {
    hasInteractive: false,
    discovered: null,
    tabCandidatesPreview: [],
    accCandidatesPreview: [],
    menuL1Preview: [],
    hamPreview: null,
  };
  if (!sectionSelector) return empty;
  if (isCmpSectionMeta(sectionMeta, sectionSelector)) return empty;

  await page.setViewportSize(VIEWPORTS.desktop);
  await page.evaluate(hideFloatingWidgetsInPage).catch(() => {});
  const discovered = await page.evaluate(discoverTriggersInBrowser, sectionSelector);

  await page.setViewportSize(VIEWPORTS.mobile);
  await ensureOverlayScrollbars(page);
  await page.waitForTimeout(80);
  const hamPreview = await page
    .evaluate(findHamburgerInBrowser, sectionSelector)
    .catch(() => null);
  await page.setViewportSize(VIEWPORTS.desktop);

  const pred = hasInteractiveFromDiscovery(discovered, hamPreview);
  return {
    hasInteractive: pred.hasInteractive,
    discovered,
    tabCandidatesPreview: pred.tabCandidatesPreview,
    accCandidatesPreview: pred.accCandidatesPreview,
    menuL1Preview: pred.menuL1Preview,
    hamPreview,
  };
}

/**
 * @param {import('playwright').Page} page
 * @param {object} opts
 * @param {string} opts.pageDir
 * @param {string} opts.sectionDir
 * @param {string} opts.folderName
 * @param {string} opts.sectionSelector
 * @param {string[]} [opts.devices]
 * @param {object} [opts.sectionMeta] — cmsName/track for CMP skip
 * @param {object} [opts.probe] — optional result from sectionHasInteractiveTriggers to skip rediscovery
 */
export async function captureInteractiveStatesForSection(page, opts) {
  const {
    pageDir,
    sectionDir,
    folderName,
    sectionSelector,
    devices = resolveScreenshotDevices(),
    sectionMeta = {},
    probe: probeIn = null,
  } = opts;

  if (!sectionSelector) {
    return { interactionStates: [], interactionStatesMutation: [], interactionSummary: null };
  }

  const blob = [sectionMeta.cmsName, sectionMeta.folderName, sectionSelector].join(' ');
  if (CMP_RE.test(blob)) {
    return { interactionStates: [], interactionStatesMutation: [], interactionSummary: null };
  }

  const probe =
    probeIn && typeof probeIn === 'object'
      ? probeIn
      : await sectionHasInteractiveTriggers(page, sectionSelector, sectionMeta);

  const discovered = probe.discovered || {
    tabs: [],
    accordion: [],
    menuL1: [],
  };
  const tabCandidatesPreview = probe.tabCandidatesPreview || [];
  const accCandidatesPreview = probe.accCandidatesPreview || [];
  const menuL1Preview = probe.menuL1Preview || [];
  const hamPreview = probe.hamPreview || null;

  console.log(
    `    … discover: tabs=${(discovered.tabs || []).length} (unselected=${tabCandidatesPreview.length}), menus=${menuL1Preview.length}, accordion=${(discovered.accordion || []).length}`,
  );

  if (menuL1Preview.length === 0) {
    console.log(
      '    … no submenu L1 triggers — treating popup/mega menus as optional; closed section HTML remains authoritative',
    );
  }

  if (!probe.hasInteractive) {
    return { interactionStates: [], interactionStatesMutation: [], interactionSummary: null };
  }

  /** @type {object[]} */
  const interactionStates = [];
  const usedSlugs = new Set();
  let menuCount = 0;
  let tabCount = 0;
  let accordionCount = 0;

  const menuFilter = String(process.env.BQ_MENU_FILTER || '')
    .trim()
    .toLowerCase();
  const menuFilterParts = menuFilter
    ? menuFilter.split('|').map((s) => s.trim()).filter(Boolean)
    : [];

  // --- Tabs (non-selected first) ---
  const tabCandidates = tabCandidatesPreview.slice(0, MAX_NON_MENU_STATES);
  for (const tab of tabCandidates) {
    if (tabCount >= MAX_NON_MENU_STATES) break;
    await restoreDefaults(page);
    const ok = await activateTrigger(page, tab);
    if (!ok) continue;
    const slug = uniqueSlug(`tab-${slugify(tab.label)}`, usedSlugs);
    const state = {
      slug,
      kind: 'tab',
      depth: 1,
      label: tab.label,
      path: [{ depth: 1, label: tab.label, selector: tab.selector, method: 'click' }],
      parentSlug: null,
      trigger: { selector: tab.selector, method: 'click' },
      panel: { selector: null },
      children: [],
    };
    const entry = await captureStateArtifacts(page, {
      pageDir,
      sectionDir,
      folderName,
      sectionSelector,
      devices,
      state,
    });
    interactionStates.push(entry);
    tabCount += 1;
  }

  // --- Accordion (closed items) ---
  const accCandidates = accCandidatesPreview.slice(0, MAX_NON_MENU_STATES - tabCount);
  for (const acc of accCandidates) {
    if (accordionCount + tabCount >= MAX_NON_MENU_STATES) break;
    await restoreDefaults(page);
    const ok = await activateTrigger(page, acc);
    if (!ok) continue;
    const slug = uniqueSlug(`faq-${slugify(acc.label)}`, usedSlugs);
    const state = {
      slug,
      kind: 'accordion',
      depth: 1,
      label: acc.label,
      path: [{ depth: 1, label: acc.label, selector: acc.selector, method: 'click' }],
      parentSlug: null,
      trigger: { selector: acc.selector, method: 'click' },
      panel: { selector: null },
      children: [],
    };
    const entry = await captureStateArtifacts(page, {
      pageDir,
      sectionDir,
      folderName,
      sectionSelector,
      devices,
      state,
    });
    interactionStates.push(entry);
    accordionCount += 1;
  }


  /** Capture menu states under states/ using mutation (DOM before/after) panel detection. */
  const captureMenuState = async (menuState) => {
    const entry = await captureStateArtifacts(page, {
      pageDir,
      sectionDir,
      folderName,
      sectionSelector,
      devices,
      state: menuState,
      statesSubdir: 'states',
      detectionMode: 'mutation',
    });
    return entry;
  };

  // --- Menu L0 (hamburger open — tablet/mobile only) ---
  // Only when THIS section owns a hamburger (nav chrome), not when another section
  // merely sits on a page that has a site-wide menu.
  // Skip L0 unless unfiltered, or filter explicitly asks for open/menu-open/l0.
  const wantL0 =
    !menuFilterParts.length ||
    menuFilterParts.some((f) => /^(open|menu-open|l0|hamburger)$/i.test(f));
  if (menuCount < MAX_MENU_STATES && hamPreview?.selector && wantL0) {
    await page.setViewportSize(VIEWPORTS.mobile);
    await ensureOverlayScrollbars(page);
    await page.waitForTimeout(100);
    await restoreDefaults(page);
    // Prove the drawer actually opens before spending multi-viewport capture time
    const chromeProbe = await ensureNavChromeOpen(
      page,
      sectionSelector,
      'mobile',
      null,
    );
    if (!chromeProbe.opened) {
      await restoreDefaults(page);
      await page.setViewportSize(VIEWPORTS.desktop);
    } else {
      await restoreDefaults(page);
      const l0Slug = uniqueSlug('menu-open', usedSlugs);
      const l0State = {
        slug: l0Slug,
        kind: 'menu',
        depth: 0,
        label: 'Menu',
        path: [],
        parentSlug: null,
        trigger: { selector: hamPreview.selector, method: 'click' },
        panel: { selector: chromeProbe.drawerSelector || null },
        children: [],
        narrowOnly: true,
      };
      const l0Entry = await captureMenuState(l0State);
      // Drop L0 if every narrow viewport failed (no useful artifact)
      const usefulL0 = ['tablet', 'mobile'].some(
        (d) => l0Entry?.outputs?.[d]?.path,
      );
      if (usefulL0) {
        interactionStates.push(l0Entry);
        menuCount += 1;
      }
      await restoreDefaults(page);
      await page.setViewportSize(VIEWPORTS.desktop);
      await page.waitForTimeout(100);
    }
  }

  // --- Menus L1 → L2 → L3 ---
  const l1List = menuL1Preview
    .filter(
      (l1) =>
        !menuFilterParts.length ||
        menuFilterParts.some((f) => String(l1.label || '').toLowerCase().includes(f)),
    )
    .slice(0, MAX_L1);
  for (const l1 of l1List) {
    if (menuCount >= MAX_MENU_STATES) break;
    await restoreDefaults(page);
    const ok1 = await activateTrigger(page, l1);
    if (!ok1) continue;

    const l1Slug = uniqueSlug(`menu-${slugify(l1.label)}`, usedSlugs);
    const l1State = {
      slug: l1Slug,
      kind: 'menu',
      depth: 1,
      label: l1.label,
      path: [{ depth: 1, label: l1.label, selector: l1.selector, method: l1.method || 'hover' }],
      parentSlug: null,
      trigger: { selector: l1.selector, method: l1.method || 'hover' },
      panel: { selector: l1.panelSelector || null },
      children: [],
    };
    const l1Entry = await captureMenuState(l1State);
    interactionStates.push(l1Entry);
    menuCount += 1;

    // Re-open L1 for children (viewport loop closed it)
    await page.setViewportSize(VIEWPORTS.desktop);
    await activateTrigger(page, l1);

    const childrenL2 = (
      await page.evaluate(findChildMenuTriggersInBrowser, l1.selector)
    ).slice(0, MAX_L2_PER_L1);

    for (const l2 of childrenL2) {
      if (menuCount >= MAX_MENU_STATES) break;
      await activateTrigger(page, l1);
      const ok2 = await activateTrigger(page, l2);
      if (!ok2) continue;

      const l2Slug = uniqueSlug(`${l1Slug}--${slugify(l2.label)}`, usedSlugs);
      const l2State = {
        slug: l2Slug,
        kind: 'menu',
        depth: 2,
        label: l2.label,
        path: [
          { depth: 1, label: l1.label, selector: l1.selector, method: l1.method || 'hover' },
          { depth: 2, label: l2.label, selector: l2.selector, method: l2.method || 'hover' },
        ],
        parentSlug: l1Slug,
        trigger: { selector: l2.selector, method: l2.method || 'hover' },
        panel: { selector: null },
        children: [],
      };
      const l2Entry = await captureMenuState(l2State);
      interactionStates.push(l2Entry);
      l1Entry.children.push(l2Slug);
      menuCount += 1;

      // L3 (one per L2)
      if (menuCount >= MAX_MENU_STATES) break;
      await page.setViewportSize(VIEWPORTS.desktop);
      await activateTrigger(page, l1);
      await activateTrigger(page, l2);
      const childrenL3 = (await page.evaluate(findChildMenuTriggersInBrowser, l2.selector)).slice(
        0,
        1,
      );
      for (const l3 of childrenL3) {
        if (menuCount >= MAX_MENU_STATES) break;
        await activateTrigger(page, l1);
        await activateTrigger(page, l2);
        const ok3 = await activateTrigger(page, l3);
        if (!ok3) continue;
        const l3Slug = uniqueSlug(`${l2Slug}--${slugify(l3.label)}`, usedSlugs);
        const l3State = {
          slug: l3Slug,
          kind: 'menu',
          depth: 3,
          label: l3.label,
          path: [
            { depth: 1, label: l1.label, selector: l1.selector, method: l1.method || 'hover' },
            { depth: 2, label: l2.label, selector: l2.selector, method: l2.method || 'hover' },
            { depth: 3, label: l3.label, selector: l3.selector, method: l3.method || 'hover' },
          ],
          parentSlug: l2Slug,
          trigger: { selector: l3.selector, method: l3.method || 'hover' },
          panel: { selector: null },
          children: [],
        };
        const l3Entry = await captureMenuState(l3State);
        interactionStates.push(l3Entry);
        l2Entry.children.push(l3Slug);
        menuCount += 1;
      }
    }
  }

  await restoreDefaults(page);
  await page.setViewportSize(VIEWPORTS.desktop);

  if (!interactionStates.length) {
    return {
      interactionStates: [],
      interactionStatesMutation: [],
      interactionSummary: null,
    };
  }

  const maxMenuDepth = interactionStates
    .filter((s) => s.kind === 'menu')
    .reduce((m, s) => Math.max(m, Number(s.depth) || 0), 0);

  const interactionSummary = {
    hasMenu: menuCount > 0,
    maxMenuDepth,
    menuStateCount: menuCount,
    tabStateCount: tabCount,
    accordionStateCount: accordionCount,
    stateRoot: 'states/',
  };

  // Menus write mutation panels into states/ only (no parallel statesbymutation/).
  return { interactionStates, interactionStatesMutation: [], interactionSummary };
}
