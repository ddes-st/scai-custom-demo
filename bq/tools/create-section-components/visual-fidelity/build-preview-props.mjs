/**
 * Build Sitecore-shaped field props from definition content.items seeds.
 */
import { readFile } from 'node:fs/promises';
import { parseContentItemsFromDefinition } from '../content-family-apply.mjs';

/**
 * @param {string} fieldType
 * @returns {boolean}
 */
function isImageFieldType(fieldType) {
  const t = String(fieldType || '')
    .trim()
    .toLowerCase();
  return t === 'image' || t === 'file';
}

/**
 * Heuristic: AI Image seeds are `{ url|href, alt }` without link text,
 * or `{ svgMarkup, alt }` (definition emit shape — no remote URL yet).
 * @param {Record<string, unknown>} obj
 * @returns {boolean}
 */
function looksLikeImageSeed(obj) {
  const hasSvg =
    typeof obj.svgMarkup === 'string' && String(obj.svgMarkup).trim().length > 0;
  const hasUrl =
    obj.url != null ||
    obj.href != null ||
    obj.src != null ||
    obj.Src != null ||
    hasSvg;
  const hasAlt = obj.alt != null || obj.Alt != null;
  const hasText = obj.text != null || obj.Text != null;
  return Boolean(hasUrl && hasAlt && !hasText);
}

/**
 * Turn definition `svgMarkup` into an `<img src>` the VF Image stub can render.
 * Real SitecoreAI emit converts svgMarkup → media URL; preview has no media pipeline.
 * @param {string} svgMarkup
 * @returns {string}
 */
export function svgMarkupToDataUri(svgMarkup) {
  const raw = String(svgMarkup || '').trim();
  if (!raw) return '';
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(raw)}`;
}

/**
 * @param {Record<string, unknown>} obj
 * @param {string} fieldName
 */
function toImageFieldValue(obj, fieldName) {
  let src = String(obj.src || obj.Src || obj.url || obj.href || '');
  if (
    !src &&
    typeof obj.svgMarkup === 'string' &&
    String(obj.svgMarkup).trim()
  ) {
    src = svgMarkupToDataUri(String(obj.svgMarkup));
  }
  return {
    value: {
      src,
      alt: String(obj.alt || obj.Alt || fieldName || ''),
      width: obj.width || obj.Width || undefined,
      height: obj.height || obj.Height || undefined,
    },
  };
}

/**
 * @param {unknown} value
 * @param {string} [fieldName]
 * @param {string} [fieldType] model field type (e.g. Image, General Link)
 */
export function seedToSitecoreField(value, fieldName = '', fieldType = '') {
  if (value == null) return { value: '' };
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return { value };
  }
  if (typeof value !== 'object') return { value: String(value) };

  const obj = /** @type {Record<string, unknown>} */ (value);

  // Already shaped { value: … } — still normalize nested Image seeds when typed
  if ('value' in obj && obj.value != null && typeof obj.value === 'object') {
    const inner = /** @type {Record<string, unknown>} */ (obj.value);
    if (isImageFieldType(fieldType) || looksLikeImageSeed(inner)) {
      return toImageFieldValue(inner, fieldName);
    }
    return obj;
  }
  if ('value' in obj) return obj;

  // Image (typed, { src }, { url|href, alt }, or { svgMarkup, alt } without link text)
  const hasSvgMarkup =
    typeof obj.svgMarkup === 'string' && String(obj.svgMarkup).trim().length > 0;
  if (
    isImageFieldType(fieldType) ||
    obj.src ||
    obj.Src ||
    hasSvgMarkup ||
    looksLikeImageSeed(obj)
  ) {
    return toImageFieldValue(obj, fieldName);
  }

  // General Link / CTA
  if (obj.url != null || obj.href != null || obj.text != null) {
    return {
      value: {
        href: String(obj.url || obj.href || '#'),
        text: String(obj.text || obj.Text || ''),
        linktype: 'external',
        url: String(obj.url || obj.href || '#'),
      },
    };
  }

  return { value: obj };
}

/**
 * Extract balanced `{…}` body starting at openIndex (must point at `{`).
 * @param {string} text
 * @param {number} openIndex
 * @returns {string | null}
 */
function extractBalancedObject(text, openIndex) {
  if (openIndex < 0 || text[openIndex] !== '{') return null;
  let depth = 0;
  let inStr = null;
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inStr = ch;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(openIndex, i + 1);
    }
  }
  return null;
}

/**
 * Collect name→type from a template object literal (`itemTemplate` / `childItemTemplate`).
 * @param {string} templateLiteral including outer braces
 * @returns {Record<string, string>}
 */
function fieldTypesFromTemplateLiteral(templateLiteral) {
  /** @type {Record<string, string>} */
  const out = {};
  try {
    const obj = Function(`"use strict"; return (${templateLiteral});`)();
    const sections = Array.isArray(obj?.sections) ? obj.sections : [];
    for (const section of sections) {
      const fields = Array.isArray(section?.fields) ? section.fields : [];
      for (const f of fields) {
        const name = String(f?.name || '').trim();
        const type = String(f?.type || '').trim();
        if (name && type) out[name] = type;
      }
    }
  } catch {
    /* fall through to regex */
  }
  if (Object.keys(out).length) return out;

  // Regex fallback for definitions that don't eval cleanly
  const fieldBlocks = templateLiteral.split(/\bfields\s*:\s*\[/);
  for (let b = 1; b < fieldBlocks.length; b++) {
    const chunk = fieldBlocks[b];
    const end = chunk.indexOf(']');
    const body = end >= 0 ? chunk.slice(0, end) : chunk;
    const parts = body.split(/\{\s*name\s*:/);
    for (let p = 1; p < parts.length; p++) {
      const part = `name:${parts[p]}`;
      const nameM = part.match(/name\s*:\s*(["'])([^"']*)\1/);
      const typeM = part.match(/type\s*:\s*(["'])([^"']*)\1/);
      if (nameM && typeM) out[nameM[2]] = typeM[2];
    }
  }
  return out;
}

/**
 * Parse model.itemTemplate / model.childItemTemplate field name → type maps.
 * @param {string} definitionTs
 * @returns {{ item: Record<string, string>, child: Record<string, string> }}
 */
export function parseFieldTypesFromDefinition(definitionTs) {
  const text = String(definitionTs || '');
  /** @type {Record<string, string>} */
  let item = {};
  /** @type {Record<string, string>} */
  let child = {};

  const itemM = text.match(/\bitemTemplate\s*:\s*\{/);
  if (itemM && itemM.index != null) {
    const open = text.indexOf('{', itemM.index);
    const lit = extractBalancedObject(text, open);
    if (lit) item = fieldTypesFromTemplateLiteral(lit);
  }

  const childM = text.match(/\bchildItemTemplate\s*:\s*\{/);
  if (childM && childM.index != null) {
    const open = text.indexOf('{', childM.index);
    const lit = extractBalancedObject(text, open);
    if (lit) child = fieldTypesFromTemplateLiteral(lit);
  }

  return { item, child };
}

/**
 * @param {object} item content.items[] entry
 * @param {Record<string, string>} [fieldTypeByName]
 * @returns {Record<string, unknown>}
 */
export function itemFieldsToProps(item, fieldTypeByName = {}) {
  const fields = item?.fields && typeof item.fields === 'object' ? item.fields : {};
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, val] of Object.entries(fields)) {
    out[key] = seedToSitecoreField(val, key, fieldTypeByName[key] || '');
  }
  return out;
}

/**
 * Flat fields props (common for Default components).
 * @param {string} definitionTs
 * @param {string} [itemName] pick by name; else first item
 */
export function buildFlatFieldsProps(definitionTs, itemName = null) {
  const types = parseFieldTypesFromDefinition(definitionTs);
  const items = parseContentItemsFromDefinition(definitionTs);
  const page = {
    mode: { isEditing: false, name: 'normal' },
    layout: { sitecore: { context: {}, route: { placeholders: {} } } },
  };
  if (!items.length) {
    return {
      fields: {},
      params: { RenderingIdentifier: 'bq-visual-fidelity' },
      rendering: { uid: 'bq-visual-fidelity', params: { RenderingIdentifier: 'bq-visual-fidelity' } },
      page,
    };
  }
  let item = items[0];
  if (itemName) {
    const found = items.find((i) => String(i.name || '') === itemName);
    if (found) item = found;
  }
  const fields = itemFieldsToProps(item, types.item);
  const rid = item.renderingIdentifier || 'bq-visual-fidelity';
  return {
    fields,
    params: {
      RenderingIdentifier: rid,
      DynamicPlaceholderId: '1',
    },
    rendering: {
      uid: rid,
      params: { RenderingIdentifier: rid, DynamicPlaceholderId: '1' },
    },
    page,
  };
}

/**
 * Merge per-item flat fields over default preview props without leaking Image
 * (or other typed) seeds from the first content item onto siblings that omit them.
 * Missing Image-typed keys become empty `{ value: { src: '', alt: '' } }` so
 * `hasImage` guards stay false.
 *
 * @param {Record<string, unknown>|null|undefined} defaultFields
 * @param {Record<string, unknown>|null|undefined} itemFields
 * @param {string} definitionTs
 * @returns {Record<string, unknown>}
 */
export function mergePreviewFieldsForItem(defaultFields, itemFields, definitionTs) {
  const types = parseFieldTypesFromDefinition(definitionTs);
  /** @type {Record<string, unknown>} */
  const base =
    defaultFields && typeof defaultFields === 'object' ? { ...defaultFields } : {};
  // Keep GraphQL-ish `data` from defaults when present; item flat fields win for keys.
  const flat =
    itemFields && typeof itemFields === 'object' ? { ...itemFields } : {};
  /** @type {Record<string, unknown>} */
  const out = { ...base, ...flat };
  for (const [name, type] of Object.entries(types.item || {})) {
    if (!isImageFieldType(type)) continue;
    if (Object.prototype.hasOwnProperty.call(flat, name)) continue;
    // Item omitted Image — clear leaked sibling/default Image.
    out[name] = { value: { src: '', alt: '' } };
  }
  return out;
}

/**
 * GraphQL-ish datasource shape for link-list style components.
 * @param {string} definitionTs
 * @param {string} [itemName] pick by name; else first item
 */
export function buildDatasourceProps(definitionTs, itemName = null) {
  const types = parseFieldTypesFromDefinition(definitionTs);
  const items = parseContentItemsFromDefinition(definitionTs);
  let item = items[0] || { fields: {}, children: [] };
  if (itemName) {
    const found = items.find((i) => String(i.name || '') === itemName);
    if (found) item = found;
  }
  const fieldEntries = itemFieldsToProps(item, types.item);
  /** @type {Record<string, { jsonValue?: unknown, value?: unknown }>} */
  const field = {};
  for (const [k, v] of Object.entries(fieldEntries)) {
    const key = k.charAt(0).toLowerCase() + k.slice(1).replace(/\s+/g, '');
    field[key] = { jsonValue: v, value: /** @type {{value?: unknown}} */ (v).value };
  }

  const children = Array.isArray(item.children) ? item.children : [];
  const childTypes = Object.keys(types.child).length ? types.child : types.item;
  const results = children.map((ch, idx) => {
    const chFields = itemFieldsToProps(ch, childTypes);
    const link =
      chFields.Link ||
      chFields.link ||
      seedToSitecoreField(ch.fields?.Link || ch.Link, 'Link', childTypes.Link || 'General Link');
    /** @type {Record<string, { jsonValue?: unknown, value?: unknown }>} */
    const childField = {
      link: { jsonValue: link, value: link?.value },
    };
    // Map every seeded child field (Title, Description, Status, Enabled, …)
    // so CMP / accordion children are not limited to link+icon+title.
    for (const [k, v] of Object.entries(chFields)) {
      if (k === 'Link' || k === 'link') continue;
      const key = k.charAt(0).toLowerCase() + k.slice(1).replace(/\s+/g, '');
      childField[key] = {
        jsonValue: v,
        value: /** @type {{ value?: unknown }} */ (v)?.value,
      };
    }
    return {
      id: `child-${idx}`,
      name: ch.name || `Child ${idx + 1}`,
      displayName: ch.displayName || ch.name || `Child ${idx + 1}`,
      link,
      field: childField,
      // Sitecore GraphQL children expose `.fields` (List.reference / Cookie options).
      fields: chFields,
      ...chFields,
    };
  });

  // Expose both camelCase GraphQL-ish keys and original Pascal/spaced field
  // names on the datasource root. Promoted List.reference TSX uses
  // getDatasource().Heading / children.results — camelCase-only blanks headings.
  /** @type {Record<string, unknown>} */
  const datasourceRoot = { field, children: { results } };
  for (const [k, v] of Object.entries(field)) {
    datasourceRoot[k] = v;
  }
  for (const [k, v] of Object.entries(fieldEntries)) {
    datasourceRoot[k] = v;
  }

  return {
    fields: {
      data: {
        datasource: datasourceRoot,
      },
      ...fieldEntries,
    },
    params: {
      RenderingIdentifier: item.renderingIdentifier || 'bq-visual-fidelity',
      DynamicPlaceholderId: '1',
    },
    rendering: {
      uid: 'bq-visual-fidelity',
      params: {
        RenderingIdentifier: item.renderingIdentifier || 'bq-visual-fidelity',
        DynamicPlaceholderId: '1',
      },
    },
    // Sitecore always passes page into components that use AppPlaceholder.
    page: {
      mode: { isEditing: false, name: 'normal' },
      layout: { sitecore: { context: {}, route: { placeholders: {} } } },
    },
  };
}

/** Minimal page context for AppPlaceholder guards (runtime-faithful only). */
function previewPageStub() {
  return {
    mode: { isEditing: false, name: 'normal' },
    layout: { sitecore: { context: {}, route: { placeholders: {} } } },
  };
}

/**
 * Prefer flat fields; also attach data.datasource for composites/link-lists.
 * @param {string} definitionTs
 * @param {string} [itemName] scope flat + datasource to this content item
 */
export function buildPreviewProps(definitionTs, itemName = null) {
  const flat = buildFlatFieldsProps(definitionTs, itemName);
  const ds = buildDatasourceProps(definitionTs, itemName);
  return {
    ...flat,
    fields: {
      ...flat.fields,
      data: ds.fields.data,
    },
    params: { ...flat.params, ...ds.params },
    rendering: ds.rendering,
    page: ds.page || flat.page || previewPageStub(),
  };
}

/**
 * @param {string} definitionPath
 */
export async function buildPreviewPropsFromFile(definitionPath) {
  const definitionTs = await readFile(definitionPath, 'utf8');
  return buildPreviewProps(definitionTs);
}
