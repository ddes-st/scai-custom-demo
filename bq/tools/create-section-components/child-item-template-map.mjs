/**
 * Always-on: when model.childItemTemplate exists but TSX still does
 * fields.Cards.map (treating children as a Field array), rewrite to
 * getDatasource().children.results — same crash mode as JSON bags.
 *
 * Also seed missing content.items[].children for media/feature grids from
 * section HTML when the Heading band is present in the capture.
 */
import { parseContentItemsFromDefinition } from './content-family-apply.mjs';
import {
  pathSafeChildItemName,
  rewriteTsxBagMapToChildResults,
} from './json-bag-field-map.mjs';
import { svgMarkupForCardTitle } from './icon-font-svg-markup.mjs';

/**
 * @param {string} s
 */
function escapeRegExp(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {string} definitionTs
 */
export function definitionHasChildItemTemplate(definitionTs) {
  return /\bchildItemTemplate\s*:/.test(String(definitionTs || ''));
}

/**
 * Inventory-ish field names that TSX may wrongly .map as arrays.
 * @param {string} tsx
 * @returns {string[]}
 */
export function findDirectMappedChildCollectionNames(tsx) {
  const src = String(tsx || '');
  /** @type {Set<string>} */
  const names = new Set();
  for (const m of src.matchAll(
    /fields(?:\.([A-Za-z_][\w]*)|\[\s*["']([^"']+)["']\s*\])\s*\.\s*map\s*\(/g,
  )) {
    names.add(m[1] || m[2]);
  }
  return [...names].filter((n) =>
    /^(Cards|Items|Tiles|Features|Reasons|Links|Options|Entries|Rows)$/i.test(
      n,
    ),
  );
}

/**
 * Infer rewrite kind from childItemTemplate field decls.
 * @param {string} definitionTs
 * @returns {'links'|'media'|'feature'|'generic'}
 */
export function inferKindFromChildItemTemplate(definitionTs) {
  const def = String(definitionTs || '');
  const block = def.match(/childItemTemplate\s*:\s*\{[\s\S]*?\n\s*\},/);
  const body = block?.[0] || def;
  if (
    /name:\s*["']Icon["']/.test(body) &&
    (/name:\s*["']Body["']/.test(body) || /name:\s*["']Title["']/.test(body))
  ) {
    return 'feature';
  }
  if (
    /name:\s*["']Image["']/.test(body) &&
    (/name:\s*["']Link["']/.test(body) || /name:\s*["']Action["']/.test(body))
  ) {
    return 'media';
  }
  if (/name:\s*["']Link\s*\d["']/.test(body) || /name:\s*["']Tone["']/.test(body)) {
    return 'links';
  }
  return 'generic';
}

/**
 * Extract media cards under an h2 whose text matches `heading`.
 * @param {string} sectionHtml
 * @param {string} heading
 */
export function extractMediaCardsUnderHeading(sectionHtml, heading) {
  const html = String(sectionHtml || '');
  const want = String(heading || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!html.trim() || !want) return [];

  const h2Re = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  /** @type {Array<{ index: number, title: string }>} */
  const heads = [];
  let m;
  while ((m = h2Re.exec(html))) {
    const title = String(m[1] || '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    heads.push({ index: m.index, title });
  }
  const hit = heads.find((h) => h.title.toLowerCase() === want);
  if (!hit) return [];
  const next = heads.find((h) => h.index > hit.index);
  const slice = html.slice(hit.index, next ? next.index : html.length);

  /** @type {Array<{ name: string, fields: Record<string, unknown> }>} */
  const children = [];
  const cardRe =
    /<a[^>]*href="([^"]*)"[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>[\s\S]*?(?:<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>|(?:Lees|Bekijk|Kijk)[^<]*)/gi;
  let cm;
  while ((cm = cardRe.exec(slice))) {
    const href = String(cm[1] || '#');
    const img = String(cm[2] || '');
    const title = String(cm[3] || '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const text = String(cm[4] || '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const actionHref = String(cm[5] || href);
    const actionText = String(cm[6] || '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!title) continue;
    children.push({
      name: pathSafeChildItemName(title, `Card ${children.length + 1}`),
      fields: {
        Title: title,
        Body: text,
        Text: text,
        Image: { url: img, alt: title },
        Link: { text: actionText || title, url: href },
        Action: { text: actionText || title, url: actionHref || href },
      },
    });
  }
  return children;
}

/**
 * Insert children: [...] after the first content item fields block when missing.
 * @param {string} definitionTs
 * @param {Array<{ name: string, fields: Record<string, unknown> }>} children
 */
export function injectChildrenSeedsIntoDefinition(definitionTs, children) {
  let text = String(definitionTs || '');
  if (!text.trim() || !children.length) return text;
  if (/\bchildren\s*:\s*\[/.test(text)) return text;

  const blocks = children.map((ch) => {
    const fieldLines = Object.entries(ch.fields || {})
      .map(([k, v]) => {
        const key = /[^A-Za-z0-9_]/.test(k) ? JSON.stringify(k) : k;
        if (v && typeof v === 'object') {
          const o = /** @type {Record<string, unknown>} */ (v);
          if (typeof o.svgMarkup === 'string' && o.svgMarkup.trim()) {
            return `          ${key}: { svgMarkup: ${JSON.stringify(String(o.svgMarkup))}, alt: ${JSON.stringify(String(o.alt || ''))} },`;
          }
          if (o.url != null || o.href != null || o.text != null) {
            const parts = [];
            if (o.text != null) parts.push(`text: ${JSON.stringify(String(o.text))}`);
            parts.push(`url: ${JSON.stringify(String(o.url || o.href || '#'))}`);
            return `          ${key}: { ${parts.join(', ')} },`;
          }
          if (o.src != null || o.alt != null || o.url != null) {
            return `          ${key}: { url: ${JSON.stringify(String(o.src || o.url || ''))}, alt: ${JSON.stringify(String(o.alt || ''))} },`;
          }
        }
        return `          ${key}: ${JSON.stringify(v)},`;
      })
      .join('\n');
    return `      {\n        name: ${JSON.stringify(ch.name)},\n        fields: {\n${fieldLines}\n        },\n      }`;
  });
  const lit = `[\n${blocks.join(',\n')},\n    ]`;

  // After last fields: { ... } inside content.items
  const fieldsRe = /\bfields\s*:\s*\{/g;
  let fm;
  /** @type {number[]} */
  const ends = [];
  while ((fm = fieldsRe.exec(text))) {
    let depth = 0;
    for (let i = fm.index; i < text.length; i++) {
      if (text[i] === '{') depth += 1;
      else if (text[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          ends.push(i);
          break;
        }
      }
    }
  }
  if (!ends.length) return text;
  let insertAt = ends[ends.length - 1] + 1;
  const needsComma = text[insertAt] !== ',';
  if (!needsComma) insertAt += 1;
  return (
    text.slice(0, ends[ends.length - 1] + 1) +
    `,\n        children: ${lit},` +
    text.slice(insertAt)
  );
}

/**
 * @param {{
 *   definitionTs?: string|null,
 *   tsx?: string|null,
 *   sectionHtml?: string|null,
 *   fontSvg?: string|null,
 * }} opts
 * @returns {{ definitionTs: string, tsx: string, rewritten: string[], seeded: boolean }}
 */
export function alignChildItemTemplateMapsAlwaysOn(opts = {}) {
  let def = String(opts.definitionTs || '');
  let tsx = String(opts.tsx || '');
  /** @type {string[]} */
  const rewritten = [];
  let seeded = false;

  if (!definitionHasChildItemTemplate(def)) {
    return { definitionTs: def, tsx, rewritten, seeded };
  }

  const mapped = findDirectMappedChildCollectionNames(tsx);
  if (mapped.length) {
    const kind = inferKindFromChildItemTemplate(def);
    for (const bagName of mapped) {
      tsx = rewriteTsxBagMapToChildResults(tsx, def, { bagName, kind });
      rewritten.push(bagName);
    }
  }

  // Seed children from HTML when Heading is set but children missing
  const items = parseContentItemsFromDefinition(def);
  const first = items[0];
  const hasChildren =
    Array.isArray(first?.children) && first.children.length > 0;
  const heading = String(
    first?.fields?.Heading || first?.fields?.heading || '',
  ).trim();
  const kind = inferKindFromChildItemTemplate(def);
  if (!hasChildren && heading && opts.sectionHtml) {
    if (kind === 'media') {
      const kids = extractMediaCardsUnderHeading(
        String(opts.sectionHtml),
        heading,
      );
      if (kids.length) {
        def = injectChildrenSeedsIntoDefinition(def, kids);
        seeded = true;
      }
    } else if (kind === 'feature') {
      const kids = extractFeatureCardsUnderHeading(
        String(opts.sectionHtml),
        heading,
        opts.fontSvg || '',
      );
      if (kids.length) {
        // Ensure Icon is Image-typed on childItemTemplate
        def = def.replace(
          /(\{\s*name:\s*['"]Icon['"]\s*,\s*type:\s*)['"]Single-Line Text['"]/,
          '$1\'Image\'',
        );
        def = injectChildrenSeedsIntoDefinition(def, kids);
        seeded = true;
        // Paint Icon with <Image> when still Text-based
        if (/<Text\s+field=\{[^}]*Icon/.test(tsx)) {
          if (
            !/(?:^|\n)import\s*\{[^}]*\bImage\b[^}]*\}\s*from\s*['"]@sitecore-content-sdk\/nextjs['"]/.test(
              tsx,
            )
          ) {
            tsx = `import { Image } from '@sitecore-content-sdk/nextjs';\n${tsx}`;
          }
          tsx = tsx.replace(
            /<div[^>]*aria-hidden="true"[^>]*>\s*<Text\s+field=\{card\.fields\.Icon\}\s*\/>\s*<\/div>/g,
            `<span aria-hidden="true" className="mx-auto mb-6 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-4 border-[#fcb53c] bg-[#043572] p-2"><Image field={card.fields.Icon} className="h-full w-full object-contain" /></span>`,
          );
          tsx = tsx.replace(
            /<Text\s+field=\{card\.fields\.Icon\}\s*\/>/g,
            `<Image field={card.fields.Icon} className="mx-auto mb-6 h-12 w-12 object-contain" />`,
          );
        }
      }
    }
  }

  return { definitionTs: def, tsx, rewritten, seeded };
}

/**
 * Feature tiles under an h2: title + body + icon-font → Icon svgMarkup.
 * @param {string} sectionHtml
 * @param {string} heading
 * @param {string} fontSvg
 */
export function extractFeatureCardsUnderHeading(sectionHtml, heading, fontSvg) {
  const html = String(sectionHtml || '');
  const want = String(heading || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!html.trim() || !want) return [];

  const h2Re = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  /** @type {Array<{ index: number, title: string }>} */
  const heads = [];
  let m;
  while ((m = h2Re.exec(html))) {
    const title = String(m[1] || '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    heads.push({ index: m.index, title });
  }
  const hit = heads.find((h) => h.title.toLowerCase() === want);
  if (!hit) return [];
  const next = heads.find((h) => h.index > hit.index);
  const slice = html.slice(hit.index, next ? next.index : html.length);

  /** @type {Array<{ name: string, fields: Record<string, unknown> }>} */
  const children = [];
  const cardRe =
    /<div[^>]*class="[^"]*\bcard\b[^"]*"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/gi;
  let cm;
  while ((cm = cardRe.exec(slice))) {
    const title = String(cm[1] || '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const body = String(cm[2] || '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!title) continue;
    /** @type {Record<string, unknown>} */
    const fields = { Title: title, Body: body };
    const markup = svgMarkupForCardTitle({
      sectionHtml: html,
      fontSvg: String(fontSvg || ''),
      title,
    });
    if (markup) {
      fields.Icon = { svgMarkup: markup, alt: title };
    } else {
      fields.Icon = { url: '', alt: title };
    }
    children.push({
      name: pathSafeChildItemName(title, `Card ${children.length + 1}`),
      fields,
    });
  }
  return children;
}
