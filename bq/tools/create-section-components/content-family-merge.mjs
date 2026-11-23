/**
 * Deterministic family-owner field union + content.items merge.
 * Value-first matching; Sitecore types from value shape (not AI labels).
 */
import path from 'node:path';

/** Preferred canonical names when a match group has no owner field. */
export const FIELD_NAME_PREFERENCE = [
  'Title',
  'Heading',
  'Name',
  'Body',
  'Description',
  'Text',
  'Introduction',
  'Subtitle',
  'Category',
  'Image',
  'Date',
  'Link',
  'CTA',
  'MoreLink',
];

/**
 * @param {unknown} name
 * @returns {string}
 */
export function toPascalFieldName(name) {
  const raw = String(name || '').trim();
  if (!raw) return '';
  if (/^[A-Z][A-Za-z0-9 ]*$/.test(raw) && raw.includes(' ')) return raw;
  if (/^[A-Z][A-Za-z0-9]*$/.test(raw)) {
    return raw.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  }
  const spaced = raw
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
  return spaced
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Normalize a seed value for equality clustering.
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeFieldValue(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return '';
  if (typeof value === 'object') {
    const obj = /** @type {Record<string, unknown>} */ (value);
    if (obj.src || obj.Src) {
      return `img:${normalizeUrl(String(obj.src || obj.Src || ''))}`;
    }
    if (obj.url != null || obj.href != null || obj.Url != null) {
      const url = normalizeUrl(String(obj.url || obj.href || obj.Url || ''));
      const text = normalizePlainText(String(obj.text || obj.Text || obj.linkText || ''));
      return `link:${url}|${text}`;
    }
    return '';
  }
  return normalizePlainText(String(value));
}

/**
 * @param {string} url
 */
function normalizeUrl(url) {
  return String(url || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/i, '')
    .replace(/\?.*$/, '')
    .replace(/\/+$/, '');
}

/**
 * @param {string} text
 */
function normalizePlainText(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Whether a normalized value is specific enough to form a cross-member cluster.
 * Short labels ("news", "more") create false unions across layouts.
 * @param {string} norm
 */
export function isClusterableNorm(norm) {
  const n = String(norm || '');
  if (n.length < 2) return false;
  if (n.startsWith('img:') || n.startsWith('link:')) return true;
  // Plain text: require enough substance (article titles, dates with year, etc.)
  if (n.length < 12) return false;
  return true;
}

/**
 * Sitecore field type from value shape. Never promote to RichText solely from AI hint.
 * @param {unknown} value
 * @param {string} [hintType]
 * @returns {string}
 */
export function inferSitecoreTypeFromValue(value, hintType = '') {
  const hint = String(hintType || '').toLowerCase();
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = /** @type {Record<string, unknown>} */ (value);
    if (obj.src || obj.Src) return 'Image';
    if (obj.url != null || obj.href != null || obj.Url != null) return 'General Link';
  }
  if (hint === 'image' || hint === 'imagefield') return 'Image';
  if (hint === 'link' || hint === 'generallink' || hint === 'general link') {
    return 'General Link';
  }
  if (hint === 'boolean' || hint === 'checkbox') return 'Checkbox';
  if (hint === 'number' || hint === 'integer') return 'Number';

  const s = value == null ? '' : String(value);
  if (/<[a-z][\s\S]*>/i.test(s)) return 'RichText';
  if (/\r?\n/.test(s) && s.replace(/\s+/g, ' ').trim().length > 60) {
    return 'Multi-Line Text';
  }
  return 'Single-Line Text';
}

/**
 * @param {string[]} candidateNames
 * @param {string | null | undefined} ownerName
 */
export function pickCanonicalFieldName(candidateNames, ownerName) {
  if (ownerName) {
    const o = toPascalFieldName(ownerName);
    if (o) return o;
  }
  const pascal = [
    ...new Set(candidateNames.map(toPascalFieldName).filter(Boolean)),
  ];
  for (const pref of FIELD_NAME_PREFERENCE) {
    if (pascal.some((n) => n === pref || n.replace(/\s+/g, '') === pref)) {
      return pref;
    }
  }
  pascal.sort((a, b) => a.localeCompare(b));
  return pascal[0] || 'Title';
}

/**
 * Flatten suggestedFields + repeats into field seed occurrences.
 * Array / repeat rows emit child keys as separate seeds (itemKey groups siblings).
 *
 * @param {object} opts
 * @param {string} opts.memberFolder
 * @param {object} opts.info — section-information.json
 * @param {string} [opts.pageSlug]
 * @param {string} [opts.sourcePath]
 * @returns {Array<object>}
 */
export function collectFieldSeedsFromInfo({
  memberFolder,
  info,
  pageSlug = '',
  sourcePath = '',
}) {
  /** @type {Array<object>} */
  const out = [];
  let itemSeq = 0;

  const pushField = (name, value, typeHint, itemKey = null) => {
    const n = String(name || '').trim();
    if (!n) return;
    if (value == null || value === '') return;
    if (Array.isArray(value)) return;
    out.push({
      memberFolder,
      pageSlug,
      sourcePath,
      name: n,
      pascalName: toPascalFieldName(n),
      value,
      typeHint: typeHint || '',
      norm: normalizeFieldValue(value),
      itemKey,
      isOwner: false,
    });
  };

  const walkFields = (fields, itemKey = null) => {
    if (!Array.isArray(fields)) return;
    for (const f of fields) {
      const name = f?.name || f?.fieldName || '';
      const type = f?.type || '';
      const value = f?.value;
      if (Array.isArray(value) || String(type).toLowerCase() === 'array') {
        const rows = Array.isArray(value) ? value : [];
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row || typeof row !== 'object') continue;
          const key = itemKey || `${memberFolder}:arr:${name}:${itemSeq++}`;
          for (const [k, v] of Object.entries(row)) {
            pushField(k, v, typeof v === 'object' && v?.src ? 'image' : '', `${key}:${i}`);
          }
        }
        continue;
      }
      pushField(name, value, type, itemKey);
    }
  };

  walkFields(info?.suggestedFields || []);
  for (const rep of info?.repeats || []) {
    const rows = Array.isArray(rep?.value) ? rep.value : [];
    const repName = rep?.name || 'items';
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || typeof row !== 'object') continue;
      const key = `${memberFolder}:rep:${repName}:${i}`;
      for (const [k, v] of Object.entries(row)) {
        pushField(k, v, typeof v === 'object' && v?.src ? 'image' : '', key);
      }
    }
  }

  return out;
}

/**
 * Merge family member field seeds into a deterministic owner field list + rename map.
 *
 * @param {object} opts
 * @param {Array<object>} opts.seeds — from collectFieldSeedsFromInfo
 * @param {string} opts.ownerFolder
 * @returns {{ fields: Array<{name: string, type: string}>, renameMap: Map<string, {name: string, type: string}>, clusters: number }}
 */
export function mergeFamilyOwnerFields({ seeds, ownerFolder }) {
  const list = Array.isArray(seeds) ? seeds.slice() : [];
  for (const s of list) {
    s.isOwner = s.memberFolder === ownerFolder;
    if (!s.pascalName) s.pascalName = toPascalFieldName(s.name);
    if (!s.norm) s.norm = normalizeFieldValue(s.value);
  }

  /** @type {Map<string, object[]>} */
  const byNorm = new Map();
  for (const s of list) {
    if (!s.norm || !isClusterableNorm(s.norm)) continue;
    if (!byNorm.has(s.norm)) byNorm.set(s.norm, []);
    byNorm.get(s.norm).push(s);
  }

  /** @type {Map<string, { name: string, type: string, norms: Set<string> }>} */
  const shared = new Map();
  /** itemKeys that participated in a cross-member match */
  const matchedItemKeys = new Set();
  const siblingAllow = new Set(
    FIELD_NAME_PREFERENCE.map((n) => n.toLowerCase().replace(/\s+/g, '')),
  );
  for (const extra of ['cta', 'morelink', 'imagecaption', 'caption', 'subtitle']) {
    siblingAllow.add(extra);
  }

  const sortedNorms = [...byNorm.keys()].sort((a, b) => a.localeCompare(b));
  for (const norm of sortedNorms) {
    const group = byNorm.get(norm) || [];
    const folders = new Set(group.map((g) => g.memberFolder));
    const hasOwner = group.some((g) => g.isOwner);
    if (folders.size < 2 && !hasOwner) continue;

    const ownerOcc = group.find((g) => g.isOwner);
    const names = group.map((g) => g.pascalName || g.name);
    const canonical = pickCanonicalFieldName(names, ownerOcc?.pascalName || ownerOcc?.name);
    const type = inferSitecoreTypeFromValue(
      ownerOcc?.value ?? group[0].value,
      ownerOcc?.typeHint || group[0].typeHint,
    );
    // Shared schema fields must be content-model names (Title/Body/Image/…)
    const canonKey = canonical.toLowerCase().replace(/\s+/g, '');
    const isModelName = siblingAllow.has(canonKey);
    for (const g of group) {
      if (g.itemKey) matchedItemKeys.add(g.itemKey);
    }
    if (!isModelName) continue;

    const key = canonical.toLowerCase();
    if (!shared.has(key)) {
      shared.set(key, { name: canonical, type, norms: new Set([norm]) });
    } else {
      shared.get(key).norms.add(norm);
      const prev = shared.get(key);
      if (prev.type === 'Single-Line Text' && type !== 'Single-Line Text') {
        prev.type = type;
      }
    }
  }

  // When a card/row matched across members, union sibling keys that are
  // shared content-model fields (not listing chrome like Ribbon / Product Image).
  for (const s of list) {
    if (!s.itemKey || !matchedItemKeys.has(s.itemKey)) continue;
    const canonical = pickCanonicalFieldName([s.pascalName || s.name], null);
    const key = canonical.toLowerCase();
    if (!siblingAllow.has(key.replace(/\s+/g, ''))) continue;
    if (shared.has(key)) continue;
    shared.set(key, {
      name: canonical,
      type: inferSitecoreTypeFromValue(s.value, s.typeHint),
      norms: new Set(s.norm ? [s.norm] : []),
    });
  }

  // Owner-only content-model fields
  for (const s of list) {
    if (!s.isOwner) continue;
    const canonical = pickCanonicalFieldName([s.pascalName || s.name], s.pascalName || s.name);
    const key = canonical.toLowerCase();
    if (shared.has(key)) continue;
    if (!siblingAllow.has(key.replace(/\s+/g, ''))) continue;
    shared.set(key, {
      name: canonical,
      type: inferSitecoreTypeFromValue(s.value, s.typeHint),
      norms: new Set(s.norm ? [s.norm] : []),
    });
  }

  const fields = [...shared.values()]
    .map(({ name, type }) => ({ name, type }))
    .sort((a, b) => {
      const ia = FIELD_NAME_PREFERENCE.indexOf(a.name);
      const ib = FIELD_NAME_PREFERENCE.indexOf(b.name);
      if (ia !== ib) {
        if (ia < 0 && ib < 0) return a.name.localeCompare(b.name);
        if (ia < 0) return 1;
        if (ib < 0) return -1;
        return ia - ib;
      }
      return a.name.localeCompare(b.name);
    });

  /** @type {Map<string, { name: string, type: string }>} */
  const renameMap = new Map();
  for (const s of list) {
    if (!s.norm) continue;
    const mapKey = `${s.memberFolder}::${String(s.name).toLowerCase()}`;
    // Prefer shared field whose norms include this value
    let hit = null;
    for (const f of shared.values()) {
      if (f.norms.has(s.norm)) {
        hit = f;
        break;
      }
    }
    if (!hit && s.isOwner) {
      const canonical = pickCanonicalFieldName([s.pascalName || s.name], s.pascalName || s.name);
      hit = shared.get(canonical.toLowerCase()) || null;
    }
    if (!hit && s.itemKey && matchedItemKeys.has(s.itemKey)) {
      const canonical = pickCanonicalFieldName([s.pascalName || s.name], null);
      hit = shared.get(canonical.toLowerCase()) || null;
    }
    if (hit) {
      renameMap.set(mapKey, { name: hit.name, type: hit.type });
    }
  }

  return { fields, renameMap, clusters: sortedNorms.length };
}

/**
 * Identity key for content item dedupe.
 * @param {object} item
 */
export function contentItemIdentity(item) {
  const fields = item?.fields && typeof item.fields === 'object' ? item.fields : {};
  const title = fields.Title || fields.Heading || fields.Name || item?.displayName || item?.name || '';
  const link = fields.Link || fields.CTA || null;
  const url =
    link && typeof link === 'object'
      ? normalizeUrl(String(link.url || link.href || ''))
      : '';
  const titleNorm = normalizePlainText(String(title));
  if (url) return `url:${url}`;
  if (titleNorm) return `title:${titleNorm}`;
  return `name:${normalizePlainText(String(item?.name || ''))}`;
}

/**
 * Merge/dedupe content.items onto owner. Stable sort by name.
 * @param {Array<object>} itemLists — arrays of items from owner + members
 * @returns {object[]}
 */
export function mergeFamilyOwnerItems(itemLists) {
  /** @type {Map<string, object>} */
  const byId = new Map();
  const lists = Array.isArray(itemLists) ? itemLists : [];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const id = contentItemIdentity(item);
      if (!id || id === 'name:') continue;
      if (!byId.has(id)) {
        byId.set(id, {
          name: String(item.name || item.displayName || 'Item')
            .replace(/[^\w\s-]/g, '')
            .trim() || 'Item',
          ...(item.displayName ? { displayName: item.displayName } : {}),
          ...(item.variant ? { variant: item.variant } : {}),
          fields: { ...(item.fields || {}) },
        });
      } else {
        const existing = byId.get(id);
        existing.fields = { ...existing.fields, ...(item.fields || {}) };
        if (!existing.displayName && item.displayName) {
          existing.displayName = item.displayName;
        }
      }
    }
  }

  return [...byId.values()].sort((a, b) =>
    String(a.name).localeCompare(String(b.name)),
  );
}

/**
 * Build a content item from co-occurring page seeds (header+body on same page).
 * @param {Array<object>} seeds — seeds for one pageSlug
 * @param {Map<string, {name: string, type: string}>} renameMap
 */
export function buildContentItemFromPageSeeds(seeds, renameMap) {
  if (!Array.isArray(seeds) || !seeds.length) return null;
  /** @type {Record<string, unknown>} */
  const fields = {};
  for (const s of seeds) {
    if (s.itemKey) continue; // card rows handled separately
    const mapKey = `${s.memberFolder}::${String(s.name).toLowerCase()}`;
    const mapped = renameMap?.get(mapKey);
    const fieldName = mapped?.name || toPascalFieldName(s.name);
    if (!fieldName || fields[fieldName] != null) continue;
    fields[fieldName] = s.value;
  }
  // Include matched card sibling fields for this page when present
  for (const s of seeds) {
    if (!s.itemKey) continue;
    const mapKey = `${s.memberFolder}::${String(s.name).toLowerCase()}`;
    const mapped = renameMap?.get(mapKey);
    if (!mapped) continue;
    if (fields[mapped.name] == null) fields[mapped.name] = s.value;
  }

  const title = fields.Title || fields.Heading || fields.Name;
  if (!title && !fields.Body && !fields.Image) return null;
  const nameBase = String(title || fields.Category || 'Article')
    .replace(/<[^>]+>/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .slice(0, 60) || 'Article';
  return {
    name: nameBase,
    displayName: String(title || nameBase)
      .replace(/<[^>]+>/g, '')
      .trim(),
    fields,
  };
}

/**
 * Apply merged fields + items onto an owner definition.ts source.
 * Ensures full itemTemplate (not thin) and content.items only on owner.
 *
 * @param {object} opts
 * @param {string} opts.definitionTs
 * @param {Array<{name: string, type: string}>} opts.fields
 * @param {object[]} opts.items
 * @param {string} [opts.itemTemplateName]
 * @param {string} [opts.datasourceFolder]
 * @returns {string}
 */
export function applyMergeToOwnerDefinition({
  definitionTs,
  fields,
  items,
  itemTemplateName,
  datasourceFolder,
}) {
  let text = String(definitionTs || '');
  if (!text.trim()) {
    throw new Error('applyMergeToOwnerDefinition: empty definitionTs');
  }

  const fieldLines = (fields || [])
    .map((f) => `{ name: ${JSON.stringify(f.name)}, type: ${JSON.stringify(f.type)} }`)
    .join(',\n              ');

  const dataSection = `{
          name: "Data",
          sortOrder: 100,
          fields: [
              ${fieldLines}
            ],
        }`;

  // Replace itemTemplate.sections (empty or existing)
  if (/itemTemplate\s*:\s*\{[\s\S]*?sections\s*:\s*\[\s*\]/.test(text)) {
    text = text.replace(
      /(itemTemplate\s*:\s*\{[\s\S]*?sections\s*:\s*)\[\s*\]/,
      `$1[\n        ${dataSection},\n      ]`,
    );
  } else if (/itemTemplate\s*:\s*\{[\s\S]*?sections\s*:\s*\[/.test(text)) {
    text = replaceItemTemplateSections(text, dataSection);
  } else {
    text = text.replace(
      /(itemTemplate\s*:\s*\{[^}]*name\s*:\s*(["'])(?:\\.|(?!\2)[^\\])*\2\s*,?)/,
      `$1\n      sections: [\n        ${dataSection},\n      ],`,
    );
  }

  if (itemTemplateName) {
    text = text.replace(
      /(itemTemplate\s*:\s*\{\s*name\s*:\s*)(["'])([^"']*)\2/,
      `$1$2${itemTemplateName}$2`,
    );
  }

  // Drop inherited thin datasourceTemplate — owner owns the template
  text = text.replace(/\n?\s*datasourceTemplate\s*:\s*["'`][^"'`]+["'`],?/g, '\n');

  if (datasourceFolder) {
    text = text.replace(
      /(datasourceLocation\s*:\s*\{[^}]*folder\s*:\s*\[)\s*["'][^"']*["']\s*(\])/,
      `$1${JSON.stringify(datasourceFolder)}$2`,
    );
    text = text.replace(
      /(content\s*:\s*\{[\s\S]*?location\s*:\s*\{[^}]*folder\s*:\s*\[)\s*["'][^"']*["']\s*(\])/,
      `$1${JSON.stringify(datasourceFolder)}$2`,
    );
  }

  text = upsertContentItems(text, items || []);
  return text;
}

/**
 * @param {string} text
 * @param {string} dataSectionLiteral
 */
function replaceItemTemplateSections(text, dataSectionLiteral) {
  const m = text.match(/itemTemplate\s*:\s*\{/);
  if (!m || m.index == null) return text;
  const itemStart = text.indexOf('{', m.index);
  const itemBody = extractBalanced(text, itemStart, '{', '}');
  if (!itemBody) return text;
  const sectionsMatch = itemBody.match(/sections\s*:\s*\[/);
  if (!sectionsMatch || sectionsMatch.index == null) {
    const inserted = itemBody.replace(
      /(name\s*:\s*(["'])(?:\\.|(?!\2)[^\\])*\2\s*,?)/,
      `$1\n      sections: [\n        ${dataSectionLiteral},\n      ],`,
    );
    return (
      text.slice(0, itemStart + 1) + inserted + text.slice(itemStart + 1 + itemBody.length)
    );
  }
  const secBracket = itemBody.indexOf('[', sectionsMatch.index);
  const secInner = extractBalanced(itemBody, secBracket, '[', ']');
  if (secInner == null) return text;
  const newItemBody =
    itemBody.slice(0, secBracket + 1) +
    `\n        ${dataSectionLiteral},\n      ` +
    itemBody.slice(secBracket + 1 + secInner.length);
  return text.slice(0, itemStart + 1) + newItemBody + text.slice(itemStart + 1 + itemBody.length);
}

/**
 * @param {string} text
 * @param {object[]} items
 */
function upsertContentItems(text, items) {
  const itemsLiteral = formatContentItemsLiteral(items);
  if (/\bcontent\s*:\s*\{/.test(text) && /\bitems\s*:\s*\[/.test(text)) {
    const contentMatch = text.match(/\bcontent\s*:\s*\{/);
    if (!contentMatch || contentMatch.index == null) return text;
    const contentOpen = text.indexOf('{', contentMatch.index);
    const contentBody = extractBalanced(text, contentOpen, '{', '}');
    if (contentBody == null) return text;
    const itemsMatch = contentBody.match(/\bitems\s*:\s*\[/);
    if (!itemsMatch || itemsMatch.index == null) {
      const withItems =
        contentBody.replace(/\s*$/, '') +
        `,\n    items: [\n${itemsLiteral}\n    ],\n  `;
      return (
        text.slice(0, contentOpen + 1) + withItems + text.slice(contentOpen + 1 + contentBody.length)
      );
    }
    const itemsBracket = contentBody.indexOf('[', itemsMatch.index);
    const itemsInner = extractBalanced(contentBody, itemsBracket, '[', ']');
    if (itemsInner == null) return text;
    const newContent =
      contentBody.slice(0, itemsBracket + 1) +
      `\n${itemsLiteral}\n    ` +
      contentBody.slice(itemsBracket + 1 + itemsInner.length);
    return (
      text.slice(0, contentOpen + 1) + newContent + text.slice(contentOpen + 1 + contentBody.length)
    );
  }

  // No content block — append before closing satisfies
  const contentBlock = `
  content: {
    location: { root: "data", folder: ["Data"] },
    items: [
${itemsLiteral}
    ],
  },`;
  if (/\}(\s*satisfies\s+ComponentTemplateDefinition\s*;?\s*)$/.test(text)) {
    return text.replace(
      /\}(\s*satisfies\s+ComponentTemplateDefinition\s*;?\s*)$/,
      `${contentBlock}\n}$1`,
    );
  }
  return text.replace(/\n\}\s*;?\s*$/, `${contentBlock}\n};\n`);
}

/**
 * @param {object[]} items
 */
function formatContentItemsLiteral(items) {
  return (items || [])
    .map((item) => {
      const fieldEntries = Object.entries(item.fields || {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `          ${quoteKey(k)}: ${jsLiteral(v)},`)
        .join('\n');
      const display = item.displayName
        ? `\n        displayName: ${JSON.stringify(item.displayName)},`
        : '';
      const variant = item.variant
        ? `\n        variant: ${JSON.stringify(item.variant)},`
        : '';
      return `      {
        name: ${JSON.stringify(item.name)},${display}${variant}
        fields: {
${fieldEntries}
        },
      },`;
    })
    .join('\n');
}

function quoteKey(k) {
  return /^[A-Za-z_][A-Za-z0-9]*$/.test(k) ? k : JSON.stringify(k);
}

function jsLiteral(v) {
  if (v == null) return '""';
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

/**
 * @param {string} text
 * @param {number} openIndex
 * @param {string} openCh
 * @param {string} closeCh
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

/**
 * Align TSX field components to final Sitecore types.
 * RichText → <RichText>; Single-Line / Multi-Line → <Text>.
 * @param {string} tsx
 * @param {Array<{name: string, type: string}>} fields
 * @returns {string}
 */
export function alignTsxToFieldTypes(tsx, fields) {
  let text = String(tsx || '');
  if (!text.trim() || !Array.isArray(fields) || !fields.length) return text;

  const needRich = fields.some((f) => f.type === 'RichText');
  const needText = fields.some(
    (f) => f.type === 'Single-Line Text' || f.type === 'Multi-Line Text',
  );

  // Ensure imports
  if (needRich && !/\bRichText\b/.test(text)) {
    text = text.replace(
      /import\s*\{([^}]+)\}\s*from\s*["']@sitecore-content-sdk\/nextjs["']/,
      (m, inner) => {
        if (/\bRichText\b/.test(inner)) return m;
        return `import {${inner.replace(/\s*$/, '')}, RichText } from "@sitecore-content-sdk/nextjs"`;
      },
    );
  }
  if (needText && !/\bText\b/.test(text)) {
    text = text.replace(
      /import\s*\{([^}]+)\}\s*from\s*["']@sitecore-content-sdk\/nextjs["']/,
      (m, inner) => {
        if (/\bText\b/.test(inner)) return m;
        return `import {${inner.replace(/\s*$/, '')}, Text } from "@sitecore-content-sdk/nextjs"`;
      },
    );
  }

  for (const f of fields) {
    const name = f.name;
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const access = /^[A-Za-z_][A-Za-z0-9]*$/.test(name)
      ? `(?:(?:[\\w.]+\\.)?fields\\.${esc}|(?:[\\w.]+\\.)?fields\\[["']${esc}["']\\])`
      : `(?:[\\w.]+\\.)?fields\\[["']${esc}["']\\]`;

    if (f.type === 'RichText') {
      text = text.replace(
        new RegExp(`<Text(\\s+[^>]*?field=\\{${access}\\}[^>]*?)\\s*\\/>`, 'g'),
        `<RichText$1 />`,
      );
      text = text.replace(
        new RegExp(`<Text(\\s+[^>]*?field=\\{${access}\\}[^>]*)>([\\s\\S]*?)<\\/Text>`, 'g'),
        `<RichText$1>$2</RichText>`,
      );
      // Interface types
      text = text.replace(
        new RegExp(`(["']?${esc}["']?\\s*:\\s*)TextField`, 'g'),
        `$1RichTextField`,
      );
    } else if (f.type === 'Single-Line Text' || f.type === 'Multi-Line Text') {
      text = text.replace(
        new RegExp(`<RichText(\\s+[^>]*?field=\\{${access}\\}[^>]*?)\\s*\\/>`, 'g'),
        `<Text$1 />`,
      );
      text = text.replace(
        new RegExp(
          `<RichText(\\s+[^>]*?field=\\{${access}\\}[^>]*)>([\\s\\S]*?)<\\/RichText>`,
          'g',
        ),
        `<Text$1>$2</Text>`,
      );
      text = text.replace(
        new RegExp(`(["']?${esc}["']?\\s*:\\s*)RichTextField`, 'g'),
        `$1TextField`,
      );
    }
  }

  // Type imports
  if (/\bRichTextField\b/.test(text) && !/import\s+type\s*\{[^}]*\bRichTextField\b/.test(text)) {
    if (/import\s+type\s*\{[^}]+\}\s*from\s*["']@sitecore-content-sdk\/nextjs["']/.test(text)) {
      text = text.replace(
        /import\s+type\s*\{([^}]+)\}\s*from\s*["']@sitecore-content-sdk\/nextjs["']/,
        (m, inner) => {
          if (/\bRichTextField\b/.test(inner)) return m;
          return `import type {${inner.replace(/\s*$/, '')}, RichTextField } from "@sitecore-content-sdk/nextjs"`;
        },
      );
    } else if (/import\s*\{([^}]+)\}\s*from\s*["']@sitecore-content-sdk\/nextjs["']/.test(text)) {
      text = text.replace(
        /import\s*\{([^}]+)\}\s*from\s*["']@sitecore-content-sdk\/nextjs["']/,
        (m, inner) => {
          if (/\btype\s+RichTextField\b|\bRichTextField\b/.test(inner)) return m;
          return `import {${inner.replace(/\s*$/, '')}, type RichTextField } from "@sitecore-content-sdk/nextjs"`;
        },
      );
    }
  }
  if (/\bTextField\b/.test(text) && !/import\s+type\s*\{[^}]*\bTextField\b/.test(text) && !/type TextField/.test(text)) {
    /* leave existing TextField imports alone */
  }

  return text;
}

/**
 * Apply renameMap to suggestedFields / repeats in section-information.
 * @param {object} info
 * @param {string} memberFolder
 * @param {Map<string, {name: string, type: string}>} renameMap
 * @returns {{ info: object, changed: boolean }}
 */
export function syncSuggestedFieldsInInfo(info, memberFolder, renameMap) {
  if (!info || !renameMap?.size) return { info, changed: false };
  let changed = false;

  const sitecoreToHint = (type) => {
    if (type === 'RichText') return 'richText';
    if (type === 'Image') return 'image';
    if (type === 'General Link') return 'link';
    if (type === 'Multi-Line Text') return 'multiline';
    if (type === 'Checkbox') return 'boolean';
    if (type === 'Number') return 'number';
    return 'text';
  };

  const patchField = (f) => {
    if (!f || typeof f !== 'object') return f;
    const mapKey = `${memberFolder}::${String(f.name || f.fieldName || '').toLowerCase()}`;
    const hit = renameMap.get(mapKey);
    if (!hit) return f;
    const next = { ...f };
    const nextName = hit.name.charAt(0).toLowerCase() + hit.name.slice(1).replace(/\s+/g, '');
    // Keep camelCase-ish for suggestedFields names when original was camelCase
    const original = String(f.name || '');
    if (original === original.toLowerCase() || /^[a-z]/.test(original)) {
      if (next.name !== nextName) {
        next.name = nextName;
        changed = true;
      }
    } else if (toPascalFieldName(original) !== hit.name) {
      next.name = hit.name;
      changed = true;
    }
    const hint = sitecoreToHint(hit.type);
    if (next.type !== hint && next.type !== hit.type) {
      next.type = hint;
      changed = true;
    }
    return next;
  };

  const next = { ...info };
  if (Array.isArray(info.suggestedFields)) {
    next.suggestedFields = info.suggestedFields.map(patchField);
  }
  if (Array.isArray(info.repeats)) {
    next.repeats = info.repeats.map((r) => {
      if (!r || typeof r !== 'object') return r;
      // repeats keep structure; field types inside rows are not named the same way
      return r;
    });
  }
  return { info: next, changed };
}

/**
 * Pure merge entry: given seeds + optional existing items → fields, items, renameMap.
 * @param {object} opts
 */
export function mergeFamilyOwnerDefinition(opts) {
  const ownerFolder = opts.ownerFolder;
  const { fields, renameMap, clusters } = mergeFamilyOwnerFields({
    seeds: opts.seeds || [],
    ownerFolder,
  });

  /** @type {object[]} */
  const seedItems = [];
  const byPage = new Map();
  for (const s of opts.seeds || []) {
    if (!s.pageSlug) continue;
    if (!byPage.has(s.pageSlug)) byPage.set(s.pageSlug, []);
    byPage.get(s.pageSlug).push(s);
  }
  for (const pageSlug of [...byPage.keys()].sort()) {
    const item = buildContentItemFromPageSeeds(byPage.get(pageSlug), renameMap);
    if (item) seedItems.push(item);
  }

  const items = mergeFamilyOwnerItems([
    ...(Array.isArray(opts.existingItems) ? [opts.existingItems] : []),
    seedItems,
  ]);

  return {
    fields,
    items,
    renameMap,
    clusters,
    ownerFolder,
  };
}

/** @param {string} _p unused path helper export for tests */
export function _debugJoin(...parts) {
  return path.join(...parts);
}
