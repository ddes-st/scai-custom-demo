/**
 * Pre-enrich / layout-hints helpers for structured motion + equal-height signals.
 * Generic — no site or component-name hardcoding.
 */

/**
 * @param {string|null|undefined} html
 * @param {string|null|undefined} authoredCss
 * @returns {{
 *   suggestsContinuousMarquee: boolean,
 *   suggestsEqualHeightChildren: boolean,
 *   evidence: string[],
 * }}
 */
export function extractMotionHintsFromCapture(html, authoredCss) {
  const blob = `${String(html || '')}\n${String(authoredCss || '')}`;
  const lower = blob.toLowerCase();
  /** @type {string[]} */
  const evidence = [];

  const infiniteAnim =
    /animation\s*:[^;]*\binfinite\b/i.test(blob) ||
    /@keyframes\s+\w+[\s\S]{0,400}transform\s*:\s*translate/i.test(blob);
  if (infiniteAnim) evidence.push('css-infinite-animation');

  const marqueeToken =
    /\bmarquee\b|\bticker\b|logo-?carousel|continuous.?scroll|announcement.?ticker/i.test(
      lower,
    );
  if (marqueeToken) evidence.push('marquee-token');

  const duplicatedTrack =
    /duplicat(e|ed|es|ing).{0,40}(track|item|content|rail)/i.test(lower) ||
    (/aria-hidden\s*=\s*["']true["']/i.test(html || '') &&
      /marquee|carousel|ticker/i.test(lower));
  if (duplicatedTrack) evidence.push('duplicated-track-cue');

  // Offline band-ticker cues (announcement / notification bars).
  const shortBandH =
    /(?:^|[^-])h-\[(?:2[4-9]|[3-9]\d)px\]|(?:^|\s)h-(?:8|9|10|11|12)\b|height\s*:\s*(?:2[4-9]|[3-8]\d)px/i.test(
      blob,
    );
  const fullBleedBand =
    /(?:w-full|w-screen|100vw|left-0\s+right-0|inset-x-0)/i.test(blob) &&
    (/(?:bg-\[|background(?:-image)?\s*:\s*(?:linear-gradient|#))/i.test(blob) ||
      /announcement|notification.?bar|promo.?bar|ticker/i.test(lower));
  const nowrapTrack =
    /whitespace-nowrap|white-space\s*:\s*nowrap/i.test(blob) &&
    /overflow(?:-x)?\s*:\s*hidden|overflow-hidden|overflow-x-hidden/i.test(blob);
  if (shortBandH && (fullBleedBand || nowrapTrack || marqueeToken)) {
    evidence.push('band-ticker-html');
  }
  if (nowrapTrack && fullBleedBand) evidence.push('full-bleed-nowrap-track');

  /** @type {string[]} */
  const equalEvidence = [];
  const equalHeightToken =
    /\beh-grid\b|\balign-items\s*:\s*stretch\b|\bitems-stretch\b|equal.?height/i.test(
      lower,
    );
  if (equalHeightToken) equalEvidence.push('css-stretch-or-eh-grid');

  // Sitecore.com-style card carousels: flex track + shrink-0 basis-* slides
  // (often no literal items-stretch / eh-grid in capture HTML).
  const flexSlideBasis =
    /\bshrink-0\b/i.test(html || '') &&
    /\bbasis-(?:full|1\/[234]|\[)/i.test(html || '') &&
    (/\bflex\b/i.test(html || '') || /overflow-x/i.test(lower));
  if (flexSlideBasis) equalEvidence.push('flex-basis-slides');

  const hFullFlexCol =
    /\bflex\b[^"']{0,80}\bh-full\b|\bh-full\b[^"']{0,80}\bflex-col\b/i.test(
      html || '',
    ) || /class=["'][^"']*\bflex\b[^"']*\bh-full\b[^"']*\bflex-col\b/i.test(html || '');
  if (hFullFlexCol && (flexSlideBasis || /carousel|card|slide|swiper/i.test(lower))) {
    equalEvidence.push('flex-h-full-col-cards');
  }

  const suggestsBandTicker =
    evidence.includes('band-ticker-html') ||
    evidence.includes('full-bleed-nowrap-track');

  return {
    suggestsContinuousMarquee: evidence.length > 0,
    suggestsBandTicker,
    suggestsEqualHeightChildren: equalEvidence.length > 0,
    evidence: [...evidence, ...equalEvidence],
  };
}

/**
 * @param {object|null|undefined} info
 * @returns {'band-ticker'|'item-rail'|null}
 */
export function layoutMotionSurface(info) {
  const surface = String(info?.layout?.motion?.surface || '')
    .trim()
    .toLowerCase();
  if (surface === 'band-ticker' || surface === 'item-rail') return surface;
  return null;
}

/**
 * @param {object|null|undefined} info
 * @returns {boolean}
 */
export function layoutMotionIsBandTicker(info) {
  if (layoutMotionSurface(info) === 'band-ticker') return true;
  const blob = [
    info?.layout?.pattern,
    info?.layout?.motion?.scrollingSubtree,
    info?.cmsName,
    info?.componentName,
    info?.name,
    info?.description,
    info?.purpose,
  ]
    .map((x) => String(x || '').toLowerCase())
    .join(' ');
  return /announcement|notification.?bar|promo.?bar|band.?ticker|ticker.?bar/.test(
    blob,
  ) && layoutMotionIsContinuousMarquee(info);
}

/**
 * Prefer structured layout.motion when present.
 * @param {object|null|undefined} info
 * @returns {boolean}
 */
export function layoutMotionIsContinuousMarquee(info) {
  const motion = info?.layout?.motion;
  if (!motion || typeof motion !== 'object') return false;
  const kind = String(motion.kind || '').toLowerCase();
  if (kind === 'continuous-marquee' || kind === 'css-keyframes') return true;
  if (motion.loop === true && /marquee|continuous|ticker/.test(kind)) return true;
  return false;
}

/**
 * Peer-card / carousel-card patterns that imply equal-height children.
 * @param {object|null|undefined} info
 * @returns {boolean}
 */
export function layoutPatternSuggestsEqualHeight(info) {
  const pattern = String(info?.layout?.pattern || '').toLowerCase();
  return /carousel-card|card-grid|tiles-section|card-list|recommendation/.test(
    pattern,
  );
}

/**
 * Chrome / rails that may share flex row height but are NOT peer cards needing
 * `h-full` card roots (false positives from capture equalHeightChildren).
 * @param {object|null|undefined} info
 * @returns {boolean}
 */
export function layoutExemptFromEqualHeightCardContract(info) {
  const pattern = String(info?.layout?.pattern || '').toLowerCase();
  const pageRole = String(
    info?.enrichStructurePayload?.pageRole ||
      info?.pageRole ||
      info?.layout?.pageRole ||
      '',
  ).toLowerCase();
  if (
    /logo|marquee|ticker|partner.?strip|brand.?rail|header|nav|mega.?menu|site.?chrome|utility.?bar/.test(
      pattern,
    ) ||
    /partial-header|header|nav/.test(pageRole) ||
    layoutMotionIsContinuousMarquee(info)
  ) {
    return true;
  }
  // Evidence that only mentions header/menu peers — not card grids.
  const evidence = String(info?.layout?.equalHeightEvidence || '').toLowerCase();
  if (
    evidence &&
    /header|menu item|nav(igation)? item|utility/.test(evidence) &&
    !/card|tile|slide|carousel/.test(evidence)
  ) {
    return true;
  }
  return false;
}

/**
 * @param {object|null|undefined} info
 * @returns {boolean}
 */
export function layoutWantsEqualHeightChildren(info) {
  // Exclusions first — never honor a false-positive equalHeightChildren flag
  // on headers / ContinuousMarquee rails (capture often marks menu-item stretch).
  if (layoutExemptFromEqualHeightCardContract(info)) return false;
  if (info?.layout?.equalHeightChildren === true) return true;
  if (layoutPatternSuggestsEqualHeight(info)) return true;
  const blob = [
    info?.layout?.equalHeightEvidence,
    info?.layout?.structureNotes,
    info?.layout?.interactionNotes,
    info?.description,
  ]
    .map((x) => String(x || '').toLowerCase())
    .join(' ');
  return /equal.?height|same height|shared row height|items-stretch|eh-grid/.test(
    blob,
  );
}

/**
 * Short MOTION block for codegen user messages.
 * @param {object|null|undefined} info
 * @returns {string}
 */
export function formatMotionBlockForPrompt(info) {
  const motion = info?.layout?.motion;
  if (!motion || typeof motion !== 'object') return '';
  const lines = [
    '=== MOTION (authoritative from section-information.layout.motion) ===',
    JSON.stringify(motion).slice(0, 800),
  ];
  if (layoutMotionIsContinuousMarquee(info)) {
    lines.push(
      'HARD: continuous-marquee — companion clientTsx MUST use ContinuousMarquee from components/primitives/continuous-marquee; mount children once; do not invent arrows when controls is none.',
    );
  }
  if (layoutMotionIsBandTicker(info) || layoutMotionSurface(info) === 'band-ticker') {
    lines.push(
      'HARD — band-ticker surface: outer element owns w-full + background (static full-bleed). ContinuousMarquee variant="band" wraps ONLY the nowrap message — prefer one RichText (inline <a> in seed), never IntroText+Link+SupportingText splits.',
      'HARD — band-ticker motion: when text FITS → centered + static. When OVERFLOWS → continuous full-width CSS loop (variant="band"). Forbidden: lg:min-w-0; wrapping gradient/bg in ContinuousMarquee; logo-rail gap-8; multi-field sentence splits.',
    );
  } else if (layoutMotionSurface(info) === 'item-rail') {
    lines.push(
      'HARD — item-rail surface: ContinuousMarquee around logo/badge placeholder children (variant="rail" defaults OK; short rails may pad to keep looping).',
    );
  }
  if (layoutWantsEqualHeightChildren(info)) {
    lines.push(
      `equalHeightChildren: true — ${String(info.layout?.equalHeightEvidence || 'peer cards share one row height')}`,
      'HARD: parent track items-stretch AND [&>*]:h-full (both required); child card root flex h-full flex-col with flex-1 body.',
    );
  }
  return lines.join('\n');
}
