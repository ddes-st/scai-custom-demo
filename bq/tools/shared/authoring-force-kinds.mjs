/**
 * Shared `--force` parsing for authoring / create:sectioncomponents.
 *
 *   --force                         → components + definition + apply (not translations)
 *   --force:all / --force=all       → all four kinds (including translations)
 *   --force:translations            → alone → all four (including translations)
 *   --force:apply                   → Authoring/Sites API apply pipeline only
 *   --force:yaml                    → deprecated alias for apply
 *   --force:components,definition   → AI package kinds
 *   --force:translations,apply      → exact listed kinds
 *
 * Space form `--force all` is NOT supported (use `--force:all`).
 */
export const AUTHORING_FORCE_KINDS = Object.freeze([
  'components',
  'definition',
  'apply',
  'translations',
]);

/** Bare `--force` — everything except translations. */
export const BARE_FORCE_KINDS = Object.freeze([
  'components',
  'definition',
  'apply',
]);

const KIND_SET = new Set(AUTHORING_FORCE_KINDS);

/**
 * @param {string} part
 * @returns {string[]}
 */
function expandKindToken(part) {
  const p = String(part || '')
    .trim()
    .toLowerCase();
  if (!p) return [];
  if (p === 'all') return [...AUTHORING_FORCE_KINDS];
  if (p === 'ai') return ['components', 'definition'];
  if (p === 'definitions') return ['definition'];
  // Deprecated alias: YAML emit pipeline → Authoring/Sites API apply.
  if (p === 'yaml') return ['apply'];
  if (!KIND_SET.has(p)) {
    throw new Error(
      `Unknown --force kind "${part}". Allowed: ${AUTHORING_FORCE_KINDS.join(', ')} (or all, ai; yaml→apply)`,
    );
  }
  return [p];
}

/**
 * @param {string | null | undefined} raw
 * @returns {Set<string>}
 */
export function parseForceKindsValue(raw) {
  // Bare --force / empty → components + definition + apply (not translations).
  if (raw == null || raw === true || String(raw).trim() === '') {
    return new Set(BARE_FORCE_KINDS);
  }
  const parts = String(raw)
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  if (!parts.length) return new Set(BARE_FORCE_KINDS);

  // `--force:translations` alone → full force including retranslate.
  if (parts.length === 1 && parts[0] === 'translations') {
    return new Set(AUTHORING_FORCE_KINDS);
  }

  const out = new Set();
  for (const p of parts) {
    for (const k of expandKindToken(p)) out.add(k);
  }
  return out;
}

/**
 * Consume `--force` / `--force=…` / `--force:…` from argv at index i.
 * Does not consume a following bare token (no `--force all`).
 * @returns {{ force: Set<string>, nextIndex: number } | null}
 */
export function consumeForceArg(argv, i) {
  const arg = argv[i];
  if (!arg) return null;

  if (arg === '--force') {
    return { force: parseForceKindsValue(''), nextIndex: i + 1 };
  }

  if (arg.startsWith('--force=')) {
    return {
      force: parseForceKindsValue(arg.slice('--force='.length)),
      nextIndex: i + 1,
    };
  }

  if (arg.startsWith('--force:')) {
    return {
      force: parseForceKindsValue(arg.slice('--force:'.length)),
      nextIndex: i + 1,
    };
  }

  return null;
}

/**
 * Parse all force args from argv (last wins if repeated).
 * @param {string[]} [argv]
 * @returns {Set<string>}
 */
export function parseAuthoringForce(argv = process.argv.slice(2)) {
  /** @type {Set<string>} */
  let force = new Set();
  for (let i = 0; i < argv.length; i++) {
    const consumed = consumeForceArg(argv, i);
    if (!consumed) continue;
    force = consumed.force;
    i = consumed.nextIndex - 1;
  }
  return force;
}

/**
 * @param {Set<string> | null | undefined} force
 * @param {string} kind
 */
export function shouldForce(force, kind) {
  return Boolean(force?.has(kind));
}

/**
 * True when conversion (AI TSX / definition) cache should be bypassed.
 * @param {Set<string> | null | undefined} force
 */
export function shouldForceConversion(force) {
  return shouldForce(force, 'components') || shouldForce(force, 'definition');
}

/**
 * True when apply-source skip should be bypassed (Authoring/Sites API apply must run).
 * @param {Set<string> | null | undefined} force
 */
export function shouldForceApply(force) {
  return shouldForce(force, 'apply') || shouldForce(force, 'translations');
}

/**
 * @deprecated Use {@link shouldForceApply}.
 * @param {Set<string> | null | undefined} force
 */
export function shouldForceYamlEmit(force) {
  return shouldForceApply(force);
}

/**
 * Serialize force kinds for forwarding to child CLI (`--force:a,b` or omit).
 * @param {Set<string> | null | undefined} force
 * @returns {string | null} argv token or null when empty
 */
export function formatForceArg(force) {
  if (!force?.size) return null;
  const ordered = AUTHORING_FORCE_KINDS.filter((k) => force.has(k));
  if (!ordered.length) return null;
  // Bare-equivalent set → bare --force (excludes translations).
  if (
    ordered.length === BARE_FORCE_KINDS.length &&
    BARE_FORCE_KINDS.every((k) => force.has(k)) &&
    !force.has('translations')
  ) {
    return '--force';
  }
  if (
    ordered.length === AUTHORING_FORCE_KINDS.length &&
    AUTHORING_FORCE_KINDS.every((k) => force.has(k))
  ) {
    return '--force:all';
  }
  return `--force:${ordered.join(',')}`;
}

/**
 * Force kinds relevant to authoring:generate (apply + translations).
 * @param {Set<string> | null | undefined} force
 * @returns {string | null}
 */
export function formatForceArgForGenerate(force) {
  /** @type {Set<string>} */
  const gen = new Set();
  if (shouldForce(force, 'apply')) gen.add('apply');
  if (shouldForce(force, 'translations')) gen.add('translations');
  if (!gen.size) return null;
  if (gen.has('apply') && gen.has('translations')) {
    return '--force:translations,apply';
  }
  if (gen.has('translations')) return '--force:translations,apply';
  return '--force:apply';
}

export function forceHelpLine() {
  return (
    `--force[=|:kinds] Bypass caches / re-run AI. Bare --force = components,definition,apply ` +
    `(not translations). kinds: ${AUTHORING_FORCE_KINDS.join(', ')}, all, ai ` +
    `(yaml is a deprecated alias for apply). Without --force: reuse prior visualize+sitecoreize; ` +
    `with --force: greenfield codegen (new names allowed) then apply upsert/delete orphans`
  );
}

/**
 * Enable translation cache bypass for this process (and child npm scripts via env).
 * @param {boolean} enabled
 */
export function applyForceTranslations(enabled) {
  if (enabled) {
    process.env.BQ_FORCE_TRANSLATIONS = '1';
  }
}
