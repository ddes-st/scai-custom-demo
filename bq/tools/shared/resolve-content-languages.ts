/**
 * Resolve source culture + full set of Sitecore languages to emit for content.
 * Always includes `en`. Source defaults to `en` when omitted.
 */

export type ContentLanguageOptions = {
  /** Capture / definition seed language (e.g. nl-BE). */
  culture?: string | null;
  /** Extra target cultures. */
  cultures?: string[] | null;
};

export type ResolvedContentLanguages = {
  /** Normalized source culture of definition strings. */
  sourceCulture: string;
  /** Deduped languages to emit (always includes en + source + cultures). */
  emitCultures: string[];
};

function normCulture(raw: string | null | undefined): string {
  return String(raw || "")
    .trim()
    .replace(/_/g, "-");
}

/** True when culture is English (en, en-US, …). */
export function isEnglishCulture(culture: string): boolean {
  const c = normCulture(culture).toLowerCase();
  return c === "en" || c.startsWith("en-");
}

/**
 * Canonical culture for cache / emit identity.
 * Short codes map to Sitecore-style when known; en* → en.
 */
export function normalizeCultureKey(culture: string | null | undefined): string {
  const raw = normCulture(culture);
  if (!raw) return "en";
  const lower = raw.toLowerCase();
  if (lower === "en" || lower.startsWith("en-")) return "en";
  const SHORT: Record<string, string> = {
    nl: "nl-BE",
    fr: "fr-BE",
    de: "de-DE",
  };
  if (SHORT[lower]) return SHORT[lower];
  // Preserve region casing: nl-be → nl-BE
  const m = lower.match(/^([a-z]{2})-([a-z]{2})$/);
  if (m) return `${m[1]}-${m[2]!.toUpperCase()}`;
  return raw;
}

/**
 * Map capture pageLanguage (often short `nl`) to a Sitecore culture.
 * Prefers a match in `cultures[]`, else short→Sitecore map, else normalized input.
 */
export function toSitecoreCulture(
  pageLanguage: string | null | undefined,
  cultures: string[] = [],
): string {
  const raw = normCulture(pageLanguage);
  if (!raw) return "en";
  const key = normalizeCultureKey(raw);
  if (isEnglishCulture(key)) return "en";

  const list = (cultures || []).map((c) => normalizeCultureKey(c));
  const lower = key.toLowerCase();
  const exact = list.find((c) => c.toLowerCase() === lower);
  if (exact) return exact;
  const prefix = list.find(
    (c) =>
      c.toLowerCase() === lower ||
      c.toLowerCase().startsWith(`${lower.split("-")[0]}-`),
  );
  if (prefix) return prefix;
  return key;
}

/**
 * Languages to materialize in YAML for a content definition.
 */
export function resolveContentLanguages(
  options: ContentLanguageOptions = {},
): ResolvedContentLanguages {
  const sourceCulture = normalizeCultureKey(options.culture || "en");
  const extras = (options.cultures || [])
    .map((c) => normalizeCultureKey(c))
    .filter(Boolean);

  const seen = new Set<string>();
  const emitCultures: string[] = [];
  const add = (c: string) => {
    const n = normalizeCultureKey(c);
    const id = n.toLowerCase();
    if (seen.has(id)) return;
    seen.add(id);
    emitCultures.push(n);
  };

  add("en");
  add(sourceCulture);
  for (const c of extras) add(c);

  return { sourceCulture, emitCultures };
}
