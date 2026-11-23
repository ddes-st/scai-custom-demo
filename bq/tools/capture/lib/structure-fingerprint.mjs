/**
 * Content/state-agnostic HTML skeleton for section merge matching.
 * Ignores copy, media URLs, repeating-child counts, and UI state classes.
 */
import { createHash } from 'node:crypto';
import { readOriginalSectionHtml } from './section-html-files.mjs';

const STATE_CLASS_RE =
  /^(is-)?(active|current|selected|open|expanded|disabled|focus|hover|pressed|checked|visited)$/i;

const VOID_TAGS = new Set([
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
 * @param {string} classAttr
 * @returns {string[]}
 */
function stableClasses(classAttr) {
  if (!classAttr) return [];
  return String(classAttr)
    .split(/\s+/)
    .map((c) => c.trim())
    .filter(Boolean)
    .filter((c) => !STATE_CLASS_RE.test(c))
    .filter((c) => !/^js-/.test(c))
    .sort();
}

/**
 * @param {string} attrs
 * @returns {string[]}
 */
function classesFromAttrs(attrs) {
  const m = String(attrs || '').match(/\bclass\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
  if (!m) return [];
  return stableClasses(m[2] ?? m[3] ?? m[4] ?? '');
}

/**
 * @typedef {{ tag: string, classes: string[], children: object[] }} SkelNode
 */

/**
 * Build a tree from HTML (tag + stable classes only).
 * @param {string} html
 * @returns {SkelNode[]}
 */
export function parseHtmlToSkeletonNodes(html) {
  const root = { tag: '#root', classes: [], children: [] };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<\/?([a-zA-Z][\w:-]*)((?:\s[^>]*)?)\/?>/g;
  let match;
  while ((match = re.exec(String(html || ''))) !== null) {
    const full = match[0];
    if (full.startsWith('<!--')) continue;
    const tag = match[1].toLowerCase();
    const attrs = match[2] || '';
    const isClose = full.startsWith('</');
    const selfClosing = full.endsWith('/>') || VOID_TAGS.has(tag);

    if (isClose) {
      while (stack.length > 1 && stack[stack.length - 1].tag !== tag) {
        stack.pop();
      }
      if (stack.length > 1 && stack[stack.length - 1].tag === tag) stack.pop();
      continue;
    }

    const node = { tag, classes: classesFromAttrs(attrs), children: [] };
    stack[stack.length - 1].children.push(node);
    if (!selfClosing) stack.push(node);
  }
  return root.children;
}

/**
 * Collapse consecutive same-signature siblings into one with +.
 * @param {SkelNode[]} nodes
 * @returns {SkelNode[]}
 */
export function collapseRepeatingSiblings(nodes) {
  const out = [];
  for (const node of nodes) {
    const collapsedChildren = collapseRepeatingSiblings(node.children || []);
    const next = { tag: node.tag, classes: node.classes, children: collapsedChildren, repeat: false };
    const sig = nodeSignature(next);
    const prev = out[out.length - 1];
    if (prev && nodeSignature(prev) === sig) {
      prev.repeat = true;
      continue;
    }
    out.push(next);
  }
  return out;
}

function nodeSignature(node) {
  const cls = (node.classes || []).join('.');
  const kids = (node.children || []).map(nodeSignature).join(',');
  return `${node.tag}${cls ? `.${cls}` : ''}[${kids}]`;
}

/**
 * @param {SkelNode[]} nodes
 * @returns {string}
 */
export function serializeSkeleton(nodes) {
  const collapsed = collapseRepeatingSiblings(nodes);
  const walk = (list) =>
    list
      .map((n) => {
        const cls = n.classes.length ? `.${n.classes.join('.')}` : '';
        const body = n.children.length ? `(${walk(n.children)})` : '';
        const rep = n.repeat ? '+' : '';
        return `${n.tag}${cls}${body}${rep}`;
      })
      .join('>');
  return walk(collapsed);
}

/**
 * @param {string} html
 * @returns {{ skeleton: string, structureFingerprint: string, tokens: string[] }}
 */
export function structureFromHtml(html) {
  const nodes = parseHtmlToSkeletonNodes(html);
  const skeleton = serializeSkeleton(nodes);
  const structureFingerprint = createHash('sha256').update(skeleton, 'utf8').digest('hex').slice(0, 16);
  const tokens = skeleton
    .split(/[>.()+\[\],]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  return { skeleton, structureFingerprint, tokens };
}

/**
 * Jaccard similarity on skeleton tokens (0..1).
 * @param {string[]} a
 * @param {string[]} b
 */
export function skeletonSimilarity(a, b) {
  const A = new Set(a || []);
  const B = new Set(b || []);
  if (!A.size && !B.size) return 1;
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

export const SIM_SURE_SAME = 0.92;
export const SIM_SURE_DIFFERENT = 0.55;

/**
 * @param {number} similarity
 * @returns {'same'|'different'|'unsure'}
 */
export function similarityBand(similarity) {
  if (similarity >= SIM_SURE_SAME) return 'same';
  if (similarity <= SIM_SURE_DIFFERENT) return 'different';
  return 'unsure';
}

/**
 * Heuristic “how extended” — larger HTML / more tags wins.
 * @param {string} html
 */
export function extensionScore(html) {
  const s = String(html || '');
  const tags = (s.match(/<[a-zA-Z]/g) || []).length;
  return tags * 1000 + s.length;
}

/**
 * @param {string} sectionDir
 */
export async function structureFromSectionDir(sectionDir) {
  try {
    const original = await readOriginalSectionHtml(sectionDir);
    const html = original?.html || '';
    return { html, ...structureFromHtml(html) };
  } catch {
    return { html: '', skeleton: '', structureFingerprint: '', tokens: [] };
  }
}

/** @deprecated content-sensitive; prefer structureFromHtml */
export function fingerprintSectionDirLegacyPayload(html, desktopSize) {
  const payload = [String(html || '').replace(/\s+/g, ' ').trim(), String(desktopSize || 0)].join('|');
  return createHash('sha256').update(payload).digest('hex').slice(0, 16);
}
