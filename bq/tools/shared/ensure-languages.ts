/**
 * Ensure SitecoreAI environment languages via Sites API
 * (`POST /api/v1/languages`), not Authoring createItem under
 * `/sitecore/system/Languages`.
 *
 * Also sync site Settings Supported languages via Sites API
 * (`PATCH … supportedLanguages`) — not Authoring Treelist GUIDs.
 *
 * @see https://api-docs.sitecore.com/sai/sites-api/languages/createlanguage
 * @see https://api-docs.sitecore.com/sai/sites-api/sites/updatesite
 * Field defaults mirrored from live CM `/sitecore/system/Languages/nl-NL` (en):
 * Charset=iso-8859-1, Code page=65001, Encoding=utf-8, Iso=nl, Regional Iso Code=nl-NL.
 */
import {
  createLanguageViaApi,
  createSitesApiContext,
  findLanguageByCulture,
  findSiteByName,
  listLanguagesViaApi,
  mergeSiteSupportedLanguages,
  normalizeSiteSupportedLanguages,
  remoteSiteSupportedLanguages,
  siteSupportedLanguagesIncomplete,
  updateSiteViaApi,
  type ApiLanguage,
} from "../definitions/apply/sites-api";
import { loadLocalEnvFiles } from "./load-local-env";
import {
  type ScsWriteResult,
  type ScsWriteStats,
  emptyWriteStats,
  recordWrite,
} from "./authoring-item-model";

function parseCulture(culture: string): {
  iso: string;
  regional: string;
  regionCode: string | undefined;
} {
  const regional = culture.trim();
  const parts = regional.split("-");
  const iso = (parts[0] || regional).toLowerCase();
  const regionCode = parts[1]?.toUpperCase() || undefined;
  return { iso, regional, regionCode };
}

function charsetForCulture(culture: string): string {
  const iso = culture.split("-")[0]?.toLowerCase() ?? "en";
  if (["zh", "ja", "ko", "th", "ar", "he", "ru", "uk", "bg", "el"].includes(iso)) {
    return "utf-8";
  }
  return "iso-8859-1";
}

/**
 * Ensure a Sitecore Language exists for the culture via Sites API Languages.
 */
export async function ensureSystemLanguage(
  culture: string,
  options?: {
    cachedLanguages?: ApiLanguage[];
  },
): Promise<ScsWriteResult | null> {
  const normalized = culture.trim();
  if (!normalized || normalized.toLowerCase() === "en") {
    return null;
  }

  loadLocalEnvFiles();
  const ctx = await createSitesApiContext();
  const existing = await findLanguageByCulture(
    ctx,
    normalized,
    options?.cachedLanguages,
  );
  if (existing) {
    return "unchanged";
  }

  const { iso, regional, regionCode } = parseCulture(normalized);
  try {
    await createLanguageViaApi(ctx, {
      languageCode: iso,
      name: regional,
      regionCode,
      charset: charsetForCulture(regional),
      codePage: "65001",
      encoding: "utf-8",
      database: "master",
    });
    console.log(
      `[bq:apply:languages] Sites API created language ${regional} (iso=${iso}` +
        (regionCode ? `, region=${regionCode}` : "") +
        `)`,
    );
    return "created";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Race / already-present — re-list and treat as unchanged when found.
    if (/already|exist|conflict|400/i.test(msg)) {
      const again = await findLanguageByCulture(ctx, normalized);
      if (again) {
        console.warn(
          `[bq:apply:languages] ${regional} already present after create conflict`,
        );
        return "unchanged";
      }
    }
    throw err;
  }
}

/**
 * Ensure all definition cultures exist via Sites API Languages.
 */
export async function ensureSystemLanguages(
  cultures: string[],
): Promise<ScsWriteStats> {
  const stats = emptyWriteStats();
  const unique = [
    ...new Set(
      cultures
        .map((c) => c.trim())
        .filter((c) => c && c.toLowerCase() !== "en"),
    ),
  ];
  // `en` is always present — no Sites API round-trip when nothing else to add.
  if (!unique.length) return stats;

  const ctx = await createSitesApiContext();
  let cached: ApiLanguage[] = await listLanguagesViaApi(ctx);

  for (const culture of unique) {
    const before = cached.length;
    const result = await ensureSystemLanguage(culture, {
      cachedLanguages: cached,
    });
    if (result) recordWrite(stats, result);
    if (result === "created") {
      cached = await listLanguagesViaApi(ctx);
      if (cached.length === before) {
        // create succeeded but list lag — still mark culture known locally
        const { regional } = parseCulture(culture);
        cached = [
          ...cached,
          { name: regional, regionalIsoCode: regional, iso: parseCulture(culture).iso },
        ];
      }
    }
  }
  return stats;
}

export type EnsureSiteSupportedLanguagesResult =
  | "updated"
  | "unchanged"
  | "skipped";

/** Optional doubles for unit tests (production callers omit). */
export type EnsureSiteSupportedLanguagesDeps = {
  ensureSystemLanguages?: (
    cultures: string[],
  ) => Promise<ScsWriteStats>;
  createSitesApiContext?: () => Promise<
    Awaited<ReturnType<typeof createSitesApiContext>>
  >;
  findSiteByName?: typeof findSiteByName;
  updateSiteViaApi?: typeof updateSiteViaApi;
};

/**
 * Ensure env languages exist, then PATCH the site's `supportedLanguages`
 * when any needed culture is missing from the remote site.
 *
 * Intended to run once per create:sectioncomponents (existing sites).
 * New sites get `languages` on create via {@link syncSiteViaApi}.
 */
export async function ensureSiteSupportedLanguages(
  options: {
    siteSystem: string;
    cultures: string[];
  },
  deps?: EnsureSiteSupportedLanguagesDeps,
): Promise<EnsureSiteSupportedLanguagesResult> {
  const siteSystem = String(options.siteSystem || "").trim();
  const cultures = normalizeSiteSupportedLanguages(options.cultures);
  if (!siteSystem) {
    console.warn(
      "[bq:apply:languages] ensureSiteSupportedLanguages: missing siteSystem — skip",
    );
    return "skipped";
  }

  const ensureLangs = deps?.ensureSystemLanguages ?? ensureSystemLanguages;
  await ensureLangs(cultures);

  loadLocalEnvFiles();
  const ctx = await (deps?.createSitesApiContext ?? createSitesApiContext)();
  const findSite = deps?.findSiteByName ?? findSiteByName;
  const site = await findSite(ctx, siteSystem);
  if (!site?.id) {
    console.warn(
      `[bq:apply:languages] site "${siteSystem}" not found — skip supportedLanguages`,
    );
    return "skipped";
  }

  const remote = remoteSiteSupportedLanguages(site);
  if (!siteSupportedLanguagesIncomplete(remote, cultures)) {
    console.log(
      `[bq:apply:languages] site "${siteSystem}" supportedLanguages already ok ` +
        `(${remote.join(", ")})`,
    );
    return "unchanged";
  }

  const merged = mergeSiteSupportedLanguages(remote, cultures);
  const updateSite = deps?.updateSiteViaApi ?? updateSiteViaApi;
  await updateSite(ctx, site.id, { supportedLanguages: merged });
  console.log(
    `[bq:apply:languages] site "${siteSystem}" supportedLanguages → ${merged.join(", ")}`,
  );
  return "updated";
}
