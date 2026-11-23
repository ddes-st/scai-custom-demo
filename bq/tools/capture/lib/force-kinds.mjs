/**
 * Shared `--force` parsing for capture / create-design-system / enrich.
 *
 *   --force                  → all kinds
 *   --force=css,fonts
 *   --force css,fonts
 *   --force:css,fonts
 */
export const FORCE_KINDS = Object.freeze([
  'html',
  'css',
  'fonts',
  'screenshots',
  'sections',
  'design',
]);

const KIND_SET = new Set(FORCE_KINDS);

/**
 * @param {string | null | undefined} raw
 * @returns {Set<string>}
 */
export function parseForceKindsValue(raw) {
  if (raw == null || raw === true || String(raw).trim() === '') {
    return new Set(FORCE_KINDS);
  }
  const parts = String(raw)
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  if (!parts.length) return new Set(FORCE_KINDS);
  const out = new Set();
  for (const p of parts) {
    if (p === 'all') {
      for (const k of FORCE_KINDS) out.add(k);
      continue;
    }
    if (!KIND_SET.has(p)) {
      throw new Error(
        `Unknown --force kind "${p}". Allowed: ${FORCE_KINDS.join(', ')} (or all)`,
      );
    }
    out.add(p);
  }
  return out;
}

/**
 * Consume `--force` / `--force=…` / `--force:…` from argv at index i.
 * @returns {{ force: Set<string>, nextIndex: number } | null}
 */
export function consumeForceArg(argv, i) {
  const arg = argv[i];
  if (!arg) return null;

  if (arg === '--force') {
    const next = argv[i + 1];
    if (next && !next.startsWith('-') && !/^https?:\/\//i.test(next)) {
      return { force: parseForceKindsValue(next), nextIndex: i + 2 };
    }
    return { force: parseForceKindsValue(''), nextIndex: i + 1 };
  }

  if (arg.startsWith('--force=')) {
    return { force: parseForceKindsValue(arg.slice('--force='.length)), nextIndex: i + 1 };
  }

  if (arg.startsWith('--force:')) {
    return { force: parseForceKindsValue(arg.slice('--force:'.length)), nextIndex: i + 1 };
  }

  return null;
}

/**
 * @param {Set<string> | null | undefined} force
 * @param {string} kind
 */
export function shouldForce(force, kind) {
  return Boolean(force?.has(kind));
}

export function forceHelpLine() {
  return `--force[=kinds]   Redo artifacts even if present. kinds: ${FORCE_KINDS.join(', ')} (default all)`;
}
