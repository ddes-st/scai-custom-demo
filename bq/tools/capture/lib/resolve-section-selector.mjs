/**
 * Browser-side: resolve the best selector for a section at the current viewport.
 * Must be self-contained for page.evaluate().
 */
export function resolveSectionSelectorInPage(sectionMeta) {
  function isVisible(el, minW = 40, minH = 24) {
    if (!el || !(el instanceof Element)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    return rect.width >= minW && rect.height >= minH;
  }

  function buildSelector(el) {
    if (!(el instanceof Element)) return null;
    if (el.id) return `#${CSS.escape(el.id)}`;

    const webid = el.getAttribute('data-webid') || el.dataset?.webid;
    if (webid) {
      const sel = `[data-webid="${CSS.escape(webid)}"]`;
      if (document.querySelector(sel) === el) return sel;
    }

    for (const child of el.querySelectorAll('[data-webid]')) {
      const wid = child.getAttribute('data-webid');
      if (!wid) continue;
      const inner = `[data-webid="${CSS.escape(wid)}"]`;
      if (document.querySelectorAll(inner).length !== 1) continue;
      const hasSel = `section:has(${inner})`;
      try {
        const matches = document.querySelectorAll(hasSel);
        if (matches.length === 1 && matches[0] === el) return hasSel;
      } catch {
        /* :has unsupported — fall through */
      }
      if (el.contains(child)) return inner;
    }

    const stableClasses = [...el.classList].filter(
      (c) =>
        c &&
        !c.startsWith('lfr-layout-structure-item-') &&
        !/^js-/.test(c) &&
        !/^is-/.test(c) &&
        !/^col-/.test(c) &&
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
        const siblings = [...parent.children].filter((c) => c.tagName === node.tagName);
        if (siblings.length > 1) {
          part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
        }
      }
      parts.unshift(part);
      node = parent;
    }
    return parts.join(' > ');
  }

  function findByAnchorWebid(webid) {
    if (!webid) return null;
    const inner = `[data-webid="${CSS.escape(webid)}"]`;
    const target = document.querySelector(inner);
    if (!target) return null;
    const hasSel = `section:has(${inner})`;
    try {
      const host = document.querySelector(hasSel);
      if (host && isVisible(host)) return host;
    } catch {
      /* :has unsupported */
    }
    let node = target;
    while (node && node !== document.body) {
      if (node.matches('section, article, main > div, [class*="section"]') && isVisible(node)) {
        return node;
      }
      node = node.parentElement;
    }
    return isVisible(target) ? target : null;
  }

  function findByHeading(text) {
    if (!text) return null;
    const normalized = text.trim().toLowerCase();
    if (!normalized) return null;
    for (const h of document.querySelectorAll('h1, h2, h3, .section__title')) {
      if (h.textContent?.trim().toLowerCase() !== normalized) continue;
      const host =
        h.closest('section, article, [class*="section"], header, footer') ||
        h.closest('main > div, #main-content > div');
      if (host && isVisible(host)) return host;
    }
    return null;
  }

  const { selector, anchorWebid, heading } = sectionMeta ?? {};

  /** @type {Element | null} */
  let el = null;

  if (selector) {
    try {
      const candidate = document.querySelector(selector);
      if (candidate && isVisible(candidate)) el = candidate;
    } catch {
      /* invalid selector */
    }
  }

  if (!el && anchorWebid) el = findByAnchorWebid(anchorWebid);
  if (!el && heading) el = findByHeading(heading);

  if (!el && selector) {
    try {
      el = document.querySelector(selector);
    } catch {
      /* ignore */
    }
  }

  if (!el || !isVisible(el)) return null;
  const resolved = buildSelector(el);
  if (!resolved) return null;
  try {
    if (document.querySelector(resolved) !== el) return selector ?? null;
  } catch {
    return selector ?? null;
  }
  return resolved;
}
