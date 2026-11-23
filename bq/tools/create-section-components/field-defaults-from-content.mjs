/**
 * Ensure model.itemTemplate fields get `default` for __Standard Values emit.
 * Prefer Sitecore expand tokens, then most-common content.items seeds, then invent.
 */

const TITLE_LIKE_EXACT =
  /^(title|heading|name|display name|navigation title|label)$/i;
const TITLE_LIKE_SUFFIX = /\b(title|heading)$/i;
const DATE_NAME_RE = /\b(date|time|published|created)\b/i;
const PARENT_NAME_RE = /^parent(\s*name)?$/i;
const ID_NAME_RE = /^id$/i;
const PARENT_ID_RE = /^parent\s*id$/i;
const TIME_EXACT_RE = /^time$/i;

/**
 * @param {string} source
 * @returns {string}
 */
export function ensureFieldDefaultsFromContentItems(source) {
  const text = String(source || '');
  if (!text.trim()) return text;
  if (/\bdatasourceTemplate\s*:/.test(text)) return text;

  const items = parseContentItems(text);
  const itemTemplate = extractItemTemplateBody(text);
  if (!itemTemplate) return text;

  const sectionsMatch = itemTemplate.body.match(/\bsections\s*:\s*\[/);
  if (!sectionsMatch || sectionsMatch.index == null) return text;
  const secBracket = itemTemplate.body.indexOf('[', sectionsMatch.index);
  const secInner = extractBalanced(itemTemplate.body, secBracket, '[', ']');
  if (secInner == null) return text;

  const { next: nextSections, injected } = injectDefaultsIntoSectionsArray(
    secInner,
    items,
  );
  if (!injected) return text;

  const newItemBody =
    itemTemplate.body.slice(0, secBracket + 1) +
    nextSections +
    itemTemplate.body.slice(secBracket + 1 + secInner.length);

  return (
    text.slice(0, itemTemplate.open + 1) +
    newItemBody +
    text.slice(itemTemplate.open + 1 + itemTemplate.body.length)
  );
}

/**
 * @param {string} sectionsInner content inside sections: [ … ]
 * @param {object[]} items
 */
function injectDefaultsIntoSectionsArray(sectionsInner, items) {
  let out = '';
  let last = 0;
  let injected = 0;
  let i = 0;
  while (i < sectionsInner.length) {
    if (sectionsInner[i] !== '{') {
      i += 1;
      continue;
    }
    const sectionBody = extractBalanced(sectionsInner, i, '{', '}');
    if (sectionBody == null) break;
    const fieldsMatch = sectionBody.match(/\bfields\s*:\s*\[/);
    if (!fieldsMatch || fieldsMatch.index == null) {
      i += 1 + sectionBody.length;
      continue;
    }
    const fieldsBracket = sectionBody.indexOf('[', fieldsMatch.index);
    const fieldsInner = extractBalanced(sectionBody, fieldsBracket, '[', ']');
    if (fieldsInner == null) {
      i += 1 + sectionBody.length;
      continue;
    }
    const { next: nextFields, count } = injectDefaultsIntoFieldsArray(
      fieldsInner,
      items,
    );
    if (count > 0) {
      const newSection =
        sectionBody.slice(0, fieldsBracket + 1) +
        nextFields +
        sectionBody.slice(fieldsBracket + 1 + fieldsInner.length);
      out += sectionsInner.slice(last, i + 1) + newSection;
      last = i + 1 + sectionBody.length;
      injected += count;
    }
    i += 1 + sectionBody.length;
  }
  if (!injected) return { next: sectionsInner, injected: 0 };
  return { next: out + sectionsInner.slice(last), injected };
}

/**
 * @param {string} fieldsInner
 * @param {object[]} items
 */
function injectDefaultsIntoFieldsArray(fieldsInner, items) {
  let out = '';
  let last = 0;
  let count = 0;
  let i = 0;
  while (i < fieldsInner.length) {
    if (fieldsInner[i] !== '{') {
      i += 1;
      continue;
    }
    const fieldBody = extractBalanced(fieldsInner, i, '{', '}');
    if (fieldBody == null) break;
    const full = `{${fieldBody}}`;
    if (/\bdefault\s*:/.test(full)) {
      i += 1 + fieldBody.length;
      continue;
    }
    const meta = parseFieldMeta(full);
    if (!meta) {
      i += 1 + fieldBody.length;
      continue;
    }
    const value = resolveFieldDefault(meta.name, meta.type, items);
    if (value === undefined) {
      i += 1 + fieldBody.length;
      continue;
    }
    const literal = jsLiteral(value);
    const trimmed = fieldBody.replace(/\s*$/, '');
    const needsComma = /,\s*$/.test(trimmed) ? '' : ',';
    const nextBody = `${trimmed}${needsComma}\n            default: ${literal},\n          `;
    out += fieldsInner.slice(last, i + 1) + nextBody;
    last = i + 1 + fieldBody.length;
    count += 1;
    i += 1 + fieldBody.length;
  }
  if (!count) return { next: fieldsInner, count: 0 };
  return { next: out + fieldsInner.slice(last), count };
}

/**
 * @param {string} fieldName
 * @param {string} fieldType
 * @param {object[]} items
 * @returns {unknown}
 */
export function resolveFieldDefault(fieldName, fieldType, items) {
  const name = String(fieldName || '').trim();
  const type = String(fieldType || '').trim();
  const typeLower = type.toLowerCase();
  const list = Array.isArray(items) ? items : [];

  const seeds = collectFieldSeeds(list, name);
  const token = pickTokenDefault(name, type, seeds, list);
  if (token !== undefined) return token;

  if (seeds.length) {
    if (typeLower.includes('image')) {
      const images = seeds.filter(isUsableImage).map(sanitizeImageSeed);
      if (!images.length) return undefined;
      return sanitizeImageSeed(pickMostCommon(images));
    }
    return pickMostCommon(seeds);
  }

  // Invent (never Image)
  if (typeLower.includes('image')) return undefined;
  if (typeLower.includes('checkbox')) return false;
  if (typeLower.includes('link') && !typeLower.includes('droplink')) {
    return { text: '$name', url: '#' };
  }
  if (typeLower.includes('rich')) {
    return '<p>$name</p>';
  }
  if (isTitleLikeFieldName(name)) return '$name';
  if (isDateTimeField(name, type)) {
    return /\bdate\b/i.test(name) && !/\btime\b/i.test(name) ? '$date' : '$now';
  }
  if (PARENT_NAME_RE.test(name)) return '$parentname';
  if (ID_NAME_RE.test(name)) return '$id';
  if (PARENT_ID_RE.test(name)) return '$parentid';
  if (TIME_EXACT_RE.test(name)) return '$time';
  return name || 'Text';
}

/**
 * @param {string} name
 * @param {string} type
 * @param {unknown[]} seeds
 * @param {object[]} items
 */
function pickTokenDefault(name, type, seeds, items) {
  const typeLower = String(type || '').toLowerCase();
  if (typeLower.includes('image')) return undefined;
  if (typeLower.includes('rich')) return undefined;
  if (typeLower.includes('checkbox')) return undefined;

  const isLink = typeLower.includes('link') && !typeLower.includes('droplink');
  const isPlainText =
    typeLower.includes('single-line') ||
    typeLower.includes('multi-line') ||
    typeLower === 'text' ||
    !typeLower;

  if (isPlainText || isLink) {
    if (isTitleLikeFieldName(name) && !isLink) return '$name';
    if (isPlainText && seedsMatchItemIdentity(seeds, items, name)) {
      return '$name';
    }
    if (isLink && seeds.length === 0 && isTitleLikeFieldName(name)) {
      return { text: '$name', url: '#' };
    }
  }

  if (isDateTimeField(name, type) && !seeds.length) {
    if (TIME_EXACT_RE.test(name)) return '$time';
    if (/\bdate\b/i.test(name) && !/\btime\b/i.test(name) && !/datetime/i.test(type)) {
      return '$date';
    }
    return '$now';
  }

  if (PARENT_NAME_RE.test(name) && !seeds.length) return '$parentname';
  if (ID_NAME_RE.test(name) && !seeds.length) return '$id';
  if (PARENT_ID_RE.test(name) && !seeds.length) return '$parentid';

  return undefined;
}

export function isTitleLikeFieldName(name) {
  const n = String(name || '').trim();
  if (!n) return false;
  if (TITLE_LIKE_EXACT.test(n)) return true;
  if (TITLE_LIKE_SUFFIX.test(n)) return true;
  return false;
}

function isDateTimeField(name, type) {
  const t = String(type || '').toLowerCase();
  if (t.includes('date') || t.includes('datetime') || t === 'time') return true;
  return DATE_NAME_RE.test(String(name || ''));
}

/**
 * @param {object[]} items
 * @param {string} fieldName
 */
function collectFieldSeeds(items, fieldName) {
  /** @type {unknown[]} */
  const out = [];
  for (const item of items) {
    const fields = item?.fields;
    if (!fields || typeof fields !== 'object') continue;
    const raw = lookupField(fields, fieldName);
    if (!isNonEmptySeed(raw)) continue;
    out.push(raw);
  }
  return out;
}

function lookupField(fields, fieldName) {
  if (Object.prototype.hasOwnProperty.call(fields, fieldName)) {
    return fields[fieldName];
  }
  const target = String(fieldName || '').toLowerCase();
  for (const [k, v] of Object.entries(fields)) {
    if (String(k).toLowerCase() === target) return v;
  }
  return undefined;
}

function isNonEmptySeed(v) {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (typeof v === 'boolean' || typeof v === 'number') return true;
  if (typeof v === 'object') {
    if (isUsableImage(v)) return true;
    if (typeof v.url === 'string' && v.url.trim()) return true;
    if (typeof v.text === 'string' && v.text.trim()) return true;
    return Object.keys(v).length > 0;
  }
  return false;
}

const IMAGE_SEED_KEYS = [
  'url',
  'alt',
  'base64',
  'svgMarkup',
  'path',
  'guid',
  'definitionKey',
  'width',
  'height',
  'mediaId',
];

function isUsableImage(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  return Boolean(
    (typeof v.url === 'string' && v.url.trim()) ||
      (typeof v.base64 === 'string' && v.base64.trim()) ||
      (typeof v.svgMarkup === 'string' && v.svgMarkup.trim()) ||
      (typeof v.path === 'string' && v.path.trim()) ||
      (typeof v.guid === 'string' && v.guid.trim()) ||
      (typeof v.definitionKey === 'string' && v.definitionKey.trim()),
  );
}

/** DataImageValue only — drop nested CTA/Link copied from bad seeds. */
function sanitizeImageSeed(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return v;
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const k of IMAGE_SEED_KEYS) {
    if (v[k] !== undefined) out[k] = v[k];
  }
  return Object.keys(out).length ? out : v;
}

/**
 * True when every non-empty seed equals that item's name or displayName.
 * @param {unknown[]} seeds
 * @param {object[]} items
 * @param {string} fieldName
 */
function seedsMatchItemIdentity(seeds, items, fieldName) {
  if (!seeds.length || !items.length) return false;
  let compared = 0;
  for (const item of items) {
    const raw = lookupField(item?.fields || {}, fieldName);
    if (!isNonEmptySeed(raw)) continue;
    if (typeof raw !== 'string') return false;
    const needle = raw.trim().toLowerCase();
    const name = String(item.name || '')
      .trim()
      .toLowerCase();
    const display = String(item.displayName || '')
      .trim()
      .toLowerCase();
    if (needle !== name && needle !== display) return false;
    compared += 1;
  }
  return compared > 0;
}

/**
 * @param {unknown[]} values
 */
export function pickMostCommon(values) {
  if (!values.length) return undefined;
  /** @type {Map<string, number>} */
  const counts = new Map();
  /** @type {string[]} */
  const order = [];
  for (const v of values) {
    const key = stableKey(v);
    if (!counts.has(key)) order.push(key);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let bestKey = order[0];
  let bestCount = 0;
  for (const key of order) {
    const c = counts.get(key) || 0;
    if (c > bestCount) {
      bestCount = c;
      bestKey = key;
    }
  }
  return JSON.parse(bestKey);
}

function stableKey(v) {
  return JSON.stringify(v);
}

function jsLiteral(v) {
  if (v == null) return '""';
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

/**
 * @param {string} fieldObj
 * @returns {{ name: string, type: string } | null}
 */
function parseFieldMeta(fieldObj) {
  const nameM = fieldObj.match(/\bname\s*:\s*(["'])([^"']*)\1/);
  const typeM = fieldObj.match(/\btype\s*:\s*(["'])([^"']*)\1/);
  if (!nameM || !typeM) return null;
  return { name: nameM[2], type: typeM[2] };
}

/**
 * @param {string} text
 * @returns {{ open: number, body: string } | null}
 */
function extractItemTemplateBody(text) {
  const m = text.match(/\bitemTemplate\s*:\s*\{/);
  if (!m || m.index == null) return null;
  const open = text.indexOf('{', m.index);
  if (open < 0) return null;
  const body = extractBalanced(text, open, '{', '}');
  if (body == null) return null;
  return { open, body };
}

/**
 * @param {string} text
 * @returns {object[]}
 */
function parseContentItems(text) {
  const m = text.match(/\bcontent\s*:\s*\{/);
  if (!m || m.index == null) return [];
  const open = text.indexOf('{', m.index);
  if (open < 0) return [];
  const body = extractBalanced(text, open, '{', '}');
  if (body == null) return [];
  const literal = `{${body}}`;
  try {
    const obj = Function(`"use strict"; return (${literal});`)();
    return Array.isArray(obj?.items) ? obj.items : [];
  } catch {
    return [];
  }
}

/**
 * @param {string} text
 * @param {number} openIndex
 * @param {string} openCh
 * @param {string} closeCh
 * @returns {string | null} inner (without outer braces)
 */
function extractBalanced(text, openIndex, openCh, closeCh) {
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
    if (ch === openCh) depth += 1;
    else if (ch === closeCh) {
      depth -= 1;
      if (depth === 0) return text.slice(openIndex + 1, i);
    }
  }
  return null;
}
