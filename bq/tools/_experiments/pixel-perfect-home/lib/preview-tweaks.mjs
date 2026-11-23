/**
 * Shared CSS injected into previews so animations / consent chrome don't inflate mismatch.
 */
export const STABILIZE_CSS = `
/* Experiment stabilize: freeze entrance animations at end state */
*, *::before, *::after {
  animation-duration: 0.01ms !important;
  animation-delay: 0ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
}
[style*="opacity: 0"], .sc-ai-light-hero__title, .sc-ai-light-hero__lead, .sc-ai-light-hero__actions {
  opacity: 1 !important;
}
`;

export function withStabilize(extraHead = '') {
  return `<style id="bq-exp-stabilize">${STABILIZE_CSS}</style>\n${extraHead}`;
}

/** Link capture global CSS so section fragments inherit design tokens */
export function withCaptureCss(extraHead = '') {
  return `
<link rel="stylesheet" href="/capture/css/page-inline.css"/>
<style id="bq-exp-stabilize">${STABILIZE_CSS}</style>
${extraHead}`;
}
