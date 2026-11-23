/**
 * Probe :hover and ::before/::after on representative nodes for main variants.
 */
import { PSEUDO_AGREE } from './constants.mjs';
import { normalizeColor, compactVariant } from './style-utils.mjs';

/**
 * @param {import('playwright').Page} page
 * @param {string[]} selectors
 */
export async function probeHoverAndPseudos(page, selectors) {
  const unique = [...new Set(selectors.filter(Boolean))].slice(0, 8);
  if (!unique.length) return { hover: null, before: null, after: null };

  const results = await page.evaluate(async (sels) => {
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = [];

    function readPseudo(el, which) {
      try {
        const pcs = getComputedStyle(el, which);
        const content = pcs.content;
        if (!content || content === 'none' || content === 'normal') return null;
        return {
          content: content.slice(0, 80),
          color: pcs.color,
          backgroundColor: pcs.backgroundColor,
          width: pcs.width,
          height: pcs.height,
        };
      } catch {
        return null;
      }
    }

    for (const sel of sels) {
      let el;
      try {
        el = document.querySelector(sel);
      } catch {
        continue;
      }
      if (!el) continue;

      const before = readPseudo(el, '::before');
      const after = readPseudo(el, '::after');

      const base = {
        color: getComputedStyle(el).color,
        backgroundColor: getComputedStyle(el).backgroundColor,
        textDecoration: getComputedStyle(el).textDecorationLine,
      };

      let hover = null;
      try {
        el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        await delay(50);
        // Playwright hover is better; this is best-effort fallback inside page
        const cs = getComputedStyle(el);
        hover = {
          color: cs.color,
          backgroundColor: cs.backgroundColor,
          textDecoration: cs.textDecorationLine,
        };
        el.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
        el.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
      } catch {
        hover = null;
      }

      out.push({ selector: sel, base, hover, before, after });
    }
    return out;
  }, unique);

  // Also try Playwright hover for first few
  const hoverSamples = [];
  for (const sel of unique.slice(0, 4)) {
    try {
      const loc = page.locator(sel).first();
      if ((await loc.count()) === 0) continue;
      await loc.hover({ timeout: 1500 });
      const hovered = await loc.evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
          color: cs.color,
          backgroundColor: cs.backgroundColor,
          textDecoration: cs.textDecorationLine,
        };
      });
      hoverSamples.push(hovered);
      await page.mouse.move(0, 0);
    } catch {
      /* skip */
    }
  }

  const hovers = (hoverSamples.length ? hoverSamples : results.map((r) => r.hover).filter(Boolean)).map(
    (h) =>
      compactVariant({
        color: normalizeColor(h.color),
        backgroundColor: normalizeColor(h.backgroundColor),
        textDecoration: h.textDecoration && h.textDecoration !== 'none' ? h.textDecoration : null,
      }),
  );

  const befores = results.map((r) => r.before).filter(Boolean);
  const afters = results.map((r) => r.after).filter(Boolean);

  return {
    hover: consensusStyle(hovers),
    before: consensusPseudo(befores),
    after: consensusPseudo(afters),
  };
}

function consensusStyle(list) {
  if (!list.length) return null;
  const need = Math.ceil(list.length * PSEUDO_AGREE);
  const key = (o) => JSON.stringify(o);
  const counts = new Map();
  for (const item of list) {
    if (!item || !Object.keys(item).length) continue;
    const k = key(item);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let best = null;
  let bestN = 0;
  for (const [k, n] of counts) {
    if (n > bestN) {
      best = JSON.parse(k);
      bestN = n;
    }
  }
  return bestN >= need || (list.length === 1 && best) ? best : null;
}

function consensusPseudo(list) {
  if (!list.length) return null;
  const need = Math.ceil(list.length * PSEUDO_AGREE);
  if (list.length < need && list.length > 1) return null;
  // Majority have a pseudo
  if (list.length / Math.max(list.length, 1) < PSEUDO_AGREE && list.length < 2) return null;
  const sample = list[0];
  return compactVariant({
    content: sample.content,
    color: normalizeColor(sample.color),
    backgroundColor: normalizeColor(sample.backgroundColor),
  });
}
