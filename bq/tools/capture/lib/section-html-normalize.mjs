/**
 * Normalize section.html snapshots before offline screenshots:
 * - Reset large marquee/carousel translate transforms frozen mid-scroll
 * - Undo capture-time data-screenshot-hidden chrome stamps on content media
 * - Probe whether the shot root has visible content (blank-PNG guard)
 */

const MARQUEE_TX_THRESHOLD_PX = 48;

/**
 * Parse tx/ty from a CSS transform string (translate / translate3d / matrix).
 * @param {string} transform
 * @returns {{ tx: number, ty: number }|null}
 */
export function parseTranslateAxes(transform) {
  const v = String(transform || '').trim();
  if (!v || v === 'none') return null;
  let m = v.match(/translate3d\(\s*([-\d.]+)(px|%)?\s*,\s*([-\d.]+)(px|%)?\s*,/i);
  if (m) {
    return { tx: Number(m[1]) || 0, ty: Number(m[3]) || 0 };
  }
  m = v.match(/translate\(\s*([-\d.]+)(px|%)?\s*(?:,\s*([-\d.]+)(px|%)?)?\s*\)/i);
  if (m) {
    return { tx: Number(m[1]) || 0, ty: Number(m[3]) || 0 };
  }
  m = v.match(/translateX\(\s*([-\d.]+)(px|%)?\s*\)/i);
  if (m) {
    return { tx: Number(m[1]) || 0, ty: 0 };
  }
  m = v.match(/translateY\(\s*([-\d.]+)(px|%)?\s*\)/i);
  if (m) {
    return { tx: 0, ty: Number(m[1]) || 0 };
  }
  m = v.match(/matrix\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/i);
  if (m) {
    return { tx: Number(m[5]) || 0, ty: Number(m[6]) || 0 };
  }
  return null;
}

/**
 * True when transform is a large pure-translate (marquee mid-scroll).
 * @param {string} transform
 * @param {number} [thresholdPx]
 */
export function isLargeMarqueeTranslate(transform, thresholdPx = MARQUEE_TX_THRESHOLD_PX) {
  const axes = parseTranslateAxes(transform);
  if (!axes) return false;
  return Math.abs(axes.tx) >= thresholdPx || Math.abs(axes.ty) >= thresholdPx;
}

/**
 * Browser-side: reset large translate transforms (inline + computed style override)
 * so marquees/carousels rest at the start for section-html screenshots.
 * Self-contained for page.evaluate().
 * @param {string} [rootSelector] — limit to a subtree; default document
 * @returns {number} count reset
 */
export function resetMarqueeTransformsInPage(rootSelector) {
  const THRESH = 48;
  const root = rootSelector
    ? (() => {
        try {
          return document.querySelector(rootSelector);
        } catch {
          return null;
        }
      })()
    : document.body || document.documentElement;
  if (!(root instanceof Element)) return 0;

  function parseAxes(transform) {
    const v = String(transform || '').trim();
    if (!v || v === 'none') return null;
    let m = v.match(/translate3d\(\s*([-\d.]+)(px|%)?\s*,\s*([-\d.]+)(px|%)?\s*,/i);
    if (m) return { tx: Number(m[1]) || 0, ty: Number(m[3]) || 0 };
    m = v.match(/translate\(\s*([-\d.]+)(px|%)?\s*(?:,\s*([-\d.]+)(px|%)?)?\s*\)/i);
    if (m) return { tx: Number(m[1]) || 0, ty: Number(m[3]) || 0 };
    m = v.match(/translateX\(\s*([-\d.]+)(px|%)?\s*\)/i);
    if (m) return { tx: Number(m[1]) || 0, ty: 0 };
    m = v.match(/translateY\(\s*([-\d.]+)(px|%)?\s*\)/i);
    if (m) return { tx: 0, ty: Number(m[1]) || 0 };
    m = v.match(
      /matrix\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/i,
    );
    if (m) return { tx: Number(m[5]) || 0, ty: Number(m[6]) || 0 };
    return null;
  }

  function shouldReset(el, transform) {
    const axes = parseAxes(transform);
    if (!axes) return false;
    if (Math.abs(axes.tx) >= THRESH || Math.abs(axes.ty) >= THRESH) return true;
    if (
      el.closest(
        '[aria-roledescription="carousel"], [class*="LogoCarousel" i], [class*="logo-carousel" i], [class*="marquee" i]',
      ) &&
      (Math.abs(axes.tx) > 0.5 || Math.abs(axes.ty) > 0.5)
    ) {
      return true;
    }
    return false;
  }

  function clearInlineTransform(el) {
    const st = el.getAttribute('style');
    if (!st || !/transform\s*:/i.test(st)) return;
    const next = st
      .replace(/(?:^|;)\s*transform\s*:[^;]*/gi, '')
      .replace(/;;+/g, ';')
      .replace(/^;|;$/g, '')
      .trim();
    if (next) el.setAttribute('style', next);
    else el.removeAttribute('style');
  }

  let count = 0;
  const nodes = [root, ...root.querySelectorAll('*')];
  for (const el of nodes) {
    if (!(el instanceof HTMLElement)) continue;
    const inline = el.style?.transform || '';
    const computed = window.getComputedStyle(el).transform || '';
    const candidate = inline && inline !== 'none' ? inline : computed;
    if (!shouldReset(el, candidate) && !shouldReset(el, inline)) continue;
    clearInlineTransform(el);
    el.style.setProperty('transform', 'none', 'important');
    el.style.setProperty('translate', 'none', 'important');
    count += 1;
  }
  return count;
}

/**
 * Browser-side: strip capture-time chrome-hide stamps so content media is visible
 * in offline section.html shots.
 * @param {string} [rootSelector]
 * @returns {number}
 */
export function stripScreenshotHideAttrsInPage(rootSelector) {
  const root = rootSelector
    ? (() => {
        try {
          return document.querySelector(rootSelector);
        } catch {
          return null;
        }
      })()
    : document.body || document.documentElement;
  if (!(root instanceof Element)) return 0;
  let count = 0;
  const nodes = [root, ...root.querySelectorAll('[data-screenshot-hidden]')];
  for (const el of nodes) {
    if (!(el instanceof HTMLElement)) continue;
    const tag = el.getAttribute('data-screenshot-hidden');
    if (!tag) continue;
    // Keep intentional cookie hides out of content sections — but section.html
    // should never ship chrome-hide on logos / carousel media.
    el.removeAttribute('data-screenshot-hidden');
    el.style.removeProperty('display');
    el.style.removeProperty('visibility');
    el.style.removeProperty('opacity');
    el.style.removeProperty('pointer-events');
    if (el.getAttribute('aria-hidden') === 'true' && el.tagName !== 'IMG') {
      /* keep decorative aria-hidden on skeletons */
    } else if (el.getAttribute('aria-hidden') === 'true' && el.tagName === 'IMG') {
      el.removeAttribute('aria-hidden');
    }
    count += 1;
  }
  return count;
}

/**
 * Browser-side: true when the preferred shot root (or body) has visible text/media.
 * Used to fail closed on blank section-html screenshots.
 * @param {string} [rootSelector]
 */
export function sectionHtmlHasVisibleContentInPage(rootSelector) {
  const root =
    (rootSelector &&
      (() => {
        try {
          return document.querySelector(rootSelector);
        } catch {
          return null;
        }
      })()) ||
    document.querySelector('[data-bq-html-shot-root="1"]') ||
    document.body;
  if (!(root instanceof HTMLElement)) return false;

  const textLen = (root.innerText || '').replace(/\s+/g, ' ').trim().length;
  if (textLen >= 12) return true;

  for (const media of root.querySelectorAll('img, svg, video, canvas')) {
    if (!(media instanceof Element)) continue;
    const st = window.getComputedStyle(media);
    if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) {
      continue;
    }
    const r = media.getBoundingClientRect();
    if (r.width >= 24 && r.height >= 24) return true;
  }

  // Non-white / non-transparent painted area (gradients, logo strips)
  for (const el of root.querySelectorAll('*')) {
    if (!(el instanceof HTMLElement)) continue;
    const st = window.getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 24) continue;
    const bg = st.backgroundColor || '';
    const m = bg.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?/i);
    if (!m) continue;
    const a = m[4] === undefined ? 1 : Number(m[4]);
    if (a < 0.08) continue;
    const rC = Number(m[1]);
    const gC = Number(m[2]);
    const bC = Number(m[3]);
    // Anything not near-white counts as content paint
    if (rC < 245 || gC < 245 || bC < 245) return true;
  }
  return false;
}

/**
 * Strip large translate(...) from an inline style attribute string (Node-side HTML).
 * @param {string} styleAttr
 */
export function scrubMarqueeTransformFromStyleAttr(styleAttr) {
  const st = String(styleAttr || '');
  if (!st || !/transform\s*:/i.test(st)) return st;
  return st
    .replace(/(?:^|;)\s*transform\s*:\s*([^;]+)/gi, (full, value) => {
      if (isLargeMarqueeTranslate(value)) return '';
      // Always drop translate on known mid-scroll marquees (any non-zero)
      const axes = parseTranslateAxes(value);
      if (axes && (Math.abs(axes.tx) > 0.5 || Math.abs(axes.ty) > 0.5)) {
        // Only when clearly a pure translate (no rotate/scale)
        if (/^\s*translate(3d|X|Y)?\(/i.test(String(value).trim()) || /^\s*matrix\(/i.test(String(value).trim())) {
          if (!/rotate|scale|skew/i.test(value)) return '';
        }
      }
      return full;
    })
    .replace(/;;+/g, ';')
    .replace(/^;|;$/g, '')
    .trim();
}

/**
 * Undo capture-time hide stamps left in inline style (display:none !important + opacity:0).
 * @param {string} styleAttr
 */
export function scrubCaptureHideFromStyleAttr(styleAttr) {
  let st = String(styleAttr || '');
  if (!st) return st;
  if (!/display\s*:\s*none/i.test(st) || !/opacity\s*:\s*0/i.test(st)) return st;
  st = st
    .replace(/(?:^|;)\s*display\s*:\s*none(?:\s*!important)?\s*/gi, '')
    .replace(/(?:^|;)\s*visibility\s*:\s*hidden(?:\s*!important)?\s*/gi, '')
    .replace(/(?:^|;)\s*opacity\s*:\s*0(?:\s*!important)?\s*/gi, '')
    .replace(/(?:^|;)\s*pointer-events\s*:\s*none(?:\s*!important)?\s*/gi, '')
    .replace(/;;+/g, ';')
    .replace(/^;|;$/g, '')
    .trim();
  return st;
}

/**
 * Post-process cloned section HTML string: reset marquee transforms + strip hide attrs.
 * @param {string} html
 */
export function normalizeSectionHtmlSnapshot(html) {
  let out = String(html || '');
  // Strip screenshot-hide markers from content clones
  out = out.replace(/\s*data-screenshot-hidden="[^"]*"/gi, '');
  // Scrub style="...transform: translate3d(-NNNN...)" and capture hide stamps
  out = out.replace(/\sstyle="([^"]*)"/gi, (full, styleVal) => {
    let next = scrubMarqueeTransformFromStyleAttr(styleVal);
    next = scrubCaptureHideFromStyleAttr(next);
    if (!next) return '';
    if (next === styleVal) return full;
    return ` style="${next}"`;
  });
  return out;
}
