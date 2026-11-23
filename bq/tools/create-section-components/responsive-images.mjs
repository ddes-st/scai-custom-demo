/**
 * Deterministic extraction of viewport-scoped images from section HTML.
 * Used by create:sectioncomponents codegen so Desktop/Mobile/Tablet Image
 * seeds get the correct absolute URLs.
 *
 * Classification (in order): source/media → inline style → standard framework
 * display utilities → URL path keywords. Site-specific classes (e.g. u-hide-*)
 * are ignored. Sibling <picture> pairs promote unclassified siblings.
 */

/**
 * @typedef {{ url: string, alt: string, evidence: string }} ResponsiveImageHit
 * @typedef {{
 *   desktop: ResponsiveImageHit[],
 *   tablet: ResponsiveImageHit[],
 *   mobile: ResponsiveImageHit[],
 *   other: ResponsiveImageHit[],
 * }} ResponsiveImageInventory
 * @typedef {'desktop'|'tablet'|'mobile'|'other'} ViewportKind
 */

function decodeHtmlEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function firstSrcsetUrl(srcset) {
  const raw = String(srcset || '').trim();
  if (!raw) return '';
  const first = raw.split(',')[0]?.trim() || '';
  return first.split(/\s+/)[0] || '';
}

function attr(tag, name) {
  const re = new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i');
  const m = tag.match(re);
  return m ? decodeHtmlEntities(m[2]) : '';
}

/**
 * @param {string} query
 * @returns {ViewportKind}
 */
function classifyMediaQuery(query) {
  const med = String(query || '').toLowerCase();
  if (!med.trim()) return 'other';

  const maxW = med.match(/max-width:\s*(\d+)/);
  const minW = med.match(/min-width:\s*(\d+)/);
  if (maxW) {
    const n = Number(maxW[1]);
    // Mobile: max-width ≤767; Tablet: max-width 768–1023; ≥1024 max is not a band alone
    if (n <= 767) return 'mobile';
    if (n <= 1023) return 'tablet';
  }
  if (minW) {
    const n = Number(minW[1]);
    // Desktop: min-width ≥1024; Tablet: min-width 768–1023; Mobile-ish: <768
    if (n >= 1024) return 'desktop';
    if (n >= 768) return 'tablet';
    if (n > 0) return 'mobile';
  }
  return 'other';
}

/**
 * Bootstrap / Tailwind / Bulma / Foundation / Materialize / UIkit.
 * @param {string} className
 * @returns {ViewportKind}
 */
function classifyFrameworkClasses(className) {
  const cls = String(className || '').toLowerCase();
  if (!cls.trim()) return 'other';

  // --- Bootstrap ---
  if (
    (/\bd-none\b/.test(cls) && /\bd-(sm|md|lg|xl|xxl)-(block|flex|inline|grid)\b/.test(cls)) ||
    (/\bd-(md|lg|xl|xxl)-(block|flex|inline|grid)\b/.test(cls) && !/\bd-(md|lg|xl|xxl)-none\b/.test(cls))
  ) {
    return 'desktop';
  }
  if (/\bd-(md|lg|xl|xxl)-none\b/.test(cls)) {
    return 'mobile';
  }

  // --- Tailwind ---
  // Desktop visibility starts at lg: (1024). md: alone is tablet band.
  if (
    (/\bhidden\b/.test(cls) && /\b(lg|xl|2xl):(block|flex|inline|grid)\b/.test(cls)) ||
    (/\b(lg|xl|2xl):(block|flex|inline|grid)\b/.test(cls) && !/\b(lg|xl|2xl):hidden\b/.test(cls))
  ) {
    return 'desktop';
  }
  if (
    (/\bhidden\b/.test(cls) && /\bmd:(block|flex|inline|grid)\b/.test(cls) && !/\b(lg|xl|2xl):(block|flex|inline|grid)\b/.test(cls)) ||
    (/\bmd:(block|flex|inline|grid)\b/.test(cls) && !/\bmd:hidden\b/.test(cls) && !/\b(lg|xl|2xl):(block|flex|inline|grid)\b/.test(cls))
  ) {
    return 'tablet';
  }
  if (/\b(lg|xl|2xl):hidden\b/.test(cls) || /\bmax-md:(block|flex)\b/.test(cls)) {
    return 'mobile';
  }
  if (/\bmd:hidden\b/.test(cls) && !/\b(lg|xl|2xl):(block|flex|inline|grid)\b/.test(cls)) {
    return 'mobile';
  }

  // --- Bulma ---
  if (/\bis-hidden-mobile\b/.test(cls) || /\bis-block-desktop\b/.test(cls) || /\bis-hidden-touch\b/.test(cls)) {
    return 'desktop';
  }
  if (/\bis-hidden-desktop\b/.test(cls) || /\bis-hidden-tablet\b/.test(cls) || /\bis-hidden-widescreen\b/.test(cls)) {
    return 'mobile';
  }

  // --- Foundation ---
  if (
    /\bshow-for-(medium|large|xlarge|xxlarge)\b/.test(cls) ||
    /\bhide-for-small-only\b/.test(cls) ||
    /\bshow-for-medium-up\b/.test(cls)
  ) {
    return 'desktop';
  }
  if (
    /\bhide-for-(medium|large|xlarge)\b/.test(cls) ||
    /\bshow-for-small-only\b/.test(cls) ||
    /\bhide-for-medium-up\b/.test(cls)
  ) {
    return 'mobile';
  }

  // --- Materialize ---
  if (
    /\bhide-on-small-only\b/.test(cls) ||
    /\bhide-on-med-and-down\b/.test(cls) ||
    /\bshow-on-large\b/.test(cls) ||
    /\bshow-on-medium-and-up\b/.test(cls)
  ) {
    return 'desktop';
  }
  if (
    /\bhide-on-med-and-up\b/.test(cls) ||
    /\bhide-on-large-only\b/.test(cls) ||
    /\bshow-on-small\b/.test(cls) ||
    /\bhide-on-med-only\b/.test(cls)
  ) {
    return 'mobile';
  }

  // --- UIkit (uk-visible@m, uk-hidden@s) ---
  if (/\buk-visible@(m|l|xl)\b/.test(cls) || /\buk-hidden@s\b/.test(cls)) {
    return 'desktop';
  }
  if (/\buk-hidden@(m|l|xl)\b/.test(cls) || /\buk-visible@s\b/.test(cls)) {
    return 'mobile';
  }

  return 'other';
}

/**
 * @param {string} className
 * @param {string} media
 * @param {string} url
 * @param {string} [style]
 * @returns {ViewportKind}
 */
export function classifyViewport(className, media, url, style = '') {
  const fromMedia = classifyMediaQuery(media);
  if (fromMedia !== 'other') return fromMedia;

  const fromStyle = classifyMediaQuery(style);
  if (fromStyle !== 'other') return fromStyle;

  const fromFramework = classifyFrameworkClasses(className);
  if (fromFramework !== 'other') return fromFramework;

  const path = String(url || '').toLowerCase();
  if (/mobile|phone|sm\.|_sm\b|-sm\./i.test(path)) return 'mobile';
  if (/tablet|pad|_md\b|-md\./i.test(path)) return 'tablet';
  if (/desktop|large|_lg\b|-lg\b|-xl\./i.test(path)) return 'desktop';

  return 'other';
}

/**
 * @typedef {{
 *   start: number,
 *   end: number,
 *   className: string,
 *   style: string,
 *   assets: { url: string, alt: string, viewport: ViewportKind, evidence: string }[],
 *   pictureViewport: ViewportKind,
 * }} PictureRecord
 */

/**
 * Promote unclassified sibling pictures when a peer has a clear viewport.
 * @param {PictureRecord[]} group
 */
function promoteSiblingViewports(group) {
  if (group.length < 2) return;

  const hasMobile = group.some((p) => p.pictureViewport === 'mobile');
  const hasDesktop = group.some((p) => p.pictureViewport === 'desktop');
  const hasTablet = group.some((p) => p.pictureViewport === 'tablet');

  for (const pic of group) {
    if (pic.pictureViewport !== 'other') continue;
    /** @type {ViewportKind} */
    let next = 'other';
    if (hasMobile && !hasDesktop) next = 'desktop';
    else if (hasDesktop && !hasMobile) next = 'mobile';
    else if (hasTablet && !hasDesktop && !hasMobile) next = 'desktop';
    if (next === 'other') continue;

    pic.pictureViewport = next;
    for (const asset of pic.assets) {
      if (asset.viewport === 'other') {
        asset.viewport = next;
        asset.evidence = `${asset.evidence}; sibling→${next}`;
      }
    }
  }
}

/**
 * Group consecutive <picture> elements separated only by whitespace.
 * @param {PictureRecord[]} pictures
 * @param {string} text
 * @returns {PictureRecord[][]}
 */
function groupSiblingPictures(pictures, text) {
  /** @type {PictureRecord[][]} */
  const groups = [];
  let current = [];
  for (const pic of pictures) {
    if (current.length === 0) {
      current = [pic];
      continue;
    }
    const prev = current[current.length - 1];
    const gap = text.slice(prev.end, pic.start);
    if (/^\s*$/.test(gap)) {
      current.push(pic);
    } else {
      groups.push(current);
      current = [pic];
    }
  }
  if (current.length) groups.push(current);
  return groups;
}

/**
 * @param {string} html
 * @returns {ResponsiveImageInventory}
 */
export function extractResponsiveImages(html) {
  /** @type {ResponsiveImageInventory} */
  const inv = { desktop: [], tablet: [], mobile: [], other: [] };
  const seen = new Set();

  /**
   * @param {string} url
   * @param {string} alt
   * @param {ViewportKind} viewport
   * @param {string} evidence
   */
  function add(url, alt, viewport, evidence) {
    const u = decodeHtmlEntities(url).trim();
    if (!u || !/^https?:\/\//i.test(u)) return;
    const key = `${viewport}|${u}`;
    if (seen.has(key)) return;
    seen.add(key);
    inv[viewport].push({ url: u, alt: alt || '', evidence });
  }

  const text = String(html || '');
  /** @type {PictureRecord[]} */
  const pictures = [];

  const pictureRe = /<picture\b([^>]*)>([\s\S]*?)<\/picture>/gi;
  let pm;
  while ((pm = pictureRe.exec(text))) {
    const pictureAttrs = pm[1] || '';
    const body = pm[2] || '';
    const pictureClass = attr(pictureAttrs, 'class');
    const pictureStyle = attr(pictureAttrs, 'style');

    /** @type {PictureRecord} */
    const record = {
      start: pm.index,
      end: pm.index + pm[0].length,
      className: pictureClass,
      style: pictureStyle,
      assets: [],
      pictureViewport: 'other',
    };

    const sourceRe = /<source\b([^>]*)\/?>/gi;
    let sm;
    let hadSource = false;
    while ((sm = sourceRe.exec(body))) {
      hadSource = true;
      const sAttrs = sm[1] || '';
      const media = attr(sAttrs, 'media');
      const url = firstSrcsetUrl(attr(sAttrs, 'srcset')) || attr(sAttrs, 'src');
      let vp = classifyViewport(pictureClass, media, url, pictureStyle);
      if (vp === 'other') vp = classifyViewport('', media, url, '');
      record.assets.push({
        url,
        alt: '',
        viewport: vp,
        evidence: `picture>source media=${media || '(none)'}`,
      });
      if (vp !== 'other' && record.pictureViewport === 'other') {
        record.pictureViewport = vp;
      }
    }

    const imgInnerRe = /<img\b([^>]*)\/?>/gi;
    let im;
    while ((im = imgInnerRe.exec(body))) {
      const iAttrs = im[1] || '';
      const url = attr(iAttrs, 'src') || firstSrcsetUrl(attr(iAttrs, 'srcset'));
      const alt = attr(iAttrs, 'alt');
      const imgClass = [pictureClass, attr(iAttrs, 'class')].filter(Boolean).join(' ');
      const imgStyle = attr(iAttrs, 'style') || pictureStyle;
      let vp = classifyViewport(imgClass, '', url, imgStyle);
      if (vp === 'other' && record.pictureViewport !== 'other') {
        vp = record.pictureViewport;
      }
      if (vp !== 'other' && record.pictureViewport === 'other') {
        record.pictureViewport = vp;
      }
      record.assets.push({
        url,
        alt,
        viewport: vp,
        evidence: hadSource
          ? `picture>img (fallback)`
          : `picture class=${pictureClass || '(none)'}`,
      });
    }

    if (record.pictureViewport === 'other') {
      const fromPic = classifyViewport(pictureClass, '', '', pictureStyle);
      if (fromPic !== 'other') {
        record.pictureViewport = fromPic;
        for (const asset of record.assets) {
          if (asset.viewport === 'other') asset.viewport = fromPic;
        }
      }
    }

    pictures.push(record);
  }

  for (const group of groupSiblingPictures(pictures, text)) {
    promoteSiblingViewports(group);
    for (const pic of group) {
      for (const asset of pic.assets) {
        add(asset.url, asset.alt, asset.viewport, asset.evidence);
      }
    }
  }

  const withoutPictures = text.replace(/<picture\b[\s\S]*?<\/picture>/gi, '');
  const imgRe = /<img\b([^>]*)\/?>/gi;
  let im;
  while ((im = imgRe.exec(withoutPictures))) {
    const iAttrs = im[1] || '';
    const url = attr(iAttrs, 'src') || firstSrcsetUrl(attr(iAttrs, 'srcset'));
    const alt = attr(iAttrs, 'alt');
    const cls = attr(iAttrs, 'class');
    const style = attr(iAttrs, 'style');
    const vp = classifyViewport(cls, '', url, style);
    add(url, alt, vp, `img class=${cls || '(none)'}`);
  }

  return inv;
}

/**
 * Best single URL for a viewport (first hit).
 * @param {ResponsiveImageInventory} inv
 * @param {'desktop'|'tablet'|'mobile'} viewport
 */
export function primaryUrl(inv, viewport) {
  return inv?.[viewport]?.[0]?.url || '';
}

/**
 * @param {string} name
 * @returns {ViewportKind}
 */
function viewportFromFieldName(name) {
  const n = String(name || '').toLowerCase().replace(/[\s_-]+/g, '');
  if (/desktop/.test(n)) return 'desktop';
  if (/mobile|phone/.test(n)) return 'mobile';
  if (/tablet|ipad/.test(n)) return 'tablet';
  return 'other';
}

/**
 * Build inventory from section-information suggestedFields (and array item images).
 * @param {Record<string, unknown>|null|undefined} info
 * @returns {ResponsiveImageInventory}
 */
export function inventoryFromSuggestedFields(info) {
  /** @type {ResponsiveImageInventory} */
  const inv = { desktop: [], tablet: [], mobile: [], other: [] };
  const seen = new Set();

  /**
   * @param {string} url
   * @param {string} alt
   * @param {ViewportKind} viewport
   * @param {string} evidence
   */
  function add(url, alt, viewport, evidence) {
    const u = String(url || '').trim();
    if (!u || !/^https?:\/\//i.test(u)) return;
    const key = `${viewport}|${u}`;
    if (seen.has(key)) return;
    seen.add(key);
    inv[viewport].push({ url: u, alt: alt || '', evidence });
  }

  /**
   * @param {unknown} field
   * @param {string} nameHint
   */
  function consumeField(field, nameHint) {
    if (!field || typeof field !== 'object') return;
    const f = /** @type {Record<string, unknown>} */ (field);
    const name = String(f.name || nameHint || '');
    const type = String(f.type || '').toLowerCase();

    if (type === 'array' && Array.isArray(f.value)) {
      for (const item of f.value) {
        if (!item || typeof item !== 'object') continue;
        for (const [k, v] of Object.entries(/** @type {Record<string, unknown>} */ (item))) {
          if (v && typeof v === 'object' && v !== null && 'src' in v) {
            const src = String(/** @type {{ src?: unknown }} */ (v).src || '');
            const alt = String(/** @type {{ alt?: unknown }} */ (v).alt || '');
            add(src, alt, viewportFromFieldName(k), `suggestedFields[].value.${k}`);
          } else if (typeof v === 'string' && /^https?:\/\//i.test(v) && /image|img|photo|icon/i.test(k)) {
            add(v, '', viewportFromFieldName(k), `suggestedFields[].value.${k}`);
          }
        }
      }
      return;
    }

    if (type === 'image' || (f.value && typeof f.value === 'object' && f.value !== null && 'src' in /** @type {object} */ (f.value))) {
      const val = f.value;
      if (val && typeof val === 'object') {
        const src = String(/** @type {{ src?: unknown }} */ (val).src || '');
        const alt = String(/** @type {{ alt?: unknown }} */ (val).alt || '');
        add(src, alt, viewportFromFieldName(name), `suggestedFields:${name}`);
      } else if (typeof val === 'string') {
        add(val, '', viewportFromFieldName(name), `suggestedFields:${name}`);
      }
    }
  }

  const suggested = Array.isArray(info?.suggestedFields) ? info.suggestedFields : [];
  for (const field of suggested) consumeField(field, '');

  const repeats = Array.isArray(info?.repeats) ? info.repeats : [];
  for (const rep of repeats) {
    if (!rep || typeof rep !== 'object') continue;
    const r = /** @type {Record<string, unknown>} */ (rep);
    if (!Array.isArray(r.value)) continue;
    consumeField(
      { type: 'array', name: r.name, value: r.value },
      String(r.name || ''),
    );
  }

  return inv;
}

/**
 * Prefer primary inventory per viewport; fill empty buckets from fallback.
 * @param {ResponsiveImageInventory} primary
 * @param {ResponsiveImageInventory} fallback
 * @returns {ResponsiveImageInventory}
 */
export function mergeImageInventories(primary, fallback) {
  /** @type {ResponsiveImageInventory} */
  const out = { desktop: [], tablet: [], mobile: [], other: [] };
  for (const key of /** @type {const} */ (['desktop', 'tablet', 'mobile', 'other'])) {
    out[key] =
      primary?.[key]?.length > 0 ? [...primary[key]] : [...(fallback?.[key] || [])];
  }
  return out;
}
