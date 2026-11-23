/**
 * Inspect visible DOM for design-system evidence (Playwright page.evaluate).
 */

function parsePx(value) {
  if (!value || value === 'auto' || value === 'none' || value === 'normal') return null;
  const m = String(value).match(/^(-?[\d.]+)px$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {import('playwright').Page} page
 */
export async function inspectDom(page) {
  return page.evaluate(() => {
    const parsePxInner = (value) => {
      if (!value || value === 'auto' || value === 'none' || value === 'normal') return null;
      const m = String(value).match(/^(-?[\d.]+)px$/);
      if (!m) return null;
      const n = Number(m[1]);
      return Number.isFinite(n) ? n : null;
    };

    function isVisible(el) {
      if (!(el instanceof Element)) return false;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width >= 2 && r.height >= 2;
    }

    function shortSelector(el) {
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${CSS.escape(el.id)}` : '';
      const cls = (el.className?.toString() || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((c) => `.${CSS.escape(c)}`)
        .join('');
      return `${tag}${id}${cls}`.slice(0, 120);
    }

    function areaOf(el) {
      const r = el.getBoundingClientRect();
      return Math.max(0, r.width) * Math.max(0, r.height);
    }

    const cssVariables = {};
    for (const root of [document.documentElement, document.body]) {
      if (!root) continue;
      const cs = getComputedStyle(root);
      for (let i = 0; i < cs.length; i++) {
        const key = cs[i];
        if (!key.startsWith('--')) continue;
        if (/^--(osano|onetrust|cookie|tw-|bs-|bootstrap-|gpc-)/i.test(key)) continue;
        cssVariables[key] = cs.getPropertyValue(key).trim();
      }
    }

    const samples = [];
    const buttons = [];
    const links = [];
    const typography = [];
    const MAX = 900;
    const selectors = [
      'body',
      'header',
      'nav',
      'main',
      'footer',
      'section',
      'article',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'p',
      'a',
      'button',
      '[role="button"]',
      '[class*="btn"]',
      '[class*="cta"]',
      '[class*="hero"]',
      'li',
      'div',
    ];

    const seen = new Set();
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        if (seen.has(el) || samples.length >= MAX) continue;
        if (!isVisible(el)) continue;
        seen.add(el);

        const cs = getComputedStyle(el);
        const tag = el.tagName.toLowerCase();
        const className = el.className?.toString() ?? '';
        const area = areaOf(el);
        const roleHint =
          /^h[1-6]$/.test(tag)
            ? 'heading'
            : tag === 'button' || /btn|cta|button/i.test(className) || el.getAttribute('role') === 'button'
              ? 'button'
              : tag === 'a'
                ? 'link'
                : tag === 'nav' || tag === 'header'
                  ? 'nav'
                  : tag === 'footer'
                    ? 'footer'
                    : /hero|banner/i.test(className)
                      ? 'hero'
                      : tag === 'p'
                        ? 'body'
                        : 'other';

        const sample = {
          tag,
          selector: shortSelector(el),
          roleHint,
          area,
          className: className.slice(0, 160),
          color: cs.color,
          backgroundColor: cs.backgroundColor,
          borderColor: cs.borderTopColor,
          fontFamily: cs.fontFamily,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          lineHeight: cs.lineHeight,
          letterSpacing: cs.letterSpacing,
          textTransform: cs.textTransform,
          paddingTop: cs.paddingTop,
          paddingRight: cs.paddingRight,
          paddingBottom: cs.paddingBottom,
          paddingLeft: cs.paddingLeft,
          marginTop: cs.marginTop,
          marginBottom: cs.marginBottom,
          gap: cs.gap,
          borderRadius: cs.borderRadius,
          borderTopLeftRadius: cs.borderTopLeftRadius,
          boxShadow: cs.boxShadow,
          maxWidth: cs.maxWidth,
          width: cs.width,
          display: cs.display,
          backgroundImage: cs.backgroundImage,
        };
        samples.push(sample);

        if (roleHint === 'button' || tag === 'button') {
          buttons.push({
            selector: sample.selector,
            area,
            color: cs.color,
            backgroundColor: cs.backgroundColor,
            borderColor: cs.borderTopColor,
            borderRadius: cs.borderRadius,
            fontFamily: cs.fontFamily,
            fontSize: cs.fontSize,
            fontWeight: cs.fontWeight,
            paddingTop: cs.paddingTop,
            paddingRight: cs.paddingRight,
            paddingBottom: cs.paddingBottom,
            paddingLeft: cs.paddingLeft,
            text: (el.textContent || '').trim().slice(0, 80),
          });
        }

        if (tag === 'a' && !el.closest('nav, header')) {
          links.push({
            selector: sample.selector,
            area,
            color: cs.color,
            textDecoration: cs.textDecorationLine,
            fontWeight: cs.fontWeight,
            text: (el.textContent || '').trim().slice(0, 80),
          });
        }

        if (/^h[1-6]$/.test(tag) || tag === 'p' || roleHint === 'button' || roleHint === 'nav') {
          typography.push({
            role:
              /^h[1-6]$/.test(tag)
                ? tag
                : roleHint === 'button'
                  ? 'button'
                  : roleHint === 'nav'
                    ? 'nav'
                    : tag === 'a'
                      ? 'link'
                      : 'body',
            fontFamily: cs.fontFamily,
            fontSize: cs.fontSize,
            fontWeight: cs.fontWeight,
            lineHeight: cs.lineHeight,
            letterSpacing: cs.letterSpacing,
            textTransform: cs.textTransform,
            color: cs.color,
            area,
            selector: sample.selector,
          });
        }
      }
    }

    // Pseudo-elements with content
    const pseudos = [];
    for (const el of seen) {
      if (pseudos.length >= 80) break;
      for (const pseudo of ['::before', '::after']) {
        try {
          const pcs = getComputedStyle(el, pseudo);
          const content = pcs.content;
          if (!content || content === 'none' || content === 'normal') continue;
          const bg = pcs.backgroundColor;
          const color = pcs.color;
          if ((bg && bg !== 'rgba(0, 0, 0, 0)') || color) {
            pseudos.push({
              selector: `${shortSelector(el)}${pseudo}`,
              content: content.slice(0, 40),
              color,
              backgroundColor: bg,
              area: areaOf(el) * 0.25,
            });
          }
        } catch {
          /* ignore */
        }
      }
    }

    // SVG fill/stroke (limited)
    const svgColors = [];
    for (const el of document.querySelectorAll('svg [fill], svg [stroke], path, circle, rect')) {
      if (svgColors.length >= 40) break;
      if (!isVisible(el.closest('svg') || el)) continue;
      const cs = getComputedStyle(el);
      const fill = el.getAttribute('fill') || cs.fill;
      const stroke = el.getAttribute('stroke') || cs.stroke;
      if (fill && fill !== 'none' && fill !== 'currentColor') {
        svgColors.push({ value: fill, prop: 'fill', area: areaOf(el) || 100 });
      }
      if (stroke && stroke !== 'none' && stroke !== 'currentColor') {
        svgColors.push({ value: stroke, prop: 'stroke', area: areaOf(el) || 50 });
      }
    }

    const breakpoints = new Set();
    try {
      for (const sheet of document.styleSheets) {
        let rules;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }
        if (!rules) continue;
        for (const rule of rules) {
          if (rule.type !== CSSRule.MEDIA_RULE) continue;
          const mq = rule.media?.mediaText || '';
          const widths = [...mq.matchAll(/\(min-width:\s*([\d.]+)px\)/gi)].map((m) => Number(m[1]));
          const maxes = [...mq.matchAll(/\(max-width:\s*([\d.]+)px\)/gi)].map((m) => Number(m[1]));
          for (const w of [...widths, ...maxes]) {
            if (w >= 320 && w <= 1920) breakpoints.add(w);
          }
        }
      }
    } catch {
      /* cross-origin sheets */
    }

    return {
      cssVariables,
      samples,
      buttons: buttons.slice(0, 40),
      links: links.slice(0, 60),
      typography: typography.slice(0, 200),
      pseudos,
      svgColors,
      breakpoints: [...breakpoints].sort((a, b) => a - b),
      viewport: { width: window.innerWidth, height: window.innerHeight },
      url: location.href,
    };
  });
}

export { parsePx };
