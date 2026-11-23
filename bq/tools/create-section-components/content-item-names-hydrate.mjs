/**
 * Rehydrate / drop conversion-log children that lack contentItemNames or packages.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../capture/paths.mjs';
import { extractContentItemNames } from './page-defs.mjs';

/**
 * Resolve absolute path for a repo-relative or absolute definition path.
 * @param {string|undefined|null} definitionRelPath
 * @returns {string|null}
 */
export function resolveDefinitionAbsPath(definitionRelPath) {
  const rel = String(definitionRelPath || '').trim();
  if (!rel) return null;
  return path.isAbsolute(rel) ? rel : path.join(repoRoot, rel);
}

/**
 * Resolve seed item names for a conversion/presentation child.
 * @param {{ contentItemNames?: string[], sources?: { definition?: string } }} child
 * @returns {{ names: string[], packageMissing: boolean, emptySeeds: boolean }}
 */
export function resolveChildContentItemNames(child) {
  const pre = Array.isArray(child?.contentItemNames)
    ? child.contentItemNames.map((n) => String(n || '').trim()).filter(Boolean)
    : [];
  if (pre.length) {
    return { names: pre, packageMissing: false, emptySeeds: false };
  }

  const abs = resolveDefinitionAbsPath(child?.sources?.definition);
  if (!abs) {
    return { names: [], packageMissing: true, emptySeeds: false };
  }
  if (!existsSync(abs)) {
    return { names: [], packageMissing: true, emptySeeds: false };
  }
  try {
    const names = extractContentItemNames(readFileSync(abs, 'utf8'));
    if (!names.length) {
      return { names: [], packageMissing: false, emptySeeds: true };
    }
    return { names, packageMissing: false, emptySeeds: false };
  } catch {
    return { names: [], packageMissing: true, emptySeeds: false };
  }
}

/**
 * Normalize sibling section-conversion components for presentation wiring:
 * drop missing packages; rehydrate empty contentItemNames from definition files.
 *
 * @param {object[]} components
 * @param {{ warn?: (msg: string) => void }} [opts]
 * @returns {object[]}
 */
export function hydrateSiblingConversionComponents(components, opts = {}) {
  const warn = typeof opts.warn === 'function' ? opts.warn : console.warn;
  const list = Array.isArray(components) ? components : [];
  /** @type {object[]} */
  const out = [];
  for (const c of list) {
    const role = String(c?.role || '').toLowerCase();
    if (role !== 'child') {
      out.push({ ...c, emitted: Array.isArray(c?.emitted) ? c.emitted : [] });
      continue;
    }
    const key = String(c?.definitionKey || '').trim();
    const resolved = resolveChildContentItemNames(c);
    if (resolved.packageMissing) {
      warn(
        `  ⚠ Presentation: stale/retired child "${key || c?.componentName || '?'}" — package missing — skipped`,
      );
      continue;
    }
    out.push({
      ...c,
      contentItemNames: resolved.names.length
        ? resolved.names
        : Array.isArray(c?.contentItemNames)
          ? c.contentItemNames
          : [],
      emitted: [],
    });
  }
  return out;
}
