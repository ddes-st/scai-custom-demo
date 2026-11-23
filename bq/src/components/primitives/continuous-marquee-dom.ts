/**
 * DOM helpers for ContinuousMarquee (shared with node unit tests).
 */

/**
 * @param root
 */
export function stripCloneIds(root: Element): void {
  if (root.hasAttribute('id')) {
    root.removeAttribute('id');
  }
  root.querySelectorAll('[id]').forEach((el) => {
    el.removeAttribute('id');
  });
}

/**
 * @param source
 * @param clone
 */
export function syncMarqueeClone(source: HTMLElement, clone: HTMLElement): void {
  clone.replaceChildren();
  for (const child of Array.from(source.children)) {
    const node = child.cloneNode(true) as HTMLElement;
    stripCloneIds(node);
    clone.appendChild(node);
  }
}

const MARQUEE_PAD_ATTR = 'data-marquee-pad';
const MARQUEE_GAP_ATTR = 'data-marquee-gap';
/** Spacing between band-ticker copies so the loop does not butt ends together. */
export const BAND_LOOP_GAP_PX = 48;

/**
 * Clear previous overflow-padding nodes from the source track.
 * @param source
 */
export function clearMarqueePads(source: HTMLElement): void {
  for (const child of Array.from(source.children)) {
    if (child.hasAttribute?.(MARQUEE_PAD_ATTR)) {
      child.remove();
    }
  }
}

/**
 * @param half
 */
export function clearMarqueeGaps(half: HTMLElement): void {
  for (const child of Array.from(half.children)) {
    if (child.hasAttribute?.(MARQUEE_GAP_ATTR)) {
      child.remove();
    }
  }
}

/**
 * Append a trailing spacer so two halves stay equal width for -50% CSS loops.
 * @param half
 * @param gapPx
 */
export function ensureBandHalfSpacer(half: HTMLElement, gapPx: number): void {
  clearMarqueeGaps(half);
  const gap = document.createElement('span');
  gap.setAttribute(MARQUEE_GAP_ATTR, '1');
  gap.setAttribute('aria-hidden', 'true');
  gap.style.display = 'inline-block';
  gap.style.flexShrink = '0';
  gap.style.width = `${gapPx}px`;
  gap.style.height = '1px';
  half.appendChild(gap);
}

/**
 * After cloning the source into the loop twin, repeat original source children
 * until the viewport overflows so short **item rails** (logo/badge rows) still
 * animate. Pads are marked data-marquee-pad and excluded from the next pad
 * generation base.
 *
 * @param viewport
 * @param source
 * @param clone
 * @param maxPads
 * @returns number of pad rounds applied
 */
export function ensureMarqueeOverflow(
  viewport: HTMLElement,
  source: HTMLElement,
  clone: HTMLElement,
  maxPads = 12,
): number {
  clearMarqueePads(source);
  clearMarqueeGaps(source);
  // Pages editing iframes / hidden chrome often report clientWidth 0. Padding
  // in that state never satisfies overflow and re-triggers MutationObservers → hang.
  if (viewport.clientWidth <= 0) {
    clone.hidden = true;
    clone.replaceChildren();
    return 0;
  }
  syncMarqueeClone(source, clone);
  clone.hidden = false;
  clone.style.paddingLeft = '';

  const originals = Array.from(source.children).filter(
    (c) =>
      !c.hasAttribute?.(MARQUEE_PAD_ATTR) && !c.hasAttribute?.(MARQUEE_GAP_ATTR),
  );
  if (!originals.length) return 0;

  let rounds = 0;
  while (
    rounds < maxPads &&
    viewport.scrollWidth <= viewport.clientWidth + 1
  ) {
    for (const child of originals) {
      const node = child.cloneNode(true) as HTMLElement;
      node.setAttribute(MARQUEE_PAD_ATTR, '1');
      stripCloneIds(node);
      source.appendChild(node);
    }
    syncMarqueeClone(source, clone);
    rounds += 1;
    if (viewport.scrollWidth <= 0) break;
  }
  return rounds;
}

/**
 * Natural content width of the source track.
 * @param source
 */
export function measureTrackContentWidth(source: HTMLElement): number {
  const rectW = source.getBoundingClientRect?.().width ?? 0;
  return Math.max(source.scrollWidth || 0, rectW, source.offsetWidth || 0);
}

/**
 * Band-ticker sync for a CSS `-50%` infinite loop:
 * - fits → single centered half, no clone
 * - overflows → two equal halves (content + gap each) so translate(-50%) loops forever
 *
 * @param viewport
 * @param source
 * @param clone
 * @param gapPx
 * @returns whether content overflows the viewport
 */
export function syncBandTickerOverflow(
  viewport: HTMLElement,
  source: HTMLElement,
  clone: HTMLElement,
  gapPx = BAND_LOOP_GAP_PX,
): boolean {
  clearMarqueePads(source);
  clearMarqueeGaps(source);
  clone.replaceChildren();
  clone.style.paddingLeft = '';
  clone.hidden = true;

  const viewportWidth = Math.max(
    viewport.clientWidth || 0,
    viewport.getBoundingClientRect?.().width ?? 0,
  );
  if (viewportWidth <= 0) {
    return false;
  }

  const contentWidth = measureTrackContentWidth(source);
  const overflowing = contentWidth > viewportWidth + 1;

  if (overflowing) {
    ensureBandHalfSpacer(source, gapPx);
    syncMarqueeClone(source, clone);
    clone.hidden = false;
  }

  return overflowing;
}
