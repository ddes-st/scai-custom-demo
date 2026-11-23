/**
 * Cookie banner layout placement for create:sectioncomponents.
 * none (default when unset) = codegen + availableRenderings only;
 * place = existing page/partial wiring.
 */
import { isConsentOverlayEvidence } from './ai-codegen.mjs';

export const BQ_COOKIEBANNER_PLACEMENT = 'BQ_COOKIEBANNER_PLACEMENT';

/** @typedef {'place'|'none'} CookieBannerPlacement */

/**
 * @param {string|null|undefined} raw
 * @returns {CookieBannerPlacement|null}
 */
export function normalizeCookieBannerPlacement(raw) {
  const v = String(raw || '')
    .trim()
    .toLowerCase();
  if (v === 'place' || v === 'none') return v;
  return null;
}

/**
 * Resolve placement: CLI value if set → else env → else none.
 * @param {string|null|undefined} [cliValue]
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {CookieBannerPlacement}
 */
export function resolveCookieBannerPlacement(
  cliValue = null,
  env = process.env,
) {
  const fromCli = normalizeCookieBannerPlacement(cliValue);
  if (fromCli) return fromCli;
  const fromEnv = normalizeCookieBannerPlacement(env[BQ_COOKIEBANNER_PLACEMENT]);
  if (fromEnv) return fromEnv;
  return 'none';
}

const COOKIE_KEY_RE =
  /consent|cookie|privacy-consent|gdpr|cmp|onetrust|osano|cookiebot|didomi|usercentrics/;

/**
 * True when this section/package is a cookie/consent banner for placement gates.
 * Footer utility/legal bands often mention "cookies" in purpose prose — that is
 * not a CMP overlay and must still land on the footer partial.
 * @param {object|null|undefined} sectionInfo
 * @param {string|null|undefined} definitionKey
 */
export function isCookieBannerSection(sectionInfo, definitionKey) {
  const k = String(definitionKey || '').toLowerCase();
  // Footer chrome / legal link rows ≠ consent overlay (even if purpose cites cookies).
  if (k && /footer/.test(k)) return false;
  if (k && COOKIE_KEY_RE.test(k)) return true;

  if (!sectionInfo || typeof sectionInfo !== 'object') return false;
  const role = String(
    sectionInfo.role ||
      sectionInfo.pageWiring?.role ||
      sectionInfo.enrichRole ||
      '',
  )
    .trim()
    .toLowerCase();
  if (role === 'partial-footer' || role === 'partial-header') return false;
  if (role === 'partial-cookie') return true;

  const nameBlob = [
    sectionInfo.cmsName,
    sectionInfo.folderName,
    sectionInfo.chromeKind,
    sectionInfo.type,
    sectionInfo.selector,
    sectionInfo.track,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (/footer/.test(nameBlob)) return false;
  if (COOKIE_KEY_RE.test(nameBlob)) return true;

  // Last resort: shared overlay evidence — but never on purpose-only "cookies" prose
  // when the section is clearly a page/footer band (handled above).
  return isConsentOverlayEvidence({
    ...sectionInfo,
    // Exclude purpose from placement detection (legal footers cite cookie policy links).
    purpose: undefined,
  });
}

/**
 * @param {CookieBannerPlacement|string|null|undefined} placement
 * @param {object|null|undefined} sectionInfo
 * @param {string|null|undefined} definitionKey
 */
export function shouldSkipCookieBannerLayoutPlacement(
  placement,
  sectionInfo,
  definitionKey,
) {
  return (
    normalizeCookieBannerPlacement(placement) === 'none' &&
    isCookieBannerSection(sectionInfo, definitionKey)
  );
}
