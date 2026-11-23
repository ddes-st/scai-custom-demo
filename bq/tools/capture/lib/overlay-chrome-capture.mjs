/**
 * Overlay chrome capture helpers (site-agnostic).
 * - Prefer the live element box for short full-bleed chrome
 * - Temporarily neutralize overlapping/transparent chrome for clean shots + menus
 * - Detect presentation variants (overlapping vs solid/pinned)
 */

function isTransparentColor(bg) {
  if (!bg || bg === 'transparent') return true;
  const m = String(bg).match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i);
  if (!m) return false;
  if (m[4] === undefined) return false;
  return Number(m[4]) < 0.08;
}

function isLightCssColor(color) {
  const m = String(color || '').match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (!m) return true;
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  // Relative luminance
  const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return L > 0.55;
}

/**
 * Browser-side: probe solid chrome styles (often appear after scroll), then
 * neutralize overlapping/transparent/sticky positioning for capture.
 * Must be self-contained for page.evaluate().
 */
export function prepareChromeCaptureModeInPage(sel) {
  const el = document.querySelector(sel);
  if (!(el instanceof HTMLElement)) return { ok: false };

  const isTransparentColor = (bg) => {
    if (!bg || bg === 'transparent') return true;
    const m = String(bg).match(
      /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i,
    );
    if (!m) return false;
    if (m[4] === undefined) return false;
    return Number(m[4]) < 0.08;
  };
  const isLightCssColor = (color) => {
    const m = String(color || '').match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if (!m) return true;
    const r = Number(m[1]);
    const g = Number(m[2]);
    const b = Number(m[3]);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55;
  };

  const cs0 = window.getComputedStyle(el);
  const wasTransparent = isTransparentColor(cs0.backgroundColor);
  const overlapHint = /overlap|overlapping|over-?hero|on-?hero|transparent|ghost/i.test(
    String(el.className || ''),
  );

  let solidBg = null;
  let solidColor = null;
  let solidHeight = null;
  if (wasTransparent || overlapHint) {
    const maxY = Math.max(
      0,
      Math.min(
        (document.documentElement.scrollHeight || 0) - (window.innerHeight || 900),
        Math.max(window.innerHeight || 900, 600),
      ),
    );
    window.scrollTo(0, maxY);
  }

  // Sync probe — caller should wait a tick after evaluate if scroll was needed.
  // We still sample immediately; Playwright wait wraps this.
  const csScroll = window.getComputedStyle(el);
  if (!isTransparentColor(csScroll.backgroundColor)) {
    solidBg = csScroll.backgroundColor;
    solidColor = csScroll.color;
    solidHeight = Math.round(el.getBoundingClientRect().height);
  }
  window.scrollTo(0, 0);

  el.dataset.bqChromeCapture = '1';
  el.dataset.bqChromePrevClass = el.className;
  el.dataset.bqChromePrevStyle = el.getAttribute('style') || '';

  const removed = [];
  for (const c of [...el.classList]) {
    if (/overlap|overlapping|minimize|transparent|on-?hero|over-?hero|ghost/i.test(c)) {
      el.classList.remove(c);
      removed.push(c);
    }
  }

  if (solidBg) {
    el.style.setProperty('background-color', solidBg, 'important');
    if (solidColor) el.style.setProperty('color', solidColor, 'important');
  } else if (wasTransparent || overlapHint) {
    const lightFg = isLightCssColor(cs0.color);
    el.style.setProperty('background-color', lightFg ? '#111111' : '#ffffff', 'important');
  }

  const pos = window.getComputedStyle(el).position;
  if (pos === 'fixed' || pos === 'sticky' || pos === 'absolute') {
    el.style.setProperty('position', 'relative', 'important');
    el.style.setProperty('top', 'auto', 'important');
    el.style.setProperty('bottom', 'auto', 'important');
    el.style.setProperty('left', '0', 'important');
    el.style.setProperty('right', '0', 'important');
    el.style.setProperty('width', '100%', 'important');
    el.style.setProperty('z-index', 'auto', 'important');
  }

  const after = window.getComputedStyle(el);
  return {
    ok: true,
    removed,
    solidBg,
    solidColor,
    solidHeight,
    height: Math.round(el.getBoundingClientRect().height),
    backgroundColor: after.backgroundColor,
    position: after.position,
  };
}

export function restoreChromeCaptureModeInPage(sel) {
  const el = document.querySelector(sel);
  if (!(el instanceof HTMLElement) || el.dataset.bqChromeCapture !== '1') return;
  const prevClass = el.dataset.bqChromePrevClass;
  const prevStyle = el.dataset.bqChromePrevStyle;
  if (typeof prevClass === 'string') el.className = prevClass;
  if (prevStyle) el.setAttribute('style', prevStyle);
  else el.removeAttribute('style');
  delete el.dataset.bqChromeCapture;
  delete el.dataset.bqChromePrevClass;
  delete el.dataset.bqChromePrevStyle;
}

/**
 * Site JS often re-applies overlapping/absolute after Escape or menu close.
 * Re-assert capture-mode styles while a capture session is active.
 */
export function reassertChromeCaptureModeInPage(sel) {
  const el = sel
    ? document.querySelector(sel)
    : document.querySelector('[data-bq-chrome-capture="1"]');
  if (!(el instanceof HTMLElement) || el.dataset.bqChromeCapture !== '1') return false;

  for (const c of [...el.classList]) {
    if (/overlap|overlapping|minimize|transparent|on-?hero|over-?hero|ghost/i.test(c)) {
      el.classList.remove(c);
    }
  }

  const solidBg = el.dataset.bqChromeSolidBg || null;
  const solidColor = el.dataset.bqChromeSolidColor || null;
  if (solidBg) {
    el.style.setProperty('background-color', solidBg, 'important');
    if (solidColor) el.style.setProperty('color', solidColor, 'important');
  } else {
    el.style.setProperty('background-color', '#ffffff', 'important');
  }

  const pos = getComputedStyle(el).position;
  if (pos === 'fixed' || pos === 'sticky' || pos === 'absolute') {
    el.style.setProperty('position', 'relative', 'important');
    el.style.setProperty('top', 'auto', 'important');
    el.style.setProperty('bottom', 'auto', 'important');
    el.style.setProperty('left', '0', 'important');
    el.style.setProperty('right', '0', 'important');
    el.style.setProperty('width', '100%', 'important');
    el.style.setProperty('z-index', 'auto', 'important');
  }
  return true;
}

/**
 * @param {import('playwright').Page} page
 * @param {string} selector
 * @param {() => Promise<T>} fn
 * @template T
 */
export async function withChromeCaptureMode(page, selector, fn) {
  if (!selector) return fn();
  // Scroll-probe solid styles then neutralize (two-phase so paint settles)
  await page.evaluate(async (sel) => {
    const el = document.querySelector(sel);
    if (!(el instanceof HTMLElement)) return;
    const isTransparentColor = (bg) => {
      if (!bg || bg === 'transparent') return true;
      const m = String(bg).match(
        /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i,
      );
      if (!m || m[4] === undefined) return false;
      return Number(m[4]) < 0.08;
    };
    const cs0 = getComputedStyle(el);
    const needProbe =
      isTransparentColor(cs0.backgroundColor) ||
      /overlap|overlapping|over-?hero|on-?hero|transparent|ghost/i.test(String(el.className || ''));
    if (!needProbe) return;
    const maxY = Math.max(
      0,
      Math.min(
        (document.documentElement.scrollHeight || 0) - (window.innerHeight || 900),
        Math.max(window.innerHeight || 900, 600),
      ),
    );
    window.scrollTo(0, maxY);
    await new Promise((r) => setTimeout(r, 400));
    const cs = getComputedStyle(el);
    if (!isTransparentColor(cs.backgroundColor)) {
      el.dataset.bqChromeSolidBg = cs.backgroundColor;
      el.dataset.bqChromeSolidColor = cs.color;
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 250));
  }, selector).catch(() => {});

  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!(el instanceof HTMLElement)) return;
    const isTransparentColor = (bg) => {
      if (!bg || bg === 'transparent') return true;
      const m = String(bg).match(
        /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i,
      );
      if (!m || m[4] === undefined) return false;
      return Number(m[4]) < 0.08;
    };
    const isLightCssColor = (color) => {
      const m = String(color || '').match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
      if (!m) return true;
      const r = Number(m[1]);
      const g = Number(m[2]);
      const b = Number(m[3]);
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55;
    };

    const cs0 = getComputedStyle(el);
    el.dataset.bqChromeCapture = '1';
    el.dataset.bqChromePrevClass = el.className;
    el.dataset.bqChromePrevStyle = el.getAttribute('style') || '';

    for (const c of [...el.classList]) {
      if (/overlap|overlapping|minimize|transparent|on-?hero|over-?hero|ghost/i.test(c)) {
        el.classList.remove(c);
      }
    }

    const solidBg = el.dataset.bqChromeSolidBg || null;
    const solidColor = el.dataset.bqChromeSolidColor || null;
    if (solidBg) {
      el.style.setProperty('background-color', solidBg, 'important');
      if (solidColor) el.style.setProperty('color', solidColor, 'important');
    } else if (
      isTransparentColor(cs0.backgroundColor) ||
      /overlap|overlapping/i.test(el.dataset.bqChromePrevClass || '')
    ) {
      el.style.setProperty(
        'background-color',
        isLightCssColor(cs0.color) ? '#111111' : '#ffffff',
        'important',
      );
    }

    const pos = getComputedStyle(el).position;
    if (pos === 'fixed' || pos === 'sticky' || pos === 'absolute') {
      el.style.setProperty('position', 'relative', 'important');
      el.style.setProperty('top', 'auto', 'important');
      el.style.setProperty('bottom', 'auto', 'important');
      el.style.setProperty('left', '0', 'important');
      el.style.setProperty('right', '0', 'important');
      el.style.setProperty('width', '100%', 'important');
      el.style.setProperty('z-index', 'auto', 'important');
    }
  }, selector);

  try {
    return await fn();
  } finally {
    await page.evaluate(restoreChromeCaptureModeInPage, selector).catch(() => {});
  }
}

/**
 * Detect overlapping vs solid/pinned presentation variants for chrome overlays.
 * @param {import('playwright').Page} page
 * @param {string} selector
 */
export async function detectChromePresentationVariants(page, selector) {
  if (!selector) return [];
  try {
    return await page.evaluate(async (sel) => {
      const el = document.querySelector(sel);
      if (!(el instanceof HTMLElement)) return [];

      const isTransparentColor = (bg) => {
        if (!bg || bg === 'transparent') return true;
        const m = String(bg).match(
          /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i,
        );
        if (!m || m[4] === undefined) return false;
        return Number(m[4]) < 0.08;
      };

      const sample = () => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          classTokens: [...el.classList].filter((c) =>
            /overlap|overlapping|minimize|fixed|sticky|transparent|solid|scrolled/i.test(c),
          ),
          position: cs.position,
          backgroundColor: cs.backgroundColor,
          color: cs.color,
          heightPx: Math.round(r.height),
          transparentBackground: isTransparentColor(cs.backgroundColor),
        };
      };

      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 200));
      const atTop = sample();

      const maxY = Math.max(
        0,
        Math.min(
          (document.documentElement.scrollHeight || 0) - (window.innerHeight || 900),
          Math.max(window.innerHeight || 900, 600),
        ),
      );
      window.scrollTo(0, maxY);
      await new Promise((r) => setTimeout(r, 400));
      const scrolled = sample();
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 200));

      /** @type {Array<object>} */
      const variants = [];

      const overlapping =
        atTop.transparentBackground ||
        atTop.classTokens.some((c) => /overlap|overlapping|over-?hero|on-?hero/i.test(c));
      if (overlapping) {
        variants.push({
          id: 'overlapping',
          label: 'Overlapping',
          description:
            'Chrome sits over page content with transparent/translucent background at the top of the page.',
          atRest: true,
          evidence: atTop,
        });
      }

      const solidAfterScroll =
        !scrolled.transparentBackground &&
        (atTop.transparentBackground ||
          scrolled.backgroundColor !== atTop.backgroundColor ||
          scrolled.classTokens.some((c) => /minimize|fixed|solid|scrolled/i.test(c)));
      if (solidAfterScroll) {
        variants.push({
          id: 'solid',
          label: 'Solid',
          description:
            'Opaque chrome bar (often after scroll / pinned / minimized), with its own fill instead of showing page content through.',
          atRest: !overlapping,
          appearsOnScroll: overlapping,
          evidence: scrolled,
        });
      } else if (!atTop.transparentBackground && variants.length === 0) {
        variants.push({
          id: 'solid',
          label: 'Solid',
          description: 'Opaque chrome bar with its own background fill.',
          atRest: true,
          evidence: atTop,
        });
      }

      if (
        overlapping &&
        Math.abs((atTop.heightPx || 0) - (scrolled.heightPx || 0)) >= 16 &&
        !variants.some((v) => v.id === 'solid')
      ) {
        variants.push({
          id: 'compact',
          label: 'Compact',
          description: 'Reduced-height chrome after scroll.',
          appearsOnScroll: true,
          evidence: scrolled,
        });
      }

      return variants;
    }, selector);
  } catch {
    return [];
  }
}

export function looksLikeChromeOverlaySection(section) {
  const blob = `${section?.cmsName || ''} ${section?.type || ''} ${section?.folderName || ''} ${section?.componentType || ''}`;
  return /header|nav|topbar|top-bar|siteheader|mainnav|navigation/i.test(blob);
}

export { isTransparentColor, isLightCssColor };
