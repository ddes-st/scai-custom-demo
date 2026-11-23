/**
 * Infer placeholder layout mode + format measured layout hints for codegen prompts.
 * Viewport contract: mobile <768, tablet 768–1023, desktop ≥1024 (Tailwind lg:).
 */
import { analyzeSectionHtml } from '../capture/lib/analyze-section-html.mjs';
import {
  formatScrollBehaviorSummary,
  pickDesktopScrollBehavior,
} from '../capture/lib/section-scroll-behavior.mjs';
import {
  extractChromeGutterHintsFromCapture,
  formatChromeGutterBlockForPrompt,
} from './chrome-gutter-hints.mjs';
import {
  formatMotionBlockForPrompt,
  layoutMotionIsBandTicker,
  layoutMotionIsContinuousMarquee,
  layoutMotionSurface,
  layoutPatternSuggestsEqualHeight,
  layoutWantsEqualHeightChildren,
} from './motion-hints.mjs';

/**
 * @typedef {'carousel'|'media-tabs'|'metric'|'columns'|'none'|'auto'} PlaceholderLayoutMode
 */

/**
 * Capture HTML/CSS (or pill-button HTML) suggests CTA ::after mask arrows.
 * Prefer `sc-cta-after-arrow` over text `after:content-['→']` for these controls.
 * @param {string|null|undefined} sectionHtml
 * @param {string|null|undefined} authoredCss
 * @returns {boolean}
 */
export function captureSuggestsCtaMaskArrow(sectionHtml, authoredCss) {
  const html = String(sectionHtml || '');
  const css = String(authoredCss || '');
  const blob = `${html}\n${css}`;
  if (!blob.trim()) return false;
  if (/cta-arrow\.svg|mask-image[^;{]{0,120}cta-arrow/i.test(blob)) return true;
  if (
    /mask-image\s*:\s*url\(/i.test(blob) &&
    /(?:width|height)\s*:\s*22px/i.test(blob) &&
    /::after|__cta/i.test(blob)
  ) {
    return true;
  }
  // Empty ::after + fixed 22×22 bg (capture often omits mask-image in section HTML).
  if (
    /::after/i.test(blob) &&
    /(?:width|height)\s*:\s*22px/i.test(blob) &&
    /background(?:-color)?\s*:/i.test(blob) &&
    /content\s*:\s*["']?\s*["']?/i.test(blob)
  ) {
    return true;
  }
  // Pill / primary buttons ONLY when a trailing arrow cue exists.
  // Plain rounded-full buttons (no → / ::after / cta-arrow) must NOT force sc-cta-after-arrow.
  const pillChrome =
    /rounded-full/i.test(html) &&
    /(?:px-5|px-4|padding(?:-inline)?\s*:\s*(?:1|1\.25|20)(?:rem|px)?)/i.test(
      html,
    );
  const trailingArrowCue =
    /→|&rarr;|cta-arrow/i.test(blob) ||
    (/::after/i.test(blob) &&
      /(?:content\s*:\s*["']?\s*["']?|mask-image|width\s*:\s*22px)/i.test(
        blob,
      ));
  if (pillChrome && trailingArrowCue) {
    return true;
  }
  return false;
}

/**
 * Carousel chrome behavior when layoutMode=carousel.
 * - arrows: click prev/next → scrollBy
 * - dots: pagination bullets (may also have arrows)
 * - auto: neither arrows nor dots → auto-scroll / marquee
 * @typedef {'arrows'|'dots'|'auto'|'none'} CarouselChromeMode
 */

/**
 * Tabbed media switcher: media/thumbnail left + text selectors right (swap on select) —
 * NOT a horizontal card carousel. Product names (MediaSlider, CustomerStorySlider) are aliases only.
 * @param {object|null|undefined} info
 * @param {string|null|undefined} sectionHtml
 * @returns {boolean}
 */
export function looksLikeMediaTabs(info, sectionHtml) {
  const h = String(sectionHtml || '');
  const names = [
    info?.cmsName,
    info?.componentName,
    info?.name,
    info?.folderName,
    info?.type,
    info?.layout?.pattern,
    info?.layout?.type,
    ...(Array.isArray(info?.alternativeNames) ? info.alternativeNames : []),
  ]
    .map((x) => String(x || '').toLowerCase())
    .join(' ');
  const notes = [
    info?.layout?.structureNotes,
    info?.layout?.interactionNotes,
    info?.purpose,
    info?.description,
  ]
    .map((x) => String(x || '').toLowerCase())
    .join(' ');

  const hasTabRoles =
    /role=["']tab["']/i.test(h) && /role=["']tabpanel["']/i.test(h);
  const mediaSideCues =
    /video|thumbnail|media.?left|story selector|side selectors|selectors on the (side|right)|swap (media|panel)|click.*(link|tab).*swap/i.test(
      `${notes}\n${h}`,
    ) ||
    /media-slider|CompactMediaArea|NavButtonText|responsive-media-slider/i.test(h);

  // 1. Structural first (name-free)
  if (hasTabRoles && mediaSideCues) return true;

  // 2. Generic pattern names
  if (
    /media.?tabs?|tabbed.?media|story.?media|responsive-media-slider|media-slider|mediaslider/.test(
      names,
    )
  ) {
    return true;
  }

  // 3. Legacy product aliases
  if (/data-component-name=["']MediaSlider["']/i.test(h)) return true;
  if (/customer.?story.?slider/.test(names) && !/card.?carousel|story.?carousel/.test(names)) {
    return true;
  }
  if (
    /customer.?story.?slider|story.?media/.test(names) &&
    (/tab|accordion|video.?left|selectors on the (side|right)/.test(notes) || hasTabRoles)
  ) {
    return true;
  }
  return false;
}

/**
 * Name / JSON identity signals that this component is a carousel (even when HTML is sparse).
 * Excludes tabbed media-sliders (see {@link looksLikeMediaTabs}).
 * @param {object|null|undefined} info
 * @returns {boolean}
 */
export function looksLikeCarouselByName(info) {
  const names = [
    info?.cmsName,
    info?.componentName,
    info?.name,
    info?.folderName,
    info?.type,
    info?.layout?.pattern,
    info?.layout?.type,
    ...(Array.isArray(info?.alternativeNames) ? info.alternativeNames : []),
  ]
    .map((x) => String(x || '').toLowerCase())
    .join(' ');
  // Tabbed MediaSlider names often include "slider" — handled by looksLikeMediaTabs first.
  return /carousel|swiper|slider|slideshow|slide.?show|marquee|card.?slider/.test(
    names,
  );
}

/**
 * DOM cues: libraries, arrows, bullets/dots, aria carousel roles.
 * @param {string} html
 * @returns {boolean}
 */
export function looksLikeCarouselByHtml(html) {
  const h = String(html || '');
  if (!h.trim()) return false;
  if (
    /\bswiper\b|data-swiper|data-component=["']swiper|owl-carousel|slick-|keen-slider|embla/i.test(
      h,
    )
  ) {
    return true;
  }
  if (/aria-roledescription=["']carousel["']/i.test(h)) return true;
  if (/role=["']region["'][^>]*aria-label=["'][^"']*carousel/i.test(h)) return true;
  // Prev/next controls typical of sliders
  if (
    /swiper-(button|pagination)|carousel-(prev|next|dot|bullet|indicator)|slider-(prev|next|dot)/i.test(
      h,
    )
  ) {
    return true;
  }
  if (hasCarouselArrows(h) || hasCarouselDots(h)) {
    // Prefer carousel when controls co-exist with repeated cards / slides
    if (
      /slide|imgcard|card|swiper-slide|carousel-item/i.test(h) ||
      hasCarouselDots(h)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Visible prev/next arrow controls in section HTML (what the crop/screenshot shows).
 * @param {string|null|undefined} html
 * @returns {boolean}
 */
export function hasCarouselArrows(html) {
  const h = String(html || '');
  if (!h.trim()) return false;
  if (
    /TilesCarouselArrow|carousel-(prev|next)|slider-(prev|next)|swiper-(button-)?(prev|next)|data-swiper-(prev|next)/i.test(
      h,
    )
  ) {
    return true;
  }
  if (
    /aria-label=["'][^"']*(previous|next|prev|zurück|vorige|volgende|previous slide|next slide)[^"']*["']/i.test(
      h,
    )
  ) {
    return true;
  }
  if (
    /\b(carousel|slider|swiper).{0,80}(prev|next|arrow)/i.test(h) ||
    /(prev|next|arrow).{0,80}\b(carousel|slider|swiper)/i.test(h)
  ) {
    return true;
  }
  return false;
}

/**
 * Visible bullet/dot pagination in section HTML.
 * Do NOT treat bare role=tablist as dots — MediaSlider uses tablist for story tabs.
 * @param {string|null|undefined} html
 * @returns {boolean}
 */
export function hasCarouselDots(html) {
  const h = String(html || '');
  if (!h.trim()) return false;
  if (
    /swiper-pagination|carousel-dots|carousel-bullets|slider-dots|pagination-bullet/i.test(
      h,
    )
  ) {
    return true;
  }
  if (/class=["'][^"']*\b(dot|bullet|pagination)[^"']*["']/i.test(h)) {
    return true;
  }
  return false;
}

/**
 * Logo / badge / marquee rails prefer continuous CSS translate over snap autoplay.
 * @param {object|null|undefined} info
 * @returns {boolean}
 */
export function prefersContinuousMarquee(info) {
  if (layoutMotionIsContinuousMarquee(info)) return true;
  const blob = [
    info?.cmsName,
    info?.componentName,
    info?.name,
    info?.layout?.pattern,
    info?.layout?.interactionNotes,
    info?.layout?.structureNotes,
    info?.description,
    info?.purpose,
    ...(Array.isArray(info?.alternativeNames) ? info.alternativeNames : []),
  ]
    .map((x) => String(x || '').toLowerCase())
    .join(' ');
  return (
    /horizontal-logo-carousel|logo.?carousel|logo.?wall|full-width-marquee|award.?badge.?carousel|award.?badge.?rail|marquee|continuously|continuous.?motion|programmatically translated|loops? its items|announcement.?bar|notification.?bar|band.?ticker/.test(
      blob,
    )
  );
}

/**
 * Infer carousel chrome when layoutMode is (or would be) carousel.
 * arrows / dots when HTML or interaction notes show those controls;
 * auto when carousel with neither (auto-scroll / marquee).
 * @param {object|null|undefined} info
 * @param {string|null|undefined} sectionHtml
 * @returns {CarouselChromeMode}
 */
export function inferCarouselChromeMode(info, sectionHtml) {
  const layoutMode = inferPlaceholderLayoutMode(info, sectionHtml);
  if (layoutMode !== 'carousel') return 'none';

  const html = String(sectionHtml || '');
  const notes = String(info?.layout?.interactionNotes || '').toLowerCase();
  const arrows =
    hasCarouselArrows(html) ||
    /\b(previous|next|prev).{0,40}(arrow|button|slide)/.test(notes) ||
    /\barrow buttons?\b/.test(notes);
  const dots =
    hasCarouselDots(html) ||
    /\b(dot|bullet|pagination)\b/.test(notes);

  if (arrows && dots) return 'dots'; // dots+arrows still need pagination chrome
  if (dots) return 'dots';
  if (arrows) return 'arrows';
  return 'auto';
}

/**
 * Infer layout mode for placeholder / carousel fixups from section info + HTML analysis.
 * @param {object|null|undefined} info section-information.json
 * @param {string|null|undefined} sectionHtml
 * @returns {PlaceholderLayoutMode}
 */
export function inferPlaceholderLayoutMode(info, sectionHtml) {
  const analysis = analyzeSectionHtml(sectionHtml) || null;
  const pattern = String(analysis?.pattern || info?.layout?.pattern || '').toLowerCase();
  const layoutNotes = [
    info?.layout?.structureNotes,
    info?.layout?.interactionNotes,
    info?.composition,
    info?.purpose,
    info?.description,
  ]
    .map((x) => String(x || '').toLowerCase())
    .join(' ');

  // Tabbed media (MediaSlider) before carousel — names often contain "slider".
  if (looksLikeMediaTabs(info, sectionHtml)) return 'media-tabs';
  if (/responsive-media-slider/.test(pattern)) return 'media-tabs';

  // Name / JSON identity wins early — "CapabilityCarousel" must not fall through to auto.
  if (looksLikeCarouselByName(info)) return 'carousel';
  if (looksLikeCarouselByHtml(sectionHtml)) return 'carousel';

  if (
    /carousel|swiper|snap-x|slider|scroll.?row/.test(pattern) ||
    /carousel|swiper|slider|horizontal.?scroll/.test(layoutNotes)
  ) {
    if (/responsive-media-slider/.test(pattern)) return 'media-tabs';
    if (/responsive-grid-carousel/.test(pattern)) return 'carousel';
    if (/carousel/.test(pattern) || /carousel|swiper|slider/.test(layoutNotes)) {
      return 'carousel';
    }
  }

  if (
    /metric|stat|trust.?metric|equal.?column|w-1\/3/.test(pattern) ||
    /metric|statistic|trust metric|kpi|counter/.test(layoutNotes)
  ) {
    return 'metric';
  }

  const desktopLayout = String(analysis?.desktop?.layout || '').toLowerCase();
  if (desktopLayout === 'carousel') return 'carousel';
  if (desktopLayout === 'grid' || desktopLayout === 'columns' || desktopLayout === 'row') {
    return 'columns';
  }

  if (/grid|columns|multi.?column|flex.?row/.test(layoutNotes)) return 'columns';

  return 'auto';
}

/**
 * Build a short per-viewport layout hints block for the codegen user message.
 * @param {object|null|undefined} info
 * @param {string|null|undefined} sectionHtml
 * @param {string|null|undefined} [authoredCss]
 * @returns {string}
 */
export function formatLayoutHintsForPrompt(info, sectionHtml, authoredCss) {
  const analysis = analyzeSectionHtml(sectionHtml);
  const mode = inferPlaceholderLayoutMode(info, sectionHtml);
  const chromeMode = inferCarouselChromeMode(info, sectionHtml);
  const lines = [
    '=== VIEWPORT / LAYOUT CONTRACT (required) ===',
    'Mobile: width < 768 (crop ~370px) — unprefixed / max-md:',
    'Tablet: 768 ≤ width ≤ 1023 (crop 768px) — md: … below lg: / max-lg:',
    'Desktop Small ≥1024 (crop 1024) — typically lg:; Regular 1280 → xl:; Large 1536 → 2xl: when HTML/crops use them',
    'Breakpoints follow section.html + five viewport crops — do not invent a different ladder',
    'Goal: near pixel-perfect match of the viewport crops (layout, spacing, type, color, media).',
    `Inferred placeholder layoutMode: ${mode}`,
  ];
  if (mode === 'carousel' && chromeMode !== 'none') {
    lines.push(`Inferred carouselChromeMode: ${chromeMode}`);
    if (chromeMode === 'auto' && prefersContinuousMarquee(info)) {
      lines.push('carouselAutoStyle: continuous-marquee');
    } else if (chromeMode === 'auto') {
      lines.push('carouselAutoStyle: interval-snap');
    }
  }

  if (analysis) {
    lines.push(`HTML layout pattern: ${analysis.pattern || '(unknown)'}`);
    if (analysis.cardCount != null) lines.push(`cardCount: ${analysis.cardCount}`);
    for (const vp of ['desktop', 'tablet', 'mobile']) {
      const block = analysis[vp];
      if (!block) continue;
      const bits = [
        block.layout && `layout=${block.layout}`,
        block.columnsMax != null && `columnsMax=${block.columnsMax}`,
        block.controls && `controls=${block.controls}`,
        block.description,
      ].filter(Boolean);
      if (bits.length) lines.push(`${vp}: ${bits.join('; ')}`);
    }
  }

  if (info?.layout && typeof info.layout === 'object') {
    lines.push(`section-information.layout: ${JSON.stringify(info.layout).slice(0, 1200)}`);
  }
  const motionBlock = formatMotionBlockForPrompt(info);
  if (motionBlock) {
    lines.push('', motionBlock);
  }
  // Continuous marquee from pattern even without structured motion (e.g. full-width-marquee).
  if (!motionBlock && prefersContinuousMarquee(info)) {
    lines.push(
      '',
      '=== MOTION ===',
      'HARD: continuous-marquee inferred — companion clientTsx MUST use ContinuousMarquee from components/primitives/continuous-marquee; mount children once.',
    );
    if (layoutMotionIsBandTicker(info) || layoutMotionSurface(info) === 'band-ticker') {
      lines.push(
        'HARD — band-ticker: bg on outer full-bleed; ContinuousMarquee variant="band" around nowrap text only; center when fits, continuous scroll only on overflow.',
      );
    }
  } else if (
    motionBlock &&
    (layoutMotionIsBandTicker(info) || layoutMotionSurface(info) === 'band-ticker')
  ) {
    // formatMotionBlockForPrompt already emits band-ticker HARD lines
  }
  // Peer cards / card-carousel only — never force for every layoutMode=carousel
  // (horizontal-logo-carousel / ContinuousMarquee image rails use items-center).
  const equalHeight =
    layoutWantsEqualHeightChildren(info) || layoutPatternSuggestsEqualHeight(info);
  if (equalHeight && (mode === 'carousel' || mode === 'columns' || mode === 'auto')) {
    lines.push(
      '',
      '=== EQUAL-HEIGHT CHILDREN (HARD) ===',
      'Peer cards/tiles in the track/grid share one row height (capability/feature/recommendation cards).',
      'Does NOT apply to logo-marquee / ContinuousMarquee image rails — those use items-center + fixed image heights.',
      'Parent: items-stretch AND [&>*]:h-full on the flex/grid track (both required — or grid … items-stretch).',
      'Child card root: flex h-full flex-col; body/content flex-1 (not only h-full on a nested Link).',
      'Forbidden: asymmetric my-* on only one card; bare AppPlaceholder without a stretch layout wrapper; [&>*]:h-full alone without items-stretch.',
    );
  }

  // Peer N-column grid (cols-4x3 / health cards / same-type tiles).
  const columnsMax =
    Number(analysis?.desktop?.columnsMax) ||
    Number(analysis?.columnsMax) ||
    Number(info?.layout?.columnsMax) ||
    (Number(analysis?.cardCount) >= 2 && Number(analysis?.cardCount) <= 6
      ? Number(analysis.cardCount)
      : 0);
  if (
    columnsMax >= 2 &&
    mode !== 'carousel' &&
    !prefersContinuousMarquee(info)
  ) {
    lines.push(
      '',
      '=== PEER COLUMN GRID (HARD) ===',
      `Same-type peer children (cardCount/columnsMax=${columnsMax}) mount under ONE AppPlaceholder track with className including grid grid-cols-1 gap-* lg:grid-cols-${columnsMax}.`,
      'Forbidden: N full-width stacked sections for N peer cards; bare AppPlaceholder without a grid-cols-N wrapper.',
      'Optional band heading (e.g. Meer gezondheid) sits outside the grid track.',
    );
  }

  const cssBlob =
    typeof authoredCss === 'string' && authoredCss.trim()
      ? authoredCss
      : typeof info?.authoredCss === 'string'
        ? info.authoredCss
        : typeof info?.css === 'string'
          ? info.css
          : '';
  if (
    captureSuggestsCtaMaskArrow(
      typeof sectionHtml === 'string' ? sectionHtml : '',
      cssBlob,
    )
  ) {
    lines.push(
      '',
      '=== CTA MASK ARROW (HARD) ===',
      'Pill / rounded-full buttons that show a trailing arrow → sc-cta-after-arrow even if mask-image is missing from section CSS.',
      "Emit: className=\"… sc-cta-after-arrow … after:ml-* after:bg-current|after:bg-[#…]\" on the Link.",
      "Forbidden on the same control: after:content-['→']; after:h-[22px] after:w-[22px] after:bg-* without sc-cta-after-arrow (solid square).",
      'Buttons with no arrow in the crop: omit after: / sc-cta-after-arrow — do not invent arrows.',
      'Leading icon/before: before the label: keep it (before: on self-closing Link, or FaIcon/Image child inside <Link> — never showLinkTextWithChildrenPresent); do not drop leading chrome to force childless.',
      "Text after:content-['→'] only for plain underlined inline links — never on pill buttons.",
    );
  }
  const chromeBlock = formatChromeGutterBlockForPrompt(
    extractChromeGutterHintsFromCapture(
      typeof sectionHtml === 'string' ? sectionHtml : '',
      cssBlob,
    ),
  );
  if (chromeBlock) {
    lines.push('', chromeBlock);
  }
  if (info?.layout?.structureNotes) {
    lines.push(
      '',
      '=== STRUCTURE NOTES HARD CONTRACT ===',
      'Match this structure in parent TSX + placeholders + children (do not flatten into a single CTA shell):',
      String(info.layout.structureNotes).slice(0, 1500),
    );
  }
  if (info?.composition) {
    const compositionText =
      typeof info.composition === 'object'
        ? JSON.stringify(info.composition)
        : String(info.composition);
    lines.push(`composition: ${compositionText.slice(0, 800)}`);
  }
  if (info?.scrollBehavior && typeof info.scrollBehavior === 'object') {
    lines.push(
      `scrollBehavior (per device): ${JSON.stringify(info.scrollBehavior).slice(0, 800)}`,
    );
    const desk = pickDesktopScrollBehavior(info);
    lines.push(`scrollBehaviorSummary: ${formatScrollBehaviorSummary(desk)}`);
    const track = String(info?.track || '').toLowerCase();
    const chromeKind = String(info?.chromeKind || '').toLowerCase();
    if (track === 'header' || chromeKind === 'header-stack') {
      lines.push(
        `CHROME KIND (hard): track=header / header-stack — sticky site chrome (partial-header), not a float overlay. Content clears under this stack; use sticky stack hooks; do not apply overlay Visible/Dismissed seeds.`,
      );
    } else if (
      (track === 'overlay' || info?.isOverlay === true) &&
      chromeKind !== 'header-stack'
    ) {
      lines.push(
        `CHROME KIND (hard): track=overlay / float-overlay — true overlay (cookie/CMP/chat). partial-cookie when consent language; keep overlay visibility seeds.`,
      );
    }
    const purposeBlob = [
      info?.cmsName,
      info?.purpose,
      info?.heading,
      info?.selector,
      info?.mapping?.primary?.slug,
      info?.mapping?.primary?.name,
    ]
      .map((s) => String(s || ''))
      .join(' ')
      .toLowerCase();
    const isCmpPreferenceCenter =
      (track === 'overlay' || info?.isOverlay === true) &&
      /onetrust|cookiepro|ot-pc|preference|voorkeuren|consent.?banner|cmp/.test(purposeBlob);
    if (isCmpPreferenceCenter) {
      lines.push(
        `CMP PREFERENCE CENTER (hard): Full-viewport modal overlay (#onetrust-pc-sdk / preference center). clientTsx MUST use fixed inset-0 backdrop + centered dialog — do NOT use useStickyChromeInset / useStickyChromeLayer (stickyTopPx is page-chrome noise, not a modal pin).`,
      );
    }
    if (desk.hidesOnScrollDown && !isCmpPreferenceCenter) {
      lines.push(
        `HIDE-ON-SCROLL (hard): hidesOnScrollDown=true — companion clientTsx must hide chrome after ~${desk.hideAfterScrollYPx ?? '?'}px (~${desk.hideAfterViewports ?? '?'}vh); restore on scroll-up if showsOnScrollUp. Do not leave a permanent always-visible fixed/sticky bar.`,
      );
      lines.push(
        `STICKY PUBLISH (hard): Register with useStickyChromeLayer from components/hooks/use-sticky-chrome; pass hidden:true when collapsed so later same-edge stickies move up. Forbidden: translateY-only hide or ad-hoc CSS vars.`,
      );
    }
    const stickyTopPx =
      desk.stickyTopPx != null && Number.isFinite(Number(desk.stickyTopPx))
        ? Number(desk.stickyTopPx)
        : null;
    const chromeStack =
      info?.chromeStack?.desktop ||
      info?.chromeStack?.desktopRegular ||
      info?.chromeStack?.desktopLarge ||
      null;
    if (chromeStack) {
      lines.push(
        `chromeStack: ${JSON.stringify(chromeStack).slice(0, 400)}`,
      );
    }
    const needsInset =
      !isCmpPreferenceCenter &&
      ((stickyTopPx != null && stickyTopPx > 0) ||
        chromeStack?.precedingMayCollapse === true);
    if (needsInset) {
      lines.push(
        `STICKY INSET (hard): stickyTopPx=${stickyTopPx ?? chromeStack?.restingInsetPx ?? '?'} — pin with useStickyChromeInset(edge, fallbackInsetPxNumber) or useStickyChromeLayer({ edge, fallbackInsetPx }) (style.top/bottom from hook), never a lone static top-[Npx]. Second arg to useStickyChromeInset is a number — never {fallbackPx}. Import from components/hooks/use-sticky-chrome.`,
      );
    }
  }

  lines.push(
    'Parent owns AppPlaceholder child layout: match the crop (grid/flex columns OR snap-x carousel only when the crop is a slider). Never invent snap-x for metric/equal-width strips.',
  );

  const pattern = String(info?.layout?.pattern || '').toLowerCase();
  const purpose = String(info?.purpose || info?.description || '').toLowerCase();
  const html = String(sectionHtml || '');
  const isStackedFooter =
    pattern === 'stacked-footer' ||
    (/signpost|navigation column|legal footer|social/.test(purpose) &&
      /footer|legal|signpost/.test(purpose)) ||
    /data-component-name=["']LegalFooter["']/i.test(html) ||
    /SignpostModules|LegalFooter/i.test(html);
  if (isStackedFooter) {
    lines.push(
      '',
      '=== STACKED-FOOTER HARD CONTRACT ===',
      '1. Parent MUST declare SEPARATE AppPlaceholder bases: footer-signposts, footer-navigation, footer-social, footer-legal (never a single footer-content dump).',
      '2. Enrich repeats → children: SignpostLinks → signpost children; NavigationGroups → navigation-group / link-column children; SocialLinks → branding+social; LegalLinks → legal. Do NOT flatten repeats into parent field arrays.',
      '3. Prefer branding+social over logo-only branding when SocialLinks exist.',
      '4. Desktop crop: CTA/copy + signpost rows, then five nav columns, then social/branding, then copyright+legal.',
    );
  }

  if (mode === 'media-tabs') {
    lines.push(
      '',
      '=== TABBED MEDIA SWITCHER HARD CONTRACT (layoutMode=media-tabs) ===',
      'This is a TABBED media switcher — NOT a horizontal card carousel. (Aliases like MediaSlider / CustomerStorySlider map here; pattern defines the mode.)',
      '1. Desktop (≥lg): media/video thumbnail LEFT (~60%); vertical TEXT selectors RIGHT (~40%, role=tablist). Optional media-corner logo badge on the active panel only (hidden lg:flex).',
      '2. PARENT owns tablists — companion clientTsx builds desktop text tabs + max-lg logo strip (aria-selected / hide inactive panels). Never leave AppPlaceholder bare (PH siblings stack).',
      '3. Below lg (mobile/tablet): logo tab strip and/or accordion (flex lg:hidden) — not text tabs, not a snap-x multi-card strip.',
      '4. VIEWPORT-EXCLUSIVE (HARD): logo media-badge vs logo-strip tabs are XOR per breakpoint — never both visible at once (no AND/AND duplicate logos on tablet/desktop). Same rule for any dual presentation of one content role across crops.',
      '5. FORBIDDEN: snap-x / overflow-x-auto card carousel / [&>*]:w-[min(90%,350px)] for this pattern.',
      '6. CHILD is a part bag only — prefer data-media-tab-item + data-media-tab-title + data-media-tab-panel + data-media-tab-logo (legacy data-story-* equivalents accepted). Parent chrome reads those parts.',
      '7. FORBIDDEN on CHILD: self-contained desktop tab chrome — e.g. data-media-tab-tab / data-story-tab (or any tab UI) wrapped in hidden lg:flex / hidden md:flex inside each article. Do not emit a second tablist inside the child.',
    );
  }

  if (mode === 'carousel') {
    const chromeLines = [
      '',
      '=== CAROUSEL HARD CONTRACT (layoutMode=carousel) ===',
      'This section IS a carousel (name and/or HTML: swiper/slider/arrows/dots) — not media-tabs.',
      '1. Parent map-entry tsx: horizontal track around AppPlaceholder — flex + snap-x sizing. Forbidden: bare AppPlaceholder / flex-col alone (placeholder children stack vertically by default).',
      '2. Placeholder children are the slides — they must be DIRECT track children (not wrapped in one basis-full shell).',
      '3. HARD — one scroll track only: never nest snap-x/overflow-x-auto around AppPlaceholder inside CarouselChrome; pass bare <AppPlaceholder /> as chrome children; the chrome owns the only overflow track.',
      '4. Hide native scrollbar. Never leave cards as a vertical stack because AppPlaceholder emits bare siblings.',
    ];
    if (chromeMode === 'auto') {
      chromeLines.push(
        '5. carouselChromeMode=auto (NO arrows and NO dots in the crop): companion clientTsx MUST auto-scroll. Manual overflow-x-auto alone is NOT enough.',
        prefersContinuousMarquee(info)
          ? '   Prefer continuous marquee via ContinuousMarquee from components/primitives/continuous-marquee (DOM-clones the track). Mount AppPlaceholder once as chrome children — Forbidden: rendering {children}/{AppPlaceholder} twice. Pause/reduced-motion handled by the primitive.'
          : '   Prefer interval snap autoplay (scrollBy to next card on a timer). Pause on prefers-reduced-motion and hover.',
        '   Do NOT emit prev/next arrow buttons or dots when chromeMode=auto.',
      );
    } else if (chromeMode === 'dots') {
      chromeLines.push(
        '5. carouselChromeMode=dots: companion clientTsx with working scrollBy arrows (if present) AND bullet/dot pagination. Main tsx stays a Server Component.',
      );
    } else {
      chromeLines.push(
        '5. carouselChromeMode=arrows: companion clientTsx with working scrollBy prev/next. Forbidden: decorative disabled arrows. Main tsx stays a Server Component; pass AppPlaceholder as children.',
      );
    }
    lines.push(...chromeLines);
  }

  lines.push(
    '',
    '=== APPPLACEHOLDER LAYOUT (all composites) ===',
    'Sitecore AppPlaceholder children render as stacked blocks unless the parent wraps them in flex/grid/snap-x/media-tabs chrome matching the crop. Always specify that layout explicitly.',
    '',
    '=== VIEWPORT-EXCLUSIVE CHROME (all components) ===',
    'If the same content (logo, nav, CTA, title) appears as two different UI forms across mobile/tablet/desktop crops, emit mutually exclusive visibility (lg:hidden + hidden lg:flex) — one form per viewport. Forbidden: both forms always visible (duplicate logos/controls on tablet/desktop).',
  );

  return lines.join('\n');
}
