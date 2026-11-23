/**
 * Shared culture-block helpers for Link List / Icon Link List / Image Link List emit.
 * Ensures language `en` field values are English when the seed culture is not.
 */
import {
  isEnglishCulture,
  normalizeCultureKey,
  resolveContentLanguages,
} from "./resolve-content-languages";
import {
  lookupPhrase,
  looksAlreadyEnglish,
  normalizeCultureKeyForCache,
  translateText,
} from "./translate";
import { unwrapStringValue } from "./naming";
import type { ScsLanguageBlock } from "./authoring-item-model";

function normText(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** True when translations.json already has a value for this target culture. */
function hasCachedTargetTranslation(
  text: string,
  sourceCulture: string,
  targetCulture: string,
): boolean {
  const phrase = lookupPhrase(sourceCulture, text);
  if (!phrase?.translations) return false;
  const to = normalizeCultureKeyForCache(targetCulture);
  const value = phrase.translations[to];
  return typeof value === "string" && value.length > 0;
}

/**
 * Prefer content item `name` (English Title Case) for language `en` when it
 * differs from the capture-language Title seed.
 */
export function resolveEnglishTitleHint(
  titleSource: string,
  englishTitleHint?: string | null,
): string | null {
  const hint = String(englishTitleHint || "").trim();
  const source = String(titleSource || "").trim();
  // Untitled link-list groups (Title: "") must stay empty — never fill from name.
  if (!hint || !source) return null;
  if (normText(hint) === normText(source)) return null;
  if (!looksAlreadyEnglish(hint)) return null;
  return hint;
}

/**
 * Translate a plain field value for an emit language.
 *
 * Trust the translation cache once populated — EN may legitimately equal NL
 * (shared tokens). Retry AI only when `en` was **missing** from cache and a
 * fresh AI call returned the same non-English source (noop).
 * Prefer {@link resolveEnglishTitleHint} / item `name` for link-list Titles.
 */
export async function translateFieldForEmitCulture(
  text: string,
  targetLang: string,
  sourceCulture: string,
): Promise<string> {
  const trimmed = String(text || "");
  if (!trimmed.trim()) return trimmed;
  const src = normalizeCultureKey(sourceCulture);
  const to = normalizeCultureKey(targetLang);
  if (to.toLowerCase() === src.toLowerCase()) return trimmed;

  const hadCachedTarget = hasCachedTargetTranslation(trimmed, src, to);
  let value = await translateText(trimmed, to, src);
  if (
    !hadCachedTarget &&
    isEnglishCulture(to) &&
    !isEnglishCulture(src) &&
    normText(value) === normText(trimmed) &&
    !looksAlreadyEnglish(trimmed)
  ) {
    value = await translateText(trimmed, "en", src, {
      purpose: "link-list-en-retry",
      replaceExisting: true,
    });
  }
  return value;
}

/** Extract General Link `text="…"` for English-equality checks. */
export function extractLinkTextFromXml(xml: string): string {
  const m = String(xml || "").match(/\btext="([^"]*)"/i);
  return unwrapStringValue(m?.[1] ?? "");
}

/**
 * Translate General Link XML `text` for an emit language.
 * English retry only after a fresh AI no-op — cached `en` values are trusted.
 */
export async function translateLinkXmlForEmitCulture(
  linkXml: string,
  targetLang: string,
  sourceCulture: string,
  translateXml: (
    xml: string,
    culture: string,
    sourceCulture: string,
  ) => Promise<string>,
): Promise<string> {
  const raw = String(linkXml || "");
  if (!raw.trim()) return raw;
  const src = normalizeCultureKey(sourceCulture);
  const to = normalizeCultureKey(targetLang);
  if (to.toLowerCase() === src.toLowerCase()) return raw;

  const srcText = extractLinkTextFromXml(raw);
  const hadCachedTarget = srcText
    ? hasCachedTargetTranslation(srcText, src, to)
    : false;

  let out = await translateXml(raw, to, src);
  if (
    !hadCachedTarget &&
    isEnglishCulture(to) &&
    !isEnglishCulture(src) &&
    srcText &&
    normText(extractLinkTextFromXml(out)) === normText(srcText) &&
    !looksAlreadyEnglish(srcText)
  ) {
    const enText = await translateText(srcText, "en", src, {
      purpose: "link-list-en-retry",
      replaceExisting: true,
    });
    if (enText && normText(enText) !== normText(srcText)) {
      out = raw.replace(
        /\btext="[^"]*"/i,
        `text="${enText.replace(/"/g, "&quot;")}"`,
      );
    }
  }
  return out;
}

export async function buildLinkListTitleLanguageBlocks(options: {
  titleSource: string;
  cultures: string[];
  sourceCulture?: string;
  titleFieldId: string;
  /** English item `name` (Title Case) — preferred Title for language `en`. */
  englishTitleHint?: string | null;
}): Promise<ScsLanguageBlock[]> {
  const { sourceCulture: src, emitCultures } = resolveContentLanguages({
    culture: options.sourceCulture || "en",
    cultures: options.cultures,
  });
  const srcKey = normalizeCultureKey(src).toLowerCase();
  const enHint = resolveEnglishTitleHint(
    options.titleSource,
    options.englishTitleHint,
  );
  const blocks: ScsLanguageBlock[] = [];
  for (const lang of emitCultures) {
    const isSource = normalizeCultureKey(lang).toLowerCase() === srcKey;
    let value: string;
    if (isSource) {
      value = options.titleSource;
    } else if (isEnglishCulture(lang) && enHint) {
      // Deterministic: name "Mobility" beats translating "Mobiliteit".
      value = enHint;
    } else if (options.titleSource.trim()) {
      value = await translateFieldForEmitCulture(
        options.titleSource,
        lang,
        src,
      );
    } else {
      value = options.titleSource;
    }
    // Untitled groups: emit Title with a true empty string (serializes as
    // `Value:` not `Value: ""`) so CM clears any leftover quote-only value.
    const titleTrimmed = String(value ?? "").trim();
    blocks.push({
      language: lang,
      versions: [
        {
          version: 1,
          versionFields: [
            {
              id: options.titleFieldId,
              hint: "Title",
              value: titleTrimmed,
            },
          ],
        },
      ],
    });
  }
  return blocks;
}
