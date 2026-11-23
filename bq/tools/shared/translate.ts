/**
 * Translate text to Sitecore cultures via Azure OpenAI (with disk cache).
 * Implementation: ./translate-core.mjs
 */
import {
  getTranslationAiLedger,
  getTranslationRunStats,
  isClearlyNonEnglishSource,
  isForceTranslations,
  isNonTranslatable,
  isPoisonedEnglishIdentity,
  lookupPhrase,
  looksAlreadyEnglish,
  makeEntryId,
  mintOpaqueEntryId,
  normalizeCultureKeyForCache,
  normalizeCacheDocument,
  plainTextForLangDetect,
  resetTranslationCacheMemory,
  resetTranslationRunStats,
  seedCachedTranslation,
  setForceTranslations,
  setTranslateWithOpenAiForTests,
  setTranslationAiLedger,
  sourceTextOf,
  translateMany,
  translateText as translateTextImpl,
  TRANSLATION_CACHE_PATH,
} from "./translate-core.mjs";

export type TranslateTextOptions = {
  purpose?: string;
  /** When true, bypass cached target and rewrite the cache entry (e.g. EN heal/retry). */
  replaceExisting?: boolean;
};

export async function translateText(
  text: string,
  targetCulture: string,
  sourceCulture: string,
  options?: TranslateTextOptions,
): Promise<string> {
  return translateTextImpl(text, targetCulture, sourceCulture, options);
}

export {
  getTranslationAiLedger,
  getTranslationRunStats,
  isClearlyNonEnglishSource,
  isForceTranslations,
  isNonTranslatable,
  isPoisonedEnglishIdentity,
  lookupPhrase,
  looksAlreadyEnglish,
  makeEntryId,
  mintOpaqueEntryId,
  normalizeCultureKeyForCache,
  normalizeCacheDocument,
  plainTextForLangDetect,
  resetTranslationCacheMemory,
  resetTranslationRunStats,
  seedCachedTranslation,
  setForceTranslations,
  setTranslateWithOpenAiForTests,
  setTranslationAiLedger,
  sourceTextOf,
  translateMany,
  TRANSLATION_CACHE_PATH,
};
