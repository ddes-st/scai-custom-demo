/**
 * Resolve whether create:sectioncomponents should create/update a brand kit.
 * CLI `--brandkit` / `--no-brandkit` wins over `BQ_CREATE_BRANDKIT` env.
 */

/**
 * @param {string|undefined|null} raw
 */
export function parseEnvBool(raw) {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!v) return null;
  if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true;
  if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
  return null;
}

/**
 * @param {{ brandkit?: boolean|null }} [args]
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function resolveCreateBrandkit(args = {}, env = process.env) {
  if (args.brandkit === true) return true;
  if (args.brandkit === false) return false;
  const fromEnv = parseEnvBool(env.BQ_CREATE_BRANDKIT);
  return fromEnv === true;
}
