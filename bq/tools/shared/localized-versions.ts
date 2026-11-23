import type { ScsField } from "./provenance";
import type { ScsLanguageBlock, ScsVersionBlock } from "./authoring-item-model";
import { translateText } from "./translate";
import {
  normalizeCultureKey,
  resolveContentLanguages,
} from "./resolve-content-languages";
import { readItemFieldValue } from "./authoring-items";

/** Hints whose values are auto-translated for non-en cultures (enumerations). */
export const ENUM_DISPLAY_TRANSLATE_HINTS = [
  "__Display name",
  "__Long description",
  "__Short description",
] as const;

/** Hints whose values are auto-translated for non-en cultures (dictionary entries). */
export const DICTIONARY_PHRASE_TRANSLATE_HINTS = [
  "Phrase",
  "__Long description",
  "__Short description",
] as const;

async function translateVersionFields(
  fields: ScsField[],
  culture: string,
  sourceCulture: string,
  translateHints: ReadonlySet<string>,
  sitecorePath?: string,
): Promise<ScsField[]> {
  const translated: ScsField[] = [];
  for (const field of fields) {
    if (translateHints.has(field.hint)) {
      const value = String(field.value);
      if (sitecorePath) {
        const stickyTarget = await readItemFieldValue({
          path: sitecorePath,
          fieldName: field.hint,
          language: culture,
        });
        const stickySource = await readItemFieldValue({
          path: sitecorePath,
          fieldName: field.hint,
          language: sourceCulture,
        });
        if (
          stickyTarget?.trim() &&
          stickySource !== undefined &&
          stickySource === value
        ) {
          translated.push({ ...field, value: stickyTarget });
          continue;
        }
      }
      translated.push({
        ...field,
        value: await translateText(value, culture, sourceCulture),
      });
    } else {
      translated.push(field);
    }
  }
  return translated;
}

/**
 * Build Languages blocks for multi-version items from source culture strings.
 * Always includes `en` + source + extras; translates when language ≠ source.
 */
export async function buildMultiVersionLanguageBlocks(options: {
  /** Field values in `sourceCulture` (param name kept for callers). */
  enVersions: ScsVersionBlock[];
  cultures: string[];
  translateHints: readonly string[];
  sourceCulture?: string;
  /** Sitecore path for sticky CM field reads on re-apply. */
  sitecorePath?: string;
  /** @deprecated Use {@link sitecorePath}. */
  existingYamlPath?: string;
}): Promise<ScsLanguageBlock[]> {
  const hintSet = new Set(options.translateHints);
  const { sourceCulture: src, emitCultures } = resolveContentLanguages({
    culture: options.sourceCulture || "en",
    cultures: options.cultures,
  });
  const srcKey = normalizeCultureKey(src).toLowerCase();
  const sitecorePath = options.sitecorePath || options.existingYamlPath;

  const blocks: ScsLanguageBlock[] = [];
  for (const lang of emitCultures) {
    const isSource = normalizeCultureKey(lang).toLowerCase() === srcKey;
    const versions: ScsVersionBlock[] = [];
    for (const ver of options.enVersions) {
      const versionFields = ver.versionFields || [];
      versions.push({
        version: ver.version,
        versionFields: isSource
          ? versionFields
          : await translateVersionFields(
              versionFields,
              lang,
              src,
              hintSet,
              sitecorePath,
            ),
      });
    }
    blocks.push({ language: lang, versions });
  }
  return blocks;
}
