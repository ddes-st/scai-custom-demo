/**
 * Write a file only when contents differ (preserves mtime when identical).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Normalize newlines for stable compare (CRLF vs LF).
 * @param {string} text
 */
export function normalizeNewlinesForCompare(text) {
  return String(text ?? '').replace(/\r\n/g, '\n');
}

/**
 * Ensure trailing newline like other BQ writers.
 * @param {string} text
 */
export function ensureTrailingNewline(text) {
  const s = String(text ?? '');
  return s.endsWith('\n') ? s : `${s}\n`;
}

/**
 * @param {string} absPath
 * @param {string} contents
 * @param {{ encoding?: BufferEncoding, ensureNewline?: boolean }} [opts]
 * @returns {Promise<{ wrote: boolean, reason: 'created' | 'updated' | 'unchanged' }>}
 */
export async function writeFileIfChanged(absPath, contents, opts = {}) {
  const encoding = opts.encoding || 'utf8';
  const ensureNl = opts.ensureNewline !== false;
  const nextRaw = ensureNl
    ? ensureTrailingNewline(String(contents ?? ''))
    : String(contents ?? '');
  const nextCmp = normalizeNewlinesForCompare(nextRaw);

  let prev = null;
  try {
    prev = await readFile(absPath, encoding);
  } catch {
    prev = null;
  }

  if (prev !== null && normalizeNewlinesForCompare(prev) === nextCmp) {
    return { wrote: false, reason: 'unchanged' };
  }

  await mkdir(path.dirname(absPath), { recursive: true });
  await writeFile(absPath, nextRaw, encoding);
  return {
    wrote: true,
    reason: prev === null ? 'created' : 'updated',
  };
}
