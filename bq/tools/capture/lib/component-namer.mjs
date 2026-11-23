/**
 * Evidence-first section naming: prefer real design-system block class names
 * (NewFeaturePromo, NewsletterPush, AccordionIntro) over leaf widgets (CtaLink).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NOISE_TOKENS = new Set([
  'cmp',
  'component',
  'wrapper',
  'container',
  'inner',
  'outer',
  'root',
  'module',
  'section',
  'row',
  'col',
  'column',
  'layout',
  'content',
  'js',
  'css',
  'sc',
  'normalized',
  'slice',
  'editable',
  'styled',
  'page',
  'main',
  'app',
  'block',
]);

/** Presentation / structural suffixes we recognize as complete names. */
const SUFFIXES = [
  'Carousel',
  'Gallery',
  'Accordion',
  'Navigation',
  'Sidebar',
  'Header',
  'Footer',
  'Hero',
  'Banner',
  'Wall',
  'Grid',
  'Rail',
  'List',
  'Tabs',
  'Table',
  'Form',
  'Search',
  'Menu',
  'Panel',
  'Details',
  'Card',
  'Bar',
  'Block',
  'Section',
  'Promo',
  'Push',
  'Intro',
  'Teaser',
  'Strip',
  'Widget',
  'Banner',
];

/** Complete natural endings — keep as-is, do not append Block. */
const COMPLETE_ENDINGS = [
  ...SUFFIXES,
  'Promo',
  'Push',
  'Intro',
  'Teaser',
  'Strip',
  'Widget',
  'Modal',
  'Dialog',
  'Overlay',
  'Drawer',
  'Popover',
  'Tooltip',
  'Player',
  'Slider',
  'Swiper',
  'Marquee',
  'Ticker',
  'Feed',
  'Timeline',
  'Map',
  'Chart',
  'Counter',
  'Pricing',
  'Newsletter',
  'Subscribe',
];

/**
 * Leaf / chrome widgets that must never name a section.
 * These appear inside almost every Renault band and previously won as "CtaLinkBlock".
 */
const LEAF_WIDGET_NAMES = new Set(
  [
    'CtaLink',
    'Link',
    'Button',
    'Btn',
    'Icon',
    'Image',
    'Img',
    'Picture',
    'PictureElement',
    'Video',
    'Svg',
    'AemRte',
    'CustomScroll',
    'Scroll',
    'Arrow',
    'Title',
    'Heading',
    'Text',
    'Description',
    'Label',
    'Input',
    'Select',
    'Checkbox',
    'Radio',
    'Span',
    'Paragraph',
    'Caption',
    'Badge',
    'Chip',
    'Tag',
    'Logo',
    'Avatar',
    'Spinner',
    'Loader',
    'Overlay',
    'Backdrop',
    'NormalizedSlice',
    'EditableComponent',
    'ImageWithVideo',
    'ContentZone',
    'Container',
  ].map((s) => s.toLowerCase()),
);

const LEAF_CLASS_RE =
  /^(CtaLink|PictureElement|ImageWithVideo|AemRte|CustomScroll|Component\d+|sc-[a-z0-9-]+)$/i;

const WRAPPER_CLASS_RE =
  /^(NormalizedSlice|EditableComponent|Styled[A-Z]|App|Page|Main|Root|Layout|Grid|Row|Col|Container|ContentZone|Zone|Region|Wrapper|Inner|Outer)$/i;


/** More specific domains first — newsletter must beat generic cta. */
const DOMAIN_MAP = [
  [/cookie|consent|privacy.?banner|osano|onetrust/i, 'Consent'],
  [/newsletter|subscribe|signup/i, 'Newsletter'],
  [/product|sku|catalog|shop|vehicle.?range/i, 'Product'],
  [/article|blog|news|editorial/i, 'Article'],
  [/review|testimonial|rating/i, 'Review'],
  [/feature|benefit|capability|new.?feature/i, 'Feature'],
  [/logo|partner|brand|trusted/i, 'Logo'],
  [/person|people|team|author|staff/i, 'Person'],
  [/price|pricing|plan|tier/i, 'Pricing'],
  [/media|video|gallery|image/i, 'Media'],
  [/promo|offer|deal|sale/i, 'Promo'],
  [/faq|accordion|accordeon/i, 'Faq'],
  [/stat|metric|counter|number/i, 'Stats'],
  [/hero|masthead|jumbotron/i, 'Hero'],
  [/header|nav|menu|banner.?nav/i, 'Header'],
  [/footer|legal|copyright/i, 'Footer'],
  [/chat|intercom|messenger/i, 'Chat'],
  [/form|lead|contact/i, 'Form'],
  [/search/i, 'Search'],
  [/alert|announcement|top.?bar/i, 'Alert'],
  [/cta|quick.?link|shortcut|action/i, 'Cta'],
];

const STRUCTURE_RULES = [
  [/carousel|slider|swiper|slideshow|embla|slick/i, 'Carousel'],
  [/gallery/i, 'Gallery'],
  [/accordion|accordeon/i, 'Accordion'],
  [/hero|masthead|jumbotron/i, 'Hero'],
  [/banner|promo.?band/i, 'Banner'],
  [/logo.?wall|brand.?wall|partner.?wall/i, 'Wall'],
  [/grid|tiles|card.?grid|collection.?grid/i, 'Grid'],
  [/rail|scroller|horizontal.?list|strip/i, 'Rail'],
  [/newsletter|subscribe|signup/i, 'Push'],
  [/list/i, 'List'],
  [/tabs?/i, 'Tabs'],
  [/table|pricing.?table/i, 'Table'],
  [/form/i, 'Form'],
  [/search/i, 'Search'],
  [/nav|menu/i, 'Navigation'],
  [/sidebar|aside/i, 'Sidebar'],
  [/header/i, 'Header'],
  [/footer/i, 'Footer'],
  [/bar|cta.?bar|toolbar/i, 'Bar'],
  [/card|teaser|tile/i, 'Card'],
  [/promo|push|intro/i, 'Block'],
  [/panel|group/i, 'Block'],
];

let catalogCache = null;

function loadCatalog() {
  if (catalogCache) return catalogCache;
  try {
    const raw = readFileSync(path.join(__dirname, 'component-mapper', 'catalog.json'), 'utf8');
    catalogCache = JSON.parse(raw);
  } catch {
    catalogCache = [];
  }
  return catalogCache;
}

export function toPascalCase(input) {
  return String(input || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

export function toFolderName(name) {
  return (
    String(name || 'section')
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'section'
  );
}

function splitClassTokens(className) {
  return String(className || '')
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((c) => {
      const base = c.split('__')[0].split('_')[0];
      const parts = base
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .split(/[-_]/)
        .filter(Boolean);
      return [c, ...parts];
    });
}

function isNoiseToken(token) {
  const t = token.toLowerCase();
  if (NOISE_TOKENS.has(t)) return true;
  if (/^[a-z]{1,3}\d+[a-z0-9]*$/i.test(token)) return true;
  if (/^(sm|md|lg|xl|2xl):/i.test(token)) return true;
  if (/^(is|js|css|sc|has)-/i.test(token)) return true;
  if (token.length < 3 || token.length > 48) return true;
  return false;
}

function extractClassesFromHtml(html) {
  const classes = [];
  const re = /class\s*=\s*["']([^"']+)["']/gi;
  let m;
  let count = 0;
  while ((m = re.exec(html || '')) && count < 120) {
    classes.push(...m[1].split(/\s+/).filter(Boolean));
    count += 1;
  }
  return classes;
}

/**
 * Ordered unique root-ish class tokens from HTML (document order, BEM blocks only).
 */
function extractOrderedBlockClasses(html, rootClassName = '') {
  const ordered = [];
  const seen = new Set();
  const push = (cls) => {
    if (!cls || seen.has(cls)) return;
    seen.add(cls);
    ordered.push(cls);
  };
  for (const cls of String(rootClassName || '').split(/\s+/).filter(Boolean)) push(cls);
  for (const cls of extractClassesFromHtml(html)) push(cls);
  return ordered;
}

function extractIdsFromHtml(html) {
  const ids = [];
  const re = /\bid\s*=\s*["']([^"']+)["']/gi;
  let m;
  let count = 0;
  while ((m = re.exec(html || '')) && count < 20) {
    ids.push(m[1]);
    count += 1;
  }
  return ids;
}

function extractDataAttrs(html) {
  const vals = [];
  // Prefer component ids like C27.A-Feature-promo over button track text.
  const re =
    /\b(data-(?:component(?:-name|-id)?|module|testid|block-name|name))\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html || ''))) {
    vals.push(m[2]);
  }
  return vals;
}

function extractAria(html) {
  const vals = [];
  const re = /\b(?:aria-label|role)\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html || ''))) {
    vals.push(m[1]);
  }
  return vals;
}

function extractHeading(html, fallback) {
  if (fallback) return String(fallback).trim();
  const m = (html || '').match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
  if (!m) return '';
  return m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function camelWordCount(pascal) {
  const parts = String(pascal).replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/\s+/).filter(Boolean);
  return parts.length;
}

function hasCompleteEnding(pascal) {
  return COMPLETE_ENDINGS.some((s) => pascal.endsWith(s) && pascal.length > s.length);
}

function isLeafWidgetName(pascal) {
  if (!pascal) return true;
  if (LEAF_WIDGET_NAMES.has(pascal.toLowerCase())) return true;
  if (/^(CtaLink|PictureElement|CustomScroll)/i.test(pascal)) return true;
  // Single-word leaves like Link/Button already covered; CtaLinkBlock-style still leaf-ish
  if (/^(Cta)?Link(Block|Bar|Button)?$/i.test(pascal)) return true;
  if (/TextItem$/i.test(pascal)) return true;
  return false;
}

function normalizeComponentPascal(cls) {
  // Drop BEM element/modifier pieces — NewFeaturePromo__container → NewFeaturePromo
  const block = String(cls || '').split('__')[0].split('_')[0];
  if (!block || LEAF_CLASS_RE.test(block) || WRAPPER_CLASS_RE.test(block)) return null;
  if (/^(is-|has-|js-|css-|sc-)/i.test(block)) return null;
  if (!/[A-Z]/.test(block) && !/-/.test(block)) return null;

  let pascal = toPascalCase(block.replace(/^sc-[a-z]+-/i, ''));
  pascal = pascal
    .replace(/(Wrapper|Container|Inner|Outer|Root|Module|Holder|Area|Wrapper)$/g, '')
    .replace(/(Wrapper|Container)$/g, '');

  if (!pascal || pascal.length < 4 || pascal.length > 48) return null;
  if (isNoiseToken(pascal)) return null;
  if (WRAPPER_CLASS_RE.test(pascal)) return null;
  if (/^Component\d+/i.test(pascal)) return null;
  if (isLeafWidgetName(pascal)) return null;
  if (/Transition|Animation|Motion|Parallax$/i.test(pascal)) return null;
  // Need real multi-word component OR known ending (Hero, Footer, …)
  const words = camelWordCount(pascal);
  if (words < 2 && !hasCompleteEnding(pascal) && !SUFFIXES.includes(pascal)) return null;
  return pascal;
}

/**
 * Prefer design-system block classes early in the DOM over deep leaf widgets.
 * Returns the best PascalCase name as it appears on the site (no forced "Block" suffix
 * when the class is already a complete component name).
 */
function findExplicitComponentClass(html, rootClassName = '') {
  const ordered = extractOrderedBlockClasses(html, rootClassName);
  const candidates = [];

  for (let i = 0; i < ordered.length; i++) {
    const cls = ordered[i];
    // Skip BEM elements (Child, title, …) — block name is the part before __
    if (cls.includes('__')) {
      const parent = normalizeComponentPascal(cls.split('__')[0]);
      if (!parent) continue;
      // Parent already considered when the block class itself appears; still score lightly
      const early = Math.max(0, 80 - i);
      candidates.push({
        pascal: parent,
        score: early + camelWordCount(parent) * 8 + (hasCompleteEnding(parent) ? 25 : 0) - 15,
        sourceClass: cls,
      });
      continue;
    }

    const pascal = normalizeComponentPascal(cls);
    if (!pascal) continue;

    // Earlier in HTML = closer to section root
    const earlyBonus = Math.max(0, 120 - i * 2);
    const words = camelWordCount(pascal);
    let score = earlyBonus + words * 12;

    if (hasCompleteEnding(pascal)) score += 40;
    if (SUFFIXES.some((s) => pascal.endsWith(s))) score += 20;
    // Prefer collection containers (PromoCards) over a single card child.
    if (/Cards$/i.test(pascal)) score += 35;
    if (/^(Promo|Service|Product|Feature|Article)Cards$/i.test(pascal)) score += 15;
    // Penalize "Sub*" children and transition-only wrappers.
    if (/^Sub[A-Z]/.test(pascal)) score -= 40;
    if (/Transition|Animation|Motion|Parallax$/i.test(pascal)) score -= 50;
    // Penalize generic leftover names
    if (/^(Content|Item|Generic|Section)(Block|Band|Grid)?$/i.test(pascal)) score -= 40;
    // Mild penalty for very deep occurrences
    if (i > 25) score -= 30;

    candidates.push({ pascal, score, sourceClass: cls });
  }

  if (candidates.length === 0) return null;

  // Dedupe by pascal keeping best score
  const bestByName = new Map();
  for (const c of candidates) {
    const prev = bestByName.get(c.pascal);
    if (!prev || c.score > prev.score) bestByName.set(c.pascal, c);
  }
  let ranked = [...bestByName.values()].sort(
    (a, b) => b.score - a.score || b.pascal.length - a.pascal.length,
  );

    // Prefer container/plural form when both PromoCard and PromoCards (etc.) appear.
  ranked = ranked.map((c) => {
    const longer = ranked.find(
      (o) =>
        o.pascal !== c.pascal &&
        o.pascal.startsWith(c.pascal) &&
        o.pascal.length > c.pascal.length &&
        o.pascal.length - c.pascal.length <= 3,
    );
    return longer && longer.score >= c.score - 40 ? longer : c;
  });
  // Unique again after plural upgrade
  const final = new Map();
  for (const c of ranked) {
    const prev = final.get(c.pascal);
    if (!prev || c.score > prev.score) final.set(c.pascal, c);
  }
  ranked = [...final.values()].sort(
    (a, b) => b.score - a.score || b.pascal.length - a.pascal.length,
  );
  return ranked[0].pascal;
}

function detectStructure(blob, hints = []) {
  const h = hints.join(' ').toLowerCase();
  const combined = `${blob} ${h}`;
  for (const [re, suffix] of STRUCTURE_RULES) {
    if (re.test(combined)) return suffix;
  }
  if (hints.includes('carousel')) return 'Carousel';
  if (hints.includes('cards') || hints.includes('grid')) return 'Grid';
  if (hints.includes('cta')) return 'Bar';
  if (hints.includes('hero')) return 'Hero';
  if (hints.includes('footer')) return 'Footer';
  if (hints.includes('header') || hints.includes('nav')) return 'Header';
  if (hints.includes('form') || hints.includes('newsletter')) return 'Push';
  return 'Block';
}

function detectDomain(blob, hints = []) {
  const combined = `${blob} ${hints.join(' ')}`;
  for (const [re, domain] of DOMAIN_MAP) {
    if (re.test(combined)) {
      return { domain, confidence: 0.75 };
    }
  }
  return { domain: null, confidence: 0.3 };
}

function pluralizeDomain(domain, suffix) {
  if (!domain) return null;
  const multi = ['Grid', 'Carousel', 'List', 'Rail', 'Gallery', 'Wall', 'Tabs', 'Table'].includes(suffix);
  if (!multi) return domain;
  if (domain === 'Person') return 'People';
  if (domain === 'Media') return 'Media';
  if (domain === 'Pricing') return 'Pricing';
  if (domain === 'Stats') return 'Stats';
  if (domain === 'Faq') return 'Faq';
  if (domain === 'Newsletter') return 'Newsletter';
  if (domain.endsWith('s')) return domain;
  return `${domain}s`;
}

function catalogPascal(entry) {
  return toPascalCase(entry.name || entry.slug || '');
}

/**
 * Soft match: if evidence name tokens overlap a catalogue entry strongly, prefer registry vocabulary.
 */
function softRegistryMatch(cmsName, blob) {
  const catalog = loadCatalog();
  const nameTokens = new Set(
    cmsName
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2 && !NOISE_TOKENS.has(t)),
  );
  let best = null;
  let bestScore = 0;
  for (const entry of catalog) {
    const label = `${entry.name} ${entry.slug}`.toLowerCase();
    const entryTokens = label
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2);
    let hits = 0;
    for (const t of entryTokens) {
      if (nameTokens.has(t) || blob.toLowerCase().includes(t)) hits += 1;
    }
    const meaningful = entryTokens.filter(
      (t) => !['list', 'block', 'item', 'rendering', 'sitecore', 'link', 'cta'].includes(t),
    );
    if (meaningful.length === 0) continue;
    const score = hits / meaningful.length;
    if (score >= 0.7 && hits >= 2 && score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  if (!best) return null;
  return catalogPascal(best);
}

/**
 * Name a detected section from HTML + metadata evidence.
 * @param {{ html?: string, cmsName?: string, heading?: string, hints?: string[], track?: string, className?: string, selector?: string }} section
 */
export function nameSectionFromEvidence(section = {}) {
  const html = section.html || '';
  const rootClassName = section.className || '';
  const classes = [...splitClassTokens(rootClassName), ...extractClassesFromHtml(html)];
  const ids = extractIdsFromHtml(html);
  const dataAttrs = extractDataAttrs(html);
  const aria = extractAria(html);
  const heading = extractHeading(html, section.heading);
  const hints = Array.isArray(section.hints) ? section.hints : [];

  const blob = [classes.join(' '), ids.join(' '), dataAttrs.join(' '), aria.join(' '), heading, hints.join(' ')]
    .join(' ')
    .slice(0, 4000);

  // Landmark chrome from detector hints / prior cmsName — don't let layout wrappers win.
  if (hints.includes('footer') || /^Footer\d*$/i.test(section.cmsName || '')) {
    const ordered = extractOrderedBlockClasses(html, rootClassName)
      .map((c) => normalizeComponentPascal(c))
      .filter(Boolean);
    const footerName =
      ordered.find((n) => /^Prefooter$/i.test(n)) ||
      ordered.find((n) => /^Footer$/i.test(n)) ||
      ordered.find((n) => /Footer|Legal|Sitemap/i.test(n) && !/^Sub/i.test(n)) ||
      'Footer';
    return {
      cmsName: footerName,
      confidence: 0.96,
      source: 'landmark-footer',
      reasons: [`Footer landmark → ${footerName}`],
    };
  }
  if (hints.includes('header') || hints.includes('nav') || /^Header\d*$/i.test(section.cmsName || '')) {
    const headerExplicit = findExplicitComponentClass(html, rootClassName);
    if (headerExplicit && /Header|Nav|Navigation|TopBar|Menu/i.test(headerExplicit)) {
      return {
        cmsName: headerExplicit,
        confidence: 0.96,
        source: 'explicit-class',
        reasons: [`Header landmark + block class → ${headerExplicit}`],
      };
    }
    return {
      cmsName: 'Header',
      confidence: 0.95,
      source: 'landmark-header',
      reasons: ['Header landmark hint'],
    };
  }

  // Track chrome
  if (section.track === 'overlay' || /cookie|consent|osano|onetrust/i.test(blob)) {
    if (/cookie|consent|osano|onetrust|privacy/i.test(blob)) {
      return {
        cmsName: 'ConsentBanner',
        confidence: 0.95,
        source: 'overlay-consent',
        reasons: ['CMP/consent evidence'],
      };
    }
    if (/chat|intercom/i.test(blob)) {
      return {
        cmsName: 'ChatWidget',
        confidence: 0.9,
        source: 'overlay-chat',
        reasons: ['Chat widget evidence'],
      };
    }
  }

  // 1) Explicit design-system block class (NewFeaturePromo, NewsletterPush, AccordionIntro, …)
  const explicit = findExplicitComponentClass(html, rootClassName);
  if (explicit && !isLeafWidgetName(explicit)) {
    const soft = softRegistryMatch(explicit, blob);
    // Soft registry only for clear structural synonyms — never replace a specific site class
    // with a generic catalogue "CTA Link Block".
    const useSoft =
      soft &&
      soft !== explicit &&
      !/CtaLink|LinkBlock|ContentBlock/i.test(soft) &&
      soft.length <= explicit.length + 4 &&
      /Carousel|Grid|Banner|Hero|Footer|Header|Form|Accordion/i.test(soft) &&
      !hasCompleteEnding(explicit);
    const cmsName = useSoft ? soft : explicit;
    return {
      cmsName,
      confidence: 0.95,
      source: useSoft ? 'explicit-class+registry' : 'explicit-class',
      reasons: [`Explicit block class → ${explicit}${useSoft ? ` → registry ${soft}` : ''}`],
    };
  }

  // 2) data-component* (skip track/button ids that are not components)
  for (const raw of dataAttrs) {
    if (/navigationClick|click|newsletter-push/i.test(raw) && !/component|Feature|Promo|Accordion/i.test(raw)) {
      continue;
    }
    // C27.A-Feature-promo → FeaturePromo
    const cleaned = String(raw)
      .replace(/^[A-Z]?\d+[.\-]/i, '')
      .replace(/^[A-Z]\d+[.\-]/i, '');
    const pascal = toPascalCase(cleaned);
    if (pascal.length >= 4 && pascal.length <= 48 && !isLeafWidgetName(pascal)) {
      const withSuffix = hasCompleteEnding(pascal) ? pascal : SUFFIXES.some((s) => pascal.endsWith(s)) ? pascal : `${pascal}`;
      return {
        cmsName: withSuffix,
        confidence: 0.88,
        source: 'data-attr',
        reasons: [`data-* attribute → ${raw}`],
      };
    }
  }

  const structure = detectStructure(blob, hints);
  const { domain, confidence: domainConf } = detectDomain(blob, hints);

  let cmsName;
  if (domain === 'Header' || structure === 'Header') {
    cmsName = 'Header';
  } else if (domain === 'Footer' || structure === 'Footer') {
    cmsName = 'Footer';
  } else if (domain === 'Hero' && (structure === 'Hero' || structure === 'Banner' || structure === 'Carousel')) {
    cmsName = structure === 'Carousel' ? 'HeroCarousel' : 'Hero';
  } else if (domain === 'Consent') {
    cmsName = 'ConsentBanner';
  } else if (domain === 'Newsletter') {
    cmsName = structure === 'Form' || structure === 'Push' ? 'NewsletterPush' : `Newsletter${structure}`;
  } else if (domain === 'Faq' && structure === 'Accordion') {
    cmsName = 'AccordionIntro';
  } else if (domainConf >= 0.55 && domain) {
    const domainPart = pluralizeDomain(domain, structure) || domain;
    cmsName = `${domainPart}${structure}`;
  } else {
    const generic = {
      Grid: 'ItemGrid',
      Carousel: 'ItemCarousel',
      Card: 'ItemCard',
      Banner: 'GenericBanner',
      Hero: 'Hero',
      Bar: 'CtaBar',
      Form: 'Form',
      Push: 'NewsletterPush',
      Block: 'ContentBlock',
      Gallery: 'MediaGallery',
      List: 'ItemList',
      Accordion: 'AccordionIntro',
      Header: 'Header',
      Footer: 'Footer',
      Rail: 'ItemRail',
      Wall: 'LogoWall',
    };
    cmsName = generic[structure] || 'ContentBlock';
  }

  cmsName = cmsName.replace(/BlockBlock$/, 'Block').replace(/SectionSection$/, 'Section');
  // Never ship CtaLinkBlock from domain fallback when blob only had leaf CTAs
  if (/^Cta(Link)?(Block|Bar|Strip)?$/i.test(cmsName) && /NewsletterPush|AccordionIntro|NewFeaturePromo/i.test(blob)) {
    if (/NewsletterPush/i.test(blob)) cmsName = 'NewsletterPush';
    else if (/AccordionIntro/i.test(blob)) cmsName = 'AccordionIntro';
    else if (/NewFeaturePromo/i.test(blob)) cmsName = 'NewFeaturePromo';
  }

  const soft = softRegistryMatch(cmsName, blob);
  if (soft && soft !== cmsName && domainConf >= 0.55 && !/CtaLink|LinkBlock/i.test(soft)) {
    return {
      cmsName: soft,
      confidence: Math.min(0.9, domainConf + 0.1),
      source: 'domain+structure+registry',
      reasons: [`${domain || 'unknown'}+${structure} → ${cmsName} → registry ${soft}`],
    };
  }

  return {
    cmsName,
    confidence: domainConf >= 0.55 ? 0.7 : 0.45,
    source: domainConf >= 0.55 ? 'domain+structure' : 'structure-fallback',
    reasons: [
      domainConf >= 0.55
        ? `Domain ${domain} + structure ${structure}`
        : `Low domain confidence; structural fallback ${cmsName}`,
    ],
  };
}
