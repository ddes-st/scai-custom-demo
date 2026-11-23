/**
 * Browser-side section discovery — injected via page.evaluate().
 * Site chrome (Header/Nav) must be hidden before this runs.
 * @see .cursor/skills/visual-cms-map/references/taxonomy.md
 */
export function discoverSectionsInPage() {
  const MIN_HEIGHT = 72;
  const MIN_WIDTH = 280;
  const MAX_MAIN_SECTIONS = 24;
  const SITE_SCOPED_TYPES = new Set(['footer', 'cookie-banner']);

  /** @type {Array<object>} */
  const sections = [];
  const claimed = new Set();

  function toPascalCase(value) {
    return (value || 'Section')
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

  function isVisible(el, type = '') {
    if (!el || !(el instanceof Element)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    const rect = el.getBoundingClientRect();
    const minH = type === 'footer' ? 40 : type === 'breadcrumb' ? 20 : MIN_HEIGHT;
    const minW = type === 'footer' ? 200 : MIN_WIDTH;
    return rect.width >= minW && rect.height >= minH;
  }

  function anchorWebid(el) {
    if (!(el instanceof Element)) return null;
    if (el.getAttribute('data-webid')) return el.getAttribute('data-webid');
    const child = el.querySelector('[data-webid]');
    return child?.getAttribute('data-webid') ?? null;
  }

  function buildSelector(el) {
    if (!(el instanceof Element)) return null;
    if (el.id) return `#${CSS.escape(el.id)}`;

    const ownWebid = el.getAttribute('data-webid');
    if (ownWebid) {
      const sel = `[data-webid="${CSS.escape(ownWebid)}"]`;
      if (document.querySelector(sel) === el) return sel;
    }

    for (const child of el.querySelectorAll('[data-webid]')) {
      const wid = child.getAttribute('data-webid');
      if (!wid) continue;
      const inner = `[data-webid="${CSS.escape(wid)}"]`;
      if (document.querySelectorAll(inner).length !== 1) continue;
      try {
        const hasSel = `section:has(${inner})`;
        const matches = document.querySelectorAll(hasSel);
        if (matches.length === 1 && matches[0] === el) return hasSel;
      } catch {
        /* :has unsupported */
      }
    }

    const stableClasses = [...el.classList].filter(
      (c) =>
        c &&
        !c.startsWith('lfr-layout-structure-item-') &&
        !/^js-/.test(c) &&
        !/^is-/.test(c) &&
        !/^col-/.test(c) &&
        c.length < 64
    );
    if (stableClasses.length) {
      const sel = `${el.tagName.toLowerCase()}.${stableClasses.slice(0, 2).map((c) => CSS.escape(c)).join('.')}`;
      if (document.querySelectorAll(sel).length === 1) return sel;
    }

    const parts = [];
    let node = el;
    while (node && node.nodeType === Node.ELEMENT_NODE && parts.length < 6) {
      let part = node.tagName.toLowerCase();
      if (node.id) {
        parts.unshift(`#${CSS.escape(node.id)}`);
        break;
      }
      const parent = node.parentElement;
      if (parent) {
        const siblings = [...parent.children].filter((c) => c.tagName === node.tagName);
        if (siblings.length > 1) {
          part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
        }
      }
      parts.unshift(part);
      node = parent;
    }
    return parts.join(' > ');
  }

  function containsClaimed(el, options = {}) {
    for (const other of claimed) {
      if (other === el) return true;
      if (options.allowParentOfClaimed && el.contains(other)) continue;
      if (other.contains(el) || el.contains(other)) return true;
    }
    return false;
  }

  function classSignature(el) {
    const classes = [...el.classList].filter(
      (c) => c && !/^col-/.test(c) && !/^row$/.test(c) && !/^container/.test(c)
    );
    return classes.sort().join('.') || el.tagName.toLowerCase();
  }

  function headingText(el) {
    const h = el.querySelector(
      ':scope > h1, :scope > h2, :scope > h3, :scope > .container h2, :scope > .container h3, h1, h2, h3, .text-panel-title, .content-title, .cardcontainerTitle-v2, .content-section .content-title, .news_heading h2, .search-header-links'
    );
    return h?.textContent?.trim().slice(0, 80) || '';
  }

  function purposePrefix(el) {
    const title = headingText(el);
    if (!title) return '';
    return toPascalCase(title.split(/\s+/).slice(0, 4).join(' '));
  }

  function purposeFromHeading(heading) {
    if (!heading) return '';
    return toPascalCase(heading.split(/\s+/).slice(0, 4).join(' '));
  }

  function buildBandSelectors(elements) {
    if (!elements?.length) return null;
    const selectors = elements.map((e) => buildBandMemberSelector(e)).filter(Boolean);
    return selectors.length ? selectors : null;
  }

  function buildBandMemberSelector(el) {
    if (!(el instanceof Element)) return null;
    if (el.id) return `#${CSS.escape(el.id)}`;

    const grid = el.parentElement;
    if (grid?.classList?.contains('aem-Grid')) {
      const section = grid.closest('.cmp-container--section');
      const sectionSel = section?.id ? `#${CSS.escape(section.id)}` : buildSelector(section);
      const idx = [...grid.children].indexOf(el);
      if (sectionSel && idx >= 0) {
        return `${sectionSel} > .aem-Grid > :nth-child(${idx + 1})`;
      }
      if (idx >= 0) {
        const gridSel = buildSelector(grid);
        if (gridSel) return `${gridSel} > :nth-child(${idx + 1})`;
      }
    }

    return buildSelector(el);
  }

  function isAemGridColumnVisible(el) {
    if (!el || !(el instanceof Element)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    const rect = el.getBoundingClientRect();
    const isContentBlock =
      el.classList.contains('productcards') ||
      el.classList.contains('pagelist') ||
      el.classList.contains('filteredpagelist') ||
      el.classList.contains('highlightboxes') ||
      !!el.querySelector('.cmp-product-cards, .cmp-page-list__cards, .cmp-highlight-boxes__list');
    const minH =
      isAemTitleComponent(el) || el.classList.contains('text') || el.classList.contains('title')
        ? 16
        : isContentBlock
          ? 24
          : MIN_HEIGHT;
    const minW =
      isAemTitleComponent(el) || el.classList.contains('text') || el.classList.contains('title')
        ? 100
        : isContentBlock
          ? 200
          : MIN_WIDTH;
    return rect.width >= minW && rect.height >= minH;
  }

  function isCorporateContentColumn(el) {
    if (!(el instanceof Element) || !el.classList.contains('aem-GridColumn')) return false;
    if (el.classList.contains('commonHeader') || el.classList.contains('footer')) return false;
    return (
      el.classList.contains('bcp-content-container-v2') ||
      el.classList.contains('contentBlockMain') ||
      el.classList.contains('corporateCards') ||
      el.classList.contains('contentWithImage') ||
      el.classList.contains('quote') ||
      el.classList.contains('news-lister') ||
      el.classList.contains('relatedLinks') ||
      !!el.querySelector(
        '.content-banner-section, .contentBlockWithImage, .cards-container, .news-section-wrapper, .related-links-row'
      )
    );
  }

  function isCorporateGridColumnVisible(el) {
    if (!el || !(el instanceof Element)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width >= 200 && rect.height >= 48;
  }

  function findCorporatePageContentGrid(main) {
    for (const grid of main.querySelectorAll('.aem-Grid')) {
      const columns = [...grid.children].filter(
        (c) => c.classList.contains('aem-GridColumn') && isCorporateContentColumn(c)
      );
      if (columns.length >= 3) return grid;
    }
    return null;
  }

  function isCorporateEditorialBlock(el) {
    return !!(
      el.querySelector('.content-leadingText, .content-title, .banner-description') &&
      el.querySelector('h1, h2, h3, .content-title') &&
      el.querySelector('p, ul, ol')
    );
  }

  function isCorporateImageTextBlock(el) {
    return !!(
      el.querySelector('.contentBlockWithImage, .content-media, .content-section') &&
      el.querySelector('img, picture, .cq-dd-image, .s7dm-dynamic-media') &&
      el.querySelector('h2, h3, .content-title, p')
    );
  }

  function classifyCorporateContentBand(bandEntry, index) {
    const el = bandEntry.el ?? bandEntry;

    if (el.querySelector('.content-banner-section') || el.classList.contains('bcp-content-container-v2')) {
      const banner = el.querySelector('.content-banner-section') || el;
      if (banner.querySelector('h1')) {
        const prefix = purposePrefix(banner);
        pushComponent(banner, prefix ? `${prefix}HeroBanner` : 'HeroBanner', 'Primary hero with page title', 'hero', {
          componentType: 'Hero',
          fields: ['title', 'body', 'image', 'cta'],
        });
        return true;
      }
    }

    if (el.classList.contains('corporateCards') || el.querySelector('.card-wrapper')) {
      const cards = el.querySelectorAll('.card-wrapper');
      if (cards.length >= 2) {
        const prefix = purposePrefix(el);
        pushComponent(
          el,
          prefix ? `${prefix}TeaserGrid` : 'VerticalTeaserGrid',
          `${prefix || 'VerticalTeaserGrid'} with ${cards.length} market cards`,
          'grid',
          {
            placeholderFor: 'VerticalTeaserCard',
            repeatCount: cards.length,
            componentType: 'Grid',
            includesSectionTitle: true,
            fields: ['sectionTitle', 'cards'],
          }
        );
        return true;
      }
    }

    if (el.classList.contains('quote') || el.querySelector('.quote-wrap')) {
      const root = el.querySelector('.quote-wrap') || el;
      const prefix = purposePrefix(root);
      pushComponent(root, prefix ? `${prefix}QuoteBlock` : 'QuoteBlock', 'Quote / testimonial block', 'feature-section', {
        componentType: 'RichText',
        fields: ['quote', 'author', 'role', 'image', 'cta'],
      });
      return true;
    }

    if (el.classList.contains('news-lister') || el.querySelector('.news-section-wrapper')) {
      const root = el.querySelector('.news-section-wrapper') || el;
      const cards = root.querySelectorAll('.news_card');
      const prefix = purposePrefix(root);
      pushComponent(
        root,
        prefix ? `${prefix}NewsGrid` : 'NewsCardGrid',
        `News list with ${cards.length || 'multiple'} items`,
        'grid',
        {
          placeholderFor: 'NewsCard',
          repeatCount: cards.length || null,
          componentType: 'Grid',
          includesSectionTitle: true,
          fields: ['sectionTitle', 'cards'],
        }
      );
      return true;
    }

    if (el.classList.contains('relatedLinks') || el.querySelector('.related-links-row')) {
      const root = el.querySelector('.related-links-row') || el;
      const links = root.querySelectorAll('.links-parent a, .related-link-item a, .search-industry-links a');
      const prefix = purposePrefix(root);
      pushComponent(
        root,
        prefix ? `${prefix}LinkGrid` : 'HorizontalLinkCardGrid',
        `Related links grid with ${links.length || 'multiple'} links`,
        'grid',
        {
          placeholderFor: 'HorizontalLinkCard',
          repeatCount: links.length || null,
          componentType: 'Grid',
          includesSectionTitle: true,
        }
      );
      return true;
    }

    if (isCorporateImageTextBlock(el)) {
      const blockName = nameEditorialBlock(el);
      pushComponent(el, blockName, `${blockName}: image + text block`, 'feature-section', {
        componentType: 'RichText',
        fields: ['title', 'body', 'image', 'cta'],
      });
      return true;
    }

    if (el.classList.contains('contentBlockMain') || isCorporateEditorialBlock(el)) {
      const blockName = nameEditorialBlock(el);
      pushComponent(el, blockName, `${blockName}: editorial content block`, 'feature-section', {
        componentType: 'RichText',
        fields: ['title', 'body', 'cta'],
      });
      return true;
    }

    return false;
  }

  function getAemGridComponents(sectionEl) {
    const grid = sectionEl.querySelector(':scope > .aem-Grid');
    if (!grid) return null;
    const components = [...grid.children].filter(
      (c) => c.classList.contains('aem-GridColumn') && isAemGridColumnVisible(c)
    );
    return components.length ? components : null;
  }

  function isAemTitleComponent(el) {
    if (!(el instanceof Element) || !el.classList.contains('component')) return false;
    if (el.classList.contains('title')) return true;
    if (el.querySelector(':scope > .cmp-title .cmp-title__text, :scope > .cmp-title h1, :scope > .cmp-title h2')) {
      return true;
    }
    return false;
  }

  function isAemStandaloneComponent(el) {
    if (!(el instanceof Element)) return false;
    if (el.classList.contains('banner')) return true;
    return !!el.querySelector(':scope > .cmp-banner, :scope .cmp-banner');
  }

  function isAemContentBoundaryComponent(el) {
    if (!(el instanceof Element)) return false;
    if (el.classList.contains('filteredpagelist')) return true;
    return !!el.querySelector('.cmp-page-list__header[data-section-title], [data-section-title]');
  }

  function getAemComponentHeading(el) {
    const title =
      el.querySelector(
        '.cmp-title__text, .cmp-page-list__title, .cmp-teaser__title, [data-section-title] h1, [data-section-title] h2, [data-section-title] h3'
      ) || el.querySelector('h1, h2, h3');
    return title?.textContent?.trim().slice(0, 80) || '';
  }

  /**
   * AEM often nests multiple editorial blocks inside one `.cmp-container--section`.
   * Split on title / standalone banner / filtered-list boundaries.
   * @returns {Array<{ el: Element, bandElements?: Element[], bandHeading?: string }> | null}
   */
  function splitAemSectionIntoBands(sectionEl) {
    const components = getAemGridComponents(sectionEl);
    if (!components || components.length < 3) return null;

    /** @type {Array<{ index: number, heading: string, standalone?: boolean }>} */
    const boundaries = [];

    components.forEach((comp, index) => {
      if (isAemStandaloneComponent(comp)) {
        boundaries.push({ index, heading: getAemComponentHeading(comp), standalone: true });
        return;
      }
      if (isAemTitleComponent(comp)) {
        boundaries.push({ index, heading: getAemComponentHeading(comp) });
        return;
      }
      if (isAemContentBoundaryComponent(comp)) {
        boundaries.push({ index, heading: getAemComponentHeading(comp) || 'Content list' });
      }
    });

    if (boundaries.length < 2) return null;

    /** @type {Array<{ el: Element, bandElements?: Element[], bandHeading?: string }>} */
    const bands = [];

    for (let b = 0; b < boundaries.length; b++) {
      const start = boundaries[b].index;
      const end = b + 1 < boundaries.length ? boundaries[b + 1].index : components.length;
      const slice = components.slice(start, end);
      const heading = boundaries[b].heading;

      if (boundaries[b].standalone && slice.length === 1) {
        bands.push({ el: slice[0], bandHeading: heading });
        continue;
      }

      const anchor =
        slice.find((c) => !isAemTitleComponent(c) && !c.classList.contains('text')) ||
        slice[slice.length - 1] ||
        slice[0];
      bands.push({ el: anchor, bandElements: slice, bandHeading: heading });
    }

    return bands.length >= 2 ? bands : null;
  }

  function hasCarouselWidget(el) {
    if (el.querySelector('.swiper, .slick-slider, .cmp-carousel, .owl-carousel')) return true;
    if (el.querySelector('.cmp-horizontal-card-slider--products, .cmp-horizontal-card-slider__wrapper')) {
      return true;
    }
    if (el.querySelector('.cmp-page-list--mobile-slider .cmp-page-list__cards')) return true;
    const html = el.innerHTML.toLowerCase();
    return html.includes('home page slider') || html.includes('background-image: url');
  }

  function classifyCompositeHeroBand(el, bandHeading) {
    const carousel = el.querySelector('.owl-carousel, .swiper, .slick-slider, .cmp-carousel');
    const panels = el.querySelector('.panels-hero-panels, [class*="hero-panels"]');
    if (!carousel || !panels) return false;

    const prefix = purposeFromHeading(bandHeading) || purposePrefix(el) || 'Home';
    const panelCols = [...panels.querySelectorAll('.hero-panels-panel, .col-md-4')].filter(isVisible);
    const hasStats = !!el.querySelector('.jm-stock-price-portlet, .stockprice__value, [class*="stockprice"]');

    pushComponent(el, `${prefix}CompositeHeroBand`, 'Composite hero: full-bleed carousel + side panels', 'composite-hero', {
      componentType: 'CompositeHero',
      heading: bandHeading,
      includesCarousel: true,
      includesPanels: true,
      panelCount: panelCols.length || null,
      includesStats: hasStats,
      fields: ['heroSlides', 'newsPanels', 'sharePrice'],
    });

    pushComponent(
      el,
      prefix ? `${prefix}HeroCarousel` : 'HeroCarousel',
      'Full-bleed hero carousel with background-image slides',
      'carousel',
      {
        componentType: 'Carousel',
        parentSection: `${prefix}CompositeHeroBand`,
        heading: bandHeading,
        fields: ['image', 'title', 'subtitle', 'cta'],
      }
    );

    if (panelCols.length >= 2) {
      pushComponent(
        panels,
        prefix ? `${prefix}NewsLinkGrid` : 'NewsLinkGrid',
        `News/promo panels (${panelCols.length} columns)`,
        'grid',
        {
          componentType: 'Grid',
          parentSection: `${prefix}CompositeHeroBand`,
          placeholderFor: 'HorizontalLinkCard',
          repeatCount: panelCols.length,
          includesSectionTitle: true,
        }
      );
    }

    if (hasStats) {
      pushComponent(
        el.querySelector('.jm-stock-price-portlet, [class*="stockprice"]') || panels,
        prefix ? `${prefix}SharePriceStats` : 'SharePriceStats',
        'Share price / live stats strip',
        'stats-bar',
        {
          componentType: 'StatsBar',
          parentSection: `${prefix}CompositeHeroBand`,
          placeholderFor: 'StatsItem',
        }
      );
    }

    return true;
  }

  function classifyAemBand({ el, bandElements, bandHeading, index }) {
    const combined = bandElements ?? [el];
    const prefix = purposeFromHeading(bandHeading) || purposePrefix(el);
    const bandSelectors = buildBandSelectors(combined);

    for (const comp of combined) {
      if (comp.classList.contains('filteredpagelist') || comp.querySelector('.cmp-page-list--content')) {
        const contentCards = comp.querySelectorAll('.cmp-page-list__card');
        const gridName = prefix ? `${prefix}ContentGrid` : 'ContentCardGrid';
        pushComponent(el, gridName, `Content list with ${contentCards.length || 'multiple'} cards`, 'grid', {
          heading: bandHeading,
          bandSelectors,
          placeholderFor: 'ContentCard',
          repeatCount: contentCards.length || null,
          componentType: 'Grid',
          includesSectionTitle: true,
        });
        return true;
      }

      const cards = comp.querySelectorAll('.cmp-page-list__card');
      if (
        cards.length >= 2 &&
        comp.querySelector('.cmp-page-list__cards') &&
        !comp.querySelector('.cmp-page-list--content')
      ) {
        const gridName = prefix ? `${prefix}TeaserGrid` : 'VerticalTeaserGrid';
        pushComponent(el, gridName, `${gridName}: card grid with ${cards.length} items`, 'grid', {
          heading: bandHeading,
          bandSelectors,
          placeholderFor: 'VerticalTeaserCard',
          repeatCount: cards.length,
          componentType: 'Grid',
          includesSectionTitle: true,
          fields: ['sectionTitle', 'cards'],
        });
        return true;
      }

      const productCards = comp.querySelectorAll('.cmp-product-cards__card');
      const productRoot = comp.querySelector('.cmp-product-cards, .cmp-horizontal-card-slider--products');
      if (productRoot && (productCards.length >= 2 || productRoot.style?.getPropertyValue('--items'))) {
        const count =
          productCards.length ||
          parseInt(productRoot.style?.getPropertyValue('--items') || '0', 10) ||
          'multiple';
        const gridName = prefix ? `${prefix}ProductCarousel` : 'ProductCarousel';
        pushComponent(el, gridName, `Product carousel with ${count} items`, 'carousel', {
          heading: bandHeading,
          bandSelectors,
          componentType: 'Carousel',
          repeatCount: typeof count === 'number' ? count : null,
        });
        return true;
      }

      const highlights = comp.querySelectorAll('.cmp-highlight-boxes__item');
      if (highlights.length >= 2) {
        const gridName = prefix ? `${prefix}HighlightGrid` : 'HighlightGrid';
        pushComponent(el, gridName, `Highlight boxes with ${highlights.length} items`, 'grid', {
          heading: bandHeading,
          bandSelectors,
          placeholderFor: 'HighlightBoxCard',
          repeatCount: highlights.length,
          componentType: 'Grid',
          includesSectionTitle: true,
        });
        return true;
      }
    }

    if (combined.some((c) => c.querySelector('.cmp-banner'))) {
      const bannerEl = combined.find((c) => c.querySelector('.cmp-banner')) ?? el;
      pushComponent(bannerEl, prefix ? `${prefix}HeroBanner` : 'HeroBanner', 'Hero / banner band', 'hero', {
        heading: bandHeading,
        bandSelectors,
        componentType: 'Hero',
        fields: ['title', 'body', 'image', 'cta'],
      });
      return true;
    }

    return false;
  }

  function uniqueCmsName(base) {
    let finalName = base;
    let i = 2;
    while (sections.some((s) => s.cmsName === finalName)) {
      finalName = `${base}${i++}`;
    }
    return finalName;
  }

  function hasBackgroundImage(el) {
    const style = window.getComputedStyle(el);
    if (style.backgroundImage && style.backgroundImage !== 'none') return true;
    return !!el.querySelector(
      '[style*="background-image"], [class*="bg-image"], [class*="hero-banner"], [class*="background-image"]'
    );
  }

  function isHorizontalImageText(el) {
    const row = el.querySelector(':scope > .container > .row, :scope > .row');
    if (!row) return false;
    const cols = [...row.children].filter((c) => /col-(md|lg|sm)/.test([...c.classList].join(' ')));
    if (cols.length < 2) return false;
    const hasImg = cols.some((c) => c.querySelector('img, picture, [style*="background-image"]'));
    const hasText = cols.some((c) => c.querySelector('p, h2, h3, ul, ol, a'));
    return hasImg && hasText;
  }

  function hasInlineImage(el) {
    return !!el.querySelector('img, picture');
  }

  function hasCta(el) {
    return !!el.querySelector('a.btn, a.button, .cta, [class*="cta"], a[class*="link"]');
  }

  function nameEditorialBlock(el) {
    const prefix = purposePrefix(el);
    if (hasBackgroundImage(el)) {
      return prefix ? `${prefix}BackgroundImageBlock` : 'BackgroundImageFeatureBlock';
    }
    if (isHorizontalImageText(el)) {
      return prefix ? `${prefix}HorizontalFeatureBlock` : 'HorizontalFeatureBlock';
    }
    if (hasInlineImage(el)) {
      return prefix ? `${prefix}RichTextImageBlock` : 'RichTextImageBlock';
    }
    if (hasCta(el) && el.querySelector('h2, h3, p')) {
      return prefix ? `${prefix}CtaBlock` : 'RichTextCtaBlock';
    }
    if (prefix) return `${prefix}RichTextSection`;
    return 'RichTextSection';
  }

  function addComponent(el, cmsName, reason, type, extra = {}) {
    const bandSelectors = extra.bandSelectors?.filter(Boolean);
    if (!el || (!isVisible(el, type) && !bandSelectors?.length)) return null;
    const allowParent = extra.placeholderFor != null || extra.allowParentOfClaimed === true || !!extra.bandSelectors?.length;
    if (containsClaimed(el, { allowParentOfClaimed: allowParent })) return null;
    const selector = extra.bandSelectors?.[0] ?? buildSelector(el);
    if (!selector) return null;
    try {
      if (!extra.bandSelectors?.length && document.querySelector(selector) !== el) return null;
    } catch {
      return null;
    }

    const finalCmsName = uniqueCmsName(cmsName);
    if (!extra.bandSelectors?.length) claimed.add(el);
    if (extra.bandSelectors?.length) {
      for (const sel of extra.bandSelectors) {
        try {
          const node = document.querySelector(sel);
          if (node) claimed.add(node);
        } catch {
          /* invalid selector */
        }
      }
    }

    const title = extra.heading ?? headingText(el);

    return {
      cmsName: finalCmsName,
      folderName: toFolderName(finalCmsName),
      name: toFolderName(finalCmsName),
      selector,
      anchorWebid: anchorWebid(el),
      heading: title || null,
      reason,
      type,
      componentType: extra.componentType ?? type,
      scope: SITE_SCOPED_TYPES.has(type) ? 'site' : 'page',
      order: sections.length,
      source: 'visual-dom',
      bandSelectors: extra.bandSelectors ?? null,
      ...extra,
    };
  }

  function pushComponent(el, cmsName, reason, type, extra = {}) {
    const entry = addComponent(el, cmsName, reason, type, extra);
    if (entry) sections.push(entry);
    return entry;
  }

  function isStatsPanel(el) {
    return !!(
      el.querySelector('.jmtext--panel-temp, .text-panel-title') &&
      el.querySelector('.text-panel-body')
    );
  }

  function isSectionTitleRow(el) {
    const h = el.querySelector('h2, h3');
    if (!h) return false;
    const repeatSiblings = el.parentElement
      ? [...el.parentElement.children].filter((s) => classSignature(s) === classSignature(el)).length
      : 0;
    if (repeatSiblings >= 2) return false;
    const tileLike = el.querySelector(
      'img, picture, [class*="card"], .col-md-3, .col-md-4, .col-lg-4, [class*="tile"]'
    );
    if (tileLike && !el.querySelector('h2:only-child, h3:only-child')) return false;
    const textLen = el.textContent?.trim().length ?? 0;
    return textLen < 400 && !el.querySelector('.jmtext--panel-temp');
  }

  function findRepeatingTileGroup(container) {
    const rows = [
      ...container.querySelectorAll(
        ':scope > .container > .row, :scope > .row, :scope .panels-hero-panels > .container > .row, :scope .row'
      ),
    ];

    for (const row of rows) {
      const items = [...row.children].filter((el) => isVisible(el) && !isSectionTitleRow(el));
      if (items.length < 2) continue;

      const bySig = new Map();
      for (const el of items) {
        const sig = classSignature(el);
        if (!bySig.has(sig)) bySig.set(sig, []);
        bySig.get(sig).push(el);
      }

      for (const [, group] of bySig) {
        if (group.length < 2) continue;
        if (group.every(isStatsPanel)) {
          return {
            parent: container,
            repeatCount: group.length,
            grid: 'StatsBar',
            card: 'StatsItem',
            captureCardScreenshot: true,
          };
        }
        const cardType = group[0].querySelector('img, picture') ? 'VerticalTeaserCard' : 'HorizontalLinkCard';
        const grid = cardType === 'VerticalTeaserCard' ? 'VerticalTeaserGrid' : 'HorizontalLinkCardGrid';
        return {
          parent: container,
          repeatCount: group.length,
          grid,
          card: cardType,
          captureCardScreenshot: false,
        };
      }
    }
    return null;
  }

  function splitSubBands(el) {
    const direct = [...el.children].filter(
      (c) =>
        isVisible(c) &&
        (c.matches('.container, section, article, .lfr-layout-structure-item-container') ||
          c.getBoundingClientRect().height >= MIN_HEIGHT * 1.2)
    );
    if (direct.length >= 2) {
      const named = direct.filter((c) => headingText(c) || isHorizontalImageText(c) || hasBackgroundImage(c));
      if (named.length >= 2) return named;
    }

    const containers = [...el.querySelectorAll(':scope > .container')].filter(isVisible);
    if (containers.length >= 2) return containers;

    return null;
  }

  function classifyMainBand(bandEntry, index) {
    const el = bandEntry.el ?? bandEntry;
    const bandElements = bandEntry.bandElements ?? null;
    const bandHeading = bandEntry.bandHeading ?? null;

    if (classifyCorporateContentBand(bandEntry, index)) {
      return true;
    }

    if (classifySitecoreJssBand(el, index)) {
      return true;
    }

    if (bandElements?.length >= 1 && classifyAemBand({ el, bandElements, bandHeading, index })) {
      return true;
    }

    const subBands = splitSubBands(el);
    if (subBands && subBands.length >= 2 && el.getBoundingClientRect().height > MIN_HEIGHT * 3) {
      subBands.forEach((sub, i) => classifyMainBand(sub, index + i));
      return true;
    }

    const jssSubBands = splitSitecoreJssCombinedBand(el);
    if (jssSubBands && jssSubBands.length >= 2) {
      jssSubBands.forEach((sub, i) => classifyMainBand(sub, index + i));
      return true;
    }

    const repeat = findRepeatingTileGroup(el);
    if (repeat) {
      // Do not classify as a simple grid when this band is a composite hero (carousel + side panels).
      if (hasCarouselWidget(el) && el.querySelector('.panels-hero-panels, [class*="hero-panels"]')) {
        if (classifyCompositeHeroBand(el, bandHeading)) return true;
      }

      const prefix = purposePrefix(el);
      let gridName = repeat.grid;
      if (prefix) {
        if (repeat.grid === 'StatsBar') gridName = `${prefix}StatsBar`;
        else if (repeat.grid === 'VerticalTeaserGrid') gridName = `${prefix}TeaserGrid`;
        else if (repeat.grid === 'HorizontalLinkCardGrid') gridName = `${prefix}LinkGrid`;
      }

      pushComponent(
        repeat.parent,
        gridName,
        `${repeat.grid} with section title + ${repeat.repeatCount} repeated tiles`,
        repeat.grid === 'StatsBar' ? 'stats-bar' : 'grid',
        {
          placeholderFor: repeat.card,
          repeatCount: repeat.repeatCount,
          componentType: repeat.grid === 'StatsBar' ? 'StatsBar' : 'Grid',
          includesSectionTitle: true,
          fields: ['sectionTitle', 'sectionIntro', 'cards'],
        }
      );

      if (repeat.captureCardScreenshot) {
        const row = el.querySelector('.row');
        const tile = row ? [...row.children].find((c) => isVisible(c) && isStatsPanel(c)) : null;
        if (tile) {
          pushComponent(tile, repeat.card, `Representative ${repeat.card} tile`, 'card', {
            parentSection: gridName,
            componentType: 'Card',
            captureScreenshot: true,
          });
        }
      }
      return true;
    }

    const html = el.innerHTML.toLowerCase();

    if (hasCarouselWidget(el)) {
      if (el.querySelector('.panels-hero-panels, [class*="hero-panels"]')) {
        if (classifyCompositeHeroBand(el, bandHeading)) return true;
      }
      const prefix = purposeFromHeading(bandHeading) || purposePrefix(el);
      pushComponent(el, prefix ? `${prefix}HeroCarousel` : 'HeroCarousel', 'Carousel / hero slider', 'carousel', {
        componentType: 'Carousel',
        heading: bandHeading,
        bandSelectors: bandElements ? buildBandSelectors(bandElements) : null,
      });
      return true;
    }

    if (el.querySelector('h1') && index <= 1) {
      pushComponent(el, purposePrefix(el) ? `${purposePrefix(el)}HeroBanner` : 'HeroBanner', 'Primary hero with page title', 'hero', {
        componentType: 'Hero',
      });
      return true;
    }

    if (el.querySelector('.cmp-banner, [class*="cmp-banner"], .hero, [class*="hero-banner"]')) {
      pushComponent(
        el,
        purposePrefix(el) ? `${purposePrefix(el)}HeroBanner` : 'HeroBanner',
        'Hero / banner band with media and CTAs',
        'hero',
        { componentType: 'Hero', fields: ['title', 'body', 'image', 'cta'] }
      );
      return true;
    }

    if (el.querySelector('[class*="faq"], .cmp-faq')) {
      pushComponent(el, purposePrefix(el) ? `${purposePrefix(el)}FaqSection` : 'FaqSection', 'FAQ / accordion', 'faq-section', {
        componentType: 'RichText',
        heading: bandHeading,
        bandSelectors: bandElements ? buildBandSelectors(bandElements) : null,
      });
      return true;
    }

    if (
      !el.classList.contains('filteredpagelist') &&
      !el.querySelector('.cmp-page-list--content') &&
      el.querySelector('[class*="accordion"], details')
    ) {
      pushComponent(el, purposePrefix(el) ? `${purposePrefix(el)}FaqSection` : 'FaqSection', 'FAQ / accordion', 'faq-section', {
        componentType: 'RichText',
        heading: bandHeading,
        bandSelectors: bandElements ? buildBandSelectors(bandElements) : null,
      });
      return true;
    }

    if (el.querySelector('form') && el.querySelector('input, textarea, select, button[type="submit"]')) {
      pushComponent(el, 'FormSection', 'Form with inputs', 'form', { componentType: 'Form' });
      return true;
    }

    const blockName = nameEditorialBlock(el);
    if (
      hasBackgroundImage(el) ||
      isHorizontalImageText(el) ||
      hasInlineImage(el) ||
      (el.querySelector('h2, h3') && el.querySelector('p'))
    ) {
      pushComponent(el, blockName, `${blockName}: editorial content block`, 'feature-section', {
        componentType: 'RichText',
        fields: hasInlineImage(el) || hasBackgroundImage(el)
          ? ['title', 'body', 'image', 'cta']
          : ['title', 'body', 'cta'],
      });
      return true;
    }

    const title = headingText(el);
    if (title) {
      pushComponent(el, nameEditorialBlock(el), `Editorial: "${title.slice(0, 50)}"`, 'content-section', {
        componentType: 'RichText',
      });
      return true;
    }

    pushComponent(el, `ContentBlock${index + 1}`, 'Major full-width content band', 'content-section', {
      componentType: 'RichText',
    });
    return true;
  }

  function isSitecoreJssLayoutRoot(el) {
    if (!el || !(el instanceof Element)) return false;
    return (
      el.id === 'web-default-layout' ||
      el.matches('[id*="default-layout"]') ||
      (el.classList.contains('prod-mode') && !!el.querySelector('.flex-container.component'))
    );
  }

  function findSitecoreJssContentRoot(layout) {
    for (const child of layout.children) {
      if (!(child instanceof Element)) continue;
      if (child.tagName === 'HEADER' || child.tagName === 'FOOTER') continue;
      if (child.getBoundingClientRect().height >= MIN_HEIGHT * 4) return child;
    }
    return null;
  }

  function isSitecoreJssSectionBand(el) {
    if (!el || !(el instanceof Element) || !isVisible(el)) return false;
    if (el.tagName === 'HEADER' || el.tagName === 'FOOTER') return false;
    if (el.classList.contains('flex-container') && el.classList.contains('component')) return true;
    if (el.classList.contains('banner-hero')) return true;
    return false;
  }

  function isNestedSitecoreJssBand(el, container) {
    let parent = el.parentElement;
    while (parent && parent !== container) {
      if (isSitecoreJssSectionBand(parent)) return true;
      parent = parent.parentElement;
    }
    return false;
  }

  function discoverSitecoreJssBands(layout) {
    const contentRoot = findSitecoreJssContentRoot(layout);
    if (!contentRoot) return [];

    let scanRoot = contentRoot;
    if (
      contentRoot.children.length === 1 &&
      contentRoot.firstElementChild instanceof Element &&
      contentRoot.firstElementChild.classList.contains('flex-container') &&
      !contentRoot.firstElementChild.classList.contains('component')
    ) {
      scanRoot = contentRoot.firstElementChild;
    }

    const candidates = [
      ...scanRoot.querySelectorAll(':scope > .flex-container.component, :scope > .component.banner-hero'),
    ].filter((el) => {
      if (el.querySelector('.breadcrumb')) {
        return isVisible(el, 'breadcrumb') && el.getBoundingClientRect().height >= 20;
      }
      return (
        isVisible(el) &&
        (el.getBoundingClientRect().height >= MIN_HEIGHT * 1.5 || el.querySelector('.banner-hero'))
      );
    }).filter((el) => !isNestedSitecoreJssBand(el, scanRoot));

    const bands = [];
    for (const band of candidates) {
      const dominated = bands.some((existing) => existing.contains(band));
      if (dominated) continue;
      const childIdx = bands.findIndex((existing) => band.contains(existing));
      if (childIdx >= 0) bands[childIdx] = band;
      else bands.push(band);
    }

    const flattened = [];
    for (const band of bands) {
      const inner = [...band.querySelectorAll(':scope > .flex-container.component')].filter(
        (node) => isVisible(node) && node.getBoundingClientRect().height >= MIN_HEIGHT * 2
      );
      if (inner.length >= 2) flattened.push(...inner);
      else flattened.push(band);
    }

    const leafBands = flattened.filter(
      (el, index, arr) => !arr.some((other, otherIndex) => index !== otherIndex && el.contains(other))
    );

    return leafBands.map((el) => ({ el }));
  }

  function isCardVisible(el) {
    if (!el || !(el instanceof Element)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width >= 48 && rect.height >= 24;
  }

  function countSitecoreJssEventCards(el, excludeSubtree = null) {
    return [...el.querySelectorAll('.component.flex-item')].filter((card) => {
      if (excludeSubtree?.contains(card)) return false;
      if (!isCardVisible(card)) return false;
      const cls = [...card.classList].join(' ');
      return /col-6|col-4|col-3|lg:col-2|rai-lg-col-2/.test(cls);
    }).length;
  }

  function countSitecoreJssNewsCards(el) {
    return [...el.querySelectorAll(
      '[class*="news_card"], .tile-rai-variant-container, [class*="newscard"], [class*="news-card"]'
    )].filter((card) => isCardVisible(card)).length;
  }

  function splitSitecoreJssCombinedBand(el) {
    const nestedBands = [...el.querySelectorAll(':scope > .flex-container.component, :scope > .component.flex-item.title')]
      .filter((node) => isVisible(node) && node.getBoundingClientRect().height >= MIN_HEIGHT);

    const sectionBands = [...el.querySelectorAll(':scope > .flex-container.component')].filter(
      (node) => isVisible(node) && node.getBoundingClientRect().height >= MIN_HEIGHT * 1.5
    );
    if (sectionBands.length >= 2) return sectionBands.map((node) => ({ el: node }));

    const titleMarker = el.querySelector(':scope .component.title.h4-title, :scope .component.flex-item.title');
    if (titleMarker && countSitecoreJssEventCards(el) >= 3) {
      const eventWrapper = titleMarker.closest('.flex-container.component') || el;
      const newsWrapper =
        titleMarker.parentElement?.closest('.flex-container.component.basis-full') ||
        titleMarker.parentElement?.closest('.flex-container.component') ||
        null;
      if (newsWrapper && newsWrapper !== eventWrapper && newsWrapper !== el) {
        return [{ el: eventWrapper }, { el: newsWrapper }];
      }
      if (titleMarker.parentElement && titleMarker.parentElement !== el) {
        return [{ el }, { el: titleMarker.parentElement.closest('.flex-container.component') || titleMarker.parentElement }];
      }
    }

    return null;
  }

  function sitecoreJssSectionHeading(el, { preferNews = false } = {}) {
    const titles = [
      ...el.querySelectorAll(
        ':scope .component.title.h4-title, :scope .component.flex-item.title, :scope > .component.title, :scope h2, :scope h4'
      ),
    ];
    for (const titleEl of titles) {
      const text = titleEl.textContent?.trim() ?? '';
      if (!text) continue;
      const isNews = /news|article|nieuws/i.test(text);
      if (preferNews && isNews) return text.slice(0, 80);
      if (!preferNews && !isNews) return text.slice(0, 80);
    }
    return titles[0]?.textContent?.trim().slice(0, 80) ?? headingText(el);
  }

  function findNewsBand(eventsBand, newsTitle) {
    if (!eventsBand || !newsTitle) return null;
    const candidates = [
      newsTitle.closest('.flex-container.component.basis-full'),
      newsTitle.closest('.component.flex-item.col-12.pb-12'),
      newsTitle.closest('.flex-container.basis-full'),
      newsTitle.closest('.component.col-12'),
    ].filter(Boolean);

    for (const candidate of candidates) {
      if (candidate === eventsBand || !eventsBand.contains(candidate)) continue;
      if (countSitecoreJssEventCards(candidate) >= 2) continue;
      return candidate;
    }
    return null;
  }

  function findInnermostComponentBand(ancestor, marker) {
    if (!ancestor || !marker) return null;
    let node = marker.parentElement;
    let best = null;
    while (node && node !== ancestor) {
      if (node.classList?.contains('flex-container') && node.classList?.contains('component')) {
        best = node;
      }
      node = node.parentElement;
    }
    return best;
  }

  function findSitecoreJssNewsTitle(el) {
    return [...el.querySelectorAll('.component.title.h4-title, .component.flex-item.title')].find((titleEl) =>
      /news|article|nieuws/i.test(titleEl.textContent ?? '')
    );
  }

  function collectSitecoreJssNodesBefore(marker, root) {
    const nodes = [...root.querySelectorAll('.component.flex-item, .component.title, .flex-container.component')];
    return nodes.filter(
      (node) =>
        node !== marker &&
        !marker.contains(node) &&
        (marker.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    );
  }

  function collectSitecoreJssNodesFrom(marker, root) {
    const nodes = [...root.querySelectorAll('.component.flex-item, .component.title, .flex-container.component')];
    return nodes.filter(
      (node) =>
        node === marker ||
        marker.contains(node) ||
        (marker.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    );
  }

  function findEventDetailInfoMarker(el) {
    return [...el.querySelectorAll('h2, h3, h4, strong')].find((node) =>
      /opening hours|^location$|ticket info|entrance|organisation|organization/i.test(
        (node.textContent ?? '').trim()
      )
    );
  }

  function isCalendarListingBand(el) {
    if (countSitecoreJssEventCards(el) >= 3) return false;
    if (findSitecoreJssNewsTitle(el)) return false;
    if (el.querySelector('.banner-hero, .banner.banner-hero')) return false;
    if (el.querySelector('.breadcrumb') && !el.querySelector('a[href*="/calendar/"]')) {
      return false;
    }
    if (
      el.querySelector(
        '.filteredpagelist, [class*="filteredpagelist"], [class*="page-list"], [class*="calendar-list"]'
      )
    ) {
      return true;
    }
    const calendarLinks = [...el.querySelectorAll('a[href*="/calendar/"]')].filter((a) => {
      const href = a.getAttribute('href') ?? '';
      return (href.match(/\//g) ?? []).length >= 3;
    });
    if (calendarLinks.length >= 2) return true;
    if (calendarLinks.length >= 1 && el.getBoundingClientRect().height >= MIN_HEIGHT * 8) return true;
    if (/loading/i.test(el.textContent ?? '') && el.getBoundingClientRect().height >= MIN_HEIGHT * 8) {
      return true;
    }
    return false;
  }

  function classifySitecoreJssBand(el, index) {
    if (el.querySelector('.breadcrumb, [class*="breadcrumb"]') && !el.querySelector('.banner-hero, h1')) {
      pushComponent(el, 'Breadcrumb', 'Breadcrumb navigation', 'breadcrumb', { componentType: 'Navigation' });
      return true;
    }

    if (el.querySelector('.banner-hero, .banner.banner-hero, [class*="banner-hero"]')) {
      const isEventDetail =
        el.querySelector('h1') &&
        (el.querySelector('.btn, [class*="btn-"], a[class*="button"]') ||
          el.textContent?.toLowerCase().includes('ticket'));
      if (isEventDetail) {
        pushComponent(el, 'EventDetailHeroSection', 'Event detail hero with title, dates, and CTAs', 'hero', {
          componentType: 'Hero',
          fields: ['title', 'dateRange', 'description', 'primaryCta', 'secondaryCta', 'image'],
        });
      } else {
        pushComponent(el, 'HeroBanner', 'Hero banner with background image', 'hero', {
          componentType: 'Hero',
          fields: ['title', 'subtitle', 'image', 'cta'],
        });
      }
      return true;
    }

    if (el.querySelector('.filteredpagelist, [class*="filteredpagelist"], [class*="page-list"]')) {
      pushComponent(el, 'CalendarListingSection', 'Calendar / filtered event listing', 'listing', {
        componentType: 'Listing',
        placeholderFor: 'EventListCard',
        fields: ['title', 'cards'],
      });
      return true;
    }

    if (isCalendarListingBand(el) && !el.querySelector('h1')) {
      const calendarLinks = el.querySelectorAll('a[href*="/calendar/"]');
      pushComponent(
        el,
        'CalendarListingSection',
        `Calendar listing (${calendarLinks.length} event links)`,
        'listing',
        {
          componentType: 'Listing',
          placeholderFor: 'EventListCard',
          fields: ['title', 'cards'],
        }
      );
      return true;
    }

    const heading = sitecoreJssSectionHeading(el);
    const eventCardCount = countSitecoreJssEventCards(el);
    const newsCardCount = countSitecoreJssNewsCards(el);
    const newsHeading = sitecoreJssSectionHeading(el, { preferNews: true });
    const embeddedNewsTitle = findSitecoreJssNewsTitle(el);
    const embeddedNewsBand = embeddedNewsTitle ? findNewsBand(el, embeddedNewsTitle) : null;

    if (embeddedNewsTitle && el.contains(embeddedNewsTitle)) {
      const newsBandNodes = collectSitecoreJssNodesFrom(embeddedNewsTitle, el);
      const eventBandNodes = collectSitecoreJssNodesBefore(embeddedNewsTitle, el);
      const eventsOnlyCount = countSitecoreJssEventCards(el, embeddedNewsBand);

      if (eventsOnlyCount >= 3) {
        const eventsHeading = sitecoreJssSectionHeading(el, { preferNews: false });
        const prefix = purposeFromHeading(eventsHeading) || 'UpcomingEvents';
        pushComponent(el, `${prefix}TeaserGrid`, `Events list with ${eventsOnlyCount} cards`, 'grid', {
          placeholderFor: 'EventListCard',
          repeatCount: eventsOnlyCount,
          componentType: 'Grid',
          includesSectionTitle: true,
          heading: eventsHeading,
          bandSelectors: buildBandSelectors(eventBandNodes),
          allowParentOfClaimed: true,
          fields: ['title', 'subtitle', 'allEventsLink', 'cards'],
        });
      }

      if (newsCardCount >= 2 || /news|article|nieuws/i.test(newsHeading)) {
        const prefix = purposeFromHeading(newsHeading) || 'NewsArticles';
        pushComponent(
          embeddedNewsBand ?? el,
          `${prefix}Section`,
          `News articles section (${newsCardCount || 'multiple'} cards)`,
          'grid',
          {
            placeholderFor: 'NewsArticleCard',
            repeatCount: newsCardCount || 3,
            componentType: 'Grid',
            includesSectionTitle: true,
            heading: newsHeading,
            bandSelectors: buildBandSelectors(newsBandNodes),
            allowParentOfClaimed: true,
            fields: ['title', 'cards'],
          }
        );
      }
      return true;
    }

    if (eventCardCount >= 3) {
      const eventsHeading = sitecoreJssSectionHeading(el, { preferNews: false });
      const prefix = purposeFromHeading(eventsHeading) || 'UpcomingEvents';
      pushComponent(el, `${prefix}TeaserGrid`, `Events list with ${eventCardCount} cards`, 'grid', {
        placeholderFor: 'EventListCard',
        repeatCount: eventCardCount,
        componentType: 'Grid',
        includesSectionTitle: true,
        heading: eventsHeading,
        fields: ['title', 'subtitle', 'allEventsLink', 'cards'],
      });
      return true;
    }

    if (newsCardCount >= 2 || /news|article|nieuws/i.test(newsHeading)) {
      const prefix = purposeFromHeading(newsHeading) || 'NewsArticles';
      pushComponent(el, `${prefix}Section`, `News articles section (${newsCardCount || 'multiple'} cards)`, 'grid', {
        placeholderFor: 'NewsArticleCard',
        repeatCount: newsCardCount || 3,
        componentType: 'Grid',
        includesSectionTitle: true,
        heading: newsHeading,
        fields: ['title', 'cards'],
      });
      return true;
    }

    if (el.querySelector('h1') && findEventDetailInfoMarker(el)) {
      const infoMarker = findEventDetailInfoMarker(el);
      const heroNodes = collectSitecoreJssNodesBefore(infoMarker, el);
      if (el.querySelector('h1') && !heroNodes.includes(el.querySelector('h1'))) {
        heroNodes.unshift(el.querySelector('h1'));
      }
      const infoRoot =
        infoMarker.closest('.component.flex-item.col-12') ||
        infoMarker.closest('.flex-container.component') ||
        infoMarker.parentElement;
      const infoNodes = infoRoot
        ? [infoRoot, ...infoRoot.querySelectorAll('.component.flex-item, h3, h4, p, dl')]
        : [infoMarker];
      pushComponent(el, 'EventDetailHeroSection', 'Event detail hero with title, dates, and CTAs', 'hero', {
        componentType: 'Hero',
        bandSelectors: buildBandSelectors(heroNodes),
        fields: ['title', 'dateRange', 'description', 'primaryCta', 'secondaryCta', 'image'],
      });
      pushComponent(infoRoot ?? el, 'EventDetailInfoSection', 'Event detail info blocks (hours, location, tickets)', 'info', {
        componentType: 'RichText',
        bandSelectors: buildBandSelectors(infoNodes),
        allowParentOfClaimed: true,
        fields: ['openingHours', 'location', 'ticketInfo'],
      });
      return true;
    }

    if (el.querySelector('h1') && !el.querySelector('.banner-hero')) {
      pushComponent(el, 'EventDetailHeroSection', 'Event detail hero with title, dates, and CTAs', 'hero', {
        componentType: 'Hero',
        fields: ['title', 'dateRange', 'description', 'primaryCta', 'secondaryCta', 'image'],
      });
      return true;
    }

    if (
      el.querySelector('h2, h3') &&
      (el.querySelector('[class*="opening"], [class*="location"], [class*="ticket"]') ||
        el.textContent?.toLowerCase().includes('opening hours'))
    ) {
      pushComponent(el, 'EventDetailInfoSection', 'Event detail info blocks (hours, location, tickets)', 'info', {
        componentType: 'RichText',
        fields: ['openingHours', 'location', 'ticketInfo'],
      });
      return true;
    }

    return false;
  }

  function findMainLandmark() {
    const scoped = [
      document.querySelector('#Page > main'),
      document.querySelector('#page > main'),
      document.querySelector('#root > main'),
      document.querySelector('#__next > main'),
      document.querySelector('#web-default-layout'),
      document.querySelector('[id*="default-layout"]'),
      document.querySelector('.cmp-container.root'),
      document.querySelector('.root.responsivegrid'),
      document.querySelector('#main-content'),
      document.querySelector('.maincontent'),
      document.querySelector('[class*="maincontent"]'),
    ].filter(Boolean);

    const all = [
      ...scoped,
      ...document.querySelectorAll('main, [role="main"]'),
    ].filter((el, i, arr) => el instanceof Element && arr.indexOf(el) === i);

    if (!all.length) return null;

    // Prefer the largest visible content column (some sites mount empty <main> shells).
    let best = null;
    let bestArea = -1;
    for (const el of all) {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const childBands = [...el.children].filter(
        (c) => c instanceof Element && c.getBoundingClientRect().height >= MIN_HEIGHT
      ).length;
      const area = Math.max(rect.height, 0) * Math.max(rect.width, 0) + childBands * 50000;
      if (area > bestArea) {
        bestArea = area;
        best = el;
      }
    }
    return best || all[0];
  }

  function viewportWidth() {
    return window.innerWidth || document.documentElement.clientWidth || 1440;
  }

  function pageScrollHeight() {
    return Math.max(
      document.documentElement.scrollHeight || 0,
      document.body?.scrollHeight || 0,
      1
    );
  }

  function isChromeishTag(el) {
    const tag = el.tagName.toLowerCase();
    return tag === 'script' || tag === 'style' || tag === 'link' || tag === 'noscript' || tag === 'template' || tag === 'svg';
  }

  function isFullBleedBand(el, minHeight = MIN_HEIGHT * 0.75) {
    if (!el || !(el instanceof Element) || isChromeishTag(el)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    const vw = viewportWidth();
    if (rect.height < minHeight) return false;
    if (rect.width < Math.min(MIN_WIDTH, vw * 0.55)) return false;
    return rect.width >= vw * 0.7;
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
        if (siblings.length > 1) {
          part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
        }
      } else if (node === document.documentElement) {
        parts.unshift('html');
        break;
      }
      parts.unshift(part);
      node = parent;
      if (node === document.body) {
        parts.unshift('body');
        break;
      }
    }
    const sel = parts.join(' > ');
    try {
      if (document.querySelector(sel) === el) return sel;
    } catch {
      return null;
    }
    return sel;
  }

  function unwrapPassthrough(el, depth = 0) {
    if (!el || !(el instanceof Element) || depth > 4) return el;
    const kids = [...el.children].filter((c) => c instanceof Element && !isChromeishTag(c) && isVisible(c));
    if (kids.length !== 1) return el;
    const child = kids[0];
    const er = el.getBoundingClientRect();
    const cr = child.getBoundingClientRect();
    if (cr.height < er.height * 0.82 || cr.width < er.width * 0.82) return el;
    if (el.querySelector(':scope > h1, :scope > h2, :scope > h3')) return el;

    const childNamed = nameFromClassTokens(child);
    const parentNamed = nameFromClassTokens(el);
    // Prefer a distinctly named CMS component child over a generic slice/container wrapper.
    if (childNamed && (!parentNamed || /slice|container|wrapper|zone|normalized/i.test(String(el.className || '')))) {
      return unwrapPassthrough(child, depth + 1);
    }

    const cls = String(el.className || '');
    const wrapperish =
      /^(div|section|article)$/i.test(el.tagName) &&
      (!cls ||
        /slice|container|wrapper|zone|layout|content|region|inner|outer|normalized|page|root/i.test(cls));
    if (!wrapperish) return el;
    return unwrapPassthrough(child, depth + 1);
  }

  function scoreBandStack(children) {
    const pageH = pageScrollHeight();
    const vw = viewportWidth();
    const metrics = children
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const top = rect.top + window.scrollY;
        return { el, width: rect.width, height: rect.height, top, bottom: top + rect.height };
      })
      .filter((m) => m.height >= 36);

    if (metrics.length < 2) {
      return { score: 0, count: metrics.length, coverage: 0, midRatio: 0 };
    }

    const count = metrics.length;
    const totalBandH = metrics.reduce((sum, m) => sum + m.height, 0);
    const coverage = Math.min(1, totalBandH / pageH);
    const mid = metrics.filter((m) => m.height >= 120 && m.height <= 1400).length;
    const midRatio = mid / count;
    const fullBleed = metrics.filter((m) => m.width >= vw * 0.7).length / count;
    const giant = metrics.filter((m) => m.height > pageH * 0.55).length;

    let countScore = 0.15;
    if (count >= 5 && count <= 16) countScore = 1;
    else if (count >= 4 && count <= 20) countScore = 0.75;
    else if (count >= 3 && count <= 24) countScore = 0.45;

    const sorted = [...metrics].sort((a, b) => a.top - b.top);
    let overlapPenalty = 0;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].top < sorted[i - 1].bottom - 48) overlapPenalty += 0.05;
    }

    const heightBuckets = new Map();
    for (const m of metrics) {
      const key = Math.round(m.height / 50) * 50;
      heightBuckets.set(key, (heightBuckets.get(key) || 0) + 1);
    }
    let dupPenalty = 0;
    for (const n of heightBuckets.values()) {
      if (n >= 4) dupPenalty += 0.12 * (n - 3);
    }

    const score =
      countScore * 35 +
      coverage * 25 +
      midRatio * 25 +
      fullBleed * 15 -
      giant * 18 -
      overlapPenalty * 12 -
      dupPenalty * 22;

    return { score, count, coverage, midRatio, fullBleed };
  }

  function collectStackChildren(root, { allowShortChrome = true } = {}) {
    return [...root.children].filter((el) => {
      if (!(el instanceof Element) || isChromeishTag(el)) return false;
      const tag = el.tagName.toLowerCase();
      const cls = String(el.className || '');
      const role = el.getAttribute('role') || '';
      const rect = el.getBoundingClientRect();
      const isLandmark =
        tag === 'header' ||
        tag === 'footer' ||
        tag === 'main' ||
        tag === 'nav' ||
        role === 'main' ||
        role === 'banner' ||
        role === 'contentinfo' ||
        /footer|header|nav|menu|contentzone|MainHeader/i.test(cls);

      if (isLandmark) {
        if (allowShortChrome && (tag === 'header' || tag === 'nav' || /menu|header|ContentZone/i.test(cls))) {
          const hasHeaderChrome = !!el.querySelector(
            '.MainHeaderV2, [class*="MainHeader"], nav, [class*="Header"], [role="navigation"]'
          );
          return rect.width >= MIN_WIDTH * 0.5 && (rect.height >= 24 || hasHeaderChrome);
        }
        return (rect.height >= 40 || el.scrollHeight >= 40) && rect.width >= MIN_WIDTH * 0.5;
      }

      return isFullBleedBand(el);
    });
  }

  function classifyStackChildRole(el, index, total) {
    const tag = el.tagName.toLowerCase();
    const cls = String(el.className || '');
    const role = el.getAttribute('role') || '';
    const rect = el.getBoundingClientRect();
    const top = rect.top + window.scrollY;
    const pageH = pageScrollHeight();

    if (tag === 'main' || role === 'main') return 'main';
    if (tag === 'footer' || role === 'contentinfo' || /ContentZone__footer|(^|[\s_-])footer([\s_-]|$)/i.test(cls)) {
      return 'footer';
    }
    if (
      tag === 'nav' ||
      /ContentZone__menu|MainHeader|site-header|global-header|page-header|main-nav/i.test(cls) ||
      (role === 'banner' && rect.height < 280)
    ) {
      return 'header';
    }
    if (index === 0 && rect.height < 220 && top < 180) return 'header';
    if (tag === 'header' && rect.height >= 360 && top < 480) return 'hero';
    if (tag === 'header' && rect.height < 280) return 'header';
    if (index <= 2 && rect.height >= 420 && top < 240) return 'hero';
    if (top > pageH * 0.78 && (/footer|legal/i.test(cls) || index >= total - 1)) return 'footer';
    return 'content';
  }

  function nameFromClassTokens(el) {
    const childClassBlob = [...el.children]
      .slice(0, 4)
      .map((c) => String(c.className || ''))
      .join(' ');
    const blob = `${el.className || ''} ${el.id || ''} ${childClassBlob}`;
    const tokenMap = [
      [/MainHeader|site-header|global-header|ContentZone__menu/i, 'Header'],
      [/ContentZone__pageHeader|HeroEditorial|SliderTransition/i, 'HeroCarousel'],
      [/ContentZone__footer|(^|[\s_-])footer([\s_-]|$)/i, 'Footer'],
      [/carousel|swiper|slider|slick/i, 'HeroCarousel'],
      [/CtaBar|cta-bar|QuickLink|shortcut-bar|HorizontalCta/i, 'HorizontalCtaBar'],
      [/ActionBanner|action-banner|PromoBanner/i, 'ActionBanner'],
      [/PromoCard|promo-card|PromoCards/i, 'PromoCards'],
      [/RevealTitle|reveal-title/i, 'RevealTitle'],
      [/NewFeaturePromo|FeaturePromo|feature-promo/i, 'NewFeaturePromo'],
      [/Newsletter|newsletter|SubscribePush/i, 'NewsletterPush'],
      [/Accordeon|Accordion/i, 'AccordionIntro'],
      [/ServicesCard|ServiceCard|services-card/i, 'ServicesCards'],
      [/TilesSection|MediaSection|RecommendationsSection|AssetSignpost|ContentLockup/i, null], // handled below via class
    ];
    for (const [re, name] of tokenMap) {
      if (name && re.test(blob)) return name;
    }

    const utility =
      /^(gap-|bg-|text-|p-|m-|px-|py-|pt-|pb-|mt-|mb-|flex|grid|w-|h-|min-|max-|col-|row|space-|items-|justify-|rounded|shadow|border|font-|leading-|tracking-|opacity-|from-|to-|via-|sm:|md:|lg:|xl:|is-|js-|css-|normalized|slice|container|wrapper|inner|outer|sc-)/i;
    const styledHash = /^(sc-)|^[a-z]{0,3}[A-Z][a-z]{2,6}$/; // e.g. Dayhbb, Gxugqa
    for (const c of el.classList) {
      if (!c || c.length < 4 || c.length > 48) continue;
      if (utility.test(c) || styledHash.test(c)) continue;
      if (/EditableComponent|Styled[A-Z]/i.test(c)) continue;
      if (/[A-Z]/.test(c) || /[-_]/.test(c)) {
        const name = toPascalCase(c.replace(/__/g, '-').replace(/^sc-[a-z]+/i, ''));
        if (name.length >= 4 && name.length <= 48 && !/^(Gap|Bg|Text|Flex|Grid)/.test(name)) return name;
      }
    }
    return null;
  }

  function nameLayoutBand(el, role, index) {
    if (role === 'header') return 'Header';
    if (role === 'footer') return 'Footer';

    const fromClass = nameFromClassTokens(el);
    const title = headingText(el);
    const fromHeading = title ? toPascalCase(title.split(/\s+/).slice(0, 5).join(' ')) : '';
    const strongClass =
      fromClass &&
      /^(Header|Footer|Hero|Promo|Action|Newsletter|Accordion|Services|Cta|Reveal|NewFeature|Tiles|Media|Recommendations|Asset|ContentLockup|Horizontal)/i.test(
        fromClass
      );

    if (role === 'hero') {
      if (strongClass && /carousel|hero|slider/i.test(fromClass)) return fromClass;
      if (
        hasCarouselWidget(el) ||
        el.querySelector('[class*="slide"], [aria-roledescription="carousel"], .SliderTransition, .HeroEditorial')
      ) {
        return 'HeroCarousel';
      }
      return fromHeading || (strongClass ? fromClass : null) || 'HeroBanner';
    }

    // Prefer known CMS tokens, then headings, then other class tokens.
    if (strongClass) return fromClass;
    if (fromHeading) return fromHeading;
    if (fromClass && !/^(Gap|Bg|Text|Flex|Grid|Overflow|ContentBand)/i.test(fromClass) && fromClass.length > 8) {
      return fromClass;
    }
    return fromHeading || `ContentBand${index + 1}`;
  }

  function expandMainColumn(mainEl) {
    const kids = [...mainEl.children].filter((c) => {
      if (!(c instanceof Element) || isChromeishTag(c)) return false;
      if (!isVisible(c) && !isFullBleedBand(c, 48)) return false;
      return c.getBoundingClientRect().height >= MIN_HEIGHT * 0.85;
    });
    return kids.length >= 2 ? kids : [mainEl];
  }

  function pushLayoutBand(el, role, index) {
    const target = unwrapPassthrough(el);
    const structural = buildStructuralSelector(target);
    const cmsName = nameLayoutBand(target, role, index);

    if (role === 'header') {
      return pushComponent(target, 'Header', 'Site header / menu chrome', 'header', {
        componentType: 'Header',
        visualRole: 'Site chrome',
        bandSelectors: structural ? [structural] : null,
        allowParentOfClaimed: true,
      });
    }
    if (role === 'footer') {
      return pushComponent(target, 'Footer', 'Site footer with links and legal', 'footer', {
        componentType: 'Footer',
        visualRole: 'Site-wide footer',
        bandSelectors: structural ? [structural] : null,
        allowParentOfClaimed: true,
      });
    }

    // Layout bands are already CMS units — do not re-split into nested landmarks/cards.
    let type = 'content-section';
    let componentType = 'RichText';
    let reason = 'Full-bleed layout content band';
    if (role === 'hero' || hasCarouselWidget(target) || target.querySelector('[aria-roledescription="carousel"], .SliderTransition, .CustomScroll__child')) {
      type = hasCarouselWidget(target) || target.querySelector('.SliderTransition, [aria-roledescription="carousel"]') ? 'carousel' : 'hero';
      componentType = type === 'carousel' ? 'Carousel' : 'Hero';
      reason = 'Hero / carousel layout band';
    } else if (target.querySelector('[class*="accordion"], details, [class*="Accordion"]')) {
      type = 'faq-section';
      componentType = 'RichText';
      reason = 'Accordion / intro layout band';
    } else if (findRepeatingTileGroup(target)) {
      type = 'grid';
      componentType = 'Grid';
      reason = 'Card / teaser grid layout band';
    }

    return pushComponent(target, cmsName, reason, type, {
      componentType,
      bandSelectors: structural ? [structural] : null,
      allowParentOfClaimed: true,
      heading: headingText(target) || null,
    });
  }

  /**
   * Layout-first partition: find a vertical stack of full-bleed siblings
   * (page shell / main children / landmark siblings) and treat those as CMS bands.
   */
  function discoverLayoutPartition() {
    /** @type {Array<{ root: Element, children: Element[], score: number, count: number, coverage: number, kind: string }>} */
    const candidates = [];
    const seen = new Set();

    const seeds = [
      document.querySelector('#Page'),
      document.querySelector('#page'),
      document.querySelector('#root'),
      document.querySelector('#__next'),
      document.querySelector('[data-page]'),
      document.querySelector('[class*="PageWrapper"]'),
      document.querySelector('[class*="page-wrapper"]'),
      document.body,
    ].filter(Boolean);

    let climb = findMainLandmark();
    for (let i = 0; i < 6 && climb; i++) {
      seeds.push(climb);
      climb = climb.parentElement;
    }

    for (const root of seeds) {
      if (!root || seen.has(root)) continue;
      seen.add(root);
      const children = collectStackChildren(root);
      if (children.length < 2) continue;
      // Score the expanded page composition (chrome + main bands), not only shell shells.
      const expandedForScore = [];
      for (const child of children) {
        if (child.tagName === 'MAIN' || child.getAttribute('role') === 'main') {
          const kids = expandMainColumn(child);
          if (kids.length >= 2) expandedForScore.push(...kids);
          else expandedForScore.push(child);
        } else {
          expandedForScore.push(child);
        }
      }
      const scored = scoreBandStack(expandedForScore.length >= children.length ? expandedForScore : children);
      // Prefer real page shells (#Page etc.) over nested landmark stacks.
      const shellBonus =
        root.id === 'Page' || root.id === 'page' || root.id === 'root' || root.id === '__next' ? 12 : 4;
      candidates.push({
        root,
        children,
        kind: 'shell',
        ...scored,
        score: scored.score + shellBonus,
      });
    }

    const main = findMainLandmark();
    if (main) {
      const mainKids = collectStackChildren(main, { allowShortChrome: false }).filter((el) => {
        const tag = el.tagName.toLowerCase();
        return tag !== 'header' && tag !== 'footer' && tag !== 'nav';
      });
      // Also accept plain visible full-width children even if slightly inset.
      const looseKids = [...main.children].filter(
        (c) =>
          c instanceof Element &&
          !isChromeishTag(c) &&
          isVisible(c) &&
          c.getBoundingClientRect().height >= MIN_HEIGHT * 0.9 &&
          c.getBoundingClientRect().width >= viewportWidth() * 0.55
      );
      const kids =
        looseKids.length >= 3 ? looseKids : mainKids.length >= looseKids.length ? mainKids : looseKids;
      if (kids.length >= 2) {
        const scored = scoreBandStack(kids);
        candidates.push({
          root: main,
          children: kids,
          kind: 'main-children',
          ...scored,
          score: scored.score + 8,
        });
      }
    }

    // Landmark sibling stacks (Sitecore/BBC-style authored <section> bands).
    const landmarkParents = new Map();
    const landmarkRoots = main
      ? [main, ...document.querySelectorAll('#content, [role="main"]')]
      : [...document.querySelectorAll('main, #content, [role="main"]')];
    for (const scope of new Set(landmarkRoots.filter(Boolean))) {
      for (const sec of scope.querySelectorAll(':scope > section, :scope > article, :scope > [role="region"]')) {
        if (!isVisible(sec) || sec.getBoundingClientRect().height < MIN_HEIGHT) continue;
        const h = sec.getBoundingClientRect().height;
        if (h > pageScrollHeight() * 0.65) continue;
        if (!landmarkParents.has(scope)) landmarkParents.set(scope, []);
        landmarkParents.get(scope).push(sec);
      }
    }
    // Fallback: nested sections under the largest main when direct children aren't sections.
    if (main && (landmarkParents.get(main)?.length || 0) < 3) {
      const nested = [...main.querySelectorAll('section, article')].filter((sec) => {
        if (!isVisible(sec) || sec.getBoundingClientRect().height < MIN_HEIGHT) return false;
        if (sec.getBoundingClientRect().height > pageScrollHeight() * 0.55) return false;
        let depth = 0;
        for (let n = sec.parentElement; n && n !== main; n = n.parentElement) depth += 1;
        return depth <= 4;
      });
      const byParent = new Map();
      for (const sec of nested) {
        const p = sec.parentElement;
        if (!p) continue;
        if (!byParent.has(p)) byParent.set(p, []);
        byParent.get(p).push(sec);
      }
      for (const [parent, secs] of byParent) {
        if (secs.length >= 3) landmarkParents.set(parent, secs);
      }
    }
    for (const [parent, secs] of landmarkParents) {
      const unique = [...new Set(secs)];
      if (unique.length < 3) continue;
      const direct = [...parent.children].filter(
        (c) =>
          c instanceof Element &&
          (c.matches('section, article, [role="region"]') || unique.includes(c)) &&
          isVisible(c) &&
          c.getBoundingClientRect().height >= MIN_HEIGHT
      );
      const stack = direct.length >= Math.min(3, unique.length) ? direct : unique;
      if (stack.length < 3) continue;
      // Penalize stacks of repeated same-size carousel/card slides (e.g. many PromoCard).
      const scored = scoreBandStack(stack);
      const sameClass = stack.every(
        (el) => el.classList?.[0] && el.classList[0] === stack[0].classList[0]
      );
      const penalty = sameClass && stack.length >= 4 ? 18 : 0;
      candidates.push({
        root: parent,
        children: stack,
        kind: 'landmark-stack',
        ...scored,
        score: scored.score - penalty,
      });
    }

    // Deep sibling stacks: styled-component / nested CMS roots where bands are
    // not direct children of main (e.g. Volkswagen EditableComponent columns).
    if (main) {
      const deepSeen = new Set();
      for (const el of main.querySelectorAll('div, section, article')) {
        if (el.childElementCount < 4) continue;
        const hostH = el.getBoundingClientRect().height;
        if (hostH < 900 || hostH > pageScrollHeight() * 0.98) continue;
        if (deepSeen.has(el)) continue;
        deepSeen.add(el);
        const kids = [...el.children].filter((c) => {
          if (!(c instanceof Element) || isChromeishTag(c)) return false;
          const r = c.getBoundingClientRect();
          return r.height >= 150 && r.width >= viewportWidth() * 0.55;
        });
        if (kids.length < 4) continue;
        const scored = scoreBandStack(kids);
        if (scored.midRatio < 0.5 || scored.score < 28) continue;
        candidates.push({
          root: el,
          children: kids,
          kind: 'deep-stack',
          ...scored,
          score: scored.score + 6,
        });
      }
    }

    candidates.sort((a, b) => b.score - a.score || b.count - a.count);
    if (!candidates.length || candidates[0].score < 26) return null;

    const best = candidates[0];
    /** @type {Array<{ el: Element, role: string }>} */
    const bands = [];

    if (best.kind === 'main-children' || best.kind === 'landmark-stack' || best.kind === 'deep-stack') {
      const headerCandidate =
        document.querySelector('section.ContentZone__menu, .MainHeaderV2, header[role="banner"], [role="banner"]') ||
        document.querySelector('header');
      if (headerCandidate && isVisible(headerCandidate, 'header')) {
        const headerRole = classifyStackChildRole(headerCandidate, 0, 3);
        bands.push({
          el: headerRole === 'hero' ? headerCandidate : headerCandidate.querySelector('.MainHeaderV2, [class*="MainHeader"]') || headerCandidate,
          role: headerRole === 'hero' ? 'hero' : 'header',
        });
      }
      // Sibling hero outside main (Renault `#Page > header`) or stage wrappers above deep stacks.
      if (main?.parentElement) {
        for (const sib of main.parentElement.children) {
          if (sib === main || !(sib instanceof Element)) continue;
          const sibH = sib.getBoundingClientRect().height;
          const isPageHero =
            (sib.tagName === 'HEADER' || /pageHeader|hero|slider/i.test(String(sib.className || ''))) &&
            sibH >= 360;
          if (!isPageHero) continue;
          if (!bands.some((b) => b.el === sib || b.el.contains(sib) || sib.contains(b.el))) {
            // Insert hero after any header already pushed.
            const headerIdx = bands.findIndex((b) => b.role === 'header');
            const heroBand = { el: sib, role: 'hero' };
            if (headerIdx >= 0) bands.splice(headerIdx + 1, 0, heroBand);
            else bands.unshift(heroBand);
          }
        }
      }
      if (best.kind === 'deep-stack' && main) {
        // Capture a tall stage/hero sibling above the deep content stack when present.
        for (const el of main.querySelectorAll('div, section, header')) {
          const r = el.getBoundingClientRect();
          if (r.height < 420 || r.height > 1200 || r.width < viewportWidth() * 0.65) continue;
          if (best.root.contains(el)) continue;
          const top = r.top + window.scrollY;
          if (top > 200) continue;
          if (bands.some((b) => b.el === el || b.el.contains(el) || el.contains(b.el))) continue;
          bands.push({ el, role: 'hero' });
          break;
        }
      }
      best.children.forEach((el, i) => {
        bands.push({ el, role: i === 0 && el.getBoundingClientRect().height >= 520 ? 'hero' : 'content' });
      });
    } else {
      best.children.forEach((child, i) => {
        const role = classifyStackChildRole(child, i, best.children.length);
        if (role === 'main') {
          expandMainColumn(child).forEach((band, j) => {
            bands.push({
              el: band,
              role: j === 0 && band.getBoundingClientRect().height >= 520 ? 'hero' : 'content',
            });
          });
          return;
        }
        if (role === 'header') {
          bands.push({
            el: child.querySelector('.MainHeaderV2, [class*="MainHeader"], nav') || child,
            role: 'header',
          });
          return;
        }
        bands.push({ el: child, role });
      });
    }

    // Dedupe nested overlaps keeping outer chrome + inner content preference.
    /** @type {Array<{ el: Element, role: string }>} */
    const deduped = [];
    for (const band of bands) {
      if (!band.el) continue;
      const dominated = deduped.some(
        (other) =>
          other.el !== band.el &&
          (other.el.contains(band.el) || band.el.contains(other.el)) &&
          !(other.role === 'header' || other.role === 'footer' || band.role === 'header' || band.role === 'footer')
      );
      if (dominated) {
        // Replace child with parent when parent is content/hero and child was nested noise.
        const childIdx = deduped.findIndex((other) => band.el.contains(other.el) && other.role === 'content');
        if (childIdx >= 0 && (band.role === 'content' || band.role === 'hero')) {
          deduped[childIdx] = band;
        }
        continue;
      }
      if (deduped.some((other) => other.el === band.el)) continue;
      deduped.push(band);
    }

    const contentCount = deduped.filter((b) => b.role === 'content' || b.role === 'hero').length;
    if (contentCount < 2 && best.score < 40) return null;

    return { bands: deduped.slice(0, MAX_MAIN_SECTIONS + 4), score: best.score, kind: best.kind, root: best.root };
  }

  function discoverMainBands(main) {
    if (isSitecoreJssLayoutRoot(main)) {
      const jssBands = discoverSitecoreJssBands(main);
      if (jssBands.length) return jssBands;
    }

    const aemSections = [...main.querySelectorAll('.cmp-container.cmp-container--section')].filter((el) => {
      if (!isVisible(el)) return false;
      let parent = el.parentElement;
      while (parent && parent !== main) {
        if (parent.classList?.contains('cmp-container--section')) return false;
        parent = parent.parentElement;
      }
      return true;
    });

    if (aemSections.length) {
      /** @type {Array<{ el: Element, bandElements?: Element[], bandHeading?: string }>} */
      const expanded = [];
      for (const section of aemSections) {
        const innerBands = splitAemSectionIntoBands(section);
        if (innerBands?.length >= 2) {
          expanded.push(...innerBands);
        } else if (isVisible(section)) {
          expanded.push({ el: section });
        }
      }
      return expanded;
    }

    const corporateGrid = findCorporatePageContentGrid(main);
    if (corporateGrid) {
      const columns = [...corporateGrid.children].filter(
        (c) => isCorporateContentColumn(c) && isCorporateGridColumnVisible(c)
      );
      if (columns.length >= 2) {
        return columns.map((el) => ({ el }));
      }
    }

    let bands = [...main.querySelectorAll(':scope > .lfr-layout-structure-item-container')].filter(isVisible);
    if (!bands.length) {
      bands = [...main.querySelectorAll(':scope > section, :scope > article, :scope > div')].filter((el) => {
        if (!isVisible(el)) return false;
        return el.getBoundingClientRect().height >= MIN_HEIGHT * 1.5;
      });
    }
    return bands.map((el) => ({ el }));
  }

  function discoverViaLegacyMainPath() {
  const main = findMainLandmark();
  if (main) {
    const bands = discoverMainBands(main);
    bands.slice(0, MAX_MAIN_SECTIONS).forEach((band, index) => classifyMainBand(band, index));
    }
  }

  // --- Primary: layout partition (site-agnostic CMS bands) ---
  const layout = discoverLayoutPartition();
  const layoutContentCount = layout
    ? layout.bands.filter((b) => b.role === 'content' || b.role === 'hero').length
    : 0;
  const useLayout = !!(layout && layout.score >= 28 && layoutContentCount >= 3);

  if (useLayout) {
    layout.bands.forEach((band, index) => pushLayoutBand(band.el, band.role, index));
  } else {
    discoverViaLegacyMainPath();
  }

  // Ensure footer exists when layout/legacy missed it.
  if (!sections.some((s) => s.type === 'footer' || s.cmsName === 'Footer')) {
  const footerEl =
    document.querySelector('footer[role="contentinfo"]') ||
      document.querySelector('section.ContentZone__footer') ||
    document.querySelector('footer.cmp-footer') ||
    document.querySelector('.cmp-footer') ||
    document.querySelector('footer') ||
    document.querySelector('.footer__container')?.closest('footer, [class*="footer"]');
  if (footerEl) {
    pushComponent(footerEl, 'Footer', 'Site footer with links and legal', 'footer', {
      componentType: 'Footer',
      visualRole: 'Site-wide footer',
        bandSelectors: [buildStructuralSelector(footerEl)].filter(Boolean),
        allowParentOfClaimed: true,
      });
    }
  }

  // Ensure header exists when layout found content but no chrome.
  if (useLayout && !sections.some((s) => s.type === 'header' || s.cmsName === 'Header')) {
    const headerEl =
      document.querySelector('section.ContentZone__menu .MainHeaderV2') ||
      document.querySelector('.MainHeaderV2') ||
      document.querySelector('header[role="banner"]') ||
      document.querySelector('[role="banner"]');
    if (headerEl && isVisible(headerEl, 'header')) {
      pushComponent(headerEl, 'Header', 'Site header / menu chrome', 'header', {
        componentType: 'Header',
        visualRole: 'Site chrome',
        bandSelectors: [buildStructuralSelector(headerEl)].filter(Boolean),
        allowParentOfClaimed: true,
      });
      // Keep header first in reading order when possible.
      const idx = sections.findIndex((s) => s.cmsName === 'Header');
      if (idx > 0) {
        const [hdr] = sections.splice(idx, 1);
        sections.unshift(hdr);
        sections.forEach((s, i) => {
          s.order = i;
        });
      }
    }
  }

  return sections;
}
