/**
 * Multi-LineText JSON bag fields that TSX wrongly treats as arrays
 * (`fields.Cards.map`) crash preview/runtime and blank sitecoreize-proof shots.
 *
 * Preferred always-on: promote bag → model.childItemTemplate + content children
 * and rewrite TSX to getDatasource().children.results (real Sitecore items).
 * Fallback only: parse+hydrate helpers when promote cannot rewrite the TSX shell.
 */
import { parseContentItemsFromDefinition } from './content-family-apply.mjs';
import { svgMarkupForCardTitle } from './icon-font-svg-markup.mjs';
import { proposeValidItemName } from '../shared/naming.ts';

/**
 * Path-safe child seed name from a bag title (keep punctuation in Title field).
 * @param {string} title
 * @param {string} [fallback]
 * @returns {string}
 */
export function pathSafeChildItemName(title, fallback = 'Card') {
  return proposeValidItemName(String(title || '').slice(0, 80), fallback);
}

/**
 * @param {string} s
 */
function escapeRegExp(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {string} definitionTs
 * @returns {string[]}
 */
function listMultiLineTextFieldNamesLocal(definitionTs) {
  const def = String(definitionTs || '');
  /** @type {Set<string>} */
  const names = new Set();
  for (const m of def.matchAll(
    /\{\s*name:\s*["']([^"']+)["']\s*,\s*type:\s*["']Multi-Line Text["']/gi,
  )) {
    names.add(m[1]);
  }
  for (const m of def.matchAll(
    /\{\s*type:\s*["']Multi-Line Text["']\s*,\s*name:\s*["']([^"']+)["']/gi,
  )) {
    names.add(m[1]);
  }
  return [...names];
}

/**
 * @param {string} tsx
 * @param {string} fieldName
 */
function tsxPaintsJsonBagFieldLocal(tsx, fieldName) {
  const src = String(tsx || '');
  if (!src.trim() || !fieldName) return false;
  const esc = escapeRegExp(fieldName);
  const fieldRef = new RegExp(
    `fields(?:\\.${esc}|\\[\\s*["']${esc}["']\\s*\\])`,
  );
  if (!fieldRef.test(src)) return false;
  if (!/JSON\.parse\s*\(/.test(src)) return false;
  if (!/\.map\s*\(/.test(src)) return false;
  return true;
}

/**
 * @param {string} name
 */
function bagHelperIdent(name) {
  return String(name || '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^(\d)/, '_$1');
}

/**
 * True when a Multi-LineText seed looks like a JSON array bag.
 * @param {string} definitionTs
 * @param {string} fieldName
 */
export function multiLineFieldHasJsonArraySeed(definitionTs, fieldName) {
  const def = String(definitionTs || '');
  const name = String(fieldName || '').trim();
  if (!def.trim() || !name) return false;
  const esc = escapeRegExp(name);
  const stringifyRe = new RegExp(
    `(?:["']${esc}["']|\\b${esc}\\b)\\s*:\\s*JSON\\.stringify\\s*\\(\\s*\\[`,
    'i',
  );
  if (stringifyRe.test(def)) return true;
  const quotedRe = new RegExp(
    `(?:["']${esc}["']|\\b${esc}\\b)\\s*:\\s*(["'\`])\\s*\\[`,
    'g',
  );
  return quotedRe.test(def);
}

/**
 * Multi-LineText fields whose content seed is a JSON array.
 * @param {string} definitionTs
 * @returns {string[]}
 */
export function findJsonArrayBagFieldNames(definitionTs) {
  return listMultiLineTextFieldNamesLocal(definitionTs).filter((name) =>
    multiLineFieldHasJsonArraySeed(definitionTs, name),
  );
}

/**
 * True when TSX calls `.map` directly on fields.Name / fields['Name']
 * without JSON.parse of that bag (runtime crash when Name is a Field).
 * @param {string} tsx
 * @param {string} fieldName
 */
export function tsxDirectMapsFieldAsArray(tsx, fieldName) {
  const src = String(tsx || '');
  const name = String(fieldName || '').trim();
  if (!src.trim() || !name) return false;
  if (tsxPaintsJsonBagFieldLocal(src, name)) return false;
  const esc = escapeRegExp(name);
  const re = new RegExp(
    `fields(?:\\.${esc}|\\[\\s*["']${esc}["']\\s*\\])\\s*\\.\\s*map\\s*\\(`,
  );
  return re.test(src);
}

/**
 * CONTRACT: Multi-LineText JSON bags must not be iterated as Field arrays.
 * @param {{ definitionTs?: string|null, tsx?: string|null }} opts
 * @returns {string[]}
 */
/**
 * CONTRACT: empty rounded-full icon chrome when feature cards / HTML icons exist.
 * @param {{ tsx?: string|null, definitionTs?: string|null, sectionHtml?: string|null }} opts
 * @returns {string[]}
 */
export function collectEmptyIconCircleContractDiagnostics(opts = {}) {
  const tsx = String(opts.tsx || '');
  const html = String(opts.sectionHtml || '');
  const def = String(opts.definitionTs || '');
  if (!tsx.trim()) return [];
  const hasEmptyCircle =
    /<span[^>]*aria-hidden="true"[^>]*className="[^"]*rounded-full[^"]*"[^>]*\/>/.test(
      tsx,
    ) ||
    /<span[^>]*aria-hidden="true"[^>]*className="[^"]*rounded-full[^"]*"[^>]*>\s*<\/span>/.test(
      tsx,
    );
  if (!hasEmptyCircle) return [];
  const htmlHasIconFont =
    /\bic-[a-z0-9-]+/i.test(html) || /data-bq-glyph=/.test(html);
  const bagLooksFeature =
    /title["']?\s*:/.test(def) &&
    /body["']?\s*:/.test(def) &&
    /Cards|Items|Tiles/.test(def);
  if (!htmlHasIconFont && !bagLooksFeature) return [];
  return [
    'CONTRACT: empty rounded-full icon chrome must be Sitecore Image (Icon) with { svgMarkup, alt } from capture icon-font glyphs — never ship blank circles when HTML has ic-* / data-bq-glyph',
  ];
}

export function collectJsonBagDirectMapContractDiagnostics(opts = {}) {
  const def = String(opts.definitionTs || '');
  const tsx = String(opts.tsx || '');
  if (!def.trim()) return [];
  const bags = findJsonArrayBagFieldNames(def);
  if (!bags.length) return [];
  /** @type {string[]} */
  const out = [];
  // Any remaining card/item JSON bag is invalid Sitecore modeling for apply/authoring.
  const inventoryBags = bags.filter((n) => isInventoryBagFieldName(n));
  if (inventoryBags.length) {
    out.push(
      `CONTRACT: Multi-LineText JSON bag(s) (${inventoryBags.join(', ')}) must be model.childItemTemplate + content.items[].children seeds — never JSON.stringify card/item arrays (authors cannot edit JSON; apply/Edge need real child items). TSX must use getDatasource().children.results`,
    );
  }
  if (tsx.trim()) {
    const direct = bags.filter((name) => tsxDirectMapsFieldAsArray(tsx, name));
    if (direct.length) {
      out.push(
        `CONTRACT: fields.X.map on Multi-LineText bag(s) (${direct.join(', ')}) — Field objects are not arrays (blank sitecoreize-proof). Use childItemTemplate + getDatasource().children.results`,
      );
    }
  }
  return out;
}

/**
 * @param {string} name
 */
export function isInventoryBagFieldName(name) {
  const n = String(name || '').trim();
  if (!n) return false;
  if (/^(Cards?|Items?|Rows?|Tiles?|Entries|Blocks?|Bands?)$/i.test(n)) {
    return true;
  }
  return /card|item|row|tile|entr|block|band/i.test(n);
}

/**
 * Hydrate a parsed JSON bag row into Sitecore-ish Field shapes for Text/Link/Image.
 * @param {unknown} row
 * @returns {unknown}
 */
export function hydrateJsonBagRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
  const obj = /** @type {Record<string, unknown>} */ (row);
  // Already Field-shaped
  if (
    obj.title &&
    typeof obj.title === 'object' &&
    obj.title != null &&
    'value' in /** @type {object} */ (obj.title)
  ) {
    return row;
  }
  /** @type {Record<string, unknown>} */
  const out = { ...obj };
  if (obj.title != null && typeof obj.title !== 'object') {
    out.title = { value: String(obj.title) };
  }
  const links = Array.isArray(obj.links) ? obj.links : null;
  if (links) {
    links.forEach((l, i) => {
      const link = l && typeof l === 'object' ? /** @type {Record<string, unknown>} */ (l) : {};
      const href = String(link.href || link.url || '#');
      const text = String(link.label || link.text || '');
      out[`Link ${i + 1}`] = {
        value: { href, text, linktype: 'external', url: href },
      };
    });
  }
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'links' || k === 'title' || k === 'tone') continue;
    if (v == null) continue;
    if (typeof v !== 'object') {
      out[k] = { value: v };
      continue;
    }
    const o = /** @type {Record<string, unknown>} */ (v);
    if ('value' in o) {
      out[k] = v;
      continue;
    }
    if (o.href != null || o.url != null || o.text != null || o.label != null) {
      const href = String(o.href || o.url || '#');
      out[k] = {
        value: {
          href,
          text: String(o.text || o.label || ''),
          linktype: 'external',
          url: href,
        },
      };
      continue;
    }
    if (o.src != null || ((o.url != null || o.href != null) && o.alt != null)) {
      out[k] = {
        value: {
          src: String(o.src || o.url || o.href || ''),
          alt: String(o.alt || o.Alt || ''),
        },
      };
    }
  }
  return out;
}

/**
 * Parse a Field/string/array bag into hydrated row objects.
 * @param {unknown} field
 * @returns {unknown[]}
 */
export function parseJsonBagField(field) {
  if (Array.isArray(field)) {
    return field.map((row) => hydrateJsonBagRow(row));
  }
  let raw = field;
  if (raw && typeof raw === 'object' && 'value' in /** @type {object} */ (raw)) {
    raw = /** @type {{ value?: unknown }} */ (raw).value;
  }
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((row) => hydrateJsonBagRow(row));
  } catch {
    return [];
  }
}

/**
 * Preview-only: replace Field `{value: jsonString}` with hydrated arrays when
 * TSX does fields.X.map without JSON.parse (prevents blank proof shots).
 * @param {Record<string, unknown>|null|undefined} fields
 * @param {string} tsxSource
 * @returns {Record<string, unknown>}
 */
export function hydrateDirectMappedJsonBagFields(fields, tsxSource) {
  const src = String(tsxSource || '');
  const out =
    fields && typeof fields === 'object' ? { ...fields } : {};
  if (!src.trim()) return out;
  for (const [name, field] of Object.entries(out)) {
    if (!tsxDirectMapsFieldAsArray(src, name)) continue;
    if (!field || typeof field !== 'object' || !('value' in field)) continue;
    const value = /** @type {{ value?: unknown }} */ (field).value;
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed.startsWith('[')) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (!Array.isArray(parsed)) continue;
      out[name] = parsed.map((row) => hydrateJsonBagRow(row));
    } catch {
      /* keep Field */
    }
  }
  return out;
}

const BAG_HELPER_SOURCE = `function __bqHydrateJsonBagRow(row: unknown): Record<string, unknown> | unknown {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
  const src = row as Record<string, unknown>;
  if (src.title && typeof src.title === 'object' && src.title != null && 'value' in src.title) {
    return src;
  }
  const out: Record<string, unknown> = { ...src };
  if (src.title != null && typeof src.title !== 'object') {
    out.title = { value: String(src.title) };
  }
  const links = Array.isArray(src.links) ? src.links : null;
  if (links) {
    links.forEach((l: unknown, i: number) => {
      const link = l && typeof l === 'object' ? (l as Record<string, unknown>) : {};
      const href = String(link.href || link.url || '#');
      out['Link ' + (i + 1)] = {
        value: {
          href,
          text: String(link.label || link.text || ''),
          linktype: 'external',
          url: href,
        },
      };
    });
  }
  for (const [k, v] of Object.entries(src)) {
    if (k === 'links' || k === 'title' || k === 'tone') continue;
    if (v == null) continue;
    if (typeof v !== 'object') {
      out[k] = { value: v };
      continue;
    }
    const o = v as Record<string, unknown>;
    if ('value' in o) {
      out[k] = v;
      continue;
    }
    if (o.href != null || o.url != null || o.text != null || o.label != null) {
      const href = String(o.href || o.url || '#');
      out[k] = {
        value: {
          href,
          text: String(o.text || o.label || ''),
          linktype: 'external',
          url: href,
        },
      };
      continue;
    }
    if (o.src != null || ((o.url != null || o.href != null) && o.alt != null)) {
      out[k] = {
        value: {
          src: String(o.src || o.url || o.href || ''),
          alt: String(o.alt || o.Alt || ''),
        },
      };
    }
  }
  return out;
}
function __bqParseJsonBagField(field: unknown): unknown[] {
  if (Array.isArray(field)) return field.map((row: unknown) => __bqHydrateJsonBagRow(row));
  const raw =
    field && typeof field === 'object' && 'value' in (field as object)
      ? (field as { value?: unknown }).value
      : field;
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((row: unknown) => __bqHydrateJsonBagRow(row));
  } catch {
    return [];
  }
}
`;

/**
 * Always-on: rewrite fields.X.map → __bqParseJsonBagField(fields.X).map for
 * Multi-LineText JSON bag fields, and type X as Field<string>.
 * @param {string} tsx
 * @param {string} definitionTs
 * @returns {string}
 */
export function rewriteDirectJsonBagFieldMaps(tsx, definitionTs) {
  let text = String(tsx || '');
  const def = String(definitionTs || '');
  if (!text.trim() || !def.trim()) return text;
  const bags = findJsonArrayBagFieldNames(def).filter((name) =>
    tsxDirectMapsFieldAsArray(text, name),
  );
  if (!bags.length) return text;

  if (!/function\s+__bqParseJsonBagField\s*\(/.test(text)) {
    if (/export const Default/.test(text)) {
      text = text.replace(
        /export const Default/,
        `${BAG_HELPER_SOURCE}\nexport const Default`,
      );
    } else {
      text = `${BAG_HELPER_SOURCE}\n${text}`;
    }
  }

  for (const name of bags) {
    const esc = escapeRegExp(name);
    const ident = bagHelperIdent(name);
    const mapRe = new RegExp(
      `fields(?:\\.${esc}|\\[\\s*["']${esc}["']\\s*\\])\\s*\\.\\s*map\\s*\\(`,
      'g',
    );
    text = text.replace(
      mapRe,
      `__bqParseJsonBagField(fields.${ident === name ? name : `['${name}']`}).map(`,
    );
    // Prefer fields.Name when ident is a valid identifier
    if (/^[A-Za-z_][\w]*$/.test(name)) {
      text = text.replace(
        new RegExp(
          `__bqParseJsonBagField\\(fields\\.\\['${esc}'\\]\\)\\.map\\(`,
          'g',
        ),
        `__bqParseJsonBagField(fields.${name}).map(`,
      );
    }
    // Cards: Card[] → Cards: Field<string>
    if (/^[A-Za-z_][\w]*$/.test(name)) {
      text = text.replace(
        new RegExp(`(\\b${esc}\\s*:\\s*)[A-Za-z_][\\w]*\\[\\]`, 'g'),
        `$1Field<string>`,
      );
    }
  }

  if (
    /\bField\s*</.test(text) &&
    !/import\s+type\s*\{[^}]*\bField\b/.test(text) &&
    !/import\s*\{[^}]*\bField\b/.test(text)
  ) {
    if (/from\s+['"]@sitecore-content-sdk\/nextjs['"]/.test(text)) {
      text = text.replace(
        /(import\s+type\s*\{)([^}]*)(\}\s*from\s*['"]@sitecore-content-sdk\/nextjs['"])/,
        (full, a, mid, c) => {
          if (/\bField\b/.test(mid)) return full;
          const trimmed = String(mid).trim();
          return `${a} Field, ${trimmed}${c}`;
        },
      );
      if (!/import\s+type\s*\{[^}]*\bField\b/.test(text)) {
        text = text.replace(
          /(import\s*\{)([^}]*)(\}\s*from\s*['"]@sitecore-content-sdk\/nextjs['"])/,
          (full, a, mid, c) => {
            if (/\bField\b/.test(mid)) return full;
            return `${a} type Field, ${mid}${c}`;
          },
        );
      }
    }
  }

  return text;
}

/**
 * @param {unknown} rows
 * @returns {{
 *   childName: string,
 *   fieldDecls: Array<{ name: string, type: string }>,
 *   children: Array<{ name: string, fields: Record<string, unknown> }>,
 *   kind: 'links'|'media'|'feature'|'generic',
 * }}
 */
export function inferChildItemTemplateFromBagRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const first =
    list.find((r) => r && typeof r === 'object') ||
    /** @type {Record<string, unknown>} */ ({});
  const row0 = /** @type {Record<string, unknown>} */ (first);

  if (Array.isArray(row0.links)) {
    const maxLinks = Math.max(
      1,
      ...list.map((r) =>
        Array.isArray(/** @type {Record<string, unknown>} */ (r)?.links)
          ? /** @type {unknown[]} */ (
              /** @type {Record<string, unknown>} */ (r).links
            ).length
          : 0,
      ),
    );
    /** @type {Array<{ name: string, type: string }>} */
    const fieldDecls = [{ name: 'Title', type: 'Single-Line Text' }];
    if (list.some((r) => /** @type {Record<string, unknown>} */ (r)?.tone != null)) {
      fieldDecls.push({ name: 'Theme', type: 'Single-Line Text' });
    }
    for (let i = 1; i <= Math.min(maxLinks, 8); i++) {
      fieldDecls.push({ name: `Link ${i}`, type: 'General Link' });
    }
    const children = list.map((raw, i) => {
      const row = /** @type {Record<string, unknown>} */ (raw || {});
      const links = Array.isArray(row.links) ? row.links : [];
      /** @type {Record<string, unknown>} */
      const fields = { Title: String(row.title || `Card ${i + 1}`) };
      if (row.tone != null) fields.Theme = String(row.tone);
      links.forEach((l, idx) => {
        const link = l && typeof l === 'object' ? /** @type {Record<string, unknown>} */ (l) : {};
        fields[`Link ${idx + 1}`] = {
          text: String(link.label || link.text || ''),
          url: String(link.href || link.url || '#'),
        };
      });
      const title = String(row.title || `Card ${i + 1}`);
      return {
        name: pathSafeChildItemName(title, `Card ${i + 1}`),
        fields,
      };
    });
    return { childName: 'Card', fieldDecls, children, kind: 'links' };
  }

  // Title + body feature tiles (often icon-font chrome in HTML → Icon Image)
  if (
    row0.title != null &&
    row0.body != null &&
    row0.image == null &&
    row0.links == null &&
    row0.href == null
  ) {
    /** @type {Array<{ name: string, type: string }>} */
    const fieldDecls = [
      { name: 'Title', type: 'Single-Line Text' },
      { name: 'Body', type: 'Multi-Line Text' },
      { name: 'Icon', type: 'Image' },
    ];
    const children = list.map((raw, i) => {
      const row = /** @type {Record<string, unknown>} */ (raw || {});
      const title = String(row.title || `Card ${i + 1}`);
      /** @type {Record<string, unknown>} */
      const fields = {
        Title: title,
        Body: String(row.body || ''),
        Icon: { url: '', alt: title },
      };
      if (typeof row.icon === 'string' && row.icon.trim().startsWith('<svg')) {
        fields.Icon = { svgMarkup: row.icon, alt: title };
      } else if (row.icon && typeof row.icon === 'object') {
        const o = /** @type {Record<string, unknown>} */ (row.icon);
        if (typeof o.svgMarkup === 'string' && o.svgMarkup.trim()) {
          fields.Icon = {
            svgMarkup: String(o.svgMarkup),
            alt: String(o.alt || title),
          };
        } else if (o.url || o.src) {
          fields.Icon = {
            url: String(o.url || o.src || ''),
            alt: String(o.alt || title),
          };
        }
      }
      return {
        name: pathSafeChildItemName(title, `Card ${i + 1}`),
        fields,
      };
    });
    return { childName: 'Card', fieldDecls, children, kind: 'feature' };
  }

  if (
    row0.image != null ||
    (row0.title != null && (row0.text != null || row0.href != null))
  ) {
    /** @type {Array<{ name: string, type: string }>} */
    const fieldDecls = [
      { name: 'Title', type: 'Single-Line Text' },
      { name: 'Text', type: 'Multi-Line Text' },
      { name: 'Image', type: 'Image' },
      { name: 'Link', type: 'General Link' },
      { name: 'Action', type: 'General Link' },
    ];
    const children = list.map((raw, i) => {
      const row = /** @type {Record<string, unknown>} */ (raw || {});
      const href = String(row.href || row.url || '#');
      const actionText = String(row.action || row.cta || row.title || '');
      const imageSrc = String(row.image || row.imageSrc || row.src || '');
      const imageAlt = String(row.imageAlt || row.alt || row.title || '');
      const title = String(row.title || `Card ${i + 1}`);
      return {
        name: pathSafeChildItemName(title, `Card ${i + 1}`),
        fields: {
          Title: title,
          Text: String(row.text || row.description || ''),
          Image: { url: imageSrc, alt: imageAlt },
          Link: { text: actionText, url: href },
          Action: { text: actionText, url: href },
        },
      };
    });
    return { childName: 'Card', fieldDecls, children, kind: 'media' };
  }

  /** @type {Array<{ name: string, type: string }>} */
  const fieldDecls = [];
  /** @type {Set<string>} */
  const seen = new Set();
  for (const [k, v] of Object.entries(row0)) {
    if (seen.has(k) || k === 'links') continue;
    seen.add(k);
    const name = k.charAt(0).toUpperCase() + k.slice(1);
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const o = /** @type {Record<string, unknown>} */ (v);
      if (o.href != null || o.url != null || o.text != null) {
        fieldDecls.push({ name, type: 'General Link' });
        continue;
      }
      if (o.src != null || o.alt != null) {
        fieldDecls.push({ name, type: 'Image' });
        continue;
      }
    }
    fieldDecls.push({
      name,
      type: typeof v === 'string' && String(v).length > 120 ? 'Multi-Line Text' : 'Single-Line Text',
    });
  }
  if (!fieldDecls.length) {
    fieldDecls.push({ name: 'Title', type: 'Single-Line Text' });
  }
  const children = list.map((raw, i) => {
    const row = /** @type {Record<string, unknown>} */ (raw || {});
    /** @type {Record<string, unknown>} */
    const fields = {};
    for (const decl of fieldDecls) {
      const key = Object.keys(row).find(
        (k) => k.toLowerCase() === decl.name.toLowerCase(),
      );
      const v = key != null ? row[key] : undefined;
      if (decl.type === 'General Link' && v && typeof v === 'object') {
        const o = /** @type {Record<string, unknown>} */ (v);
        fields[decl.name] = {
          text: String(o.text || o.label || ''),
          url: String(o.url || o.href || '#'),
        };
      } else if (decl.type === 'Image' && v && typeof v === 'object') {
        const o = /** @type {Record<string, unknown>} */ (v);
        fields[decl.name] = {
          url: String(o.src || o.url || ''),
          alt: String(o.alt || ''),
        };
      } else {
        fields[decl.name] = v != null ? String(v) : '';
      }
    }
    const title = String(fields.Title || fields.Name || `Item ${i + 1}`);
    return {
      name: pathSafeChildItemName(title, `Item ${i + 1}`),
      fields,
    };
  });
  return { childName: 'Item', fieldDecls, children, kind: 'generic' };
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function formatSeedLiteral(value) {
  if (value == null) return "''";
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'object') {
    const o = /** @type {Record<string, unknown>} */ (value);
    if (o.url != null || o.href != null || o.text != null) {
      const parts = [];
      if (o.text != null) parts.push(`text: ${JSON.stringify(String(o.text))}`);
      parts.push(`url: ${JSON.stringify(String(o.url || o.href || '#'))}`);
      return `{ ${parts.join(', ')} }`;
    }
    if (typeof o.svgMarkup === 'string' && o.svgMarkup.trim()) {
      return `{ svgMarkup: ${JSON.stringify(String(o.svgMarkup))}, alt: ${JSON.stringify(String(o.alt || ''))} }`;
    }
    if (o.alt != null || o.src != null || o.url != null) {
      return `{ url: ${JSON.stringify(String(o.src || o.url || ''))}, alt: ${JSON.stringify(String(o.alt || ''))} }`;
    }
  }
  return JSON.stringify(value);
}

/**
 * Fill feature-card Icon seeds from section HTML icon-font glyphs.
 * @param {{
 *   children: Array<{ name: string, fields: Record<string, unknown> }>,
 *   fieldDecls: Array<{ name: string, type: string }>,
 *   kind: string,
 *   childName: string,
 * }} inferred
 * @param {{ sectionHtml?: string|null, fontSvg?: string|null }} [opts]
 */
export function enrichFeatureCardIconsFromHtml(inferred, opts = {}) {
  if (!inferred || inferred.kind !== 'feature') return inferred;
  const html = String(opts.sectionHtml || '');
  const fontSvg = String(opts.fontSvg || '');
  if (!html.trim() || !fontSvg.trim()) return inferred;
  for (const ch of inferred.children || []) {
    const title = String(ch.fields?.Title || ch.name || '');
    const markup = svgMarkupForCardTitle({
      sectionHtml: html,
      fontSvg,
      title,
    });
    if (!markup) continue;
    ch.fields.Icon = { svgMarkup: markup, alt: title };
  }
  return inferred;
}

/**
 * @param {Array<{ name: string, fields: Record<string, unknown> }>} children
 */
function formatChildrenLiteral(children) {
  const blocks = children.map((ch) => {
    const fieldLines = Object.entries(ch.fields || {})
      .map(([k, v]) => {
        const key = /[^A-Za-z0-9_]/.test(k) ? JSON.stringify(k) : k;
        return `          ${key}: ${formatSeedLiteral(v)},`;
      })
      .join('\n');
    return `      {\n        name: ${JSON.stringify(ch.name)},\n        fields: {\n${fieldLines}\n        },\n      }`;
  });
  return `[\n${blocks.join(',\n')},\n    ]`;
}

/**
 * Promote inventory Multi-LineText JSON bags → childItemTemplate + children seeds.
 * @param {string} definitionTs
 * @param {{ sectionHtml?: string|null, fontSvg?: string|null }} [opts]
 * @returns {{ text: string, promoted: string[], kinds: Record<string, string> }}
 */
export function promoteJsonBagDefinitionToChildItemTemplate(
  definitionTs,
  opts = {},
) {
  let text = String(definitionTs || '');
  if (!text.trim()) return { text, promoted: [], kinds: {} };
  const bags = findJsonArrayBagFieldNames(text).filter((n) =>
    isInventoryBagFieldName(n),
  );
  if (!bags.length) return { text, promoted: [], kinds: {} };
  if (/\bchildItemTemplate\s*:/.test(text) && !bags.length) {
    return { text, promoted: [], kinds: {} };
  }

  const items = parseContentItemsFromDefinition(text);
  /** @type {string[]} */
  const promoted = [];
  /** @type {Record<string, string>} */
  const kinds = {};

  for (const bagName of bags) {
    // Find first item that has this bag
    let rows = null;
    for (const item of items) {
      const raw = item?.fields?.[bagName];
      if (typeof raw !== 'string') continue;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          rows = parsed;
          break;
        }
      } catch {
        /* continue */
      }
    }
    if (!rows) continue;

    let inferred = inferChildItemTemplateFromBagRows(rows);
    inferred = enrichFeatureCardIconsFromHtml(inferred, opts);
    kinds[bagName] = inferred.kind;
    promoted.push(bagName);

    // Remove Multi-LineText field decl for bag
    text = text.replace(
      new RegExp(
        `\\{\\s*name:\\s*['"]${escapeRegExp(bagName)}['"]\\s*,\\s*type:\\s*['"]Multi-Line Text['"]\\s*,?\\s*\\},?\\s*`,
        'g',
      ),
      '',
    );
    text = text.replace(
      new RegExp(
        `\\{\\s*type:\\s*['"]Multi-Line Text['"]\\s*,\\s*name:\\s*['"]${escapeRegExp(bagName)}['"]\\s*,?\\s*\\},?\\s*`,
        'g',
      ),
      '',
    );

    // Insert childItemTemplate if missing
    if (!/\bchildItemTemplate\s*:/.test(text)) {
      const fieldLit = inferred.fieldDecls
        .map((f) => `          { name: ${JSON.stringify(f.name)}, type: ${JSON.stringify(f.type)} },`)
        .join('\n');
      const childBlock = `childItemTemplate: {
      name: ${JSON.stringify(inferred.childName)},
      sections: [
        {
          name: 'Content',
          fields: [
${fieldLit}
          ],
        },
      ],
    },`;
      // After itemTemplate's closing `},` that precedes placeholders/content or model end
      const itemTpl = /\bitemTemplate\s*:\s*\{/.exec(text);
      if (itemTpl && itemTpl.index != null) {
        let depth = 0;
        let end = -1;
        for (let i = itemTpl.index; i < text.length; i++) {
          const ch = text[i];
          if (ch === '{') depth += 1;
          else if (ch === '}') {
            depth -= 1;
            if (depth === 0) {
              end = i;
              break;
            }
          }
        }
        if (end > 0) {
          // Skip optional comma/whitespace after itemTemplate
          let insertAt = end + 1;
          if (text[insertAt] === ',') insertAt += 1;
          text =
            text.slice(0, insertAt) +
            `\n    ${childBlock}` +
            text.slice(insertAt);
        }
      }
    }

    // Replace bag seed with children on each content item
    const esc = escapeRegExp(bagName);
    const bagSeedRe = new RegExp(
      `(?:["']${esc}["']|\\b${esc}\\b)\\s*:\\s*JSON\\.stringify\\s*\\(`,
      'g',
    );
    let m;
    const replacements = [];
    while ((m = bagSeedRe.exec(text))) {
      // Find matching closing `)` for stringify
      let depth = 0;
      let endParen = -1;
      for (let i = m.index + m[0].length - 1; i < text.length; i++) {
        const ch = text[i];
        if (ch === '(') depth += 1;
        else if (ch === ')') {
          depth -= 1;
          if (depth === 0) {
            endParen = i;
            break;
          }
        }
      }
      if (endParen < 0) continue;
      let end = endParen + 1;
      if (text[end] === ',') end += 1;
      replacements.push({ start: m.index, end });
    }
    // Apply from end so indexes stay valid — use same children for all (typical single item)
    const childrenLit = formatChildrenLiteral(inferred.children);
    for (let i = replacements.length - 1; i >= 0; i--) {
      const { start, end } = replacements[i];
      // Remove bag field line; children inserted after fields block below
      text = text.slice(0, start) + text.slice(end);
    }

    // Insert children: after each fields: { ... }, that no longer has the bag
    // Find content items' fields blocks and append children sibling if missing
    if (!/\bchildren\s*:\s*\[/.test(text)) {
      // After first `fields: { ... },` inside content.items, add children
      const fieldsRe = /\bfields\s*:\s*\{/g;
      let fm;
      /** @type {number[]} */
      const fieldEnds = [];
      while ((fm = fieldsRe.exec(text))) {
        let depth = 0;
        for (let i = fm.index; i < text.length; i++) {
          if (text[i] === '{') depth += 1;
          else if (text[i] === '}') {
            depth -= 1;
            if (depth === 0) {
              fieldEnds.push(i);
              break;
            }
          }
        }
      }
      // Prefer the content item fields (usually last/first substantial) — insert after first fields in items
      if (fieldEnds.length) {
        let insertAt = fieldEnds[fieldEnds.length - 1] + 1;
        if (text[insertAt] === ',') insertAt += 1;
        text =
          text.slice(0, insertAt) +
          `\n        children: ${childrenLit},` +
          text.slice(insertAt);
      }
    }
  }

  return { text, promoted, kinds };
}

/**
 * Rewrite bag-mapping TSX to getDatasource + children.results (List.reference).
 * Preserves outer JSX shell when possible.
 * @param {string} tsx
 * @param {string} definitionTs
 * @param {{ kind?: string, bagName?: string }} [meta]
 */
export function rewriteTsxBagMapToChildResults(tsx, definitionTs, meta = {}) {
  let text = String(tsx || '');
  const def = String(definitionTs || '');
  const bagName = meta.bagName || findJsonArrayBagFieldNames(def)[0] || 'Cards';
  if (!text.trim()) return text;

  // Strip prior parse-helper band-aid
  text = text.replace(
    /function __bqHydrateJsonBagRow[\s\S]*?function __bqParseJsonBagField[\s\S]*?\n\}\n*/,
    '',
  );
  text = text.replace(
    /const parseCards\s*=\s*\([^)]*\)\s*:\s*[^=]+=\s*>\s*\{[\s\S]*?\n\};\n*/,
    '',
  );

  // Never put getDatasource in a type-only import.
  text = text.replace(
    /import\s+type\s*\{([^}]*)\bgetDatasource\b\s*,?\s*([^}]*)\}\s*from\s*['"]lib\/component-props['"]\s*;?/,
    (full, a, b) => {
      const rest = `${a || ''}${b || ''}`
        .replace(/^\s*,\s*|\s*,\s*$/g, '')
        .trim();
      const typeLine = rest
        ? `import type { ${rest} } from 'lib/component-props';\n`
        : '';
      return `${typeLine}import { getDatasource } from 'lib/component-props';`;
    },
  );
  if (
    !/import\s*\{[^}]*\bgetDatasource\b[^}]*\}\s*from\s*['"]lib\/component-props['"]/.test(
      text,
    )
  ) {
    if (/from\s+['"]lib\/component-props['"]/.test(text)) {
      text = text.replace(
        /(import\s+type\s*\{[^}]*\}\s*from\s*['"]lib\/component-props['"];?\s*)/,
        `$1import { getDatasource } from 'lib/component-props';\n`,
      );
    }
    if (
      !/import\s*\{[^}]*\bgetDatasource\b[^}]*\}\s*from\s*['"]lib\/component-props['"]/.test(
        text,
      )
    ) {
      text = `import { getDatasource } from 'lib/component-props';\n${text}`;
    }
  }

  // Normalize Fields: drop Cards bag typing; ensure children results
  text = text.replace(
    new RegExp(
      `\\n\\s*${escapeRegExp(bagName)}\\s*:\\s*(?:Field<string>|Card\\[\\]|[A-Za-z_][\\w]*\\[\\])\\s*;?`,
      'g',
    ),
    `\n  children?: { results?: CardItem[] };`,
  );

  if (!/interface CardItem\b/.test(text) && !/type CardItem\b/.test(text)) {
    const kind = meta.kind || 'links';
    const itemFields =
      kind === 'media'
        ? `interface CardItemFields {
  Title: Field<string>;
  Text?: Field<string>;
  Body?: Field<string>;
  Image: ImageField;
  Link: LinkField;
  Action: LinkField;
}
interface CardItem {
  id?: string;
  name?: string;
  fields: CardItemFields;
}`
        : kind === 'feature'
          ? `interface CardItemFields {
  Title: Field<string>;
  Body: Field<string>;
  Icon: ImageField;
}
interface CardItem {
  id?: string;
  name?: string;
  fields: CardItemFields;
}`
          : `interface CardItemFields {
  Title: Field<string>;
  Theme?: Field<string>;
  'Link 1'?: LinkField;
  'Link 2'?: LinkField;
  'Link 3'?: LinkField;
  'Link 4'?: LinkField;
}
interface CardItem {
  id?: string;
  name?: string;
  fields: CardItemFields;
}`;
    text = text.replace(
      /interface Fields\s*\{/,
      `${itemFields}\n\ninterface Fields {\n`,
    );
  }

  // Feature cards need ImageField + <Image> for Icon seeds
  if (meta.kind === 'feature') {
    // Ensure ImageField on a type import (or add one)
    if (!/import\s+type\s*\{[^}]*\bImageField\b/.test(text)) {
      if (/import\s+type\s*\{[^}]*\}\s*from\s*['"]@sitecore-content-sdk\/nextjs['"]/.test(text)) {
        text = text.replace(
          /(import\s+type\s*\{)([^}]*)(\}\s*from\s*['"]@sitecore-content-sdk\/nextjs['"])/,
          (full, a, mid, c) => {
            if (/\bImageField\b/.test(mid)) return full;
            const rest = String(mid || '').trim().replace(/,\s*$/, '');
            return `${a}${rest ? ` ${rest}, ImageField ` : ' ImageField '}${c}`;
          },
        );
      } else {
        text = `import type { ImageField } from '@sitecore-content-sdk/nextjs';\n${text}`;
      }
    }
    // Ensure runtime Image import (non-type), after 'use client' if present
    if (
      !/(?:^|\n)import\s*\{[^}]*\bImage\b[^}]*\}\s*from\s*['"]@sitecore-content-sdk\/nextjs['"]/.test(
        text,
      )
    ) {
      if (/^['"]use client['"];?\s*\n/.test(text)) {
        text = text.replace(
          /^(['"]use client['"];?\s*\n)/,
          `$1import { Image } from '@sitecore-content-sdk/nextjs';\n`,
        );
      } else {
        text = `import { Image } from '@sitecore-content-sdk/nextjs';\n${text}`;
      }
    }
  }

  /**
   * Inject getDatasource + cards for Default / export default hosts.
   * @param {string} src
   * @param {RegExp} exportRe
   * @param {string} exportName
   */
  const injectDatasourcePrologue = (src, exportRe, exportName) => {
    let t = src;
    if (!exportRe.test(t)) return t;
    t = t.replace(
      new RegExp(
        `${exportName}\\s*=\\s*\\(\\s*\\{\\s*fields\\s*\\}\\s*:\\s*Props\\s*\\)\\s*:\\s*JSX\\.Element\\s*=>\\s*\\{`,
      ),
      `${exportName} = (props: Props): JSX.Element => {
  const datasource = getDatasource<Fields>(props.fields);
  if (!datasource) {
    return <div>Missing Component Datasource.</div>;
  }
  const fields = datasource;
  const cards: CardItem[] = datasource.children?.results ?? [];
`,
    );
    t = t.replace(
      new RegExp(
        `${exportName}\\s*=\\s*\\(\\s*\\{\\s*fields\\s*\\}\\s*:\\s*Props\\s*\\)\\s*:\\s*JSX\\.Element\\s*=>\\s*\\(`,
      ),
      `${exportName} = (props: Props): JSX.Element => {
  const datasource = getDatasource<Fields>(props.fields);
  if (!datasource) {
    return <div>Missing Component Datasource.</div>;
  }
  const fields = datasource;
  const cards: CardItem[] = datasource.children?.results ?? [];
  return (
`,
    );
    if (
      new RegExp(`${exportName}\\s*=\\s*\\(\\s*props\\s*:\\s*Props\\s*\\)`).test(
        t,
      ) &&
      !/getDatasource\s*</.test(t)
    ) {
      t = t.replace(
        new RegExp(
          `${exportName}\\s*=\\s*\\(\\s*props\\s*:\\s*Props\\s*\\)\\s*:\\s*JSX\\.Element\\s*=>\\s*\\{\\s*const\\s*\\{\\s*fields\\s*\\}\\s*=\\s*props\\s*;?`,
        ),
        `${exportName} = (props: Props): JSX.Element => {
  const datasource = getDatasource<Fields>(props.fields);
  if (!datasource) {
    return <div>Missing Component Datasource.</div>;
  }
  const fields = datasource;
  const cards: CardItem[] = datasource.children?.results ?? [];
`,
      );
    }
    return t;
  };

  const hasDefaultHost =
    /export const Default\s*=/.test(text) ||
    /(?:^|\n)const Default\s*=/.test(text) ||
    /export default\s+function\s+/.test(text) ||
    /export default\s*\(/.test(text);

  if (hasDefaultHost) {
    text = injectDatasourcePrologue(
      text,
      /export const Default\s*=/,
      'export const Default',
    );
    text = injectDatasourcePrologue(text, /(?:^|\n)const Default\s*=/, 'const Default');

    // Ensure cards binding even when getDatasource already injected without cards
    if (
      /getDatasource\s*</.test(text) &&
      !/const cards(?::\s*CardItem\[\])?\s*=\s*datasource\.children/.test(text)
    ) {
      text = text.replace(
        /const fields = datasource\s*;/,
        `const fields = datasource;\n  const cards: CardItem[] = datasource.children?.results ?? [];`,
      );
    }
    // Normalize untyped cards binding
    text = text.replace(
      /const cards = datasource\.children\?\.results \?\? \[\];/g,
      'const cards: CardItem[] = datasource.children?.results ?? [];',
    );
    // Close arrow IIFE that became a block: trailing `);` after JSX → `); };`
    if (
      /const cards(?::\s*CardItem\[\])?\s*=\s*datasource\.children\?\.results/.test(
        text,
      ) &&
      !/export const Default[\s\S]*\}\s*;\s*\nexport default/.test(text)
    ) {
      text = text.replace(
        /(\n\s*<\/section>\s*\n\);\s*)\n(export default)/,
        '$1};\n$2',
      );
    }

    // parseCards(fields.Cards) / __bqParseJsonBagField(fields.Cards) / fields.Cards.map
    text = text.replace(
      /const\s+cards(?:\s*:\s*CardItem\[\])?\s*=\s*parseCards\s*\(\s*fields\.Cards\s*\)\s*;?\s*/g,
      '',
    );
    text = text.replace(
      /const\s+cards(?:\s*:\s*CardItem\[\])?\s*=\s*datasource\.children\?\.results\s*\?\?\s*\[\];\s*(?=[\s\S]*const\s+cards(?:\s*:\s*CardItem\[\])?\s*=\s*datasource\.children)/,
      '',
    );
    text = text.replace(
      /__bqParseJsonBagField\s*\(\s*fields\.Cards\s*\)\.map/g,
      'cards.map',
    );
    text = text.replace(/fields\.Cards\.map/g, 'cards.map');
    text = text.replace(
      new RegExp(
        `fields(?:\\.${escapeRegExp(bagName)}|\\[\\s*["']${escapeRegExp(bagName)}["']\\s*\\])\\s*\\.\\s*map`,
        'g',
      ),
      'cards.map',
    );
    // Drop orphan visual row interfaces that conflict with CardItem map callbacks
    text = text.replace(
      /\n(?:export\s+)?(?:interface|type)\s+(?:HealthCard|HealthCards?|ServiceCard|FeatureCard|MediaCard)\b[^{;=]*\{[\s\S]*?\n\}\s*;?\n/g,
      '\n',
    );
    text = text.replace(
      /\n(?:export\s+)?(?:interface|type)\s+(?:HealthCard|HealthCards?|ServiceCard|FeatureCard|MediaCard)\b[^=\n]*=\s*\{[\s\S]*?\};\n/g,
      '\n',
    );
    // Typed arrays still pointing at removed interfaces → CardItem[]
    text = text.replace(
      /:\s*(?:HealthCard|HealthCards?|ServiceCard|FeatureCard|MediaCard)\[\]/g,
      ': CardItem[]',
    );
    text = text.replace(
      /as\s+(?:HealthCard|HealthCards?|ServiceCard|FeatureCard|MediaCard)\[\]/g,
      'as CardItem[]',
    );

    // reason/item aliases used by AI for child rows
    text = text.replace(
      /\(reason:\s*[A-Za-z_][\w]*\s*,\s*index:\s*number\)/g,
      '(card: CardItem, index: number)',
    );
    text = text.replace(/\(reason,\s*index\)/g, '(card: CardItem, index: number)');
    text = text.replace(/\breason\.(Title|Body|Icon|Link)\b/g, 'card.fields.$1');
    text = text.replace(/\breason\.fields\b/g, 'card.fields');

    // Field access on card rows → item.fields.*
    text = text.replace(
      /\(card:\s*Card,\s*index:\s*number\)/g,
      '(card: CardItem, index: number)',
    );
    text = text.replace(/\(card,\s*index\)/g, '(card: CardItem, index: number)');
    text = text.replace(/card\.title\b/g, 'card.fields.Title');
    text = text.replace(/card\.body\b/g, 'card.fields.Body');
    text = text.replace(/card\.text\b/g, 'card.fields.Text');
    text = text.replace(/card\.image\b/g, 'card.fields.Image');
    text = text.replace(/card\.icon\b/g, 'card.fields.Icon');
    text = text.replace(/card\.link\b/g, 'card.fields.Link');
    text = text.replace(/card\.action\b/g, 'card.fields.Action');
    text = text.replace(/card\.tone\b/g, 'card.fields.Theme');
    // Flat href/url from visual cards → Link field string value
    text = text.replace(
      /card\.href\b/g,
      "(card.fields.Link?.value?.href ?? '#')",
    );
    text = text.replace(
      /card\.url\b/g,
      "(card.fields.Link?.value?.href ?? '#')",
    );
    // PascalCase flat card fields (AI typed Cards: { Title, Body, Image }[])
    text = text.replace(/card\.Title\b/g, 'card.fields.Title');
    text = text.replace(/card\.Body\b/g, 'card.fields.Body');
    text = text.replace(/card\.Text\b/g, 'card.fields.Text');
    text = text.replace(/card\.Image\b/g, 'card.fields.Image');
    text = text.replace(/card\.Icon\b/g, 'card.fields.Icon');
    text = text.replace(/card\.Link\b/g, 'card.fields.Link');
    text = text.replace(/card\.Action\b/g, 'card.fields.Action');
    text = text.replace(/card\.Tone\b/g, 'card.fields.Tone');
    text = text.replace(/card\.Theme\b/g, 'card.fields.Theme');
    text = text.replace(/card\.Links\b/g, 'card.fields.Links');
    text = text.replace(/card\['Link 1'\]/g, "card.fields['Link 1']");
    text = text.replace(/card\['Link 2'\]/g, "card.fields['Link 2']");
    text = text.replace(/card\['Link 3'\]/g, "card.fields['Link 3']");
    text = text.replace(/card\['Link 4'\]/g, "card.fields['Link 4']");
    text = text.replace(/card\[key\]/g, 'card.fields[key]');
    // Type annotations: (card: HealthCard → CardItem
    text = text.replace(
      /\(card:\s*[A-Za-z_][\w]*\s*,\s*index:\s*number\)/g,
      '(card: CardItem, index: number)',
    );
    // Same for item/row params
    text = text.replace(
      /\((item|row):\s*[A-Za-z_][\w]*\s*,\s*index:\s*number\)/g,
      '($1: CardItem, index: number)',
    );

    // Bare string Field as React text children → <Text field={…} />
    // Skip Link/Image/Icon/Action (not Text children).
    text = text.replace(
      /(?<!field=\{)\{\s*((?:card|item|row)\.fields\.(?:Title|Text|Body|Theme|Heading|Label|Description|Name))\s*\}/g,
      '<Text field={$1} />',
    );
    text = text.replace(
      /(?<!field=\{)\{\s*((?:card|item|row)\.fields\[['"](?:Title|Text|Body|Theme|Heading|Label|Description|Name)['"]\])\s*\}/g,
      '<Text field={$1} />',
    );
    // Ensure Text import when we wrapped fields
    if (/<Text\s+field=\{/.test(text)) {
      if (
        !/(?:^|\n)import\s*\{[^}]*\bText\b[^}]*\}\s*from\s*['"]@sitecore-content-sdk\/nextjs['"]/.test(
          text,
        )
      ) {
        if (
          /import\s*\{[^}]*\}\s*from\s*['"]@sitecore-content-sdk\/nextjs['"]/.test(
            text,
          )
        ) {
          text = text.replace(
            /(import\s*\{)([^}]*)(\}\s*from\s*['"]@sitecore-content-sdk\/nextjs['"])/,
            (full, a, mid, c) => {
              if (/\bText\b/.test(mid)) return full;
              const rest = String(mid || '').trim().replace(/,\s*$/, '');
              return `${a}${rest ? ` ${rest}, Text ` : ' Text '}${c}`;
            },
          );
        } else if (/^['"]use client['"];?\s*\n/.test(text)) {
          text = text.replace(
            /^(['"]use client['"];?\s*\n)/,
            `$1import { Text } from '@sitecore-content-sdk/nextjs';\n`,
          );
        } else {
          text = `import { Text } from '@sitecore-content-sdk/nextjs';\n${text}`;
        }
      }
    }

    // Nested Links[] on card → Link 1..N (childItemTemplate shape)
    if (/card\.fields\.Links\.map/.test(text) || /card\.Links\.map/.test(text)) {
      text = text.replace(
        /\{?\s*card\.fields\.Links\.map\(\(item:\s*ServiceLink,\s*linkIndex:\s*number\)\s*=>\s*\([\s\S]*?\)\)\s*\}?/g,
        `{(['Link 1', 'Link 2', 'Link 3', 'Link 4', 'Link 5'] as const).map((key) => {
                  const linkField = card.fields[key];
                  if (!linkField?.value?.href && !linkField?.value?.text) return null;
                  return (
                    <li
                      key={key}
                      className="relative pl-7 leading-6 before:absolute before:left-0 before:top-1 before:text-xl before:content-['›']"
                    >
                      <Link field={linkField} />
                    </li>
                  );
                })}`,
      );
      text = text.replace(/card\.Links\.map/g, '/* Links→Link N */ ([ ] as const).map');
    }

    // Empty decorative icon circles → Sitecore Image (Icon field)
    if (meta.kind === 'feature') {
      text = text.replace(
        /<span\s+aria-hidden="true"\s+className="[^"]*rounded-full[^"]*"\s*\/>/g,
        '<span aria-hidden="true" className="mx-auto mb-6 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-4 border-[#fcb53c] bg-[#043572] p-2"><Image field={card.fields.Icon} className="h-full w-full object-contain" /></span>',
      );
      text = text.replace(
        /<span\s+aria-hidden="true"\s+className="[^"]*rounded-full[^"]*"\s*>\s*<\/span>/g,
        '<span aria-hidden="true" className="mx-auto mb-6 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-4 border-[#fcb53c] bg-[#043572] p-2"><Image field={card.fields.Icon} className="h-full w-full object-contain" /></span>',
      );
    }
  }

  return text;
}

/**
 * Always-on package promote: definition childItemTemplate + TSX children.results.
 * Falls back to parse helpers only when no inventory bag remains to promote.
 * @param {{
 *   definitionTs?: string|null,
 *   tsx?: string|null,
 *   sectionHtml?: string|null,
 *   fontSvg?: string|null,
 * }} opts
 * @returns {{ definitionTs: string, tsx: string, promoted: string[] }}
 */
export function promoteJsonBagPackageAlwaysOn(opts = {}) {
  const defIn = String(opts.definitionTs || '');
  let tsx = String(opts.tsx || '');
  const { text: defOut, promoted, kinds } =
    promoteJsonBagDefinitionToChildItemTemplate(defIn, {
      sectionHtml: opts.sectionHtml,
      fontSvg: opts.fontSvg,
    });

  if (promoted.length) {
    for (const bagName of promoted) {
      const kind = kinds[bagName] || 'links';
      tsx = rewriteTsxBagMapToChildResults(tsx, defOut, { bagName, kind });
    }
    return { definitionTs: defOut, tsx, promoted };
  }

  // Fallback: keep bag, rewrite direct .map to parse helper (preview/runtime paint only)
  if (tsx.trim() && defOut.trim()) {
    tsx = rewriteDirectJsonBagFieldMaps(tsx, defOut);
  }
  return { definitionTs: defOut, tsx, promoted };
}
