/**
 * Sitecore content item Path / YAML filename must be English Title Case.
 * Field values stay in capture language; only structural `name` is forced to EN.
 *
 * Definition content items are Path-normalized post-sitecoreize (see
 * definition-path-name-normalize.mjs); emit trusts those EN names and should
 * not call this again for them. Prefer this helper for HTML-derived names that
 * never went through that pass (link lists, media, structural folders).
 */
import { proposeValidItemName } from "./naming";
import {
  isPoisonedEnglishIdentity,
  looksAlreadyEnglish,
  translateText,
} from "./translate";

export type ResolveEnglishItemNameOptions = {
  /** Capture / definition source culture (e.g. nl-BE). Defaults to nl-BE when missing. */
  sourceLanguage?: string | null;
  /** When true, kebab-case for Home URL descendants. */
  forUrl?: boolean;
  /**
   * Data/Home folder segments from definitions are structural English keys.
   * When already English, skip nl→en rewrite (avoids Site→Website drift under nl-BE).
   */
  structuralFolder?: boolean;
};

/**
 * Return a Sitecore-valid English item name for Path + `.yml` filename.
 * Routes through translateText so already-English labels seed the phrase cache,
 * except structural folders that already look English (kept stable).
 */
export async function resolveEnglishItemName(
  rawName: string,
  options: ResolveEnglishItemNameOptions = {},
): Promise<string> {
  const source = String(rawName || "").trim() || "unnamed-item";
  const sourceCulture = options.sourceLanguage?.trim() || "nl-BE";
  const forUrl = options.forUrl === true;
  const purpose = options.structuralFolder ? "folder-name-en" : "item-name-en";

  if (options.structuralFolder && looksAlreadyEnglish(source)) {
    return proposeValidItemName(source, source, { forUrl });
  }

  let english = await translateText(source, "en", sourceCulture, { purpose });
  // Safety net: poisoned cache/AI identity must not become Sitecore Path.
  if (isPoisonedEnglishIdentity(source, english)) {
    english = await translateText(source, "en", sourceCulture, {
      purpose,
      replaceExisting: true,
    });
  }

  return proposeValidItemName(english.trim() || source, source, { forUrl });
}
