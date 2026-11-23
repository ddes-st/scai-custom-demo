/**
 * Deterministic repair for AI-compact content.items that omit the item-closing
 * `}` after nested last fields (CTA / Image / JSON.stringify([…])).
 *
 * Broken:  CTA: { text, url } }, { name: 'Next'
 * Fixed:   CTA: { text, url } } }, { name: 'Next'
 */

/**
 * Collapse accidental JSON.stringify(JSON.stringify(…)) to a single wrap.
 * Safe when the outer call's argument is exactly another JSON.stringify(…).
 * Also repairs the common AI miss where the outer `)` is omitted:
 *   JSON.stringify(JSON.stringify({ … }),  ← next field
 * → JSON.stringify({ … }),
 * @param {string} source
 * @returns {{ text: string, collapsed: number }}
 */
export function collapseDoubleJsonStringify(source) {
  let text = String(source || '');
  let collapsed = 0;
  const re = /JSON\.stringify\s*\(\s*JSON\.stringify\s*\(/g;
  let m;
  while ((m = re.exec(text))) {
    const openOuter = m.index;
    const innerStart = m.index + m[0].length - 'JSON.stringify('.length;
    // Find matching close for the INNER stringify's paren (starts at innerStart's '(')
    const innerParen = text.indexOf('(', innerStart);
    if (innerParen < 0) break;
    const innerClose = skipBalancedParen(text, innerParen);
    if (innerClose < 0) break;
    // After inner close, optional ws then outer close
    let j = innerClose;
    while (j < text.length && /\s/.test(text[j])) j += 1;
    // Missing outer `)` — AI often ends `JSON.stringify(JSON.stringify({…}),` next field
    if (text[j] !== ')') {
      if (text[j] === ',' || text[j] === '}' || text[j] === '\n') {
        // Treat innerClose as the only close; collapse to single stringify(arg)
        const arg = text.slice(innerParen + 1, innerClose - 1);
        const replacement = `JSON.stringify(${arg})`;
        text = text.slice(0, openOuter) + replacement + text.slice(innerClose);
        collapsed += 1;
        re.lastIndex = openOuter + replacement.length;
        continue;
      }
      break;
    }
    // Replace outer JSON.stringify( JSON.stringify( ARG ) ) → JSON.stringify( ARG )
    // innerClose is the index *after* the inner ')'; arg excludes that paren.
    const arg = text.slice(innerParen + 1, innerClose - 1);
    const replacement = `JSON.stringify(${arg})`;
    text = text.slice(0, openOuter) + replacement + text.slice(j + 1);
    collapsed += 1;
    re.lastIndex = openOuter + replacement.length;
  }
  return { text, collapsed };
}

/**
 * @param {string} text
 * @param {number} openIdx index of '('
 * @returns {number} index after closing ')' or -1
 */
function skipBalancedParen(text, openIdx) {
  let depth = 0;
  let inStr = null;
  let esc = false;
  for (let i = openIdx; i < text.length; i += 1) {
    const ch = text[i];
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (ch === '\\') {
        esc = true;
        continue;
      }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = ch;
      continue;
    }
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/**
 * Locate `items: [` under a content: block (best-effort).
 * @param {string} source
 * @returns {{ arrayOpen: number, arrayClose: number } | null}
 */
export function findContentItemsArraySpan(source) {
  const src = String(source || '');
  const contentIdx = src.search(/\bcontent\s*:/);
  if (contentIdx < 0) return null;
  const fromContent = src.slice(contentIdx);
  const itemsMatch = fromContent.match(/\bitems\s*:\s*\[/);
  if (!itemsMatch || itemsMatch.index == null) return null;
  const arrayOpen = contentIdx + itemsMatch.index + itemsMatch[0].length - 1;
  const arrayClose = findMatchingBracket(src, arrayOpen, '[', ']');
  if (arrayClose < 0) return null;
  return { arrayOpen, arrayClose };
}

/**
 * @param {string} text
 * @param {number} openIdx
 * @param {string} openCh
 * @param {string} closeCh
 */
function findMatchingBracket(text, openIdx, openCh, closeCh) {
  let depth = 0;
  let inStr = null;
  let esc = false;
  for (let i = openIdx; i < text.length; i += 1) {
    const ch = text[i];
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (ch === '\\') {
        esc = true;
        continue;
      }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = ch;
      continue;
    }
    // Skip JSON.stringify(…) argument braces (treat call as opaque for array end)
    if (
      ch === 'J' &&
      text.startsWith('JSON.stringify', i)
    ) {
      const paren = text.indexOf('(', i + 'JSON.stringify'.length);
      if (paren >= 0) {
        const after = skipBalancedParen(text, paren);
        if (after > 0) {
          i = after - 1;
          continue;
        }
      }
    }
    if (ch === openCh) depth += 1;
    else if (ch === closeCh) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * True when at `i` we see `{` then optional ws then `name` (next items[] element).
 * @param {string} text
 * @param {number} i
 */
function looksLikeNextItemName(text, i) {
  let j = i;
  while (j < text.length && /\s/.test(text[j])) j += 1;
  if (text[j] !== '{') return false;
  j += 1;
  while (j < text.length && /\s/.test(text[j])) j += 1;
  return text.startsWith('name', j);
}

/**
 * Insert missing item-close `}` before `, { name` / `]` when the item is still open
 * after `fields` closed (last field was a nested object / stringify array).
 *
 * Nested LinkList-style `children: [{ name, fields… }, …]` must NOT trigger inserts:
 * after parent `fields` close we remain at brace===1 while walking nested `{ name`
 * siblings — those commas are not missing parent closes.
 * @param {string} source
 * @returns {{ text: string, inserted: number }}
 */
export function repairContentItemsMissingItemClose(source) {
  let text = String(source || '');
  const span = findContentItemsArraySpan(text);
  if (!span) return { text, inserted: 0 };

  let inserted = 0;
  // Work on the array body; rebuild after each insert (indices shift).
  for (;;) {
    const again = findContentItemsArraySpan(text);
    if (!again) break;
    const { arrayOpen, arrayClose } = again;
    const fixAt = findNextMissingItemClose(text, arrayOpen, arrayClose);
    if (fixAt < 0) break;
    text = `${text.slice(0, fixAt)}}${text.slice(fixAt)}`;
    inserted += 1;
    // Safety: avoid infinite loops on pathological input
    if (inserted > 200) break;
  }
  return { text, inserted };
}

/**
 * @param {string} text
 * @param {number} arrayOpen index of `[`
 * @param {number} arrayClose index of matching `]`
 * @returns {number} index to insert `}` before, or -1
 */
function findNextMissingItemClose(text, arrayOpen, arrayClose) {
  let i = arrayOpen + 1;
  let inStr = null;
  let esc = false;
  /** Brace depth relative to items array body (0 = between items). */
  let brace = 0;
  /**
   * Bracket depth: 1 = top-level content.items body. Nested `children: [` (or any
   * nested array) raises this so `, { name` inside children is ignored.
   */
  let arrayDepth = 1;
  /** True once we've seen `fields:` and entered its object while brace went to 2+. */
  let seenFieldsObject = false;
  /** True after fields object's closing brace brought us back to brace===1. */
  let fieldsClosed = false;

  while (i < arrayClose) {
    const ch = text[i];

    if (inStr) {
      if (esc) {
        esc = false;
        i += 1;
        continue;
      }
      if (ch === '\\') {
        esc = true;
        i += 1;
        continue;
      }
      if (ch === inStr) inStr = null;
      i += 1;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inStr = ch;
      i += 1;
      continue;
    }

    if (ch === 'J' && text.startsWith('JSON.stringify', i)) {
      const paren = text.indexOf('(', i + 'JSON.stringify'.length);
      if (paren >= 0) {
        const after = skipBalancedParen(text, paren);
        if (after > 0) {
          i = after;
          continue;
        }
      }
    }

    if (ch === '[') {
      arrayDepth += 1;
      i += 1;
      continue;
    }

    if (ch === ']') {
      arrayDepth = Math.max(1, arrayDepth - 1);
      i += 1;
      continue;
    }

    if (ch === '{') {
      if (brace === 0 && arrayDepth === 1) {
        seenFieldsObject = false;
        fieldsClosed = false;
      }
      // Detect fields: { at brace 1 → entering fields (top-level item only)
      if (brace === 1 && arrayDepth === 1) {
        let k = i - 1;
        while (k > arrayOpen && /\s/.test(text[k])) k -= 1;
        if (text[k] === ':') {
          let labelEnd = k - 1;
          while (labelEnd > arrayOpen && /\s/.test(text[labelEnd])) labelEnd -= 1;
          const labelStart = Math.max(arrayOpen + 1, labelEnd - 20);
          const label = text.slice(labelStart, labelEnd + 1);
          if (/\bfields\s*$/.test(label)) seenFieldsObject = true;
        }
      }
      brace += 1;
      i += 1;
      continue;
    }

    if (ch === '}') {
      brace = Math.max(0, brace - 1);
      if (seenFieldsObject && brace === 1 && arrayDepth === 1) {
        fieldsClosed = true;
      }
      i += 1;
      continue;
    }

    // Missing item close: top-level item still open after fields, next sibling or end
    if (brace === 1 && fieldsClosed && arrayDepth === 1) {
      if (ch === ',') {
        let j = i + 1;
        while (j < arrayClose && /\s/.test(text[j])) j += 1;
        if (looksLikeNextItemName(text, j)) {
          return i; // insert `}` before this comma
        }
      }
    }

    i += 1;
  }

  // Trailing: top-level item still open at end of items array
  if (brace === 1 && fieldsClosed && arrayDepth === 1) {
    return arrayClose; // insert `}` before `]`
  }

  return -1;
}

/** Max root `}` inserts before `satisfies` (pathological AI spam guard). */
const MAX_ROOT_BRACES_BEFORE_SATISFIES = 8;

/**
 * String-aware brace depth from the first `{` after `export … =` up to `satisfies`.
 * @param {string} source
 * @returns {{ depth: number, sat: number }}
 */
export function braceDepthBeforeSatisfies(source) {
  const src = String(source || '');
  const sat = src.search(/\bsatisfies\b/);
  if (sat < 0) return { depth: 0, sat: -1 };
  const eq = src.indexOf('=');
  if (eq < 0 || eq > sat) return { depth: 0, sat };
  let i = src.indexOf('{', eq);
  if (i < 0 || i > sat) return { depth: 0, sat };
  let depth = 0;
  let inStr = null;
  let esc = false;
  for (; i < sat; i += 1) {
    const ch = src[i];
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (ch === '\\') {
        esc = true;
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
    else if (ch === '}') depth -= 1;
  }
  return { depth, sat };
}

/**
 * AI one-liners often omit the root `}` before `satisfies ComponentTemplateDefinition`.
 * Insert enough closing braces (capped) so the export object is balanced.
 * @param {string} source
 * @returns {{ text: string, rootClosed: number }}
 */
export function closeUnbalancedBracesBeforeSatisfies(source) {
  const src = String(source || '');
  const { depth, sat } = braceDepthBeforeSatisfies(src);
  if (sat < 0 || depth <= 0) return { text: src, rootClosed: 0 };
  const n = Math.min(depth, MAX_ROOT_BRACES_BEFORE_SATISFIES);
  return {
    text: `${src.slice(0, sat)}${'}'.repeat(n)} ${src.slice(sat)}`,
    rootClosed: n,
  };
}

/**
 * Full content.items brace + double-stringify + root-before-satisfies repair.
 * @param {string} source
 * @returns {{ text: string, inserted: number, collapsedStringify: number, rootClosed: number }}
 */
export function repairDefinitionContentItems(source) {
  const dbl = collapseDoubleJsonStringify(source);
  const braces = repairContentItemsMissingItemClose(dbl.text);
  const root = closeUnbalancedBracesBeforeSatisfies(braces.text);
  return {
    text: root.text,
    inserted: braces.inserted,
    collapsedStringify: dbl.collapsed,
    rootClosed: root.rootClosed,
  };
}
