import React from 'react';

/** Preview-only passthrough — avoids ContinuousMarquee layout/rAF during VF shots. */
export function ContinuousMarquee({ children, className }) {
  return React.createElement('div', { className: className || undefined }, children);
}

export default ContinuousMarquee;
export const BAND_LOOP_GAP_PX = 48;
export function clearMarqueePads() {}
export function ensureMarqueeOverflow() {
  return 0;
}
export function measureTrackContentWidth() {
  return 0;
}
export function stripCloneIds() {}
export function syncMarqueeClone() {}
export function syncBandTickerOverflow() {
  return false;
}
export function clearMarqueeGaps() {}
export function ensureBandHalfSpacer() {}
