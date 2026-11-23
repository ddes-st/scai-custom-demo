/**
 * HTML image inventory helpers for REQUIRED IMAGE SEEDS prompts and logo-rail
 * child checks. `assertHtmlImagesInTsx` remains for unit tests / offline use —
 * write-component, tsx-contract-diagnostics, and visual-fidelity no longer call it
 * (composite parent/child ownership made the coverage warn too noisy).
 */
import {
  extractResponsiveImages,
  mergeImageInventories,
  inventoryFromSuggestedFields,
} from './responsive-images.mjs';

/**
 * Flatten inventory buckets to unique URL hits.
 * @param {import('./responsive-images.mjs').ResponsiveImageInventory|null|undefined} inv
 * @returns {{ url: string, alt: string, evidence: string }[]}
 */
export function flattenImageInventory(inv) {
  if (!inv || typeof inv !== 'object') return [];
  /** @type {Map<string, { url: string, alt: string, evidence: string }>} */
  const byUrl = new Map();
  for (const bucket of ['desktop', 'tablet', 'mobile', 'other']) {
    const list = Array.isArray(inv[bucket]) ? inv[bucket] : [];
    for (const hit of list) {
      const url = String(hit?.url || '').trim();
      if (!url || !/^https?:\/\//i.test(url)) continue;
      if (byUrl.has(url)) continue;
      byUrl.set(url, {
        url,
        alt: String(hit?.alt || ''),
        evidence: String(hit?.evidence || bucket),
      });
    }
  }
  return [...byUrl.values()];
}

/**
 * Heuristic: logo / brand / wordmark / partner mark paths or alts.
 * @param {{ url: string, alt?: string, evidence?: string }} hit
 */
export function isLogoLikeImage(hit) {
  const blob = `${hit.url} ${hit.alt || ''} ${hit.evidence || ''}`.toLowerCase();
  return /logo|wordmark|brand|partner|badge|mark|emblem|favicon|lockup/i.test(
    blob,
  );
}

/**
 * Collect Image field usage signals from TSX + definition.
 * @param {string} tsx
 * @param {string} [definitionTs]
 * @returns {{ hasImageComponent: boolean, fieldNames: string[], seedUrls: string[] }}
 */
export function collectTsxImageCoverage(tsx, definitionTs = '') {
  const text = String(tsx || '');
  const def = String(definitionTs || '');
  const hasImageComponent = /<Image\b/.test(text);

  /** @type {Set<string>} */
  const fieldNames = new Set();
  for (const m of text.matchAll(
    /<Image\b[^>]*\bfield\s*=\s*\{[^}]*fields(?:\[["']([^"']+)["']\]|\.(\w+))/gi,
  )) {
    fieldNames.add(m[1] || m[2] || '');
  }
  for (const m of text.matchAll(
    /(?:ImageField|type:\s*["']Image["'])/g,
  )) {
    void m;
  }
  // Fields interface: `Logo: ImageField` / `'Logo Image': ImageField`
  for (const m of text.matchAll(
    /(?:^|\n)\s*(?:['"]([^'"]+)['"]|(\w+))\s*:\s*ImageField\b/g,
  )) {
    fieldNames.add(m[1] || m[2] || '');
  }
  for (const m of def.matchAll(
    /\{\s*name:\s*["']([^"']+)["']\s*,\s*type:\s*["']Image["']/g,
  )) {
    fieldNames.add(m[1]);
  }

  /** @type {Set<string>} */
  const seedUrls = new Set();
  for (const m of def.matchAll(
    /url\s*:\s*["'](https?:\/\/[^"']+)["']/gi,
  )) {
    seedUrls.add(m[1]);
  }
  // Also bare image seed objects in content
  for (const m of text.matchAll(/["'](https?:\/\/[^"']+\.(?:png|jpe?g|svg|webp|gif)[^"']*)["']/gi)) {
    seedUrls.add(m[1]);
  }

  return {
    hasImageComponent,
    fieldNames: [...fieldNames].filter(Boolean),
    seedUrls: [...seedUrls],
  };
}

/**
 * Normalize URL for fuzzy match (strip query noise that differs).
 * @param {string} url
 */
export function normalizeUrlKey(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    // Drop common transform params but keep path
    ['w', 'h', 'width', 'height', 'quality', 'q', 'fm', 'fit'].forEach((k) =>
      u.searchParams.delete(k),
    );
    return u.href.replace(/\/$/, '').toLowerCase();
  } catch {
    return String(url || '')
      .split('?')[0]
      .replace(/\/$/, '')
      .toLowerCase();
  }
}

/**
 * @param {string} htmlUrl
 * @param {Set<string>} seedUrlKeys
 */
export function urlCoveredBySeeds(htmlUrl, seedUrlKeys) {
  const key = normalizeUrlKey(htmlUrl);
  if (seedUrlKeys.has(key)) return true;
  for (const s of seedUrlKeys) {
    if (key.includes(s) || s.includes(key)) return true;
    // Path basename match
    const a = key.split('/').pop() || '';
    const b = s.split('/').pop() || '';
    if (a && b && a === b) return true;
  }
  return false;
}

/**
 * Image seed URLs from a parent definition (for child-vs-parent paint-owner checks).
 * @param {string|null|undefined} definitionTs
 * @returns {string[]}
 */
export function collectImageSeedUrlsFromDefinition(definitionTs) {
  const def = String(definitionTs || '');
  if (!def.trim()) return [];
  /** @type {Set<string>} */
  const urls = new Set();
  for (const m of def.matchAll(/url\s*:\s*["'](https?:\/\/[^"']+)["']/gi)) {
    urls.add(m[1]);
  }
  return [...urls];
}

/**
 * Child seeds that match parent-owned URLs (parent definition seeds and/or
 * inventory URLs outside this child's paint-owner scope).
 *
 * @param {{
 *   role?: string|null,
 *   seedUrls?: string[],
 *   childHitUrls?: string[],
 *   parentOwnedUrls?: string[],
 *   parentDefinitionTs?: string|null,
 * }} opts
 * @returns {string[]} offending seed URLs
 */
export function findChildSeedsOfParentOwnedImages(opts = {}) {
  if (String(opts.role || '').toLowerCase() !== 'child') return [];
  const seedUrls = Array.isArray(opts.seedUrls) ? opts.seedUrls : [];
  if (!seedUrls.length) return [];

  const childHitKeys = new Set(
    (opts.childHitUrls || []).map((u) => normalizeUrlKey(u)).filter(Boolean),
  );
  const parentDefUrls = collectImageSeedUrlsFromDefinition(
    opts.parentDefinitionTs,
  );
  const parentDefKeys = new Set(
    parentDefUrls.map((u) => normalizeUrlKey(u)).filter(Boolean),
  );
  const parentInvKeys = new Set(
    (Array.isArray(opts.parentOwnedUrls) ? opts.parentOwnedUrls : [])
      .map((u) => normalizeUrlKey(u))
      .filter(Boolean),
  );
  if (!parentDefKeys.size && !parentInvKeys.size) return [];

  /** @type {string[]} */
  const offenders = [];
  for (const seed of seedUrls) {
    const key = normalizeUrlKey(seed);
    if (!key) continue;
    // Parent definition Image seeds are never valid on a child (hero ≠ card).
    if (parentDefKeys.size && urlCoveredBySeeds(seed, parentDefKeys)) {
      offenders.push(seed);
      continue;
    }
    // Inventory outside this child's paint-owner scope — skip if child owns the URL.
    if (urlCoveredBySeeds(seed, childHitKeys)) continue;
    if (parentInvKeys.size && urlCoveredBySeeds(seed, parentInvKeys)) {
      offenders.push(seed);
    }
  }
  return offenders;
}

/**
 * Asset identity for collapsing responsive style variants of one file.
 * e.g. …/styles/hero_card_lg/…/Apple%20pay.png.webp and …/hero_card_mobile/… → same key.
 * @param {string} url
 * @returns {string}
 */
export function imageAssetDedupeKey(url) {
  const stripExt = (base) =>
    String(base || '')
      // Drupal style variants often end in .jpg.webp / .png.webp
      .replace(/(\.(jpe?g|png|gif|svg|avif))?\.webp$/i, '')
      .replace(/\.(webp|jpe?g|png|gif|svg|avif)$/i, '')
      .toLowerCase()
      .trim();
  try {
    const path = new URL(String(url || '')).pathname;
    const base = decodeURIComponent(path.split('/').pop() || '');
    return stripExt(base);
  } catch {
    const bare = String(url || '')
      .split('?')[0]
      .split('/')
      .pop() || '';
    return stripExt(decodeURIComponent(bare));
  }
}

/**
 * suggestedFields names that are section-level parent chrome media (not card repeats).
 * @param {string} name
 */
export function isParentChromeImageFieldName(name) {
  const n = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  if (!n) return false;
  if (
    /^(hero|banner|background|section|chrome|intro|header)(image|img|photo|picture)$/.test(
      n,
    )
  ) {
    return true;
  }
  if (/^(desktop|mobile|tablet)(image|img|photo)$/.test(n)) return true;
  if (/(hero|banner|background).*(image|img|photo|picture)/.test(n)) return true;
  return false;
}

/**
 * True when section-information has parent-owned media (heroImage, bannerImage, …).
 * @param {object|null|undefined} info
 */
export function hasParentChromeImageFields(info) {
  const fields = Array.isArray(info?.suggestedFields) ? info.suggestedFields : [];
  return fields.some((f) => {
    if (!f || typeof f !== 'object') return false;
    return isParentChromeImageFieldName(
      /** @type {{ name?: unknown }} */ (f).name,
    );
  });
}

/**
 * Collect parent-chrome image URLs from suggestedFields (heroImage etc.).
 * @param {object|null|undefined} info
 * @returns {string[]}
 */
export function collectParentChromeImageUrls(info) {
  /** @type {string[]} */
  const out = [];
  const fields = Array.isArray(info?.suggestedFields) ? info.suggestedFields : [];
  for (const f of fields) {
    if (!f || typeof f !== 'object') continue;
    const rec = /** @type {Record<string, unknown>} */ (f);
    if (!isParentChromeImageFieldName(rec.name)) continue;
    const val = rec.value;
    if (val && typeof val === 'object' && val !== null) {
      const src = String(/** @type {{ src?: unknown }} */ (val).src || '').trim();
      if (/^https?:\/\//i.test(src)) out.push(src);
    } else if (typeof val === 'string' && /^https?:\/\//i.test(val.trim())) {
      out.push(val.trim());
    }
  }
  return out;
}

/**
 * Collect image URLs from repeats[].value[].image (card/promo rows).
 * Rows with image: null are skipped (optional image).
 * @param {object|null|undefined} info
 * @returns {{ urls: string[], hasNullImageRow: boolean }}
 */
export function collectRepeatCardImageUrls(info) {
  /** @type {string[]} */
  const urls = [];
  let hasNullImageRow = false;
  const repeats = Array.isArray(info?.repeats) ? info.repeats : [];
  for (const rep of repeats) {
    if (!rep || typeof rep !== 'object') continue;
    const values = /** @type {{ value?: unknown }} */ (rep).value;
    if (!Array.isArray(values)) continue;
    for (const row of values) {
      if (!row || typeof row !== 'object') continue;
      const rec = /** @type {Record<string, unknown>} */ (row);
      if (!('image' in rec) && !('Image' in rec)) continue;
      const img = rec.image ?? rec.Image;
      if (img == null) {
        hasNullImageRow = true;
        continue;
      }
      if (typeof img === 'object') {
        const src = String(
          /** @type {{ src?: unknown, url?: unknown }} */ (img).src ||
            /** @type {{ url?: unknown }} */ (img).url ||
            '',
        ).trim();
        if (/^https?:\/\//i.test(src)) urls.push(src);
      } else if (typeof img === 'string' && /^https?:\/\//i.test(img.trim())) {
        urls.push(img.trim());
      }
    }
  }
  return { urls, hasNullImageRow };
}

/**
 * True when layout pattern is an image hero that keeps media on the parent.
 * @param {object|null|undefined} info
 */
export function isImageHeroLayoutPattern(info) {
  const pattern = String(
    info?.layout?.pattern || info?.layout?.type || '',
  ).toLowerCase();
  return /image-hero|full-width-image-hero|hero-with|overlapping-card|photographic-hero|welcome.?hero/.test(
    pattern,
  );
}

/**
 * True when this package is a composite / logo-rail parent that owns chrome only
 * (AppPlaceholder track) — card/badge/logo images live on child packages.
 * Composites with section-level hero/banner Image stay false (parent seeds that media).
 *
 * @param {{
 *   role?: string|null,
 *   planMode?: string|null,
 *   plan?: object|null,
 *   sectionInfo?: object|null,
 * }} opts
 */
export function isCompositeChromeOnlyImageRole(opts = {}) {
  const role = String(opts.role || '').toLowerCase();
  if (role === 'child') return false;
  const mode = String(
    opts.planMode || opts.plan?.mode || '',
  ).toLowerCase();
  const info = opts.sectionInfo || {};
  const pattern = String(
    info?.layout?.pattern || info?.layout?.type || '',
  ).toLowerCase();
  // Responsive / mega header parent owns site logo + utility chrome images.
  if (
    /responsive-header|mega-menu|brand-row-with-mega|horizontal-brand-navigation/.test(
      pattern,
    )
  ) {
    return false;
  }
  // Image-hero / heroImage chrome lives on the parent — not chrome-only (0).
  if (hasParentChromeImageFields(info) || isImageHeroLayoutPattern(info)) {
    return false;
  }
  if (mode === 'composite') return true;
  // Logo-rail parents often labeled section without explicit planMode on assert
  if (
    /infinite-logo|logo-wall|logo-carousel|awards.?logo|recognition.?badge|badge.?carousel|media-tabs|media-slider/.test(
      pattern,
    )
  ) {
    return role === 'section' || role === 'parent' || !role;
  }
  return false;
}

/**
 * Collapse inventory hits that are responsive variants of the same asset.
 * Prefers suggestedFields / non-styles-path URLs when present.
 * @param {{ url: string, alt?: string, evidence?: string }[]} hits
 * @returns {{ url: string, alt: string, evidence: string }[]}
 */
export function dedupeImageHitsByAsset(hits) {
  /** @type {Map<string, { url: string, alt: string, evidence: string }>} */
  const byKey = new Map();
  for (const hit of hits || []) {
    const url = String(hit?.url || '').trim();
    if (!url) continue;
    const key = imageAssetDedupeKey(url) || normalizeUrlKey(url);
    if (!key) continue;
    const next = {
      url,
      alt: String(hit?.alt || ''),
      evidence: String(hit?.evidence || ''),
    };
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, next);
      continue;
    }
    // Prefer suggestedFields / non-styles transform paths as the canonical seed.
    const preferNext =
      /suggestedfields/i.test(next.evidence) ||
      (!/\/styles\//i.test(next.url) && /\/styles\//i.test(prev.url)) ||
      (/header_homepage|hero_card_lg/i.test(next.url) &&
        !/header_homepage|hero_card_lg/i.test(prev.url));
    if (preferNext) byKey.set(key, next);
  }
  return [...byKey.values()];
}

/**
 * Normalize child package / placeholder hints for footer band detection.
 * @param {{
 *   componentName?: string|null,
 *   definitionKey?: string|null,
 *   childComponentName?: string|null,
 *   placeholder?: string|null,
 *   childPlaceholder?: string|null,
 * }} opts
 * @returns {{ childHint: string, childHintCompact: string, band: string }}
 */
export function footerImageBandHints(opts = {}) {
  const childHint = String(
    opts.componentName || opts.definitionKey || opts.childComponentName || '',
  )
    .toLowerCase()
    .replace(/^sitecore-?/, '');
  const childHintCompact = childHint.replace(/[-_\s]+/g, '');
  const band = String(opts.placeholder || opts.childPlaceholder || '').toLowerCase();
  return { childHint, childHintCompact, band };
}

/**
 * Text nav / legal Link List columns — never own section-wide image inventory
 * (corporate logo + social glyphs belong on SiteFooter / footer-social).
 * @param {object} [opts]
 */
export function isFooterTextOnlyImageBand(opts = {}) {
  if (isPlatformTextLinkListsFolder(opts.definitionTs)) return true;
  const { childHint, childHintCompact, band } = footerImageBandHints(opts);
  if (/footer-navigation|footer-nav$|^footer-legal$|footer-legal-/.test(band)) {
    return true;
  }
  if (/social|signpost|branding/.test(childHint)) return false;
  if (
    /navigationgroup|footernavigation(?!andsignpost)|footerlegal|footerlink(column|list|group)?$/.test(
      childHintCompact,
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Social / branding-social leaf — owns social glyph imgs, not corporate wordmark.
 * @param {object} [opts]
 */
export function isFooterSocialImageBand(opts = {}) {
  const { childHint, childHintCompact, band } = footerImageBandHints(opts);
  if (/footer-social|branding-social|social-links/.test(band)) return true;
  return /brandingsocial|footersocial|sociallinks|sociallink$/.test(childHintCompact);
}

/**
 * Signpost leaf — owns signpost icons/images, not corporate wordmark.
 * @param {object} [opts]
 */
export function isFooterSignpostImageBand(opts = {}) {
  const { childHint, band } = footerImageBandHints(opts);
  if (/signpost/.test(band)) return true;
  return /signpost/.test(childHint);
}

/**
 * Known stacked-footer bands where empty filter must NOT fall back to full inventory.
 * @param {object} [opts]
 */
export function isKnownFooterImageBand(opts = {}) {
  return (
    isFooterTextOnlyImageBand(opts) ||
    isFooterSocialImageBand(opts) ||
    isFooterSignpostImageBand(opts)
  );
}

/**
 * Header product-nav / mega-menu child under composite header — never owns site logo chrome
 * (logo stays on the Header parent). May own editorial teaser images.
 * @param {object} [opts]
 */
export function isHeaderNavigationImageBand(opts = {}) {
  const { childHint, childHintCompact, band } = footerImageBandHints(opts);
  if (/header-navigation|header-nav$/.test(band)) return true;
  if (
    /headernavigation|navigationmenuitem|mainnavigation|productnavigation|megamenu/.test(
      childHintCompact,
    )
  ) {
    return true;
  }
  if (
    /navigation|menu.?item|mega/.test(childHint) &&
    !/footer|signpost|social|branding|logo.?rail|badge|card/.test(childHint)
  ) {
    const pattern = String(
      opts.sectionInfo?.layout?.pattern || opts.sectionInfo?.layout?.type || '',
    ).toLowerCase();
    if (
      /responsive-header|mega-menu|brand-row|horizontal-brand|header-stack/.test(
        pattern,
      )
    ) {
      return true;
    }
  }
  return false;
}

/** Social network / glyph URL-alt evidence (not corporate wordmark). */
const SOCIAL_GLYPH_BLOB_RE =
  /social|linkedin|twitter|youtube|facebook|instagram|tiktok|x\.com|mailto:|envelope|email/i;

/**
 * Scope image inventory for prompt/assert by package role.
 * Composite parents → empty (chrome-only); children / singles → full inventory.
 *
 * @param {import('./responsive-images.mjs').ResponsiveImageInventory|null|undefined} inv
 * @param {{
 *   role?: string|null,
 *   planMode?: string|null,
 *   plan?: object|null,
 *   sectionInfo?: object|null,
 *   componentName?: string|null,
 *   definitionKey?: string|null,
 *   placeholder?: string|null,
 *   childPlaceholder?: string|null,
 *   definitionTs?: string|null,
 * }} [opts]
 */
/**
 * Rebuild inventory buckets from a deduped hit list (prefer desktop bucket).
 * @param {{ url: string, alt?: string, evidence?: string }[]} hits
 */
function inventoryFromDedupedHits(hits) {
  return {
    desktop: hits.map((h) => ({
      url: h.url,
      alt: h.alt || '',
      evidence: h.evidence || '',
    })),
    tablet: [],
    mobile: [],
    other: [],
  };
}

/**
 * Filter inventory to hits whose asset key matches any of the owned URLs,
 * collapsing responsive variants to one seed URL per asset.
 * @param {import('./responsive-images.mjs').ResponsiveImageInventory} inv
 * @param {string[]} ownedUrls
 */
function filterInventoryByOwnedUrls(inv, ownedUrls) {
  const empty = { desktop: [], tablet: [], mobile: [], other: [] };
  if (!ownedUrls.length) return empty;
  const keys = new Set(
    ownedUrls.map((u) => imageAssetDedupeKey(u) || normalizeUrlKey(u)).filter(Boolean),
  );
  const keep = (hit) => {
    const key = imageAssetDedupeKey(hit?.url) || normalizeUrlKey(hit?.url);
    return Boolean(key && keys.has(key));
  };
  const filtered = {
    desktop: (inv.desktop || []).filter(keep),
    tablet: (inv.tablet || []).filter(keep),
    mobile: (inv.mobile || []).filter(keep),
    other: (inv.other || []).filter(keep),
  };
  return inventoryFromDedupedHits(dedupeImageHitsByAsset(flattenImageInventory(filtered)));
}

export function scopeImageInventoryForRole(inv, opts = {}) {
  if (isCompositeChromeOnlyImageRole(opts)) {
    return { desktop: [], tablet: [], mobile: [], other: [] };
  }
  const empty = { desktop: [], tablet: [], mobile: [], other: [] };
  const base = inv || empty;
  const role = String(opts.role || '').toLowerCase();
  const info = opts.sectionInfo || {};
  const parentChromeUrls = collectParentChromeImageUrls(info);
  const { urls: repeatCardUrls } = collectRepeatCardImageUrls(info);
  const parentComposite =
    String(opts.plan?.mode || '').toLowerCase() === 'composite';
  const mode = String(opts.planMode || opts.plan?.mode || '').toLowerCase();

  // Parent / section with hero chrome: only parent-owned media (not card images).
  if (
    role !== 'child' &&
    (hasParentChromeImageFields(info) || isImageHeroLayoutPattern(info)) &&
    parentChromeUrls.length
  ) {
    const scopedParent = filterInventoryByOwnedUrls(base, parentChromeUrls);
    const anyParent =
      scopedParent.desktop.length +
      scopedParent.tablet.length +
      scopedParent.mobile.length +
      scopedParent.other.length;
    if (anyParent > 0) return scopedParent;
    // Fall back to injecting suggestedField URLs as desktop hits.
    return {
      desktop: parentChromeUrls.map((url) => ({
        url,
        alt: '',
        evidence: 'suggestedFields:parentChrome',
      })),
      tablet: [],
      mobile: [],
      other: [],
    };
  }

  // Leaf children use planMode=single but still sit under a composite parent plan.
  if (role !== 'child' || (mode !== 'composite' && !parentComposite)) {
    return base;
  }
  // Text nav/legal columns: never inherit section chrome images.
  if (isFooterTextOnlyImageBand(opts)) {
    return empty;
  }

  // Card/promo children under a hero composite: only repeat card images.
  const { childHint, band } = footerImageBandHints(opts);
  const cardLikeChild =
    /card|promo|teaser|tile|slide|story|badge/.test(childHint) ||
    /promo|card|teaser/.test(band);
  if (
    (parentChromeUrls.length || isImageHeroLayoutPattern(info) || cardLikeChild) &&
    (repeatCardUrls.length || parentChromeUrls.length)
  ) {
    if (repeatCardUrls.length) {
      const scopedCards = filterInventoryByOwnedUrls(base, repeatCardUrls);
      const anyCards =
        scopedCards.desktop.length +
        scopedCards.tablet.length +
        scopedCards.mobile.length +
        scopedCards.other.length;
      if (anyCards > 0) return scopedCards;
      return {
        desktop: repeatCardUrls.map((url) => ({
          url,
          alt: '',
          evidence: 'repeats.image',
        })),
        tablet: [],
        mobile: [],
        other: [],
      };
    }
    // All repeat rows have image: null — child owns no images (fail-closed).
    if (parentChromeUrls.length || isImageHeroLayoutPattern(info)) {
      return empty;
    }
  }

  // Prefer images whose alt/path hint matches this child package or its placeholder band.
  if (!childHint && !band) return base;

  const socialBand = isFooterSocialImageBand(opts);
  const signpostBand = isFooterSignpostImageBand(opts);
  const headerNavBand = isHeaderNavigationImageBand(opts);
  const parentAssetKeys = new Set(
    parentChromeUrls
      .map((u) => imageAssetDedupeKey(u) || normalizeUrlKey(u))
      .filter(Boolean),
  );

  const keep = (hit) => {
    const blob = `${hit?.url || ''} ${hit?.alt || ''} ${hit?.evidence || ''}`.toLowerCase();
    const logoLike = Boolean(hit?.logoLike) || isLogoLikeImage(hit || { url: '' });
    const assetKey = imageAssetDedupeKey(hit?.url) || normalizeUrlKey(hit?.url);
    // Never leak parent hero/banner onto card children.
    if (parentAssetKeys.size && assetKey && parentAssetKeys.has(assetKey)) {
      return false;
    }

    if (headerNavBand) {
      // Site logo/wordmark belongs on Header parent — nav child keeps teaser/editorial imgs only.
      if (logoLike && !/teaser|promo|editorial|blog|article|card/.test(blob)) {
        return false;
      }
      if (!logoLike) return true;
      return /teaser|promo|editorial|blog|article|card/.test(blob);
    }

    if (signpostBand) {
      // Signpost icons only — drop corporate wordmark unless evidence is signpost-ish.
      if (logoLike && !/signpost|cta|explore|usecase|icon/.test(blob)) {
        return false;
      }
      if (/signpost|cta|explore|usecase/.test(blob)) return true;
      // Name tokens may still match (e.g. "footer-signpost" in path — rare)
    }
    if (socialBand) {
      // Social glyphs only — never corporate logo/wordmark on the social list package.
      if (logoLike && !SOCIAL_GLYPH_BLOB_RE.test(blob)) return false;
      if (SOCIAL_GLYPH_BLOB_RE.test(blob)) return true;
    }
    if (band && /signpost/.test(band) && /signpost|cta|explore|usecase/.test(blob)) {
      return true;
    }
    if (band && /social/.test(band) && SOCIAL_GLYPH_BLOB_RE.test(blob)) {
      return !logoLike || SOCIAL_GLYPH_BLOB_RE.test(blob);
    }
    if (band && /legal/.test(band) && /legal|privacy|cookie|copyright/.test(blob)) {
      return true;
    }
    if (childHint) {
      const tokens = childHint.split(/[-_\s]+/).filter((t) => t.length > 3);
      if (tokens.some((t) => blob.includes(t))) {
        // Footer social/signpost children must still drop sibling corporate logo.
        if (
          (socialBand || signpostBand) &&
          logoLike &&
          !SOCIAL_GLYPH_BLOB_RE.test(blob) &&
          !/signpost|cta|explore|usecase|icon/.test(blob)
        ) {
          return false;
        }
        return true;
      }
    }
    // Logo-rail / badge children: keep logo-like hits when child looks like a badge/logo card
    if (
      /badge|logo|rail|card|slide|story/.test(childHint) &&
      !/signpost|navigation|legal|social/.test(childHint) &&
      logoLike
    ) {
      return true;
    }
    return false;
  };

  const filterList = (arr) => (Array.isArray(arr) ? arr.filter(keep) : []);
  const scoped = {
    desktop: filterList(base.desktop),
    tablet: filterList(base.tablet),
    mobile: filterList(base.mobile),
    other: filterList(base.other),
  };
  const any =
    scoped.desktop.length +
    scoped.tablet.length +
    scoped.mobile.length +
    scoped.other.length;
  if (any > 0) return scoped;
  // Footer / header-nav bands: empty filter means this leaf owns no images — do NOT dump full inventory (esp. site logo).
  if (
    isKnownFooterImageBand(opts) ||
    /footer-/.test(band) ||
    headerNavBand ||
    parentAssetKeys.size > 0
  ) {
    return empty;
  }
  // Generic image-card children: fall back to full inventory when naming is weak.
  return base;
}

/**
 * Check HTML inventory images are represented in TSX as Image fields / seeds.
 *
 * @param {{
 *   sectionHtml?: string|null,
 *   imageInventory?: object|null,
 *   sectionInfo?: object|null,
 *   tsx?: string|null,
 *   definitionTs?: string|null,
 *   componentName?: string|null,
 *   role?: string|null,
 *   planMode?: string|null,
 *   plan?: object|null,
 *   parentDefinitionTs?: string|null,
 * }} opts
 * @returns {{
 *   ok: boolean,
 *   uncovered: { url: string, alt: string, evidence: string, logoLike: boolean }[],
 *   revisionHints: string[],
 * }}
 */
/**
 * Platform `Link Lists` (text columns) — not Icon/Image Link Lists.
 * Parent is Title-only; HTML logos belong on composite chrome / branding children.
 * @param {string|null|undefined} definitionTs
 */
export function isPlatformTextLinkListsFolder(definitionTs) {
  const def = String(definitionTs || '');
  if (!/folder\s*:\s*\[[^\]]*["']Link Lists["']/i.test(def)) return false;
  // Icon/Image Link Lists also contain the substring "Link Lists"
  if (/folder\s*:\s*\[[^\]]*(?:Icon Link Lists|Image Link Lists)/i.test(def)) {
    return false;
  }
  return true;
}

/**
 * Library coverage check (not wired into create:sectioncomponents pipeline).
 * Prefer REQUIRED IMAGE SEEDS via `scopeImageInventoryForRole` + AI prompts.
 */
export function assertHtmlImagesInTsx(opts = {}) {
  // Text Link Lists columns must stay Title-only — never require parent Logo Image.
  if (isPlatformTextLinkListsFolder(opts.definitionTs)) {
    return { ok: true, uncovered: [], revisionHints: [] };
  }
  const html = String(opts.sectionHtml || '');
  let inv = opts.imageInventory || null;
  if (!inv && html) {
    const fromHtml = extractResponsiveImages(html);
    const fromInfo = inventoryFromSuggestedFields(opts.sectionInfo || {});
    inv = mergeImageInventories(fromInfo, fromHtml);
  }
  const scopeOpts = {
    role: opts.role,
    planMode: opts.planMode,
    plan: opts.plan,
    sectionInfo: opts.sectionInfo,
    componentName: opts.componentName,
    definitionKey: opts.definitionKey,
    placeholder: opts.placeholder || opts.childPlaceholder,
  };
  const fullHits = flattenImageInventory(inv);
  inv = scopeImageInventoryForRole(inv, scopeOpts);
  const hits = flattenImageInventory(inv);
  const isChild = String(opts.role || '').toLowerCase() === 'child';

  const coverage = collectTsxImageCoverage(
    String(opts.tsx || ''),
    String(opts.definitionTs || ''),
  );
  const seedKeys = new Set(
    coverage.seedUrls.map((u) => normalizeUrlKey(u)),
  );

  /** @type {{ url: string, alt: string, evidence: string, logoLike: boolean }[]} */
  const uncovered = [];
  for (const hit of hits) {
    const logoLike = isLogoLikeImage(hit);
    const coveredByUrl = urlCoveredBySeeds(hit.url, seedKeys);
    if (coveredByUrl) continue;
    if (logoLike || isChild) {
      // Logos/wordmarks (and all child paint-owner URLs) must be seeded — never Text-only
      // or a wrong sibling/parent hero URL.
      uncovered.push({ ...hit, logoLike: Boolean(logoLike) });
    } else if (!coverage.hasImageComponent) {
      // Non-logo parent/single: only flag when the package has zero Image usage
      uncovered.push({ ...hit, logoLike: false });
    }
  }

  // Deduplicate uncovered by URL
  const seen = new Set();
  let unique = uncovered.filter((u) => {
    if (seen.has(u.url)) return false;
    seen.add(u.url);
    return true;
  });

  // Composite children often share the full section inventory. Once this package
  // already mounts Image + seeds its own assets, drop leftover logo-like URLs
  // (sibling brand/wordmarks belong on branding children — not every child).
  if (
    shouldDropSiblingLogoMisses(opts, coverage, hits, seedKeys)
  ) {
    unique = unique.filter((u) => !u.logoLike);
  }

  const childHitUrls = hits.map((h) => h.url);
  const childHitKeySet = new Set(childHitUrls.map((u) => normalizeUrlKey(u)));
  const parentOwnedFromInventory = fullHits
    .map((h) => h.url)
    .filter((u) => !urlCoveredBySeeds(u, childHitKeySet));
  const parentOwnedOffenders = findChildSeedsOfParentOwnedImages({
    role: opts.role,
    seedUrls: coverage.seedUrls,
    childHitUrls,
    parentOwnedUrls: parentOwnedFromInventory,
    parentDefinitionTs: opts.parentDefinitionTs,
  });

  const logoMisses = unique.filter((u) => u.logoLike);
  const revisionHints = [];
  const dualFileFix =
    'In definitionTs: add/keep Image-type field(s) and seed each URL as { url, alt }. In tsx: mount <Image field={fields.…}> (never <Text> / hardcoded src). Both files must agree.';
  if (logoMisses.length) {
    revisionHints.push(
      `Mount these HTML logo/wordmark images as Sitecore <Image> fields (not <Text> / hardcoded brand strings). ${dualFileFix} Missing: ${logoMisses
        .slice(0, 8)
        .map((u) => u.url)
        .join(', ')}`,
    );
  } else if (unique.length) {
    revisionHints.push(
      `Mount these HTML images as Sitecore <Image> fields with matching seed URLs. ${dualFileFix} Missing: ${unique
        .slice(0, 8)
        .map((u) => u.url)
        .join(', ')}`,
    );
  }
  if (parentOwnedOffenders.length) {
    revisionHints.push(
      `Child Image seeds must use this child's paint-owner / REQUIRED IMAGE SEEDS URLs only — never reuse parent hero/header/banner seeds. Offending: ${parentOwnedOffenders
        .slice(0, 8)
        .join(', ')}`,
    );
  }

  const label = opts.componentName || 'component';
  if (unique.length) {
    const sampleUrls = unique
      .slice(0, 3)
      .map((u) => u.url)
      .filter(Boolean);
    const more =
      unique.length > sampleUrls.length
        ? ` (+${unique.length - sampleUrls.length} more)`
        : '';
    console.warn(
      `  ⚠ ${label}: ${unique.length} HTML image(s) not covered as <Image> in TSX` +
        (logoMisses.length ? ` (${logoMisses.length} logo-like)` : '') +
        (sampleUrls.length ? `\n      missing: ${sampleUrls.join('\n      missing: ')}${more}` : '') +
        `\n      (HTML is sent to AI, but mounts must come from REQUIRED IMAGE SEEDS / <Image field={…}> — not inventing Text-only logos)`,
    );
  }
  if (parentOwnedOffenders.length) {
    console.warn(
      `  ⚠ ${label}: child seeded parent-owned image URL(s): ${parentOwnedOffenders
        .slice(0, 3)
        .join(', ')}`,
    );
  }

  if (!hits.length && !parentOwnedOffenders.length) {
    return { ok: true, uncovered: [], revisionHints: [] };
  }

  return {
    ok: unique.length === 0 && parentOwnedOffenders.length === 0,
    uncovered: unique,
    revisionHints,
  };
}

/**
 * Composite child already owns Image seeds — do not fail on sibling-band logos.
 * Logo-rail children stay strict (every badge URL must be seeded).
 *
 * @param {{
 *   role?: string|null,
 *   planMode?: string|null,
 *   plan?: object|null,
 *   sectionInfo?: object|null,
 *   parentComponentName?: string|null,
 *   layoutMode?: string|null,
 * }} opts
 * @param {{ hasImageComponent: boolean, seedUrls: string[] }} coverage
 * @param {{ url: string }[]} hits
 * @param {Set<string>} seedKeys
 */
export function shouldDropSiblingLogoMisses(opts, coverage, hits, seedKeys) {
  if (isLogoRailChildContext(opts)) return false;
  if (String(opts.role || '').toLowerCase() !== 'child') return false;
  const mode = String(opts.planMode || opts.plan?.mode || '').toLowerCase();
  if (mode !== 'composite') return false;
  if (!coverage?.hasImageComponent) return false;
  if (!Array.isArray(hits) || !hits.length) return false;
  return hits.some((h) => urlCoveredBySeeds(h.url, seedKeys));
}

/**
 * True when this write is a logo-rail / awards-badge child (must be Image-first).
 * @param {{
 *   role?: string|null,
 *   sectionInfo?: object|null,
 *   parentComponentName?: string|null,
 *   plan?: object|null,
 *   layoutMode?: string|null,
 * }} opts
 */
export function isLogoRailChildContext(opts = {}) {
  if (String(opts.role || '').toLowerCase() !== 'child') return false;
  const info = opts.sectionInfo || {};
  const pattern = String(
    info?.layout?.pattern || info?.layout?.type || '',
  ).toLowerCase();
  if (
    /infinite-logo|logo-wall|logo-carousel|awards.?logo|recognition.?badge|badge.?carousel/.test(
      pattern,
    )
  ) {
    return true;
  }
  const names = [
    info?.cmsName,
    opts.parentComponentName,
    opts.plan?.section?.componentName,
    opts.plan?.section?.cmsName,
  ]
    .map((s) => String(s || '').toLowerCase())
    .join(' ');
  if (
    /logo.?carousel|awards.?logo|logo.?wall|recognition.?badge|badge.?carousel|logo.?rail/.test(
      names,
    )
  ) {
    return true;
  }
  const reason = String(opts.plan?.reason || '').toLowerCase();
  if (
    /logo carousel|recognition badge|infinite logo|logo.?wall|awards logo/.test(
      reason,
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Logo-rail children must declare Image field(s) and mount `<Image>` — not text-only cards.
 * @param {{
 *   role?: string|null,
 *   sectionInfo?: object|null,
 *   parentComponentName?: string|null,
 *   plan?: object|null,
 *   tsx?: string|null,
 *   definitionTs?: string|null,
 *   componentName?: string|null,
 * }} opts
 * @returns {{ ok: boolean, revisionHints: string[] }}
 */
export function assertLogoRailChildHasImage(opts = {}) {
  if (!isLogoRailChildContext(opts)) {
    return { ok: true, revisionHints: [] };
  }
  const coverage = collectTsxImageCoverage(
    String(opts.tsx || ''),
    String(opts.definitionTs || ''),
  );
  const hasImageField =
    coverage.fieldNames.length > 0 ||
    /\btype:\s*["']Image["']/.test(String(opts.definitionTs || ''));
  if (coverage.hasImageComponent && hasImageField) {
    return { ok: true, revisionHints: [] };
  }
  const label = opts.componentName || 'component';
  const hint =
    'Logo-rail / awards-badge child must be Image-first: model Image field + <Image field={…} /> + {url,alt} seeds per badge — not text-only Category/Title/Description capability cards';
  console.warn(`  ⚠ ${label}: ${hint}`);
  return { ok: false, revisionHints: [hint] };
}

/**
 * Prompt block: list inventory URLs the model must seed as Image {url,alt}.
 * Empty string when inventory has no http(s) hits (or role is chrome-only parent).
 * Lists every URL by default (no truncate). Pass `maxUrls` only for tests / explicit caps.
 * @param {import('./responsive-images.mjs').ResponsiveImageInventory|null|undefined} inv
 * @param {{
 *   maxUrls?: number,
 *   role?: string|null,
 *   planMode?: string|null,
 *   plan?: object|null,
 *   sectionInfo?: object|null,
 * }} [opts]
 * @returns {string}
 */
export function formatRequiredImageSeedsForPrompt(inv, opts = {}) {
  if (isCompositeChromeOnlyImageRole(opts)) {
    return [
      'REQUIRED IMAGE SEEDS (0) — composite/logo-rail PARENT owns AppPlaceholder chrome only.',
      'HARD: card / badge / logo / thumbnail Image seeds + <Image> live on CHILD packages — do not seed those URLs on this parent, and do not treat missing parent <Image> as a coverage miss.',
    ].join('\n');
  }
  // Text nav/legal (and Link Lists) — zero seeds even before definitionTs exists.
  if (isFooterTextOnlyImageBand(opts)) {
    return [
      'REQUIRED IMAGE SEEDS (0) — footer nav/legal / platform Link Lists parent is Title + link children only.',
      'HARD: do not add Logo/Image on this parent; put brand chrome on the composite parent (SiteFooter Logo) or a branding/social child.',
    ].join('\n');
  }
  if (isHeaderNavigationImageBand(opts)) {
    const scopedNav = scopeImageInventoryForRole(inv, opts);
    const navHits = flattenImageInventory(scopedNav);
    if (!navHits.length) {
      return [
        'REQUIRED IMAGE SEEDS (0) — header Navigation child owns mega/teaser images only after paint-owner scoping; site logo stays on Header parent.',
        'HARD: do not seed corporate Logo/wordmark on this nav package.',
      ].join('\n');
    }
  }
  const scoped = scopeImageInventoryForRole(inv, opts);
  const hits = dedupeImageHitsByAsset(flattenImageInventory(scoped));
  const { hasNullImageRow } = collectRepeatCardImageUrls(opts.sectionInfo || {});
  if (!hits.length) {
    if (isKnownFooterImageBand(opts)) {
      return [
        'REQUIRED IMAGE SEEDS (0) — this footer band child has no owned image URLs after paint-owner scoping.',
        'HARD: do not add sibling corporate Logo/Image chrome; brand logo lives on SiteFooter / branding only; social glyphs only on footer-social Image/Icon Link Lists.',
      ].join('\n');
    }
    if (isHeaderNavigationImageBand(opts)) {
      return [
        'REQUIRED IMAGE SEEDS (0) — header Navigation child owns mega/teaser images only after paint-owner scoping; site logo stays on Header parent.',
        'HARD: do not seed corporate Logo/wordmark on this nav package.',
      ].join('\n');
    }
    if (hasNullImageRow && String(opts.role || '').toLowerCase() === 'child') {
      return [
        'REQUIRED IMAGE SEEDS (0) — this child owns no paint-owner image URLs (repeat rows may set image: null).',
        'HARD: OPTIONAL IMAGE ROWS — when repeats[].value[i].image is null, omit Image from that content.items[] entry; do not copy sibling/default Image onto null rows.',
      ].join('\n');
    }
    return '';
  }
  const hasCap =
    opts.maxUrls != null && Number.isFinite(Number(opts.maxUrls)) && Number(opts.maxUrls) > 0;
  const maxUrls = hasCap ? Math.max(1, Number(opts.maxUrls)) : hits.length;
  const listed = hits.slice(0, maxUrls);
  const lines = [
    `REQUIRED IMAGE SEEDS (${hits.length}) — each URL must appear as content Image {url,alt} on THIS package; never Text-only / omit:`,
    `REQUIRED REPEAT / IMAGE ROW SEEDS (${hits.length}) — when this package models image/logo/badge rows (childItemTemplate Image or PH image children), nested Image {url,alt} / PH child count must equal ${hits.length} (prefer HTML unique inventory over crop window). Not for text/toggle/action nested rows.`,
    ...listed.map((h, i) => `${i + 1}. ${h.url}`),
    `HARD: seed/<Image> count for this role must match REQUIRED IMAGE SEEDS (${hits.length}) — do not drop URLs or truncate to screenshot-visible window.`,
  ];
  if (String(opts.role || '').toLowerCase() === 'child') {
    lines.push(
      'HARD: child Image seeds must use URLs from THIS list / paint-owner inventory only — never reuse the parent hero/header/banner image URL.',
    );
  }
  if (hasNullImageRow) {
    lines.push(
      'HARD: OPTIONAL IMAGE ROWS — when repeats[].value[i].image is null, omit Image from that content.items[] entry; do not copy sibling/default Image onto null rows.',
    );
  }
  if (hits.length > maxUrls) {
    lines.push(
      `… and ${hits.length - maxUrls} more in the responsive image inventory JSON below`,
    );
  }
  return lines.join('\n');
}

/**
 * Merge coverage revision hints into a fidelity revision brief changes list.
 * @param {string[]} changes
 * @param {string[]} revisionHints
 */
export function appendImageCoverageRevisionHints(changes, revisionHints) {
  const out = Array.isArray(changes) ? [...changes] : [];
  for (const h of revisionHints || []) {
    if (h && !out.includes(h)) out.push(h);
  }
  return out;
}
