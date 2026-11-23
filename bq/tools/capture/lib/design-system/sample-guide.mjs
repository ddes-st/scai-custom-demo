/**
 * Focused DOM sampling for the design guide (not all divs).
 */
import {
  normalizeColor,
  normalizeFamily,
  parsePx,
  snapPx,
  formatPx,
  isUaLinkColor,
} from './style-utils.mjs';

function snapLength(value) {
  const n = parsePx(value);
  if (n == null) return value === '0px' ? '0px' : null;
  return formatPx(snapPx(n, 2));
}

/**
 * @param {import('playwright').Page} page
 */
export async function sampleDesignGuide(page) {
  return page.evaluate(() => {
    function visible(el) {
      if (!(el instanceof Element)) return false;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width >= 2 && r.height >= 2;
    }

    function shortSel(el) {
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${CSS.escape(el.id)}` : '';
      const cls = (el.className?.toString() || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((c) => `.${CSS.escape(c)}`)
        .join('');
      return `${tag}${id}${cls}`.slice(0, 140);
    }

    function box(cs, prefix) {
      return {
        top: cs[`${prefix}Top`],
        right: cs[`${prefix}Right`],
        bottom: cs[`${prefix}Bottom`],
        left: cs[`${prefix}Left`],
      };
    }

    function snapshot(el) {
      const cs = getComputedStyle(el);
      const family = cs.fontFamily?.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '') || null;
      return {
        selector: shortSel(el),
        tag: el.tagName.toLowerCase(),
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        borderColor: cs.borderTopColor,
        borderWidth: cs.borderTopWidth,
        borderStyle: cs.borderTopStyle,
        fontFamily: family,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        fontStyle: cs.fontStyle,
        lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing,
        textTransform: cs.textTransform,
        textDecoration: cs.textDecorationLine || cs.textDecoration,
        textAlign: cs.textAlign,
        borderRadius: cs.borderTopLeftRadius,
        padding: box(cs, 'padding'),
        margin: box(cs, 'margin'),
        gap: cs.gap,
        boxShadow: cs.boxShadow,
        display: cs.display,
        alignItems: cs.alignItems,
        justifyContent: cs.justifyContent,
        maxWidth: cs.maxWidth,
        whiteSpace: cs.whiteSpace,
        width: el.getBoundingClientRect().width,
      };
    }

    function collect(selector, limit = 80) {
      const out = [];
      for (const el of document.querySelectorAll(selector)) {
        if (out.length >= limit) break;
        if (!visible(el)) continue;
        out.push(snapshot(el));
      }
      return out;
    }

    const buttons = [
      ...collect('button', 40),
      ...collect('[role="button"]', 20),
      ...collect(
        'a.btn, a[class*="btn"], a[class*="Btn"], a[class*="cta"], a[class*="Cta"], a[class*="Button"], a[class*="button"]',
        50,
      ),
      ...collect('[class*="CtaLink"], [class*="cta-link"]', 40),
    ];

    // Dedupe buttons by selector
    const seenBtn = new Set();
    const buttonSnaps = [];
    for (const b of buttons) {
      if (seenBtn.has(b.selector)) continue;
      seenBtn.add(b.selector);
      buttonSnaps.push(b);
    }

    const links = collect('a[href]', 100).filter((a) => a.width >= 20);

    const sections = [
      ...collect('section', 40),
      ...collect('article', 20),
      ...collect('main > *', 40),
      ...collect('[class*="Section"], [class*="section"], [class*="Band"], [class*="Promo"]', 40),
    ];

    return {
      h1: collect('h1', 30),
      h2: collect('h2', 40),
      h3: collect('h3', 40),
      body: collect('p', 60),
      buttons: buttonSnaps.slice(0, 80),
      links: links.slice(0, 80),
      sections: sections.slice(0, 60),
      viewport: { width: window.innerWidth, height: window.innerHeight },
      url: location.href,
    };
  }).then((raw) => normalizeSample(raw));
}

function padSum(box) {
  if (!box) return 0;
  const n = (v) => parsePx(v) ?? 0;
  return n(box.top) + n(box.right) + n(box.bottom) + n(box.left);
}

function isFilledBg(bg) {
  return Boolean(bg && bg !== 'transparent' && !isUaLinkColor(bg));
}

function looksLikeButton(snap) {
  if (!snap) return false;
  if (isFilledBg(snap.backgroundColor)) return true;
  if (padSum(snap.padding) >= 16) return true;
  if (/btn|button|cta|ctaLink/i.test(snap.selector || '')) return true;
  return (
    (snap.display === 'flex' || snap.display === 'inline-flex' || snap.display === 'inline-block') &&
    padSum(snap.padding) >= 8
  );
}

function normalizeBox(box) {
  if (!box) return null;
  return {
    top: snapLength(box.top),
    right: snapLength(box.right),
    bottom: snapLength(box.bottom),
    left: snapLength(box.left),
  };
}

function normalizeSnap(snap) {
  const color = normalizeColor(snap.color);
  const backgroundColor = normalizeColor(snap.backgroundColor);
  const borderColor = normalizeColor(snap.borderColor);
  return {
    ...snap,
    color,
    backgroundColor,
    borderColor,
    borderWidth: snapLength(snap.borderWidth) || snap.borderWidth,
    fontFamily: normalizeFamily(snap.fontFamily) || snap.fontFamily,
    fontSize: snapLength(snap.fontSize) || snap.fontSize,
    borderRadius: snapLength(snap.borderRadius) || snap.borderRadius,
    padding: normalizeBox(snap.padding),
    margin: normalizeBox(snap.margin),
    gap: snapLength(snap.gap),
    maxWidth:
      snap.maxWidth && snap.maxWidth !== 'none' ? snapLength(snap.maxWidth) || snap.maxWidth : null,
    lineHeight: (() => {
      const px = parsePx(snap.lineHeight);
      const fs = parsePx(snap.fontSize);
      if (px != null && fs) return String(Math.round((px / fs) * 100) / 100);
      return snap.lineHeight;
    })(),
  };
}

function normalizeSample(raw) {
  const mapList = (list, filterFn) =>
    (list || []).map(normalizeSnap).filter((s) => (filterFn ? filterFn(s) : true));

  const buttons = mapList(raw.buttons);
  const links = mapList(raw.links, (s) => !isUaLinkColor(s.color));

  // Promote button-like anchors into actions.button (after color normalize)
  const seen = new Set(buttons.map((b) => b.selector).filter(Boolean));
  for (const link of links) {
    if (!looksLikeButton(link)) continue;
    if (seen.has(link.selector)) continue;
    seen.add(link.selector);
    buttons.push(link);
  }

  return {
    url: raw.url,
    viewport: raw.viewport,
    h1: mapList(raw.h1),
    h2: mapList(raw.h2),
    h3: mapList(raw.h3),
    body: mapList(raw.body),
    buttons,
    links,
    sections: mapList(raw.sections),
  };
}
