#!/usr/bin/env node
/**
 * Decompose section manifest entries into Sitecore component blueprints.
 * @see .cursor/skills/sitecore-from-capture/SKILL.md
 */
import { readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CHROME_TYPES = new Set(['header', 'nav', 'navigation', 'footer', 'cookie-banner', 'topbar', 'top-bar']);
const BASE_VARIANTS = ['Default', 'Inversed', 'ImageTop', 'Animated'];
const CHROME_COMPONENTS = {
  TopBar: {
    cmsName: 'TopBar',
    componentType: 'Layout',
    description: 'Thin utility strip above the main header (promo, search, support links).',
    fields: [
      { name: 'Message', type: 'Single-Line Text' },
      { name: 'PrimaryLink', type: 'General Link' },
      { name: 'SecondaryLink', type: 'General Link' },
    ],
    placeholders: [],
    variants: BASE_VARIANTS,
  },
  Header: {
    cmsName: 'Header',
    componentType: 'Navigation',
    description: 'Site header with logo and navigation placeholder.',
    fields: [
      { name: 'Logo', type: 'Image' },
      { name: 'LogoLink', type: 'General Link' },
      { name: 'LogoText', type: 'Single-Line Text' },
    ],
    placeholders: [{ key: 'header-nav-{DynamicPlaceholderId}', allowedRenderings: ['Navigation'], layout: 'nav' }],
    variants: BASE_VARIANTS,
  },
  Navigation: {
    cmsName: 'Navigation',
    componentType: 'Navigation',
    description: 'Primary navigation links.',
    fields: [{ name: 'NavLinks', type: 'Treelist' }],
    placeholders: [],
    variants: BASE_VARIANTS,
    parentComponents: ['Header'],
  },
  Footer: {
    cmsName: 'Footer',
    componentType: 'Footer',
    description: 'Site footer with link columns and legal.',
    fields: [
      { name: 'CopyrightText', type: 'Single-Line Text' },
      { name: 'Logo', type: 'Image' },
    ],
    placeholders: [
      { key: 'footer-links-{DynamicPlaceholderId}', allowedRenderings: ['LinkList'], layout: 'columns' },
    ],
    variants: BASE_VARIANTS,
  },
  ChatWidget: {
    cmsName: 'ChatWidget',
    componentType: 'Layout',
    description: 'Fixed chat or support widget (corner overlay).',
    fields: [
      { name: 'LauncherLabel', type: 'Single-Line Text' },
      { name: 'AriaLabel', type: 'Single-Line Text' },
    ],
    placeholders: [],
    variants: BASE_VARIANTS,
  },
  FloatingActionButton: {
    cmsName: 'FloatingActionButton',
    componentType: 'Layout',
    description: 'Floating side button (back-to-top, feedback, sticky CTA).',
    fields: [
      { name: 'Label', type: 'Single-Line Text' },
      { name: 'Link', type: 'General Link' },
    ],
    placeholders: [],
    variants: BASE_VARIANTS,
  },
  CookieBanner: {
    cmsName: 'CookieBanner',
    componentType: 'Layout',
    description: 'Cookie consent banner.',
    fields: [
      { name: 'Message', type: 'Multi-Line Text' },
      { name: 'AcceptLabel', type: 'Single-Line Text' },
      { name: 'PrivacyLink', type: 'General Link' },
    ],
    placeholders: [],
    variants: BASE_VARIANTS,
  },
};

function parseArgs(argv) {
  const options = { project: path.resolve(process.cwd(), 'design-screenshots') };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--project') options.project = path.resolve(process.cwd(), argv[++i]);
    if (argv[i] === '--help' || argv[i] === '-h') {
      console.log('Usage: node decompose-sections.mjs --project ./design-screenshots/{domain}');
      process.exit(0);
    }
  }
  return options;
}

function sectionFields(entry) {
  const layoutParent = entry.layoutAnalysis?.parentFields;
  if (Array.isArray(layoutParent)) {
    return layoutParent;
  }

  const names = entry.fields ?? [];
  const map = {
    sectionEyebrow: { name: 'Eyebrow', type: 'Single-Line Text' },
    sectionTitle: { name: 'Title', type: 'Single-Line Text' },
    sectionDescription: { name: 'Description', type: 'Multi-Line Text' },
    sectionCta: { name: 'SectionCta', type: 'General Link' },
    title: { name: 'Title', type: 'Single-Line Text' },
    body: { name: 'Body', type: 'Multi-Line Text' },
    image: { name: 'Image', type: 'Image' },
    cta: { name: 'Cta', type: 'General Link' },
    slides: null,
    cards: null,
  };
  const out = [];
  for (const f of names) {
    const mapped = map[f];
    if (mapped) out.push(mapped);
  }

  const hasSectionContent =
    entry.includesSectionTitle ||
    entry.heading ||
    names.some((f) => ['sectionTitle', 'sectionDescription', 'sectionEyebrow', 'title', 'body'].includes(f));

  if (!out.length && hasSectionContent) {
    out.push({ name: 'Title', type: 'Single-Line Text' }, { name: 'Body', type: 'Multi-Line Text' });
  }
  return out;
}

function childFields(childName) {
  const byChild = {
    ImageTeaserCard: [
      { name: 'Image', type: 'Image' },
      { name: 'Title', type: 'Single-Line Text' },
      { name: 'Link', type: 'General Link' },
      { name: 'PromoRibbon', type: 'General Link' },
    ],
    FeatureCarouselCard: [
      { name: 'Eyebrow', type: 'Single-Line Text' },
      { name: 'Title', type: 'Single-Line Text' },
      { name: 'Body', type: 'Multi-Line Text' },
    ],
    EventCard: [
      { name: 'Image', type: 'Image' },
      { name: 'Category', type: 'Single-Line Text' },
      { name: 'Title', type: 'Single-Line Text' },
      { name: 'Description', type: 'Multi-Line Text' },
      { name: 'Cta', type: 'General Link' },
    ],
    HorizontalLinkCard: [
      { name: 'Logo', type: 'Image' },
      { name: 'Title', type: 'Single-Line Text' },
      { name: 'Cta', type: 'General Link' },
    ],
    VerticalTeaserCard: [
      { name: 'Image', type: 'Image' },
      { name: 'Title', type: 'Single-Line Text' },
      { name: 'Description', type: 'Multi-Line Text' },
      { name: 'Cta', type: 'General Link' },
    ],
    StatsItem: [
      { name: 'Value', type: 'Single-Line Text' },
      { name: 'Label', type: 'Single-Line Text' },
      { name: 'Link', type: 'General Link' },
    ],
    HeroSlideCard: [
      { name: 'Image', type: 'Image' },
      { name: 'Title', type: 'Single-Line Text' },
      { name: 'Subtitle', type: 'Multi-Line Text' },
      { name: 'Cta', type: 'General Link' },
    ],
    HeroPanelCard: [
      { name: 'PanelTitle', type: 'Single-Line Text' },
      { name: 'Body', type: 'Multi-Line Text' },
      { name: 'Cta', type: 'General Link' },
    ],
    HeroStatsPanel: [
      { name: 'Title', type: 'Single-Line Text' },
      { name: 'Value', type: 'Single-Line Text' },
      { name: 'Change', type: 'Single-Line Text' },
      { name: 'Date', type: 'Single-Line Text' },
      { name: 'Link', type: 'General Link' },
    ],
    MediaSliderItem: [
      { name: 'Logo', type: 'Image' },
      { name: 'Title', type: 'Single-Line Text' },
      { name: 'Body', type: 'Multi-Line Text' },
      { name: 'Cta', type: 'General Link' },
    ],
    InsuranceCategoryGroupCard: [
      { name: 'CategoryTitle', type: 'Single-Line Text' },
      { name: 'Links', type: 'Treelist' },
    ],
  };
  return (
    byChild[childName] ?? [
      { name: 'Title', type: 'Single-Line Text' },
      { name: 'Body', type: 'Multi-Line Text' },
      { name: 'Cta', type: 'General Link' },
    ]
  );
}

function sectionHtmlSnippet(entry) {
  if (entry.__sectionHtml !== undefined) return entry.__sectionHtml;
  try {
    const dir = entry.outputDir;
    if (!dir) {
      entry.__sectionHtml = '';
      return '';
    }
    // Prefer original-section.html (raw DOM); fall back to section.html for older captures
    let html = '';
    try {
      html = readFileSync(path.join(dir, 'original-section.html'), 'utf8');
    } catch {
      html = readFileSync(path.join(dir, 'section.html'), 'utf8');
    }
    entry.__sectionHtml = html;
    return html;
  } catch {
    entry.__sectionHtml = '';
    return '';
  }
}

function isBackgroundPanelBlock(entry) {
  if (entry.type === 'hero' || entry.componentType === 'Hero') return false;
  const html = sectionHtmlSnippet(entry).toLowerCase();
  if (/panels-hero|jmpanels--hero|hero-panels-panel/.test(html)) return false;
  if (/panel_block|jmpanelblock/.test(html)) return true;
  const haystack = `${entry.folderName ?? ''} ${entry.cmsName ?? ''} ${entry.reason ?? ''}`.toLowerCase();
  return (
    /panel[-_]?block|background-panel|core-technical-capabilities/.test(haystack) &&
    (entry.repeatCount ?? 0) <= 2
  );
}

function looksLikeInsuranceCatalog(entry) {
  const haystack = `${entry.selector ?? ''} ${entry.anchorWebid ?? ''} ${entry.cmsName ?? ''} ${entry.reason ?? ''}`.toLowerCase();
  return /insurance_catalog|catalog--|data-component=\"catalog\"|alleverzekeringen/.test(haystack);
}

export function decomposeSectionEntry(entry) {
  return decomposeContentSection(entry);
}

export function getChromeBlueprint(cmsName) {
  return CHROME_COMPONENTS[cmsName] ?? null;
}

function decomposeResponsiveTeaserGrid(entry, layout) {
  const hasTitle = (layout.parentFields ?? []).length > 0;
  const parentName = hasTitle ? 'TitleImageTeaserCardGridSection' : 'ImageTeaserCardGridSection';
  const cardName = 'ImageTeaserCard';
  const placeholderKey = 'teaser-cards-{DynamicPlaceholderId}';
  const cardFieldTypes =
    layout.cardFieldTypes ??
    [
      { name: 'Image', type: 'Image' },
      { name: 'Title', type: 'Single-Line Text' },
      { name: 'Link', type: 'General Link' },
    ];

  return {
    parent: {
      cmsName: parentName,
      componentType: 'Section',
      description:
        'Responsive image teaser band: multi-column card grid on desktop, horizontal carousel on tablet/mobile.',
      fields: sectionFields(entry),
      placeholders: [
        {
          key: placeholderKey,
          allowedRenderings: [cardName],
          layout: 'responsive-grid-carousel',
        },
      ],
      variants: [...BASE_VARIANTS, 'Carousel'],
      confidence: 'high',
      responsiveBehavior: layout,
    },
    child: {
      cmsName: cardName,
      componentType: 'Card',
      description: 'Image + title + link teaser card; optional promo ribbon badge.',
      fields: cardFieldTypes,
      placeholders: [],
      variants: BASE_VARIANTS,
      parentComponents: [parentName],
      confidence: 'high',
    },
    placeholderKey,
    repeatCount: layout.cardCount ?? entry.repeatCount ?? 2,
  };
}

function isStandaloneTextVideoSection(entry) {
  const folder = (entry.folderName ?? entry.sectionFolder ?? '').toLowerCase();
  const haystack = `${entry.cmsName ?? ''} ${entry.reason ?? ''} ${folder}`.toLowerCase();
  if (entry.type === 'text-video' || entry.componentType === 'TextVideoSplit') return true;
  if (/jmvideotempl|video-thumbnail|text.*video|rich-text-video/.test(haystack)) return true;
  if (/developing-the-future|future-of.*pgm/.test(folder)) return true;
  return false;
}

function decomposeContentSection(entry) {
  const child = entry.placeholderFor;
  const repeatCount = entry.repeatCount ?? 2;
  const layout = entry.layoutAnalysis;

  if (entry.type === 'composite-hero' || entry.componentType === 'CompositeHero') {
    const panelCount = entry.panelCount ?? repeatCount ?? 2;
    const parentName = 'CompositeHeroBandSection';
    return {
      compositeBand: true,
      parent: {
        cmsName: parentName,
        componentType: 'Section',
        description: 'Composite hero band: full-bleed carousel with side panel row (news/promo + live metrics).',
        fields: [],
        placeholders: [
          { key: 'hero-slides-{DynamicPlaceholderId}', allowedRenderings: ['HeroSlideCard'], layout: 'horizontal-carousel' },
          { key: 'hero-panels-{DynamicPlaceholderId}', allowedRenderings: ['HeroPanelCard'], layout: 'grid' },
          { key: 'hero-stats-{DynamicPlaceholderId}', allowedRenderings: ['HeroStatsPanel'], layout: 'horizontal-row' },
        ],
        variants: [...BASE_VARIANTS, 'Carousel'],
        headlessVariant: 'Carousel',
        confidence: 'high',
      },
      placeholderChildren: [
        {
          cmsName: 'HeroSlideCard',
          repeatCount: entry.slideCount ?? 3,
          inPlaceholder: 'hero-slides-{DynamicPlaceholderId}',
        },
        {
          cmsName: 'HeroPanelCard',
          repeatCount: panelCount,
          inPlaceholder: 'hero-panels-{DynamicPlaceholderId}',
        },
        ...(entry.includesStats !== false
          ? [
              {
                cmsName: 'HeroStatsPanel',
                repeatCount: 1,
                inPlaceholder: 'hero-stats-{DynamicPlaceholderId}',
              },
            ]
          : []),
      ],
    };
  }

  if (layout?.pattern === 'responsive-grid-carousel') {
    return decomposeResponsiveTeaserGrid(entry, layout);
  }

  if (layout?.pattern === 'content-carousel') {
    const parentName = 'TitleDescriptionCarouselSection';
    const cardName = child || 'FeatureCarouselCard';
    const placeholderKey = 'carousel-slides-{DynamicPlaceholderId}';
    return {
      parent: {
        cmsName: parentName,
        componentType: 'Section',
        description: 'Section with title, description, and content carousel placeholder.',
        fields: layout.parentFields?.length ? layout.parentFields : sectionFields(entry),
        placeholders: [{ key: placeholderKey, allowedRenderings: [cardName], layout: 'horizontal-carousel' }],
        variants: [...BASE_VARIANTS, 'Carousel'],
        confidence: 'high',
        responsiveBehavior: layout,
      },
      child: {
        cmsName: cardName,
        componentType: 'Card',
        description: 'Carousel slide card with image, title, and body.',
        fields: childFields(cardName),
        placeholders: [],
        variants: BASE_VARIANTS,
        parentComponents: [parentName],
        confidence: 'high',
      },
      placeholderKey,
      repeatCount: layout.cardCount ?? repeatCount,
    };
  }

  if (entry.type === 'carousel' || entry.componentType === 'Carousel') {
    const isEvents = child === 'EventCard';
    const parentName = isEvents ? 'TitleDescriptionEventsCarouselSection' : 'EyebrowTitleCarouselSection';
    const placeholderKey = isEvents ? 'event-cards-{DynamicPlaceholderId}' : 'carousel-slides-{DynamicPlaceholderId}';
    const cardName = child || (isEvents ? 'EventCard' : 'FeatureCarouselCard');
    return {
      parent: {
        cmsName: parentName,
        componentType: 'Section',
        description: isEvents
          ? 'Events/webinars section with title, description, carousel, and section CTA.'
          : 'Feature carousel section with eyebrow, title, description, and slide placeholder.',
        fields: sectionFields(entry),
        placeholders: [{ key: placeholderKey, allowedRenderings: [cardName], layout: 'horizontal-carousel' }],
        variants: [...BASE_VARIANTS, 'Carousel'],
        confidence: 'high',
      },
      child: {
        cmsName: cardName,
        componentType: 'Card',
        description: `${cardName} slide for carousel placeholder.`,
        fields: childFields(cardName),
        placeholders: [],
        variants: BASE_VARIANTS,
        parentComponents: [parentName],
        confidence: 'high',
      },
      placeholderKey,
      repeatCount,
    };
  }

  if (entry.type === 'signpost-section' || entry.componentType === 'SignpostSection') {
    const parentName = 'LogoTitleCtaSignpostSection';
    const cardName = child || 'HorizontalLinkCard';
    const placeholderKey = 'signpost-cards-{DynamicPlaceholderId}';
    return {
      parent: {
        cmsName: parentName,
        componentType: 'Section',
        description: 'Signpost section with stacked horizontal logo + title + CTA rows.',
        fields: sectionFields(entry),
        placeholders: [{ key: placeholderKey, allowedRenderings: [cardName], layout: 'vertical-list' }],
        variants: [...BASE_VARIANTS, 'Carousel'],
        confidence: 'high',
      },
      child: {
        cmsName: cardName,
        componentType: 'Card',
        description: 'Horizontal link row with logo, title, and CTA.',
        fields: childFields(cardName),
        placeholders: [],
        variants: BASE_VARIANTS,
        parentComponents: [parentName],
        confidence: 'high',
      },
      placeholderKey,
      repeatCount,
    };
  }

  if (entry.type === 'stats-bar' || entry.componentType === 'StatsBar') {
    const parentName = 'TitleStatsBarSection';
    const cardName = child || 'StatsItem';
    const placeholderKey = 'stats-items-{DynamicPlaceholderId}';
    return {
      parent: {
        cmsName: parentName,
        componentType: 'Section',
        description: 'Statistics bar with optional section title and metric items.',
        fields: sectionFields(entry),
        placeholders: [{ key: placeholderKey, allowedRenderings: [cardName], layout: 'horizontal-row' }],
        variants: [...BASE_VARIANTS, 'Carousel'],
        confidence: 'high',
      },
      child: {
        cmsName: cardName,
        componentType: 'Card',
        description: 'Single statistic metric tile.',
        fields: childFields(cardName),
        placeholders: [],
        variants: BASE_VARIANTS,
        parentComponents: [parentName],
        confidence: 'high',
      },
      placeholderKey,
      repeatCount,
    };
  }

  if (isStandaloneTextVideoSection(entry)) {
    return {
      parent: {
        cmsName: 'TitleDescriptionVideoSection',
        componentType: 'Section',
        description: 'Two-column band: rich text + CTA beside a video thumbnail with play control.',
        fields: [
          { name: 'Title', type: 'Single-Line Text' },
          { name: 'Body', type: 'Multi-Line Text' },
          { name: 'Cta', type: 'General Link' },
          { name: 'VideoThumbnail', type: 'Image' },
          { name: 'VideoThumbnailMobile', type: 'Image' },
          { name: 'PlayVideoLabel', type: 'Single-Line Text' },
          { name: 'VideoLink', type: 'General Link' },
        ],
        placeholders: [],
        variants: BASE_VARIANTS,
        confidence: 'high',
      },
      child: null,
      placeholderKey: null,
      repeatCount: 0,
    };
  }

  if (isBackgroundPanelBlock(entry)) {
    return {
      parent: {
        cmsName: 'BackgroundPanelSection',
        componentType: 'Section',
        description:
          'Full-width background panel: section title, image column, and text/CTA column — one editorial story, not a teaser grid. Preserve jmpanelblock band padding (background visible below inner card); image column fills inner card height — see background-panel-block-fidelity.md.',
        fields: [
          { name: 'Title', type: 'Single-Line Text' },
          { name: 'BackgroundImage', type: 'Image' },
          { name: 'Image', type: 'Image' },
          { name: 'Body', type: 'Multi-Line Text' },
          { name: 'Cta', type: 'General Link' },
        ],
        placeholders: [],
        variants: BASE_VARIANTS,
        confidence: 'high',
      },
      child: null,
      placeholderKey: null,
      repeatCount: 0,
    };
  }

  if (entry.type === 'grid' || entry.placeholderFor) {
    const cardName = child || 'VerticalTeaserCard';
    const isHorizontal = cardName.includes('Horizontal');
    const parentName = isHorizontal ? 'TitleDescriptionLinkGridSection' : 'TitleDescriptionTeaserGridSection';
    const placeholderKey = isHorizontal ? 'link-cards-{DynamicPlaceholderId}' : 'teaser-cards-{DynamicPlaceholderId}';
    return {
      parent: {
        cmsName: parentName,
        componentType: 'Section',
        description: 'Grid section with section title and repeating card placeholder.',
        fields: sectionFields(entry),
        placeholders: [{ key: placeholderKey, allowedRenderings: [cardName], layout: 'grid' }],
        variants: [...BASE_VARIANTS, 'Carousel'],
        confidence: 'high',
      },
      child: {
        cmsName: cardName,
        componentType: 'Card',
        description: `${cardName} for grid placeholder.`,
        fields: childFields(cardName),
        placeholders: [],
        variants: BASE_VARIANTS,
        parentComponents: [parentName],
        confidence: 'high',
      },
      placeholderKey,
      repeatCount,
    };
  }

  if (entry.type === 'hero' || entry.componentType === 'Hero') {
    if ((entry.cmsName || '').includes('Carousel')) {
      const parentName = 'FullBleedHeroCarouselSection';
      const cardName = 'HeroSlideCard';
      const placeholderKey = 'hero-slides-{DynamicPlaceholderId}';
      return {
        parent: {
          cmsName: parentName,
          componentType: 'Hero',
          description: 'Full-bleed hero carousel with slide placeholder.',
          fields: sectionFields(entry),
          placeholders: [{ key: placeholderKey, allowedRenderings: [cardName], layout: 'horizontal-carousel' }],
          variants: [...BASE_VARIANTS, 'Carousel'],
          confidence: 'high',
        },
        child: {
          cmsName: cardName,
          componentType: 'Card',
          description: 'Hero carousel slide.',
          fields: childFields(cardName),
          placeholders: [],
          variants: BASE_VARIANTS,
          parentComponents: [parentName],
          confidence: 'high',
        },
        placeholderKey,
        repeatCount,
      };
    }
    return {
      parent: {
        cmsName: 'FullBleedHeroBannerSection',
        componentType: 'Hero',
        description: 'Full-bleed hero banner with title and CTA.',
        fields: [
          ...sectionFields(entry),
          { name: 'BackgroundImage', type: 'Image' },
          { name: 'Cta', type: 'General Link' },
        ],
        placeholders: [],
        variants: BASE_VARIANTS,
        confidence: 'medium',
      },
      child: null,
      placeholderKey: null,
      repeatCount: 0,
    };
  }

  if (entry.type === 'content-section' && looksLikeInsuranceCatalog(entry)) {
    const parentName = 'InsuranceCategoryCatalogSection';
    const cardName = 'InsuranceCategoryGroupCard';
    const placeholderKey = 'category-groups-{DynamicPlaceholderId}';
    return {
      parent: {
        cmsName: parentName,
        componentType: 'Section',
        description: 'Insurance category catalog with section title and repeating category group placeholder (grid on desktop, accordion on mobile).',
        fields: [
          { name: 'Title', type: 'Single-Line Text' },
        ],
        placeholders: [{ key: placeholderKey, allowedRenderings: [cardName], layout: 'grid' }],
        variants: [...BASE_VARIANTS, 'Carousel'],
        confidence: 'high',
      },
      child: {
        cmsName: cardName,
        componentType: 'Card',
        description: 'Category group with title and list of insurance product links.',
        fields: [
          { name: 'CategoryTitle', type: 'Single-Line Text' },
          { name: 'Links', type: 'Treelist' },
        ],
        placeholders: [],
        variants: BASE_VARIANTS,
        parentComponents: [parentName],
        confidence: 'high',
      },
      placeholderKey,
      repeatCount: entry.repeatCount ?? 6,
    };
  }

  const name = entry.cmsName || '';
  let parentName = 'TitleDescriptionCtaSection';
  if (name.includes('BackgroundImage') || (entry.fields || []).includes('image')) {
    parentName = entry.fields?.includes('image') ? 'ImageRichTextSection' : 'BackgroundImageRichTextSection';
  } else if (name.includes('Horizontal') || name.includes('Feature')) {
    parentName = 'HorizontalFeatureSection';
  } else if (name.includes('RichText')) {
    parentName = 'ImageRichTextSection';
  }

  return {
    parent: {
      cmsName: parentName,
      componentType: 'Section',
      description: 'Editorial content section inferred from screenshot band.',
      fields: sectionFields(entry),
      placeholders: [],
      variants: BASE_VARIANTS,
      confidence: 'medium',
    },
    child: null,
    placeholderKey: null,
    repeatCount: 0,
  };
}

function addBlueprint(blueprints, blueprint, folderName) {
  const existing = blueprints[blueprint.cmsName];
  const sourceSectionFolders = new Set(existing?.sourceSectionFolders ?? []);
  sourceSectionFolders.add(folderName);
  blueprints[blueprint.cmsName] = {
    ...blueprint,
    sourceSectionFolders: [...sourceSectionFolders],
  };
}

export async function decomposeProject(projectRoot) {
  const sectionsRoot = path.join(projectRoot, 'sections');
  const manifestPath = path.join(sectionsRoot, 'manifest.json');
  const raw = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);

  /** @type {Record<string, object>} */
  const blueprints = {};

  for (const [name, def] of Object.entries(CHROME_COMPONENTS)) {
    if (manifest.components[name]) {
      addBlueprint(blueprints, { ...def, confidence: 'high' }, manifest.components[name].folderName);
    }
  }

  for (const page of manifest.pages ?? []) {
    const layoutChrome = [];
    const sections = [];
    let order = 0;

    for (const cmsName of page.sectionOrder ?? []) {
      const entry = manifest.components[cmsName];
      if (!entry) continue;

      if (CHROME_TYPES.has(entry.type) || entry.scope === 'site') {
        if (CHROME_COMPONENTS[entry.cmsName]) {
          layoutChrome.push({
            cmsName: entry.cmsName,
            scope: 'site',
            sectionFolder: entry.folderName,
          });
        }
        continue;
      }

      if (entry.type === 'card' && entry.metadataOnly) continue;

      order += 1;
      const decomposed = decomposeContentSection(entry);

      if (decomposed.compositeBand) {
        addBlueprint(blueprints, decomposed.parent, entry.folderName);
        for (const childSpec of decomposed.placeholderChildren) {
          addBlueprint(
            blueprints,
            {
              cmsName: childSpec.cmsName,
              componentType: 'Card',
              description: `${childSpec.cmsName} for composite hero band placeholder.`,
              fields: childFields(childSpec.cmsName),
              placeholders: [],
              variants: BASE_VARIANTS,
              parentComponents: [decomposed.parent.cmsName],
              confidence: 'high',
            },
            entry.folderName,
          );
        }
        sections.push({
          order,
          sectionFolder: entry.folderName,
          sectionScreenshotName: entry.cmsName,
          compositeBand: true,
          parentComponent: {
            cmsName: decomposed.parent.cmsName,
            headlessVariant: decomposed.parent.headlessVariant ?? 'Carousel',
            placeholderKey: null,
          },
          placeholderChildren: decomposed.placeholderChildren,
        });
        continue;
      }

      addBlueprint(blueprints, decomposed.parent, entry.folderName);
      if (decomposed.child) addBlueprint(blueprints, decomposed.child, entry.folderName);

      sections.push({
        order,
        sectionFolder: entry.folderName,
        sectionScreenshotName: entry.cmsName,
        parentComponent: {
          cmsName: decomposed.parent.cmsName,
          placeholderKey: decomposed.placeholderKey,
        },
        placeholderChildren: decomposed.child
          ? [
              {
                cmsName: decomposed.child.cmsName,
                repeatCount: decomposed.repeatCount,
                inPlaceholder: decomposed.placeholderKey,
              },
            ]
          : [],
      });
    }

    const pageDecomposition = {
      slug: page.slug,
      url: page.url,
      layoutChrome,
      sections,
      confidence: 'high',
      notes: [],
    };

    const outPath = path.join(page.pageDir, 'page-decomposition.json');
    await writeFile(outPath, JSON.stringify(pageDecomposition, null, 2), 'utf8');
    console.log(`  ✓ ${page.slug}/page-decomposition.json (${sections.length} sections)`);
  }

  const blueprintDoc = {
    projectRoot,
    updatedAt: new Date().toISOString(),
    components: blueprints,
  };

  const blueprintPath = path.join(sectionsRoot, 'component-blueprint.json');
  await writeFile(blueprintPath, JSON.stringify(blueprintDoc, null, 2), 'utf8');

  return {
    blueprintPath,
    componentCount: Object.keys(blueprints).length,
    pageCount: manifest.pages?.length ?? 0,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  console.log(`Decomposing sections for ${options.project}\n`);
  const result = await decomposeProject(options.project);
  console.log(`\nComponent blueprint: ${result.blueprintPath}`);
  console.log(`Components: ${result.componentCount}`);
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirectRun) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
