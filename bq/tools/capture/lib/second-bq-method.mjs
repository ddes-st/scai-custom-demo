/**
 * SecondBQMethod — human-style section detection.
 *
 * Mimics scrolling a desktop page and cutting it into full-width bands that
 * read as distinct visual regions (background / media / landmark changes),
 * then naming from root attributes → child cues → vocabulary guess.
 *
 * Injected via page.evaluate(secondBqMethodInPage).
 */

/** Sitecore / BQ-ish vocabulary used when DOM names are weak. */
export const SECOND_BQ_VOCABULARY = [
  'Accordion Block',
  'Accordion Item Rendering',
  'AI Chat',
  'AI Chat Widget',
  'Alert Banner',
  'Article Card',
  'Article Details',
  'Article Header',
  'Articles Carousel',
  'Articles List Grid',
  'Avatar Block',
  'Badge Block',
  'Block Quote',
  'Breadcrumb - Sitecore',
  'Callout Card',
  'Card Block',
  'Code Snippet',
  'Column Splitter',
  'Consent Banner',
  'Container',
  'Content Block',
  'Countdown Banner',
  'CTA Button',
  'Destination Card',
  'Destination Details',
  'Destination Sidebar',
  'Destination Tabs',
  'Destinations Carousel',
  'Destinations List Grid',
  'Feature Card',
  'Features Carousel',
  'Features List Grid',
  'Filter Panel',
  'Footer',
  'Form Address Field',
  'Form Builder',
  'Form Checkbox Field',
  'Form Conditional',
  'Form Date Field',
  'Form Fieldset',
  'Form Fieldset Array',
  'Form Phone Field',
  'Form Range Field',
  'Form Rating Field',
  'Form Select Field',
  'Form Step',
  'Form Summary',
  'Form Text Field',
  'Form Textarea Field',
  'Form Upload Field',
  'Header',
  'Hero',
  'Hero Carousel',
  'Image',
  'Inline Banner',
  'Language Switcher',
  'Lead Form',
  'Lib Helpers - Sitecore',
  'Link List',
  'Linked Items Rail',
  'Locale Direction',
  'Location Card',
  'Location Search Bar',
  'Locations Carousel',
  'Locations List Grid',
  'Logo Wall',
  'Main Nav',
  'Matrix',
  'Media Carousel',
  'Media Gallery List Grid',
  'Media Wall',
  'Mega Menu',
  'Mini Cart',
  'Mobile Menu',
  'Offer Card',
  'Offers Carousel',
  'Offers List Grid',
  'Partial Design Placeholder',
  'Person Card',
  'Person Carousel',
  'Person List Grid',
  'Pricing Card',
  'Pricing Carousel',
  'Pricing List Grid',
  'Product Card',
  'Products Carousel',
  'Products List Grid',
  'Promo',
  'Quick Links Tiles',
  'Ranking Table',
  'Recipe Spec',
  'Review Card',
  'Reviews Carousel',
  'Reviews List Grid',
  'Row Splitter',
  'Scroll Scene',
  'Scroll To Top',
  'Search Bar',
  'Search Booking Bar',
  'Search Controls Bar',
  'Search Experience',
  'Search Pagination Bar',
  'Section Wrapper',
  'Social Links',
  'Social Share',
  'Stats Card',
  'Stats Carousel',
  'Stats List Grid',
  'Status List',
  'Stories Rail',
  'Subscribe Section',
  'Subscription Banner',
  'Tab Rendering',
  'Tabs Block',
  'Tagline Banner',
  'Travel Search',
  'Tree Navigation',
  'Utility Trigger',
  'Versus List',
  'Video',
  'Visual Accordion',
  'Visual Tabs',
  'Wildcard Detail',
  'Wildcard Experience',
];

/**
 * Browser-side detector. Assumes the page has already been scrolled down/up.
 * @returns {Array<object>}
 */
export function secondBqMethodInPage() {
  const VOCAB = [
    'Accordion Block',
    'Alert Banner',
    'Article Header',
    'Articles Carousel',
    'Articles List Grid',
    'Callout Card',
    'Card Block',
    'Consent Banner',
    'Container',
    'Content Block',
    'Countdown Banner',
    'CTA Button',
    'Feature Card',
    'Features Carousel',
    'Features List Grid',
    'Filter Panel',
    'Footer',
    'Form Builder',
    'Header',
    'Hero',
    'Hero Carousel',
    'Image',
    'Inline Banner',
    'Language Switcher',
    'Lead Form',
    'Link List',
    'Logo Wall',
    'Main Nav',
    'Media Carousel',
    'Media Wall',
    'Mega Menu',
    'Offer Card',
    'Offers Carousel',
    'Product Card',
    'Products Carousel',
    'Products List Grid',
    'Promo',
    'Quick Links Tiles',
    'Reviews Carousel',
    'Search Bar',
    'Section Wrapper',
    'Social Links',
    'Stats Card',
    'Stats List Grid',
    'Stories Rail',
    'Subscribe Section',
    'Subscription Banner',
    'Tabs Block',
    'Tagline Banner',
    'Video',
    'Visual Accordion',
    'Visual Tabs',
  ];

  const MIN_BAND_H = 64;
  const vw = window.innerWidth || document.documentElement.clientWidth || 1440;

  function toPascalCase(value) {
    const raw = String(value || '').trim();
    if (!raw) return 'Section';
    // Keep existing PascalCase / camelCase tokens (PromoCards, SliderTransition).
    if (/^[A-Za-z][A-Za-z0-9]*$/.test(raw) && /[A-Z]/.test(raw) && /[a-z]/.test(raw)) {
      return raw.charAt(0).toUpperCase() + raw.slice(1);
    }
    return raw
      .split(/[^a-zA-Z0-9]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join('');
  }

  function toFolderName(cmsName) {
    return cmsName
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
      .toLowerCase();
  }

  function isChromeish(el) {
    const tag = el?.tagName?.toLowerCase();
    return !el || ['script', 'style', 'link', 'noscript', 'template', 'svg', 'meta'].includes(tag);
  }

  function parseColor(cssColor) {
    if (!cssColor || cssColor === 'transparent' || cssColor === 'none') return null;
    const m = cssColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
    if (!m) return null;
    const a = m[4] == null ? 1 : Number(m[4]);
    if (a < 0.08) return null;
    return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a };
  }

  function colorKey(c) {
    if (!c) return 'transparent';
    return `${Math.round(c.r / 12)}_${Math.round(c.g / 12)}_${Math.round(c.b / 12)}`;
  }

  function luminance(c) {
    if (!c) return null;
    return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  }

  function effectiveBackground(el) {
    let node = el;
    for (let i = 0; i < 6 && node && node !== document.documentElement; i++) {
      const style = window.getComputedStyle(node);
      const bgImage = style.backgroundImage && style.backgroundImage !== 'none';
      const color = parseColor(style.backgroundColor);
      if (bgImage) {
        return { key: `img:${(style.backgroundImage || '').slice(0, 48)}`, kind: 'image', color, bgImage: true };
      }
      if (color) {
        return { key: colorKey(color), kind: 'solid', color, bgImage: false };
      }
      node = node.parentElement;
    }
    return { key: 'transparent', kind: 'transparent', color: null, bgImage: false };
  }

  function hasMediaFill(el) {
    if (!el) return false;
    if (el.querySelector('video, iframe[src*="youtube"], iframe[src*="vimeo"]')) return true;
    const img = el.querySelector('img, picture, [style*="background-image"]');
    if (!img) return false;
    const rect = el.getBoundingClientRect();
    const media = img.getBoundingClientRect ? img : img.querySelector?.('img') || img;
    const mr = media.getBoundingClientRect?.() || { width: 0, height: 0 };
    return mr.width >= rect.width * 0.55 && mr.height >= Math.min(rect.height * 0.45, 180);
  }

  function isFullWidth(el) {
    const rect = el.getBoundingClientRect();
    return rect.width >= vw * 0.82;
  }

  function bandMetrics(el) {
    const rect = el.getBoundingClientRect();
    const top = rect.top + window.scrollY;
    const bg = effectiveBackground(el);
    return {
      el,
      top,
      bottom: top + rect.height,
      height: rect.height,
      width: rect.width,
      bg,
      hasMedia: hasMediaFill(el) || bg.bgImage,
    };
  }

  function backgroundsDiffer(a, b) {
    if (!a || !b) return true;
    if (a.hasMedia !== b.hasMedia) return true;
    if (a.bg.key !== b.bg.key) return true;
    if (a.bg.kind !== b.bg.kind) return true;
    const la = luminance(a.bg.color);
    const lb = luminance(b.bg.color);
    if (la != null && lb != null && Math.abs(la - lb) >= 28) return true;
    return false;
  }

  function buildStructuralSelector(el) {
    if (!(el instanceof Element)) return null;
    if (el.id && !/^[0-9]/.test(el.id)) {
      const idSel = `#${CSS.escape(el.id)}`;
      try {
        if (document.querySelector(idSel) === el) return idSel;
      } catch {
        /* ignore */
      }
    }
    const parts = [];
    let node = el;
    while (node && node.nodeType === Node.ELEMENT_NODE && parts.length < 8) {
      if (node.id && !/^[0-9]/.test(node.id) && node !== el) {
        parts.unshift(`#${CSS.escape(node.id)}`);
        break;
      }
      let part = node.tagName.toLowerCase();
      const parent = node.parentElement;
      if (parent) {
        const siblings = [...parent.children].filter((c) => c.tagName === node.tagName);
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
      }
      parts.unshift(part);
      node = parent;
      if (node === document.body) {
        parts.unshift('body');
        break;
      }
    }
    return parts.join(' > ');
  }

  function findPageShell() {
    return (
      document.querySelector('#Page') ||
      document.querySelector('#page') ||
      document.querySelector('#root') ||
      document.querySelector('#__next') ||
      document.querySelector('[data-page]') ||
      document.querySelector('main')?.parentElement ||
      document.body
    );
  }

  function pickLargestMain() {
    const all = [...document.querySelectorAll('main, [role="main"]')];
    let best = null;
    let bestScore = -1;
    for (const el of all) {
      const rect = el.getBoundingClientRect();
      const kids = [...el.children].filter((c) => c.getBoundingClientRect().height >= MIN_BAND_H).length;
      const score = rect.height * rect.width + kids * 80000;
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    }
    return best || document.querySelector('main');
  }

  function unwrapOne(el) {
    if (!el) return el;
    const kids = [...el.children].filter((c) => c instanceof Element && !isChromeish(c));
    if (kids.length !== 1) return el;
    const child = kids[0];
    const er = el.getBoundingClientRect();
    const cr = child.getBoundingClientRect();
    if (cr.height < er.height * 0.85 || cr.width < er.width * 0.85) return el;
    const parentWeak = /slice|container|wrapper|zone|normalized|editorial|padding/i.test(String(el.className || ''));
    const childStrong = /[A-Z][a-z]+[A-Z]|Promo|Hero|Banner|Footer|Header|Accordion|Newsletter|Service|Cta/i.test(
      String(child.className || '')
    );
    if (parentWeak || childStrong) return child;
    return el;
  }

  /**
   * Collect candidate bands the way a human scans the page:
   * - chrome slots on the page shell (menu / page header / footer)
   * - every full-width direct child of the largest <main>
   * - dedicated <footer> if not already included
   * Then keep a band when it is full-width and either:
   *   (a) landmark chrome, or
   *   (b) background/media differs from the previous kept band, or
   *   (c) it is a substantial content slice (≥ ~120px)
   */
  function collectVisualBands() {
    const shell = findPageShell();
    const main = pickLargestMain();
    /** @type {Element[]} */
    const ordered = [];

    if (shell) {
      for (const child of shell.children) {
        if (!(child instanceof Element) || isChromeish(child)) continue;
        if (child === main || child.tagName === 'MAIN' || child.getAttribute('role') === 'main') continue;
        const tag = child.tagName.toLowerCase();
        const cls = String(child.className || '');
        const isChromeSlot =
          tag === 'header' ||
          tag === 'footer' ||
          tag === 'nav' ||
          /ContentZone|Header|Footer|menu|nav/i.test(cls);
        const m = bandMetrics(child);
        const hasHeaderChrome = !!child.querySelector(
          '.MainHeaderV2, [class*="MainHeader"], [class*="Header"], nav, [role="navigation"]'
        );
        // Menu zones can report h=0 when overlapping/fixed — still keep them.
        if (
          isChromeSlot ||
          hasHeaderChrome ||
          (isFullWidth(child) && m.height >= MIN_BAND_H)
        ) {
          ordered.push(hasHeaderChrome && m.height < MIN_BAND_H ? child.querySelector('.MainHeaderV2, [class*="MainHeader"], nav') || child : child);
        }
      }
    }

    // Language / utility top bar above the page shell (white strip).
    const shellParent = shell?.parentElement;
    if (shellParent) {
      for (const sib of shellParent.children) {
        if (!(sib instanceof Element) || sib === shell) continue;
        const m = bandMetrics(sib);
        if (m.height < 24 || m.height > 120) continue;
        if (!isFullWidth(sib) && m.width < vw * 0.7) continue;
        const blob = `${sib.className || ''} ${sib.id || ''} ${sib.innerText?.slice(0, 80) || ''}`.toLowerCase();
        if (/lang|locale|language|français|nederlands|topbar|utility/.test(blob) || m.height <= 64) {
          if (!ordered.some((el) => el === sib || el.contains(sib))) ordered.unshift(sib);
        }
      }
    }

    if (main) {
      for (const child of main.children) {
        if (!(child instanceof Element) || isChromeish(child)) continue;
        const m = bandMetrics(child);
        if (!isFullWidth(child) && m.width < vw * 0.7) continue;
        if (m.height < MIN_BAND_H) continue;
        ordered.push(child);
      }
    }

    const footer =
      document.querySelector('footer[role="contentinfo"]') ||
      document.querySelector('footer.Footer, footer') ||
      document.querySelector('[class*="ContentZone__footer"]');
    if (footer && !ordered.some((el) => el === footer || el.contains(footer) || footer.contains(el))) {
      ordered.push(footer);
    }

    // Always try to keep the overlapping site header even when its zone reports h=0.
    const forcedHeader =
      document.querySelector('#Page .MainHeaderV2, .MainHeaderV2, [class*="MainHeader"]') ||
      document.querySelector('section.ContentZone__menu');
    if (
      forcedHeader &&
      !ordered.some((el) => el === forcedHeader || el.contains(forcedHeader) || forcedHeader.contains(el))
    ) {
      ordered.unshift(forcedHeader);
    }

    // Sort by document order / top.
    ordered.sort((a, b) => {
      const ta = a.getBoundingClientRect().top + window.scrollY;
      const tb = b.getBoundingClientRect().top + window.scrollY;
      return ta - tb;
    });

    /** @type {Array<{ el: Element, metrics: ReturnType<typeof bandMetrics>, role: string }>} */
    const kept = [];
    for (const raw of ordered) {
      const clsRaw = String(raw.className || '');
      const keepAsHeaderChrome = /MainHeader|ContentZone__menu|site-header|global-header/i.test(clsRaw);
      const el = keepAsHeaderChrome ? raw : unwrapOne(raw);
      const metrics = bandMetrics(el);

      const tag = el.tagName.toLowerCase();
      const cls = String(el.className || '');
      let role = 'content';
      if (tag === 'footer' || /footer/i.test(cls) || el.getAttribute('role') === 'contentinfo') role = 'footer';
      else if (
        keepAsHeaderChrome ||
        /ContentZone__menu|MainHeader|site-header|global-header/i.test(cls) ||
        (tag === 'nav' && metrics.height < 280)
      ) {
        role = 'header';
      } else if (
        tag === 'header' ||
        /pageHeader|HeroEditorial|SliderTransition|carousel|hero/i.test(cls) ||
        (metrics.height >= Math.min(420, window.innerHeight * 0.45) && metrics.top < 200)
      ) {
        role = 'hero';
      }

      // Absolute/overlapping headers can report odd box sizes — still keep chrome.
      const allowShortChrome = role === 'header' && (metrics.height >= 24 || keepAsHeaderChrome);
      if (metrics.height < MIN_BAND_H && !allowShortChrome) continue;

      const prev = kept[kept.length - 1];
      const landmark = role === 'header' || role === 'footer' || role === 'hero';
      const differs = !prev || backgroundsDiffer(prev.metrics, metrics);
      const substantial = metrics.height >= 120;

      // Skip near-duplicate nested leftovers.
      if (prev && (prev.el.contains(el) || el.contains(prev.el))) {
        if (el.contains(prev.el) && metrics.height >= prev.metrics.height * 0.9) {
          kept[kept.length - 1] = { el, metrics, role };
        }
        continue;
      }

      if (landmark || differs || substantial || allowShortChrome) {
        // If backgrounds are identical and both are small utility strips, merge by skipping.
        if (
          prev &&
          !landmark &&
          prev.role === 'content' &&
          !differs &&
          metrics.height < 100 &&
          prev.metrics.height < 100
        ) {
          continue;
        }
        kept.push({ el, metrics, role });
      }
    }

    return kept;
  }

  function meaningfulClassTokens(el) {
    const skip =
      /^(is-|js-|js_|css-|col-|row$|container|wrapper|inner|outer|flex|grid|w-|h-|p-|m-|gap-|bg-|text-|normalized|slice|padding|extended|background|sc-|Product_|Editorial)/i;
    return [...(el.classList || [])].filter((c) => c && c.length >= 4 && c.length <= 48 && !skip.test(c));
  }

  function attrNameHints(el) {
    const attrs = [
      el.getAttribute('data-component'),
      el.getAttribute('data-component-name'),
      el.getAttribute('data-module'),
      el.getAttribute('data-testid'),
      el.getAttribute('aria-label'),
      el.getAttribute('name'),
      el.id,
    ];
    return attrs.map((v) => (v || '').trim()).filter(Boolean);
  }

  function headingText(el) {
    const h = el.querySelector('h1, h2, h3, [class*="title" i], [class*="Title"]');
    return h?.textContent?.trim().replace(/\s+/g, ' ').slice(0, 80) || '';
  }

  function structureHints(el) {
    const html = (el.innerHTML || '').toLowerCase();
    const cls = String(el.className || '').toLowerCase();
    const hints = [];
    if (el.querySelector('.swiper, .slick-slider, [aria-roledescription="carousel"], .SliderTransition, .owl-carousel')) {
      hints.push('carousel');
    }
    if (el.querySelector('video')) hints.push('video');
    if (el.querySelector('form')) hints.push('form');
    if (el.querySelector('[class*="accordion" i], details')) hints.push('accordion');
    if (el.querySelectorAll('img, picture').length >= 4) hints.push('grid');
    if (/newsletter|subscribe|signup/.test(cls + html.slice(0, 500))) hints.push('subscribe');
    if (/promo|offer|banner/.test(cls)) hints.push('promo');
    if (/nav|menu|header/.test(cls) && el.getBoundingClientRect().height < 280) hints.push('nav');
    if (/footer/.test(cls) || el.tagName === 'FOOTER') hints.push('footer');
    if (/hero/.test(cls) || el.tagName === 'HEADER') hints.push('hero');
    if (/cta|quick.?link|shortcut/.test(cls)) hints.push('cta');
    if (/language|locale|lang-/.test(cls + html.slice(0, 400))) hints.push('language');
    return hints;
  }

  function matchVocabulary(hints, heading, classBlob) {
    const blob = `${hints.join(' ')} ${heading} ${classBlob}`.toLowerCase();
    const rules = [
      [/footer/, 'Footer'],
      [/language|locale/, 'Language Switcher'],
      [/mega.?menu|main.?nav|navigation/, 'Main Nav'],
      [/header|menu/, 'Header'],
      [/hero.*carousel|carousel.*hero|slidertransition|heroeditorial/, 'Hero Carousel'],
      [/carousel|slider|swiper/, 'Media Carousel'],
      [/hero/, 'Hero'],
      [/accordion|accordeon/, 'Visual Accordion'],
      [/newsletter|subscribe/, 'Subscribe Section'],
      [/subscription|banner/, 'Subscription Banner'],
      [/promo|offer|action.?banner/, 'Promo'],
      [/quick.?link|cta.?bar|shortcut/, 'Quick Links Tiles'],
      [/logo/, 'Logo Wall'],
      [/product/, 'Products List Grid'],
      [/card.?grid|teaser|promo.?card|services.?card/, 'Card Block'],
      [/feature/, 'Feature Card'],
      [/stats|counter/, 'Stats List Grid'],
      [/video/, 'Video'],
      [/form|lead/, 'Lead Form'],
      [/search/, 'Search Bar'],
      [/alert|inline.?banner|tagline/, 'Inline Banner'],
      [/tab/, 'Tabs Block'],
      [/social/, 'Social Links'],
      [/consent|cookie/, 'Consent Banner'],
    ];
    for (const [re, name] of rules) {
      if (re.test(blob) && VOCAB.includes(name)) return name;
    }
    // Fuzzy: pick vocab entry whose words appear in blob.
    let best = null;
    let bestScore = 0;
    for (const name of VOCAB) {
      const words = name.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      const hits = words.filter((w) => blob.includes(w)).length;
      if (hits > bestScore && hits >= Math.ceil(words.length * 0.6)) {
        bestScore = hits;
        best = name;
      }
    }
    return best;
  }

  function nameBand(el, role) {
    if (role === 'header') return { cmsName: 'Header', nameSource: 'role' };
    if (role === 'footer') return { cmsName: 'Footer', nameSource: 'role' };

    const heading = headingText(el);
    const hints = structureHints(el);
    const classBlob = `${el.className || ''} ${[...el.children]
      .slice(0, 3)
      .map((c) => c.className || '')
      .join(' ')}`;

    // Prefer vocabulary for clear structural roles before weak framework class names.
    if (role === 'hero') {
      const vocabHero = matchVocabulary(['hero', ...hints], heading, classBlob);
      if (vocabHero) return { cmsName: vocabHero.replace(/\s+/g, ''), nameSource: 'vocabulary', vocab: vocabHero };
    }

    // 1) Root class / attrs — skip generic chrome/framework tokens
    for (const hint of attrNameHints(el)) {
      const cleaned = toPascalCase(hint.replace(/^data-/, ''));
      if (cleaned.length >= 4 && cleaned.length <= 48 && !/^(Page|Main|Root|App|Content)$/i.test(cleaned)) {
        return { cmsName: cleaned, nameSource: 'attr' };
      }
    }
    const weakToken =
      /^(SliderTransition|CustomScroll|NormalizedSlice|Container|ContentZone|EditorialContentZone|HeroEditorial)$/i;
    const tokens = meaningfulClassTokens(el);
    for (const token of tokens) {
      if (/ContentZone|NormalizedSlice|^Container$/i.test(token) || weakToken.test(token)) continue;
      const name = toPascalCase(token.replace(/__/g, '-').replace(/Background$/i, ''));
      if (name.length >= 4 && name.length <= 48) {
        return { cmsName: name, nameSource: 'class' };
      }
    }

    // 2) Meaningful child root (first strong component child)
    for (const child of [...el.children].slice(0, 6)) {
      if (!(child instanceof Element)) continue;
      const childTokens = meaningfulClassTokens(child);
      for (const token of childTokens) {
        if (/ContentZone|NormalizedSlice|^Container$/i.test(token) || weakToken.test(token)) continue;
        const name = toPascalCase(token.replace(/__/g, '-').replace(/Background$/i, ''));
        if (name.length >= 4 && name.length <= 48) {
          return { cmsName: name, nameSource: 'child-class' };
        }
      }
    }

    // 3) Vocabulary guess from structure + heading
    const vocab = matchVocabulary(hints, heading, classBlob);
    if (vocab) {
      return { cmsName: vocab.replace(/\s+/g, ''), nameSource: 'vocabulary', vocab };
    }

    // 4) Heading-derived name
    if (heading) {
      return { cmsName: toPascalCase(heading.split(/\s+/).slice(0, 5).join(' ')), nameSource: 'heading' };
    }

    return { cmsName: 'ContentBlock', nameSource: 'fallback', vocab: 'Content Block' };
  }

  function typeFromRole(role, cmsName) {
    if (role === 'header') return 'header';
    if (role === 'footer') return 'footer';
    if (role === 'hero' || /hero|carousel/i.test(cmsName)) return /carousel/i.test(cmsName) ? 'carousel' : 'hero';
    if (/accordion/i.test(cmsName)) return 'faq-section';
    if (/subscribe|newsletter/i.test(cmsName)) return 'content-section';
    return 'content-section';
  }

  const bands = collectVisualBands();
  const usedNames = new Map();
  const sections = [];

  for (let i = 0; i < bands.length; i++) {
    const { el, metrics, role } = bands[i];
    const named = nameBand(el, role);
    let cmsName = named.cmsName || `ContentBlock${i + 1}`;
    const count = usedNames.get(cmsName) || 0;
    usedNames.set(cmsName, count + 1);
    if (count > 0) cmsName = `${cmsName}${count + 1}`;

    const type = typeFromRole(role, cmsName);
    const selector = buildStructuralSelector(el);
    sections.push({
      cmsName,
      folderName: toFolderName(cmsName),
      name: toFolderName(cmsName),
      selector,
      heading: headingText(el) || null,
      reason: `SecondBQMethod: full-width band (${named.nameSource}; bg=${metrics.bg.kind}${metrics.hasMedia ? '+media' : ''})`,
      type,
      componentType: cmsName,
      scope: type === 'footer' || type === 'header' ? 'site' : 'page',
      order: i,
      source: 'second-bq-method',
      nameSource: named.nameSource,
      vocabularyGuess: named.vocab || null,
      backgroundKind: metrics.bg.kind,
      backgroundKey: metrics.bg.key,
      hasMedia: metrics.hasMedia,
      height: Math.round(metrics.height),
      top: Math.round(metrics.top),
      className: String(el.className || '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 4)
        .join(' '),
      tag: el.tagName.toLowerCase(),
    });
  }

  return sections;
}
