/**
 * Capture → prompt evidence for chrome inventory, hairlines, and section gutters.
 * Detect-only / format-for-prompt — does not rewrite TSX.
 */

/**
 * @param {string|null|undefined} html
 * @param {string|null|undefined} authoredCss
 * @returns {{
 *   brandLogo: boolean,
 *   socialIconCount: number,
 *   legalLinkTexts: string[],
 *   cmpCookieSettings: boolean,
 *   hairlineHints: string[],
 *   gutterProfile: { marginX?: string, paddingX?: string, edgeMode?: string } | null,
 * }}
 */
export function extractChromeGutterHintsFromCapture(html, authoredCss) {
  const h = String(html || '');
  const css = String(authoredCss || '');
  const blob = `${h}\n${css}`;

  const brandLogo =
    /alt=["'][^"']*logo[^"']*["']/i.test(h) ||
    /\b(site-?logo|brand-?logo|footer.?branding|navbar-brand)\b/i.test(blob);

  const socialAnchors = h.match(
    /<(?:a|img)[^>]*(?:social|facebook|twitter|linkedin|instagram|youtube|x\.com)[^>]*>/gi,
  );
  const socialIconCount = socialAnchors ? Math.min(socialAnchors.length, 12) : 0;

  /** @type {string[]} */
  const legalLinkTexts = [];
  const legalLi =
    h.match(
      /<(?:a|span)[^>]*>\s*(Legal Hub|Privacy|Your privacy choices|Cookie settings|Cookie Preferences|webmaster@[^<]+)\s*<\/(?:a|span)>/gi,
    ) || [];
  for (const m of legalLi) {
    const t = m.replace(/<[^>]+>/g, '').trim();
    if (t && !legalLinkTexts.includes(t)) legalLinkTexts.push(t);
  }

  const cmpCookieSettings =
    /id=["']customize-cookies["']|CustomizeCookies|Cookie settings|Cookie Preferences|osano/i.test(
      blob,
    );

  /** @type {string[]} */
  const hairlineHints = [];
  if (/border-(?:top|bottom|y)\b|border-t\b|border-b\b/i.test(blob)) {
    hairlineHints.push('capture-uses-border-edges');
  }
  if (/sc-grid-no-border|no-border/i.test(blob)) {
    hairlineHints.push('some-bands-no-border');
  }

  let marginX;
  let paddingX;
  const marginMatch = css.match(
    /--sc-grid-margin-x\s*:\s*([^;}+]+)/i,
  );
  const paddingMatch = css.match(
    /--sc-grid-padding-x\s*:\s*([^;}+]+)/i,
  );
  if (marginMatch) marginX = marginMatch[1].trim();
  if (paddingMatch) paddingX = paddingMatch[1].trim();

  /** @type {{ marginX?: string, paddingX?: string, edgeMode?: string } | null} */
  let gutterProfile = null;
  if (marginX || paddingX) {
    gutterProfile = {
      ...(marginX ? { marginX } : {}),
      ...(paddingX ? { paddingX } : {}),
      edgeMode: /full-?bleed|sc-grid/i.test(blob) ? 'inset-band' : 'inset-band',
    };
  }

  return {
    brandLogo,
    socialIconCount,
    legalLinkTexts,
    cmpCookieSettings,
    hairlineHints,
    gutterProfile,
  };
}

/**
 * @param {ReturnType<typeof extractChromeGutterHintsFromCapture>} hints
 * @returns {string}
 */
export function formatChromeGutterBlockForPrompt(hints) {
  if (!hints) return '';
  const lines = ['=== CHROME / GUTTERS / HAIRLINES (from capture HTML+CSS) ==='];
  if (hints.brandLogo) {
    lines.push(
      'brandLogo: visible in capture — paint on branding/social owner only (never dump+sr-only on legal).',
    );
  }
  if (hints.socialIconCount > 0) {
    lines.push(
      `socialIconLinks: ~${hints.socialIconCount} in capture — Image/Image Link List on footer-social (or equivalent); must be visible.`,
    );
  }
  if (hints.legalLinkTexts.length) {
    lines.push(
      `legalUtilityLinks: ${hints.legalLinkTexts.join(' | ')} — seed all on legal strip.`,
    );
  }
  if (hints.cmpCookieSettings) {
    lines.push(
      'cmpCookieSettings: present in HTML (may be capture-hidden) — liveExpected: seed Cookie Settings / customize-cookies on legal strip.',
    );
  }
  if (hints.hairlineHints.length) {
    lines.push(
      `hairlines: ${hints.hairlineHints.join(', ')} — ONE owner per separator; never parent+child both border-y.`,
    );
  }
  if (hints.gutterProfile) {
    lines.push(
      `gutterProfile: ${JSON.stringify(hints.gutterProfile)} — match section outer inset; prefer px-[var(--sc-grid-padding-x)] / capture clamps; forbid double parent+child mx/px.`,
    );
  }
  if (lines.length === 1) return '';
  return lines.join('\n');
}
