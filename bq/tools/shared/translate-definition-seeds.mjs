/**
 * Historically translated definition.ts content seeds to English when the capture
 * language was not English. Seeds must now stay in `content.culture` (capture
 * language); emit translates to `en` + `cultures`. This helper is a no-op.
 */
export { looksAlreadyEnglish } from './translate-core.mjs';

/**
 * @param {string} source definition.ts source
 * @param {string} [_pageLanguage] unused — kept for call-site compatibility
 * @returns {Promise<string>}
 */
export async function translateDefinitionSeedsToEnglish(source, _pageLanguage) {
  void _pageLanguage;
  return String(source || '');
}
