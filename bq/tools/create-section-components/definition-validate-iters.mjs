/**
 * BQ_DEFINITION_VALIDATE_MAX_ITERS — AI retries after definitionTs parse/assert failure.
 * Semantics = **retry count** (not total attempts):
 *   0 = no retry (first parse fail aborts)
 *   1 = one retry after failed parse (default)
 *   2–3 = that many retries
 */

export const BQ_DEFINITION_VALIDATE_MAX_ITERS =
  'BQ_DEFINITION_VALIDATE_MAX_ITERS';

/** Default: one parse-repair retry even when TSX validate is off. */
export const BQ_DEFINITION_VALIDATE_MAX_ITERS_DEFAULT = 1;

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {number} [defaultWhenUnset]
 * @returns {number} Integer in 0..3 (retry count)
 */
export function resolveDefinitionValidateMaxIters(
  env = process.env,
  defaultWhenUnset = BQ_DEFINITION_VALIDATE_MAX_ITERS_DEFAULT,
) {
  const raw = env?.[BQ_DEFINITION_VALIDATE_MAX_ITERS];
  if (raw === undefined || String(raw).trim() === '') {
    return defaultWhenUnset;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) return defaultWhenUnset;
  return Math.max(0, Math.min(3, Math.trunc(n)));
}

/**
 * Apply CLI `--definition-validate-max-iters=N` onto process.env.
 * @param {number|null|undefined} cliValue
 * @returns {number} Resolved retry count after apply
 */
export function applyDefinitionValidateMaxItersCli(cliValue) {
  if (cliValue != null && Number.isFinite(Number(cliValue))) {
    const n = Math.max(0, Math.min(3, Math.trunc(Number(cliValue))));
    process.env[BQ_DEFINITION_VALIDATE_MAX_ITERS] = String(n);
  }
  return resolveDefinitionValidateMaxIters();
}

/**
 * Whether an error from finalizeDefinitionTs is a parse/assert refusal.
 * @param {unknown} err
 * @returns {boolean}
 */
export function isDefinitionParseFailure(err) {
  const msg = String(err?.message || err || '');
  if (!msg) return false;
  return (
    /not valid TypeScript after fixups/i.test(msg) ||
    /refusing to write broken definition/i.test(msg) ||
    /DEFINITION SEED SHAPE/i.test(msg) ||
    /DEFINITION SEED INTEGRITY/i.test(msg) ||
    /DEFINITION REPEAT HINT/i.test(msg) ||
    /GraphQL-shaped content seed/i.test(msg) ||
    /Transform failed/i.test(msg) ||
    /Expected ["'\]]/i.test(msg) ||
    /Unterminated/i.test(msg)
  );
}

/** Lead-in for definition parse repair revisionBrief / LLM re-emit. */
export const DEFINITION_PARSE_FIX_HEADER =
  'DEFINITION PARSE FIX (hard): Return complete definitionTs only (no markdown). Re-emit every Single-Line / Multi-Line / Rich Text / displayName seed with JSON.stringify("…") (or equivalent double-quoted JSON string). Bad: Body: \'…programma\'s…\' (apostrophe terminates the string). Good: Body: JSON.stringify("…programma\'s…"). Also close each content.items[] element after fields: Bad: CTA: { text: \'…\', url: \'…\' } }, { name: \'Next\' (fields closed, item still open). Good: CTA: { text: \'…\', url: \'…\' } } }, { name: \'Next\' (fields then item). Never JSON.stringify(JSON.stringify(…)). Delete non-printable C0 controls from seed text — do not escape them into \\u00xx leftovers mid-word. Do not splice CSS/<style>/font-family debris into prose seeds. Do not invent new fields; keep the structure of previousDefinitionTs. Emit valid TS only — keep [ ] { } balanced through model.itemTemplate.sections / sections[].fields, content.items, and nested children: [ … ] (close each array with ], never } alone). Close the component export with } satisfies ComponentTemplateDefinition; — never put satisfies inside the object literal. Never children.results in definitionTs.';

/** Lead-in when definitionTs uses GraphQL layout seed shapes. */
export const DEFINITION_SEED_SHAPE_FIX_HEADER =
  'DEFINITION SEED SHAPE FIX (hard): content must satisfy ComponentContentSeed — keys only location | culture | cultures | items | versions (omit content.linkLists — dual-write retired; flat lists use LinkList packages under folder Link Lists); use content.items[] and nested children: [ { name, fields }, … ]; never GraphQL content.fields or children: { results: […] } in definitionTs (that shape is TSX/getDatasource only; causes TS2353 on ComponentContentSeed). Every content.items[].fields value must be a literal, object literal ({ text, url } / { url, alt } / { svgMarkup: \'<svg…></svg>\', alt }), or JSON.stringify([…]) — never bare identifiers like contextLinks / menuGroups / energypriceLogoSvg (ReferenceError at generate).';

/** Lead-in when child content.items length disagrees with plan repeatHint. */
export const DEFINITION_REPEAT_HINT_FIX_HEADER =
  'DEFINITION REPEAT HINT FIX (hard): content.items.length must match this child\'s plan repeatHint (exact when repeatHint is 1). Seed ONLY this child band from its crop/HTML — never sibling nav/USP inventories or "* Repeat" clones. Emit the correct item count with fields for this component only.';

/**
 * Whether an error should trigger definition validate retry (parse, seed shape, or repeatHint).
 * @param {unknown} err
 * @returns {boolean}
 */
export function isDefinitionValidateFailure(err) {
  if (isDefinitionParseFailure(err)) return true;
  const msg = String(err?.message || err || '');
  return (
    /DEFINITION SEED INTEGRITY/i.test(msg) ||
    /DEFINITION REPEAT HINT/i.test(msg) ||
    /repeatHint/i.test(msg) ||
    /content\.items\.length/i.test(msg)
  );
}