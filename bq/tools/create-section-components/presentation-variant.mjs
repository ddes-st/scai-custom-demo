/**
 * Infer Sitecore headless variant names for presentation children from capture /
 * content-seed signals. Site-agnostic; used by create-section-components wiring.
 */

const TEASER_TITLE_RE =
  /bekijk|view all|alle producten|tous les produits|voir tous/i;

/**
 * @param {{
 *   title?: string,
 *   hasImage?: boolean,
 *   hasPromoLabel?: boolean,
 *   hasRating?: boolean,
 *   className?: string,
 *   htmlSnippet?: string,
 * }} signals
 * @returns {string | undefined} PascalCase variant name, or undefined for Default
 */
export function inferChildVariantFromSignals(signals = {}) {
  const classBlob = `${signals.className || ''} ${signals.htmlSnippet || ''}`;
  const title = String(signals.title || '');
  const hasPromoLabel = Boolean(signals.hasPromoLabel);
  const hasRating = Boolean(signals.hasRating);

  // Rating / score cards (eKomi-style) stay Default — field-driven chrome, not Teaser.
  if (hasRating) return undefined;

  // Teaser only for explicit imgcard teaser chrome or “view all” titles — never bare !hasImage.
  if (
    /\bimgcard--teaser\b/i.test(classBlob) ||
    /--teaser\b/i.test(classBlob) ||
    TEASER_TITLE_RE.test(title)
  ) {
    return 'Teaser';
  }

  if (
    hasPromoLabel ||
    /\bimgcard--promo\b|\bimgcard--featured\b|--promo\b|--featured\b|ribbon|badge/i.test(
      classBlob,
    )
  ) {
    return 'Promo';
  }

  return undefined;
}

/**
 * Infer variant from a definition.ts content item `fields: { … }` body string.
 * @param {string} fieldsBody
 * @returns {string | undefined}
 */
export function inferChildVariantFromFieldsBody(fieldsBody) {
  const body = String(fieldsBody || '');
  const titleMatch = body.match(/Title\s*:\s*(["'])((?:\\.|(?!\1)[^\\])*)\1/);
  const title = titleMatch ? titleMatch[2] : '';
  const hasImage = /\bImage\s*:\s*\{/.test(body);
  const hasRating =
    /\bRating\s*:/.test(body) ||
    /\b["']Rating Maximum["']\s*:/.test(body) ||
    /\b["']Rating Summary["']\s*:/.test(body);
  const promoMatch = body.match(
    /["']Promo Label["']\s*:\s*(["'])((?:\\.|(?!\1)[^\\])*)\1/,
  );
  const hasPromoLabel = Boolean(promoMatch && String(promoMatch[2]).trim());
  return inferChildVariantFromSignals({
    title,
    hasImage,
    hasPromoLabel,
    hasRating,
  });
}

/**
 * Parse **top-level** content.items from a definition.ts source and return
 * `{ name, variant?, renderingIdentifier? }[]` for presentation wiring.
 * Ignores nested `children[].name` (Link List link rows under groups).
 * @param {string} definitionSource
 * @returns {Array<{ name: string, variant?: string, renderingIdentifier?: string }>}
 */
export function contentItemsWithVariantsFromDefinition(definitionSource) {
  const text = String(definitionSource || '');
  /** @type {Array<{ name: string, variant?: string, renderingIdentifier?: string }>} */
  const out = [];

  // Limit to content.items array so variants[] / model names are ignored.
  const contentMatch = text.match(/\bcontent\s*:\s*\{/);
  if (!contentMatch || contentMatch.index == null) return out;
  const contentStart = contentMatch.index;
  const contentOpen = text.indexOf('{', contentStart);
  if (contentOpen < 0) return out;
  const contentBody = extractBalancedObjectBody(text, contentOpen);
  if (contentBody == null) return out;

  const itemsMatch = contentBody.match(/\bitems\s*:\s*\[/);
  if (!itemsMatch || itemsMatch.index == null) return out;
  const itemsBracket = contentBody.indexOf('[', itemsMatch.index);
  if (itemsBracket < 0) return out;
  const itemsInner = extractBalancedArrayBody(contentBody, itemsBracket);
  if (itemsInner == null) return out;

  // Walk top-level `{ … }` objects in the items array (array depth 1).
  let i = 0;
  let arrayDepth = 0;
  let braceDepth = 0;
  while (i < itemsInner.length) {
    const ch = itemsInner[i];
    if (ch === '"' || ch === "'") {
      const q = ch;
      i += 1;
      while (i < itemsInner.length && itemsInner[i] !== q) {
        if (itemsInner[i] === '\\') i += 1;
        i += 1;
      }
      i += 1;
      continue;
    }
    if (ch === '[') {
      arrayDepth += 1;
      i += 1;
      continue;
    }
    if (ch === ']') {
      arrayDepth = Math.max(0, arrayDepth - 1);
      i += 1;
      continue;
    }
    if (ch === '{') {
      if (arrayDepth === 0 && braceDepth === 0) {
        const objStart = i;
        const body = extractBalancedObjectBody(itemsInner, objStart);
        if (body == null) {
          i += 1;
          continue;
        }
        const objEnd = objStart + body.length + 2; // include braces
        const nameMatch = body.match(/^\s*name\s*:\s*(["'])((?:\\.|(?!\1)[^\\])*)\1/);
        // name may not be first — search at top level of this object only
        const name = readTopLevelName(body);
        if (name) {
          const fieldsBody = readTopLevelFieldsBody(body);
          if (
            fieldsBody != null &&
            (/\bTitle\s*:/.test(fieldsBody) || /\bLink\s*:/.test(fieldsBody))
          ) {
            const variant = inferChildVariantFromFieldsBody(fieldsBody);
            const renderingIdentifier = readRenderingIdentifierFromItemBody(body);
            out.push({
              name,
              ...(variant ? { variant } : {}),
              ...(renderingIdentifier ? { renderingIdentifier } : {}),
            });
          }
        }
        i = objEnd;
        continue;
      }
      braceDepth += 1;
      i += 1;
      continue;
    }
    if (ch === '}') {
      braceDepth = Math.max(0, braceDepth - 1);
      i += 1;
      continue;
    }
    i += 1;
  }
  return out;
}

/**
 * @param {string} objectBody without outer braces
 * @returns {string | undefined}
 */
function readTopLevelName(objectBody) {
  let i = 0;
  let depth = 0;
  while (i < objectBody.length) {
    const ch = objectBody[i];
    if (ch === '"' || ch === "'") {
      const q = ch;
      i += 1;
      while (i < objectBody.length && objectBody[i] !== q) {
        if (objectBody[i] === '\\') i += 1;
        i += 1;
      }
      i += 1;
      continue;
    }
    if (ch === '{' || ch === '[') {
      depth += 1;
      i += 1;
      continue;
    }
    if (ch === '}' || ch === ']') {
      depth = Math.max(0, depth - 1);
      i += 1;
      continue;
    }
    if (depth === 0) {
      const slice = objectBody.slice(i);
      const m = slice.match(/^name\s*:\s*(["'])((?:\\.|(?!\1)[^\\])*)\1/);
      if (m) return m[2];
    }
    i += 1;
  }
  return undefined;
}

/**
 * @param {string} objectBody without outer braces
 * @returns {string | null}
 */
function readTopLevelFieldsBody(objectBody) {
  let i = 0;
  let depth = 0;
  while (i < objectBody.length) {
    const ch = objectBody[i];
    if (ch === '"' || ch === "'") {
      const q = ch;
      i += 1;
      while (i < objectBody.length && objectBody[i] !== q) {
        if (objectBody[i] === '\\') i += 1;
        i += 1;
      }
      i += 1;
      continue;
    }
    if (ch === '{' || ch === '[') {
      depth += 1;
      i += 1;
      continue;
    }
    if (ch === '}' || ch === ']') {
      depth = Math.max(0, depth - 1);
      i += 1;
      continue;
    }
    if (depth === 0) {
      const slice = objectBody.slice(i);
      const m = slice.match(/^fields\s*:\s*\{/);
      if (m) {
        const open = objectBody.indexOf('{', i);
        if (open < 0) return null;
        return extractBalancedObjectBody(objectBody, open);
      }
    }
    i += 1;
  }
  return null;
}

/**
 * @param {string} objectBody without outer braces
 * @returns {string | undefined}
 */
function readRenderingIdentifierFromItemBody(objectBody) {
  let i = 0;
  let depth = 0;
  while (i < objectBody.length) {
    const ch = objectBody[i];
    if (ch === '"' || ch === "'") {
      const q = ch;
      i += 1;
      while (i < objectBody.length && objectBody[i] !== q) {
        if (objectBody[i] === '\\') i += 1;
        i += 1;
      }
      i += 1;
      continue;
    }
    if (ch === '{' || ch === '[') {
      depth += 1;
      i += 1;
      continue;
    }
    if (ch === '}' || ch === ']') {
      depth = Math.max(0, depth - 1);
      i += 1;
      continue;
    }
    if (depth === 0) {
      const slice = objectBody.slice(i);
      const m = slice.match(
        /^renderingIdentifier\s*:\s*(["'])((?:\\.|(?!\1)[^\\])*)\1/,
      );
      if (m) {
        const id = String(m[2] || '').trim();
        return id || undefined;
      }
    }
    i += 1;
  }
  return undefined;
}

/**
 * @param {string} text
 * @param {number} openBraceIndex index of `{`
 * @returns {string | null} inner body without outer braces
 */
function extractBalancedObjectBody(text, openBraceIndex) {
  let depth = 0;
  for (let i = openBraceIndex; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(openBraceIndex + 1, i);
      }
    }
  }
  return null;
}

/**
 * @param {string} text
 * @param {number} openBracketIndex index of `[`
 * @returns {string | null}
 */
function extractBalancedArrayBody(text, openBracketIndex) {
  let depth = 0;
  for (let i = openBracketIndex; i < text.length; i++) {
    const ch = text[i];
    if (ch === '[') depth += 1;
    else if (ch === ']') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(openBracketIndex + 1, i);
      }
    }
  }
  return null;
}
