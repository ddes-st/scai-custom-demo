/**
 * Component-type → frozen reference TSX mapping for AI codegen.
 * References live under prompts/references/*.reference.tsx
 */

/** @typedef {'field-catalog'|'header'|'footer'|'navigation'|'hero'|'banner'|'content-section'|'card'|'grid'|'list'|'carousel'|'gallery'|'media-block'|'text-and-media'|'quote'|'accordion'|'tabs'|'table'|'comparison'|'steps'|'timeline'|'statistics'|'form'|'search-filters'|'map-locator'|'embed'} ReferenceTypeKey */

export const FIELD_CATALOG_REFERENCE_REL =
  'references/FieldCatalog.reference.tsx';

/** @type {Record<ReferenceTypeKey, string>} */
export const REFERENCE_TYPE_RELS = {
  'field-catalog': FIELD_CATALOG_REFERENCE_REL,
  header: 'references/Header.reference.tsx',
  footer: 'references/Footer.reference.tsx',
  navigation: 'references/Navigation.reference.tsx',
  hero: 'references/Hero.reference.tsx',
  banner: 'references/Banner.reference.tsx',
  'content-section': 'references/ContentSection.reference.tsx',
  card: 'references/Card.reference.tsx',
  grid: 'references/Grid.reference.tsx',
  list: 'references/List.reference.tsx',
  carousel: 'references/Carousel.reference.tsx',
  gallery: 'references/Gallery.reference.tsx',
  'media-block': 'references/MediaBlock.reference.tsx',
  'text-and-media': 'references/TextAndMedia.reference.tsx',
  quote: 'references/Quote.reference.tsx',
  accordion: 'references/Accordion.reference.tsx',
  tabs: 'references/Tabs.reference.tsx',
  table: 'references/Table.reference.tsx',
  comparison: 'references/Comparison.reference.tsx',
  steps: 'references/Steps.reference.tsx',
  timeline: 'references/Timeline.reference.tsx',
  statistics: 'references/Statistics.reference.tsx',
  form: 'references/Form.reference.tsx',
  'search-filters': 'references/SearchFilters.reference.tsx',
  'map-locator': 'references/MapLocator.reference.tsx',
  embed: 'references/Embed.reference.tsx',
};

/**
 * @param {unknown} value
 * @returns {string}
 */
function norm(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_/]+/g, '-')
    .replace(/\s+/g, '-');
}

/**
 * Infer reference type keys from packageKind / layout / naming hints.
 *
 * @param {{
 *   packageKind?: string,
 *   layoutPattern?: string,
 *   cmsName?: string,
 *   componentName?: string,
 *   purpose?: string,
 *   role?: string,
 *   pageRole?: string,
 * }} opts
 * @returns {ReferenceTypeKey[]}
 */
export function resolveReferenceTypeKeys(opts = {}) {
  /** @type {ReferenceTypeKey[]} */
  const keys = [];
  // Prefer stamped inventory / decompose keys when present.
  if (Array.isArray(opts.referenceTypeKeys) && opts.referenceTypeKeys.length) {
    for (const k of opts.referenceTypeKeys) {
      const key = /** @type {ReferenceTypeKey} */ (norm(k).replace(/_/g, '-'));
      if (REFERENCE_TYPE_RELS[key] && !keys.includes(key)) keys.push(key);
    }
    if (keys.length) return keys;
  }
  const packageKind = norm(opts.packageKind);
  const pattern = norm(opts.layoutPattern);
  const cms = norm(opts.cmsName);
  const component = norm(opts.componentName);
  const purpose = norm(opts.purpose);
  const blob = `${pattern} ${cms} ${component} ${purpose}`;
  const pageRole = norm(opts.pageRole);

  const push = (/** @type {ReferenceTypeKey} */ key) => {
    if (!keys.includes(key)) keys.push(key);
  };

  if (packageKind === 'navigation') {
    push('navigation');
    return keys;
  }

  if (
    pageRole === 'partial-header' ||
    /responsive-header|brand-row|mega-menu|site-header|^header$/.test(pattern) ||
    /\bheader\b/.test(cms) ||
    /\bheader\b/.test(component)
  ) {
    push('header');
    if (/nav|menu|mega/.test(blob)) push('navigation');
  }

  if (
    pageRole === 'partial-footer' ||
    /stacked-footer|site-footer|^footer$/.test(pattern) ||
    /\bfooter\b/.test(cms) ||
    /\bfooter\b/.test(component)
  ) {
    push('footer');
  }

  if (
    pageRole === 'partial-cookie' ||
    /consent|cookie|banner|alert|announcement|promo-bar/.test(blob)
  ) {
    push('banner');
  }

  if (/hero|jumbotron|masthead|welcome/.test(blob)) push('hero');
  if (/carousel|slider|scrolling-rail|marquee|swiper/.test(blob)) push('carousel');
  if (/accordion|faq|expandable/.test(blob)) push('accordion');
  if (/\btabs?\b|tabbed|tab-panel/.test(blob)) push('tabs');
  if (/gallery|image-grid|photo-grid/.test(blob)) push('gallery');
  if (/media-block|video-block|audio-block/.test(blob)) push('media-block');
  if (/text-and-media|text-media|split-media|fifty-fifty/.test(blob)) {
    push('text-and-media');
  }
  if (/quote|testimonial|review/.test(blob)) push('quote');
  if (/\btable\b|data-table/.test(blob)) push('table');
  if (/comparison|compare|pricing-table|plan-compare/.test(blob)) {
    push('comparison');
  }
  if (/steps|process|how-it-works|wizard/.test(blob)) push('steps');
  if (/timeline|milestones?/.test(blob)) push('timeline');
  if (/statistic|stats|kpi|metrics|numbers/.test(blob)) push('statistics');
  if (/\bform\b|contact-form|newsletter|signup/.test(blob)) push('form');
  if (/search|filter|facet/.test(blob)) push('search-filters');
  if (/map|locator|dealer|branch-finder|store-finder/.test(blob)) {
    push('map-locator');
  }
  if (/\bembed\b|iframe|oembed|external-tool/.test(blob)) push('embed');
  if (/\bgrid\b|card-grid|tile-grid|three-up|multi-card/.test(blob)) {
    push('grid');
  }
  if (/\bcard\b|teaser|tile/.test(blob) && !keys.includes('grid')) {
    push('card');
  }
  if (/\blist\b|link-list|item-list/.test(blob)) push('list');

  if (
    keys.length === 0 &&
    (/content|rich-text|article|section|body|copy/.test(blob) ||
      opts.role === 'section')
  ) {
    push('content-section');
  }

  return keys;
}

/**
 * Resolve relative prompt paths to attach for a codegen package.
 * Always includes the field catalog; adds matching type references.
 *
 * @param {{
 *   packageKind?: string,
 *   layoutPattern?: string,
 *   cmsName?: string,
 *   componentName?: string,
 *   purpose?: string,
 *   role?: string,
 *   pageRole?: string,
 * }} opts
 * @returns {string[]}
 */
export function resolveReferenceRelsForCodegen(opts = {}) {
  /** @type {string[]} */
  const rels = [FIELD_CATALOG_REFERENCE_REL];
  const keys = resolveReferenceTypeKeys(opts);
  for (const key of keys) {
    const rel = REFERENCE_TYPE_RELS[key];
    if (rel && !rels.includes(rel)) rels.push(rel);
  }
  return rels;
}
