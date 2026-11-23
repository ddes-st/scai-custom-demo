/**
 * Shared BQ env readers for create:sectioncomponents / definitions emit.
 */

/** Opt-in: model repeating link lists as composite parent + placeholder + link-item children. */
export const BQ_LINK_LIST_AS_COMPOSITE = 'BQ_LINK_LIST_AS_COMPOSITE';

/**
 * @param {unknown} raw
 * @returns {boolean}
 */
export function envFlagEnabled(raw) {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined> | null | undefined} [env]
 * @returns {boolean}
 */
export function isLinkListAsCompositeEnabled(env = process.env) {
  return envFlagEnabled(env?.[BQ_LINK_LIST_AS_COMPOSITE]);
}

/**
 * When the composite link-list flag is on and this definition is a true
 * placeholder composite (or otherwise not a platform list folder), skip the
 * platform Link/Icon/Image Link Lists emit + rendering override.
 *
 * @param {{
 *   placeholders?: Array<{ allowedControls?: string[] | null } | null> | null,
 *   datasourceLocation?: { folder?: string[] | null } | null,
 *   content?: { location?: { folder?: string[] | null } | null } | null,
 * } | null | undefined} definition
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined> | null | undefined} [env]
 * @returns {boolean}
 */
export function shouldPreferCompositeLinkList(definition, env = process.env) {
  if (!isLinkListAsCompositeEnabled(env)) return false;
  if (!definition) return true;
  const controls = (definition.placeholders ?? []).flatMap(
    (p) => p?.allowedControls ?? [],
  );
  if (controls.length > 0) return true;
  return false;
}

/**
 * Hard-rule override block for AI codegen when {@link isLinkListAsCompositeEnabled}.
 * Supersedes platform Link Lists / JSON-bag collapse for repeating links.
 * @returns {string}
 */
export function linkListAsCompositePromptOverride() {
  return [
    'LINK LIST AS COMPOSITE (BQ_LINK_LIST_AS_COMPOSITE=1 — SUPERSEDES Link Lists / Icon Link Lists / Image Link Lists / Multi-Line Text JSON-bag rules for repeating links):',
    '- Model a repeating link list like other multi-item bands: parent package + AppPlaceholder + child link-item packages.',
    '- Parent: optional Title/Heading when the crop has a group heading; chrome only; placeholders: [{ key, allowedControls: ["…-link-item"] }]; omit childItemTemplate; do NOT use folder ["Link Lists"|"Icon Link Lists"|"Image Link Lists"].',
    '- Nested titled groups (footer column, mega-menu column, site-link group): parent = Heading/Title + AppPlaceholder only; each visible link = one child `…-link-item` package with `Link: General Link` (plus Icon/Image when the crop shows those); seed one content item per link; wire one PH child per seed.',
    '- Child (…-link-item): dedicated itemTemplate with Link (plus Icon and/or Image when the crop shows those); placeholders: []; seed N content.items; presentation wires one placeholder child per seed.',
    '- Forbidden under this flag: platform list folders; per-group nested children.results for individual links; Multi-Line Text JSON { text, url }[] / { text, url, icon }[] bags (Links / Site Links / Social Links / …) for repeating link rows; JSON.parse + map of those bags in TSX.',
    '- Ignore Scalar seeds / JSON bags “repeating link list” and “combined repeating rows” rows while this block is in the task — those bags apply only when BQ_LINK_LIST_AS_COMPOSITE is off.',
  ].join('\n');
}
