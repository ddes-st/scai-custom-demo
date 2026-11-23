/**
 * Cross-page content.items merge by content hash.
 * Same hash → same item name on the shared component definition.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * @param {unknown} value
 * @returns {string}
 */
export function hashContentSeed(value) {
  const json = JSON.stringify(value ?? null);
  return createHash('sha256').update(json).digest('hex').slice(0, 16);
}

/**
 * Parse content.items array text from a definition.ts source.
 * @param {string} definitionTs
 * @returns {{ name: string, fields?: object, children?: unknown[] }[]}
 */
export function parseContentItemsLoose(definitionTs) {
  const text = String(definitionTs || '');
  const items = [];
  const re =
    /\{\s*name:\s*(['"])([^'"]+)\1\s*,[\s\S]*?fields:\s*(\{[\s\S]*?\})\s*(?:,\s*children:\s*(\[[\s\S]*?\])\s*)?\}/g;
  let m;
  while ((m = re.exec(text))) {
    items.push({
      name: m[2],
      fieldsRaw: m[3],
      childrenRaw: m[4] || null,
    });
  }
  return items;
}

/**
 * Ensure a content item with the given seed hash exists on the definition.
 * If an item with matching hash meta or identical fields exists, return its name.
 * Otherwise append a new item (caller supplies name).
 *
 * Uses a trailing comment marker `/* bqContentHash:<hash> *\/` after the item name
 * when inserting, and recognizes existing markers.
 *
 * @param {string} definitionTs
 * @param {{
 *   preferredName: string,
 *   contentHash: string,
 *   itemSnippet?: string|null,
 * }} opts
 * @returns {{ definitionTs: string, itemName: string, reused: boolean }}
 */
export function upsertContentItemByHash(definitionTs, opts) {
  const text = String(definitionTs || '');
  const hash = String(opts.contentHash || '').trim();
  const preferredName = String(opts.preferredName || 'Item').trim() || 'Item';
  if (!hash || !text.includes('content:')) {
    return { definitionTs: text, itemName: preferredName, reused: false };
  }

  const markerRe = /\/\*\s*bqContentHash:([a-f0-9]+)\s*\*\//gi;
  let m;
  while ((m = markerRe.exec(text))) {
    if (m[1] === hash) {
      // Find preceding name: '…'
      const before = text.slice(Math.max(0, m.index - 200), m.index);
      const nameMatch = before.match(/name:\s*['"]([^'"]+)['"]\s*,?\s*$/);
      if (nameMatch) {
        return {
          definitionTs: text,
          itemName: nameMatch[1],
          reused: true,
        };
      }
    }
  }

  // Try match by contentHash field if present in seeds
  const hashField = new RegExp(
    `name:\\s*(['"])([^'"]+)\\1[\\s\\S]{0,400}?['"]${hash}['"]`,
  );
  const fieldHit = text.match(hashField);
  if (fieldHit) {
    return { definitionTs: text, itemName: fieldHit[2], reused: true };
  }

  const itemSnippet = String(opts.itemSnippet || '').trim();
  if (!itemSnippet) {
    return { definitionTs: text, itemName: preferredName, reused: false };
  }

  // Insert into items: [ … ]
  const itemsIdx = text.search(/items:\s*\[/);
  if (itemsIdx < 0) {
    return { definitionTs: text, itemName: preferredName, reused: false };
  }
  const openBracket = text.indexOf('[', itemsIdx);
  if (openBracket < 0) {
    return { definitionTs: text, itemName: preferredName, reused: false };
  }

  const marked = itemSnippet.includes('bqContentHash:')
    ? itemSnippet
    : itemSnippet.replace(
        /(name:\s*['"][^'"]+['"])/,
        `$1 /* bqContentHash:${hash} */`,
      );

  const next = `${text.slice(0, openBracket + 1)}\n    ${marked},${text.slice(openBracket + 1)}`;
  return { definitionTs: next, itemName: preferredName, reused: false };
}

/**
 * Load definition, upsert by hash, write back.
 * @param {string} definitionPath
 * @param {{ preferredName: string, contentHash: string, itemSnippet?: string }} opts
 */
export async function upsertDefinitionContentItemByHash(definitionPath, opts) {
  let text = '';
  try {
    text = await readFile(definitionPath, 'utf8');
  } catch {
    return { ok: false, reason: 'missing-definition' };
  }
  const result = upsertContentItemByHash(text, opts);
  if (result.definitionTs !== text) {
    await writeFile(definitionPath, result.definitionTs, 'utf8');
  }
  return { ok: true, ...result, path: definitionPath };
}

/**
 * Stable datasource item name from page slug + section + hash.
 * @param {{ pageSlug?: string, sectionFolder?: string, contentHash: string, fallbackName?: string }} opts
 */
export function datasourceItemNameForInstance(opts) {
  const hash = String(opts.contentHash || '').slice(0, 8);
  const base =
    String(opts.fallbackName || '')
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .trim() || 'Content';
  if (!hash) return base;
  return `${base} ${hash}`;
}
