/**
 * Extract HTML `id` from section / repeating-block roots only.
 * Never promote nested descendant ids to RenderingIdentifier.
 */

/**
 * Read `id` from the primary section root (`body` → first element child).
 * @param {string} html
 * @returns {string | undefined}
 */
export function extractSectionRootId(html) {
  const text = String(html || '');
  const bodyMatch = text.match(/<body\b[^>]*>/i);
  if (!bodyMatch || bodyMatch.index == null) return undefined;
  const afterBody = text.slice(bodyMatch.index + bodyMatch[0].length);
  return extractFirstElementId(afterBody);
}

/**
 * Read `id` from the first top-level element in an HTML fragment
 * (repeating-block root HTML, not nested descendants).
 * @param {string} htmlFragment
 * @returns {string | undefined}
 */
export function extractRepeatingBlockRootId(htmlFragment) {
  return extractFirstElementId(String(htmlFragment || ''));
}

/**
 * Document-order root ids of direct children under a container that matches
 * `containerSelector` (simple class/tag heuristics via regex — no DOM parser).
 *
 * Prefer elements that are direct structural repeats (e.g. `.imgcard`, `[data-role="card"]`).
 * When `itemSelector` is omitted, uses first-level element children of the first
 * matching container.
 *
 * @param {string} html
 * @param {{ containerClass?: string, itemClass?: string }} [opts]
 * @returns {string[]} parallel list of root ids (empty string when a root has no id)
 */
export function extractRepeatingBlockRootIds(html, opts = {}) {
  const text = String(html || '');
  const itemClass = opts.itemClass || '';
  /** @type {string[]} */
  const ids = [];

  if (itemClass) {
    const re = new RegExp(
      `<([a-z0-9]+)([^>]*\\bclass\\s*=\\s*["'][^"']*\\b${escapeRegExp(itemClass)}\\b[^"']*["'][^>]*)>`,
      'gi',
    );
    let m;
    while ((m = re.exec(text))) {
      ids.push(readIdFromOpenTagAttrs(m[2] || '') || '');
    }
    return ids;
  }

  // Fallback: first container with class, then direct child open tags at shallow depth.
  const containerClass = opts.containerClass || '';
  if (!containerClass) return ids;

  const containerRe = new RegExp(
    `<([a-z0-9]+)([^>]*\\bclass\\s*=\\s*["'][^"']*\\b${escapeRegExp(containerClass)}\\b[^"']*["'][^>]*)>`,
    'i',
  );
  const cm = containerRe.exec(text);
  if (!cm || cm.index == null) return ids;
  const tag = cm[1];
  const start = cm.index + cm[0].length;
  const inner = extractElementInnerHtml(text, tag, start);
  if (!inner) return ids;

  // Collect only top-level element open tags inside the container.
  let depth = 0;
  const openRe = /<\/?([a-z0-9]+)([^>]*)>/gi;
  let om;
  while ((om = openRe.exec(inner))) {
    const full = om[0];
    const name = om[1];
    const attrs = om[2] || '';
    const isClose = full.startsWith('</');
    const selfClosing = /\/>$/.test(full) || voidElements.has(name.toLowerCase());
    if (isClose) {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth === 0) {
      ids.push(readIdFromOpenTagAttrs(attrs) || '');
    }
    if (!selfClosing) depth += 1;
  }
  return ids;
}

/**
 * @param {string} html
 * @returns {string | undefined}
 */
function extractFirstElementId(html) {
  const trimmed = String(html || '').replace(/^\s+/, '');
  // Skip leading comments / doctype noise
  const cleaned = trimmed.replace(/^(?:<!--[\s\S]*?-->|\s)+/, '');
  const m = cleaned.match(/^<([a-z0-9]+)([^>]*)>/i);
  if (!m) return undefined;
  return readIdFromOpenTagAttrs(m[2] || '') || undefined;
}

/**
 * Read standalone HTML `id` from an open-tag attribute string.
 * Never matches `data-bq-id` / `data-id` / similar.
 * @param {string} attrs
 * @returns {string}
 */
export function readIdFromOpenTagAttrs(attrs) {
  // Match standalone `id=` only — never `data-bq-id` / `data-id` / `aria-labelledby`.
  const m = String(attrs || '').match(
    /(?:^|[\s"'/])id\s*=\s*(["'])([^"']*)\1/i,
  );
  return m ? String(m[2] || '').trim() : '';
}

/**
 * @param {string} s
 * @returns {string}
 */
function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const voidElements = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

/**
 * @param {string} html
 * @param {string} tagName
 * @param {number} innerStart index after opening tag
 * @returns {string | null}
 */
function extractElementInnerHtml(html, tagName, innerStart) {
  const openName = tagName.toLowerCase();
  let depth = 1;
  const re = new RegExp(`</?${escapeRegExp(openName)}\\b[^>]*>`, 'gi');
  re.lastIndex = innerStart;
  let m;
  while ((m = re.exec(html))) {
    const isClose = m[0].startsWith('</');
    if (isClose) {
      depth -= 1;
      if (depth === 0) {
        return html.slice(innerStart, m.index);
      }
    } else if (!/\/>$/.test(m[0])) {
      depth += 1;
    }
  }
  return null;
}
