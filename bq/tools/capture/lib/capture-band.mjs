/**
 * Screenshot and HTML capture for composite section bands (multiple sibling DOM nodes).
 * Used when AEM (and similar CMS) pack several editorial blocks inside one section container.
 */

/**
 * @param {import('playwright').Page} page
 * @param {string[]} selectors
 * @returns {Promise<{ x: number, y: number, width: number, height: number } | null>}
 */
export async function computeBandClip(page, selectors) {
  return page.evaluate((sels) => {
    /** @type {DOMRect[]} */
    const rects = [];
    for (const sel of sels) {
      try {
        const el = document.querySelector(sel);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width >= 1 && rect.height >= 1) rects.push(rect);
      } catch {
        /* invalid selector */
      }
    }
    if (!rects.length) return null;

    const top = Math.min(...rects.map((r) => r.top));
    const left = Math.min(...rects.map((r) => r.left));
    const bottom = Math.max(...rects.map((r) => r.bottom));
    const right = Math.max(...rects.map((r) => r.right));
    const width = right - left;
    const height = bottom - top;
    if (width < 8 || height < 8) return null;

    return {
      x: Math.max(0, left),
      y: Math.max(0, top),
      width,
      height,
    };
  }, selectors);
}

/**
 * @param {import('playwright').Page} page
 * @param {string[]} selectors
 * @param {string} filePath
 */
export async function screenshotBandRegion(page, selectors, filePath) {
  const first = page.locator(selectors[0]).first();
  if ((await first.count()) > 0) {
    await first.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(200);
  }

  const clip = await computeBandClip(page, selectors);
  if (!clip) return false;

  await page.screenshot({
    path: filePath,
    clip,
  });
  return true;
}

/**
 * @param {import('playwright').Page} page
 * @param {string[]} selectors
 * @returns {Promise<string | null>}
 */
export async function extractBandHtml(page, selectors) {
  return page.evaluate((sels) => {
    const parts = [];
    for (const sel of sels) {
      try {
        const el = document.querySelector(sel);
        if (el) parts.push(el.outerHTML);
      } catch {
        /* invalid selector */
      }
    }
    return parts.length ? parts.join('\n') : null;
  }, selectors);
}
