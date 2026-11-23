/**
 * Page + section conversion logs and YAML inventory (read-only after generate).
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { repoRoot } from '../capture/paths.mjs';
import { toKebabCase } from './naming.mjs';

/**
 * True when a conversion-log component entry is the classic String(object) poison
 * (`componentName: "[object Object]"`, `definitionKey: "object-object"`).
 * @param {unknown} c
 */
export function isPoisonedConversionComponent(c) {
  if (!c || typeof c !== 'object') return false;
  const obj = /** @type {Record<string, unknown>} */ (c);
  const key = String(obj.definitionKey || '').trim().toLowerCase();
  const name = String(obj.componentName || '').trim();
  if (key === 'object-object') return true;
  if (/^\[object object\]$/i.test(name)) return true;
  if (name && /^object-object$/i.test(toKebabCase(name))) return true;
  return false;
}

/**
 * Drop poisoned object-object children from a section-conversion payload.
 * Also strips emitted paths that reference `[object Object]` / object-object.
 * @param {object|null|undefined} payload
 * @returns {{ payload: object|null, removed: number }}
 */
export function sanitizeSectionConversionPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { payload: payload ?? null, removed: 0 };
  }
  const next = { ...payload };
  let removed = 0;
  if (Array.isArray(next.components)) {
    const before = next.components.length;
    next.components = next.components.filter((c) => {
      if (isPoisonedConversionComponent(c)) {
        removed += 1;
        return false;
      }
      return true;
    });
    if (next.components.length === before) {
      /* unchanged */
    }
  }
  const stripPoisonPaths = (arr) => {
    if (!Array.isArray(arr)) return arr;
    const filtered = arr.filter((p) => {
      const s = String(p || '');
      if (/object-object/i.test(s) || /\[object Object\]/i.test(s)) {
        removed += 1;
        return false;
      }
      return true;
    });
    return filtered.length !== arr.length ? filtered : arr;
  };
  next.emitted = stripPoisonPaths(next.emitted);
  next.allFiles = stripPoisonPaths(next.allFiles);
  return { payload: next, removed };
}

export async function readSectionConversion(sectionAbsDir) {
  const file = path.join(sectionAbsDir, 'section-conversion.json');
  try {
    const raw = JSON.parse(await readFile(file, 'utf8'));
    const { payload, removed } = sanitizeSectionConversionPayload(raw);
    // One-shot heal poisoned logs so sibling --only merges stay clean.
    if (removed > 0 && payload) {
      try {
        await writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
      } catch {
        /* best-effort rewrite */
      }
    }
    return payload;
  } catch {
    return null;
  }
}

export async function writeSectionConversion(sectionAbsDir, payload) {
  const { payload: clean } = sanitizeSectionConversionPayload(payload);
  const out = path.join(sectionAbsDir, 'section-conversion.json');
  await writeFile(out, `${JSON.stringify(clean, null, 2)}\n`, 'utf8');
  return out;
}

export async function writePageConversion(pageDir, payload) {
  const out = path.join(pageDir, 'page-conversion.json');
  await writeFile(out, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return out;
}

/**
 * Snapshot relative file paths under a root (for before/after diff).
 */
export async function snapshotFiles(rootAbs, { maxDepth = 12 } = {}) {
  const files = new Set();
  async function walk(dir, depth) {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '.git') continue;
        await walk(full, depth + 1);
      } else {
        files.add(path.relative(repoRoot, full).replace(/\\/g, '/'));
      }
    }
  }
  await walk(rootAbs, 0);
  return files;
}

export function diffSnapshots(before, after) {
  const added = [];
  for (const f of after) {
    if (!before.has(f)) added.push(f);
  }
  return added.sort();
}

export function filterInventory(paths, definitionKeys) {
  if (!definitionKeys?.length) return paths;
  const keys = definitionKeys.map((k) => k.toLowerCase());
  const pascals = definitionKeys.map((k) =>
    k
      .split('-')
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(''),
  );
  return paths.filter((p) => {
    const lower = p.toLowerCase();
    return (
      keys.some((k) => lower.includes(k)) ||
      pascals.some((n) => p.includes(n))
    );
  });
}
