/**
 * Analyze saved section.html for layout patterns and card structure.
 * Used when building section-plan.json (no live browser required).
 */

function countMatches(html, pattern) {
  return (html.match(pattern) || []).length;
}

function extractImgCardTitles(html) {
  const titles = [];
  const re = /class="[^"]*imgcard__title[^"]*"[^>]*>([^<]+)</gi;
  let m;
  while ((m = re.exec(html)) && titles.length < 12) {
    const text = m[1].replace(/\s+/g, ' ').trim();
    if (text) titles.push(text);
  }
  return titles;
}

function hasSectionTitle(html) {
  if (/class="[^"]*section__title[^"]*"/i.test(html)) return true;
  const bodyIdx = html.search(/class="[^"]*section__body/i);
  const head = bodyIdx > 0 ? html.slice(0, bodyIdx) : html.slice(0, 1200);
  return /<h[12]\b/i.test(head);
}

/**
 * @param {string | null | undefined} html
 * @returns {object | null}
 */
export function analyzeSectionHtml(html) {
  if (!html || typeof html !== 'string') return null;

  const lower = html.toLowerCase();
  const imgCardCount = countMatches(html, /class="[^"]*\bimgcard\b/gi);
  const hasSwiper =
    /\bswiper\b/.test(lower) ||
    /data-component="swiper/i.test(html) ||
    /data-swiper/i.test(html);
  const mobileCarouselHints =
    /data-swiper-slides-mobile/i.test(html) ||
    /scrllcntrl[^"']*u-hide-desktop/i.test(html) ||
    (/swiper__prev/i.test(html) && /u-hide-desktop/i.test(html));
  const hasCarouselControls =
    /swiper__prev|swiper__next|data-swiper-prev|data-swiper-next/i.test(html);
  const hasRibbon = /class="[^"]*\bribbon\b/i.test(html);
  const cardTitles = extractImgCardTitles(html);
  const sectionTitle = hasSectionTitle(html);

  if (imgCardCount >= 2 && hasSwiper) {
    const cardFields = [
      { name: 'Image', type: 'Image' },
      { name: 'Title', type: 'Single-Line Text' },
      { name: 'Link', type: 'General Link' },
    ];
    if (hasRibbon) {
      cardFields.push({ name: 'PromoRibbon', type: 'General Link' });
    }

    const differsByViewport = mobileCarouselHints || hasCarouselControls;

    if (differsByViewport) {
      return {
        pattern: 'responsive-grid-carousel',
        differsByViewport: true,
        cardCount: imgCardCount,
        cardPattern: 'image-teaser',
        cardFields: cardFields.map((f) => f.name),
        cardFieldTypes: cardFields,
        parentFields: sectionTitle ? [{ name: 'Title', type: 'Single-Line Text' }] : [],
        sampleCardTitles: cardTitles,
        desktop: {
          layout: 'grid',
          columnsMax: 4,
          description:
            'Repeated image+title cards in a multi-column grid (typically up to 4 cards per row). No carousel arrows on desktop.',
        },
        tablet: {
          layout: 'carousel',
          controls: hasCarouselControls ? 'prev-next' : 'scroll',
          description:
            'Same cards in a horizontal carousel with prev/next (or scroll) controls below the track.',
        },
        mobile: {
          layout: 'carousel',
          controls: hasCarouselControls ? 'prev-next' : 'scroll',
          description:
            'Same cards in a horizontal carousel; narrower viewport shows fewer cards at once.',
        },
      };
    }

    return {
      pattern: 'carousel-all-viewports',
      differsByViewport: false,
      cardCount: imgCardCount,
      cardPattern: 'image-teaser',
      cardFields: cardFields.map((f) => f.name),
      cardFieldTypes: cardFields,
      parentFields: sectionTitle ? [{ name: 'Title', type: 'Single-Line Text' }] : [],
      sampleCardTitles: cardTitles,
      desktop: {
        layout: 'carousel',
        controls: hasCarouselControls ? 'prev-next' : 'scroll',
        description: 'Horizontal carousel on all breakpoints.',
      },
      tablet: {
        layout: 'carousel',
        controls: hasCarouselControls ? 'prev-next' : 'scroll',
        description: 'Horizontal carousel on all breakpoints.',
      },
      mobile: {
        layout: 'carousel',
        controls: hasCarouselControls ? 'prev-next' : 'scroll',
        description: 'Horizontal carousel on all breakpoints.',
      },
    };
  }

  if (imgCardCount >= 2 && !hasSwiper) {
    return {
      pattern: 'static-grid',
      differsByViewport: false,
      cardCount: imgCardCount,
      cardPattern: 'image-teaser',
      cardFields: ['Image', 'Title', 'Link'],
      parentFields: sectionTitle ? [{ name: 'Title', type: 'Single-Line Text' }] : [],
      sampleCardTitles: cardTitles,
      desktop: { layout: 'grid', columnsMax: 4, description: 'Static card grid on all viewports.' },
      tablet: { layout: 'grid', columnsMax: 2, description: 'Static card grid, fewer columns.' },
      mobile: { layout: 'grid', columnsMax: 1, description: 'Static card grid, stacked or single column.' },
    };
  }

  if (hasSwiper && imgCardCount === 0) {
    const hasCardLikeSlides = countMatches(html, /class="[^"]*\bcard\b/gi) >= 2;
    if (hasCardLikeSlides) {
      return {
        pattern: 'content-carousel',
        differsByViewport: false,
        cardCount: countMatches(html, /class="[^"]*\bcard\b/gi),
        cardPattern: 'content-card',
        parentFields: sectionTitle
          ? [
              { name: 'Title', type: 'Single-Line Text' },
              { name: 'Description', type: 'Multi-Line Text' },
            ]
          : [],
        desktop: {
          layout: 'carousel',
          controls: hasCarouselControls ? 'prev-next' : 'scroll',
          description: 'Content carousel with image/title/body cards.',
        },
        tablet: {
          layout: 'carousel',
          controls: hasCarouselControls ? 'prev-next' : 'scroll',
          description: 'Content carousel with image/title/body cards.',
        },
        mobile: {
          layout: 'carousel',
          controls: hasCarouselControls ? 'prev-next' : 'scroll',
          description: 'Content carousel with image/title/body cards.',
        },
      };
    }
  }

  if (/class="[^"]*\bcatalog\b/i.test(html)) {
    return {
      pattern: 'catalog-accordion-grid',
      differsByViewport: true,
      desktop: {
        layout: 'grid',
        columnsMax: 3,
        description: 'Multi-column link catalog with category headings.',
      },
      tablet: {
        layout: 'accordion',
        description: 'Vertical accordion list of categories.',
      },
      mobile: {
        layout: 'accordion',
        description: 'Vertical accordion list of categories.',
      },
    };
  }

  return null;
}

function stripHtmlTags(fragment) {
  return fragment.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function hasSubstantialHtmlText(htmlFragment) {
  if (!htmlFragment) return false;
  const heading = htmlFragment.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
  if (heading && stripHtmlTags(heading[1]).length >= 3) return true;
  const para = htmlFragment.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (para && stripHtmlTags(para[1]).length >= 3) return true;
  return false;
}

function inferTextColumnFields(sectionHtml) {
  const fields = [];
  if (/<h[1-6]\b/i.test(sectionHtml)) fields.push('Title');
  if (/<p\b/i.test(sectionHtml)) fields.push('Body');
  if (
    /<a\b[^>]*class="[^"]*button/i.test(sectionHtml) ||
    /<div class="[^"]*cwr-btn/i.test(sectionHtml) ||
    /<a\b[^>]*href=/i.test(sectionHtml)
  ) {
    fields.push('Cta');
  }
  return fields;
}

function buildImageFieldGuidanceEntry({ mediaHtml, sectionHtml, html }) {
  const mediaWithoutComments = mediaHtml.replace(/<!--[\s\S]*?-->/g, '');
  const titleMatch =
    sectionHtml.match(/<h[1-6][^>]*class="[^"]*content-title[^"]*"[^>]*>([^<]+)/i) ||
    sectionHtml.match(/<h[1-6][^>]*>([^<]+)/i);
  const assetName =
    html.match(/data-asset-name="([^"]+)"/i)?.[1] ||
    mediaHtml.match(/data-asset-path="([^"]+)"/i)?.[1] ||
    null;
  const alt = mediaWithoutComments.match(/<img[^>]*\salt="([^"]*)"/i)?.[1] ?? '';

  return {
    fieldName: 'Image',
    visibleTextInScreenshot: true,
    authorAsSeparateFields: false,
    imageColumnHasHtmlText: false,
    authorableTextInSeparateColumn: true,
    authorableTextColumnFields: inferTextColumnFields(sectionHtml),
    emptyImageAlt: !alt.trim(),
    imageAsset: assetName,
    note:
      'Text or branding visible in the image column of the design screenshot is part of the Image asset — do not create separate Sitecore fields for copy that appears only within the image. Title, body, and CTA in the adjacent text column are separate authored fields.',
    textColumnTitle: titleMatch?.[1]?.trim() ?? null,
  };
}

/**
 * Detect image+text split layouts where the image column has no HTML text
 * (marketing copy in the screenshot is baked into the image asset).
 * @param {string | null | undefined} html
 * @returns {object | null}
 */
export function analyzeImageFieldGuidance(html) {
  if (!html || typeof html !== 'string') return null;

  const bekMatch = html.match(
    /<div class="content-media">([\s\S]*?)<\/div>\s*<\/div>\s*<div class="a-container_column[^"]*">\s*<div class="content-section">([\s\S]*?)<\/div>/i
  );
  if (bekMatch) {
    const [, mediaHtml, sectionHtml] = bekMatch;
    const hasImage = /<img\b/i.test(mediaHtml);
    const mediaHasText = hasSubstantialHtmlText(mediaHtml);
    if (hasImage && !mediaHasText && hasSubstantialHtmlText(sectionHtml)) {
      return {
        pattern: 'image-text-split',
        imageFields: [buildImageFieldGuidanceEntry({ mediaHtml, sectionHtml, html })],
      };
    }
  }

  const genericMatch = html.match(
    /<div class="[^"]*(?:content-media|media-column|image-column|cmp-image)[^"]*">([\s\S]*?)<\/div>\s*(?:<\/div>\s*){0,3}<div class="[^"]*(?:content-section|text-column|cmp-text|rich-text)[^"]*">([\s\S]*?)<\/div>/i
  );
  if (genericMatch) {
    const [, mediaHtml, sectionHtml] = genericMatch;
    const hasImage = /<img\b/i.test(mediaHtml);
    const mediaHasText = hasSubstantialHtmlText(mediaHtml);
    if (hasImage && !mediaHasText && hasSubstantialHtmlText(sectionHtml)) {
      return {
        pattern: 'image-text-split',
        imageFields: [buildImageFieldGuidanceEntry({ mediaHtml, sectionHtml, html })],
      };
    }
  }

  return null;
}

function formatFieldList(fields) {
  const names = (fields ?? []).map((f) => f.name).filter(Boolean);
  return names.length ? names.join(', ') : 'none';
}

function readablePlaceholderKey(key) {
  if (!key) return null;
  return key.replace('-{DynamicPlaceholderId}', '').replace('{DynamicPlaceholderId}', '');
}

function describePlaceholder(parent, child, { repeatCount, layoutAnalysis } = {}) {
  const placeholders = parent?.placeholders ?? [];
  if (!placeholders.length) {
    return 'No Sitecore placeholders — all authored content lives on this component’s datasource fields.';
  }

  return placeholders
    .map((ph) => {
      const keyLabel = readablePlaceholderKey(ph.key) ?? ph.key;
      const allowed = ph.allowedRenderings ?? (child ? [child.cmsName] : []);
      const childName = allowed.join(' or ') || child?.cmsName || 'child rendering';
      const count = repeatCount ?? child?.repeatCount ?? layoutAnalysis?.cardCount ?? 'multiple';
      const countLabel = typeof count === 'number' ? `~${count}` : 'multiple';
      const childFields = child ? formatFieldList(child.fields) : 'see allowed rendering fields';
      const layout = ph.layout ? ` Layout: ${ph.layout}.` : '';

      return (
        `Sitecore placeholder "${keyLabel}" on ${parent.cmsName} accepts ${countLabel} ` +
        `${childName} item(s). Each ${allowed.length === 1 ? childName : 'item'} is authored with: ${childFields}.${layout}`
      );
    })
    .join(' ');
}

function describeParentFields(parent) {
  if (!parent) return '';
  const fields = formatFieldList(parent.fields);
  if (fields === 'none') {
    return `${parent.cmsName} has no datasource fields (structure/layout only).`;
  }
  return `${parent.cmsName} datasource fields: ${fields}.`;
}

function describeStandalone(component, allComponents) {
  const parts = [`We will create one component: ${component.cmsName}.`];
  parts.push(describeParentFields(component));

  if (component.placeholders?.length) {
    parts.push(describePlaceholder(component, null, {}));
    for (const ph of component.placeholders) {
      const allowed = ph.allowedRenderings ?? [];
      for (const childName of allowed) {
        const nested = allComponents.find((c) => c.cmsName === childName);
        if (nested) {
          parts.push(
            `${childName} goes inside the "${readablePlaceholderKey(ph.key)}" placeholder and is authored with: ${formatFieldList(nested.fields)}.`
          );
        } else {
          parts.push(
            `${childName} goes inside the "${readablePlaceholderKey(ph.key)}" placeholder (nested rendering — build separately).`
          );
        }
      }
    }
  } else {
    parts.push('No placeholders — editors publish content directly on this component.');
  }

  return parts.join(' ');
}

export function buildNarrativeSummary(entry, components, layoutAnalysis, planMeta = {}) {
  if (!components.length) {
    return 'No Sitecore components are planned for this section yet.';
  }

  const parent = components.find((c) => c.role === 'parent');
  const child = components.find((c) => c.role === 'child');
  const standalone = components.find((c) => c.role === 'standalone');
  const repeatCount = planMeta.repeatCount ?? child?.repeatCount ?? layoutAnalysis?.cardCount ?? entry?.repeatCount;

  if (parent && child) {
    const parts = [
      `We will create ${components.length} components: ${parent.cmsName} (section wrapper) and ${child.cmsName} (repeatable child).`,
      describeParentFields(parent),
      describePlaceholder(parent, child, { repeatCount, layoutAnalysis }),
    ];

    if (layoutAnalysis?.pattern === 'responsive-grid-carousel') {
      parts.push(
        `Responsive behaviour: desktop shows a grid (up to ${layoutAnalysis.desktop?.columnsMax ?? 4} cards per row); tablet and mobile show the same ${child.cmsName} items in a horizontal carousel.`
      );
    } else if (layoutAnalysis?.pattern === 'catalog-accordion-grid') {
      parts.push(
        'Responsive behaviour: desktop shows a multi-column category grid; tablet and mobile use a vertical accordion for the same categories.'
      );
    } else if (layoutAnalysis?.differsByViewport) {
      parts.push(
        `Responsive behaviour: desktop = ${layoutAnalysis.desktop?.layout ?? 'unknown'}, tablet = ${layoutAnalysis.tablet?.layout ?? 'unknown'}, mobile = ${layoutAnalysis.mobile?.layout ?? 'unknown'}.`
      );
    }

    if (layoutAnalysis?.sampleCardTitles?.length) {
      parts.push(`Example child items from the design: ${layoutAnalysis.sampleCardTitles.slice(0, 4).join(', ')}.`);
    }

    return parts.join(' ');
  }

  if (layoutAnalysis?.pattern === 'catalog-accordion-grid') {
    const parts = [
      `We will create ${components.length} components: ${components.map((c) => c.cmsName).join(' and ')}.`,
      describeParentFields(parent ?? standalone),
      describePlaceholder(parent ?? standalone, child, { repeatCount, layoutAnalysis }),
      'Responsive behaviour: desktop = category link grid; tablet/mobile = accordion list.',
    ];
    return parts.join(' ');
  }

  if (standalone && !parent) {
    const parts = [describeStandalone(standalone, components)];
    for (const img of planMeta.imageFieldGuidance?.imageFields ?? []) {
      if (img.note) parts.push(img.note);
    }
    return parts.join(' ');
  }

  const root = parent ?? components[0];
  const fields = formatFieldList(root.fields);
  const fieldNote = fields === 'none' ? 'No datasource fields inferred yet.' : `Datasource fields: ${fields}.`;
  return `We will create one component (${root.cmsName}). ${fieldNote} No placeholders.`;
}

export function buildReviewNotes(entry, layoutAnalysis, components = [], imageFieldGuidance = null) {
  const notes = [];
  if (entry.reason) notes.push(`Detection: ${entry.reason}`);

  for (const img of imageFieldGuidance?.imageFields ?? []) {
    const assetLabel = img.imageAsset ? ` (${img.imageAsset})` : '';
    notes.push(
      `Image field: visible text in the screenshot is embedded in the image asset${assetLabel} — do not add separate Sitecore fields for that text.`
    );
    if (img.textColumnTitle) {
      notes.push(`Title "${img.textColumnTitle}" is authored in the text column, not inside the image.`);
    }
    if (img.authorableTextColumnFields?.length) {
      notes.push(`Separate authored fields in the text column: ${img.authorableTextColumnFields.join(', ')}.`);
    }
  }

  const parent = components.find((c) => c.role === 'parent' || c.role === 'standalone');
  if (parent?.placeholders?.length) {
    for (const ph of parent.placeholders) {
      const key = readablePlaceholderKey(ph.key);
      const allowed = (ph.allowedRenderings ?? []).join(', ');
      notes.push(`Placeholder "${key}" → ${allowed || 'child renderings'} (${ph.layout ?? 'default layout'}).`);
    }
  } else if (components.length === 1 && !(components[0].placeholders ?? []).length) {
    notes.push('No Sitecore placeholders on this component.');
  }

  if (layoutAnalysis?.differsByViewport) {
    notes.push(
      `Responsive layout: desktop = ${layoutAnalysis.desktop?.layout ?? 'unknown'}, tablet = ${layoutAnalysis.tablet?.layout ?? 'unknown'}, mobile = ${layoutAnalysis.mobile?.layout ?? 'unknown'}.`
    );
  }

  if (layoutAnalysis?.sampleCardTitles?.length) {
    notes.push(`Sample card titles from HTML: ${layoutAnalysis.sampleCardTitles.slice(0, 5).join(', ')}.`);
  }

  if (entry.repeatCount) {
    notes.push(`Detected ${entry.repeatCount} repeated child elements in DOM.`);
  }
  if (entry.includesSectionTitle) {
    notes.push('Section title/intro is owned by the parent component (not a separate card crop).');
  }
  if (entry.placeholderFor) {
    notes.push(`Child card component "${entry.placeholderFor}" slots into parent placeholder.`);
  }
  if (entry.parentSection) {
    notes.push(`Representative child tile for parent section "${entry.parentSection}".`);
  }
  if (entry.type === 'carousel' && !layoutAnalysis?.differsByViewport) {
    notes.push('Carousel pattern on all viewports (or layout could not be split from HTML).');
  }
  if (entry.metadataOnly) {
    notes.push('Metadata only — no section screenshot (representative tile for grid/card pattern).');
  }

  return notes;
}

const REVIEW_NEXT_STEPS = [
  'Review the narrative summary and responsive layout notes against the section PNGs.',
  'Edit component names or fields in this file if the plan looks wrong, then set reviewStatus to "approved".',
  'Run sitecore-component-from-design for each component under implementationPlan.components.',
  'Create YAML artifacts listed under each component.yaml.artifacts.',
  'Wire renderings into page YAML via sitecore-page-from-design.',
];

export { REVIEW_NEXT_STEPS };
