/**
 * Persistent multilingual URL route cache:
 * locale pathname → canonical English Home path + itemId.
 *
 * File: .bq/definitions/cache/url-routes.json
 * Delete that file to force a full route-identity rebuild (same idea as translations.json).
 */
import fs from "node:fs";
import path from "node:path";
import { stripLocalePathSegments } from "./cultures.mjs";
import { BQ_CACHE_DIR } from "./paths";
import { proposeValidItemName, toSystemName } from "./naming";
import {
  isClearlyNonEnglishSource,
  seedCachedTranslation,
  translateText,
} from "./translate";

function titleCaseSegment(seg: string): string {
  return String(seg || "")
    .split(/[-_]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

export const URL_ROUTES_CACHE_PATH = path.join(BQ_CACHE_DIR, "url-routes.json");

/**
 * Stable English path segments for common locale URL slugs.
 * Prevents translate drift (particulieren → individuals vs private-individuals).
 */
export const PATH_SEGMENT_GLOSSARY: Record<string, string> = {
  particulieren: "individuals",
  particuliers: "individuals",
  particular: "individuals",
  netwerk: "network",
  reseau: "network",
  réseau: "network",
  gezin: "family",
  menage: "family",
  ménage: "family",
  famille: "family",
  verzekeringen: "insurance",
  assurances: "insurance",
  bijstand: "assistance",
  assistance: "assistance",
  pensioen: "pension",
  pension: "pension",
  woning: "property",
  mobiliteit: "mobility",
  mobilite: "mobility",
  mobilité: "mobility",
  gezondheid: "health",
  sante: "health",
  santé: "health",
  beleggingen: "investments",
  investissements: "investments",
  "ons-netwerk": "our-network",
  "notre-reseau": "our-network",
  "veelgestelde-vragen": "frequently-asked-questions",
  "digitale-toegankelijkheid": "digital-accessibility",
  "privacy-cookiebeleid": "privacy-cookie-policy",
  "privacy-clausule": "privacy-clause",
  "juridische-info": "legal-information",
  "wettelijke-documenten": "legal-documents",
  "algemene-voorwaarden-en-productfiches":
    "terms-and-conditions-and-product-sheets",
  "over-axa": "about-axa",
  pers: "press",
  "personeel-axa": "axa-staff",
  contact: "contact",
  "site-overzicht": "site-overview",
  "alle-verzekeringen": "all-insurances",
  // Brand / product leaves — never machine-translate (DOM ≠ "home")
  "find-a-dom-dealer": "find-a-dom-dealer",
  dom: "dom",
  // Product leaves (avoid translate drift / false friends like NL "van" → "from")
  bestelwagen: "van",
  van: "van",
  auto: "car",
  motor: "motor",
  fiets: "bicycle",
  pensioensparen: "pension-savings",
  langetermijnsparen: "long-term-savings",
  "groepsverzekering-medewerkers": "employee-group-insurance",
  "vrij-aanvullend-pensioen-werknemers":
    "voluntary-supplementary-pension-for-employees",
  blokpolis: "block-policy",
  schuldsaldoverzekering: "outstanding-balance-insurance",
  "woonverzekering-brandverzekering": "home-insurance-fire-insurance",
  bootverzekering: "boat-insurance",
  dierenverzekering: "pet-insurance",
  evenementenverzekering: "event-insurance",
  "familiale-verzekering": "family-insurance",
  "ongevallenverzekering-priveleven":
    "personal-accident-insurance-for-private-life",
  reisverzekering: "travel-insurance",
  gezondheidsverzekering: "health-insurance",
  arbeidsongeschiktheid: "incapacity-for-work",
  arbeidsongevallen: "occupational-accidents",
  "beleggingsverzekering-tak-23": "branch-23-investment-insurance",
  "spaar-en-of-beleggingsverzekering": "savings-andor-investment-insurance",
  zoekresultaten: "search-results",
  acceptall: "accept-all",
  // Crelan banking path leaves (stable English Home names; avoid AI drift)
  "sparen-en-beleggen": "saving-and-investing",
  beleggen: "investing",
  beleggingsadvies: "investment-advice",
  sparen: "saving",
  spaarrekeningen: "savings-accounts",
  "starten-met-beleggen": "getting-started-with-investing",
  lenen: "borrowing",
  "hypothecaire-lening": "mortgage-loan",
  renovatielening: "renovation-loan",
  autolening: "car-loan",
  "persoonlijke-lening": "personal-loan",
  "andere-doelen": "other-purposes",
  betalen: "payments",
  "betalen-smartphone": "mobile-payments",
  "online-bankieren": "online-banking",
  zichtrekeningen: "current-accounts",
  "zichtrekeningen-vergelijken": "compare-current-accounts",
  "gezamenlijke-rekening": "joint-account",
  "eerste-loon": "first-salary",
  "betalen-in-buitenland-tips": "paying-abroad-tips",
  artikel: "article",
  verzekeren: "insuring",
  "over-crelan": "about-crelan",
  "crelan-sociaal-engagement": "crelan-social-engagement",
  "klant-worden": "become-a-customer",
  kantoorzoeker: "branch-finder",
  klachtenbehandeling: "complaints-handling",
  "reglementaire-info": "regulatory-information",
  tarieflijst: "rate-list",
  ondernemers: "entrepreneurs",
  cooperanten: "cooperative-members",
};

export type LocaleRouteEntry = {
  englishPath: string;
  itemId: string;
  sourceCulture?: string;
  updatedAt: string;
};

export type EnglishRouteEntry = {
  itemId: string;
  localePaths: string[];
};

type SiteRoutes = {
  byLocalePath: Record<string, LocaleRouteEntry>;
  byEnglishPath: Record<string, EnglishRouteEntry>;
};

type UrlRoutesCacheDoc = {
  version: 1;
  routes: Record<string, SiteRoutes>;
};

let memoryDoc: UrlRoutesCacheDoc | null = null;

function emptyDoc(): UrlRoutesCacheDoc {
  return { version: 1, routes: {} };
}

export function resetUrlRouteCacheMemory(): void {
  memoryDoc = null;
}

export function makeSiteKey(
  collectionSystem: string,
  siteSystem: string,
): string {
  return `${toSystemName(collectionSystem)}/${toSystemName(siteSystem)}`;
}

/** Lowercase pathname, no query/hash, single leading slash, no trailing slash (except `/`). */
export function normalizeLocalePath(pathname: string): string {
  let p = String(pathname || "").trim();
  if (!p) return "/";
  const q = p.indexOf("?");
  const h = p.indexOf("#");
  let end = p.length;
  if (q >= 0) end = Math.min(end, q);
  if (h >= 0) end = Math.min(end, h);
  p = p.slice(0, end);
  if (!p.startsWith("/")) p = `/${p}`;
  p = p.replace(/\/+/g, "/");
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p.toLowerCase();
}

export function normalizeEnglishPath(pathname: string): string {
  return normalizeLocalePath(pathname);
}

export function stripCulturePrefixes(
  segments: string[],
  cultures: string[] = [],
): string[] {
  return stripLocalePathSegments(segments, cultures);
}

const ENGLISH_GLOSSARY_TARGETS = new Set(
  Object.values(PATH_SEGMENT_GLOSSARY).map((v) => v.toLowerCase()),
);

export async function toEnglishPathSegment(
  rawSegment: string,
  sourceLanguage: string,
  purpose = "link-page-path",
): Promise<string> {
  const decoded = decodeURIComponent(rawSegment.replace(/\+/g, " ")).trim();
  const slugKey = decoded.toLowerCase().replace(/\s+/g, "-");
  const glossaryHit = PATH_SEGMENT_GLOSSARY[slugKey];
  if (glossaryHit) {
    return titleCaseSegment(glossaryHit);
  }
  // Already a canonical English slug (e.g. van, pension-savings) — do not re-translate.
  if (ENGLISH_GLOSSARY_TARGETS.has(slugKey)) {
    return titleCaseSegment(slugKey);
  }
  const asWords = decoded.replace(/[-_]+/g, " ").trim();
  let from = sourceLanguage.trim() || "en";
  // Wrong culture="en" on NL/FR captures must not keep Dutch/French path leaves
  // (e.g. zoeken) as Home item names — force translate when the slug is clearly non-EN.
  if (from.toLowerCase().split("-")[0] === "en") {
    if (!isClearlyNonEnglishSource(decoded) && !isClearlyNonEnglishSource(asWords)) {
      return titleCaseSegment(slugKey || asWords.replace(/\s+/g, "-"));
    }
    from = /\b(chercher|recherche|particuliers)\b/iu.test(decoded)
      ? "fr-BE"
      : "nl-BE";
  }
  let english = await translateText(asWords, "en", from, { purpose });
  const glossedWords =
    PATH_SEGMENT_GLOSSARY[english.toLowerCase().replace(/\s+/g, "-")];
  if (glossedWords) {
    return titleCaseSegment(glossedWords);
  }
  const englishSlug = english.toLowerCase().replace(/\s+/g, "-");
  if (ENGLISH_GLOSSARY_TARGETS.has(englishSlug)) {
    return titleCaseSegment(englishSlug);
  }
  return titleCaseSegment(english.replace(/\s+/g, "-"));
}

/**
 * Translate each path segment to English kebab URL leaves (Home descendants).
 */
export async function resolveCanonicalEnglishPath(options: {
  pathname: string;
  sourceCulture?: string | null;
  cultures?: string[] | null;
}): Promise<string> {
  const sourceLanguage = String(options.sourceCulture || "en").trim() || "en";
  const cultures = options.cultures ?? [];
  const rawSegments = String(options.pathname || "")
    .replace(/^\//, "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
  const segments = stripCulturePrefixes(rawSegments, cultures);
  if (!segments.length) return "/";

  const enParts: string[] = [];
  for (const seg of segments) {
    const englishTitle = await toEnglishPathSegment(
      seg,
      sourceLanguage,
      "link-page-path",
    );
    const itemName = proposeValidItemName(englishTitle, englishTitle, {
      forUrl: true,
    });
    enParts.push(itemName);
  }
  return `/${enParts.join("/")}`;
}

function ensureCacheDir(): void {
  if (!fs.existsSync(BQ_CACHE_DIR)) {
    fs.mkdirSync(BQ_CACHE_DIR, { recursive: true });
  }
}

export function loadUrlRoutesCache(): UrlRoutesCacheDoc {
  if (memoryDoc) return memoryDoc;
  try {
    if (fs.existsSync(URL_ROUTES_CACHE_PATH)) {
      const raw = JSON.parse(fs.readFileSync(URL_ROUTES_CACHE_PATH, "utf8"));
      if (raw && raw.version === 1 && raw.routes && typeof raw.routes === "object") {
        memoryDoc = raw as UrlRoutesCacheDoc;
        return memoryDoc;
      }
    }
  } catch {
    /* corrupt → empty */
  }
  memoryDoc = emptyDoc();
  return memoryDoc;
}

export function saveUrlRoutesCache(doc?: UrlRoutesCacheDoc): void {
  const d = doc || memoryDoc || emptyDoc();
  memoryDoc = d;
  ensureCacheDir();
  fs.writeFileSync(URL_ROUTES_CACHE_PATH, `${JSON.stringify(d, null, 2)}\n`, "utf8");
}

function siteBucket(doc: UrlRoutesCacheDoc, siteKey: string): SiteRoutes {
  if (!doc.routes[siteKey]) {
    doc.routes[siteKey] = { byLocalePath: {}, byEnglishPath: {} };
  }
  return doc.routes[siteKey]!;
}

export function lookupByLocalePath(
  siteKey: string,
  localePath: string,
): LocaleRouteEntry | undefined {
  const doc = loadUrlRoutesCache();
  const key = normalizeLocalePath(localePath);
  return doc.routes[siteKey]?.byLocalePath?.[key];
}

export function lookupByEnglishPath(
  siteKey: string,
  englishPath: string,
): EnglishRouteEntry | undefined {
  const doc = loadUrlRoutesCache();
  const key = normalizeEnglishPath(englishPath);
  return doc.routes[siteKey]?.byEnglishPath?.[key];
}

/**
 * Seed translations.json for each locale→english path segment pair.
 * Helps display-name / link-text translate reuse the same glossary mapping.
 */
export function seedSegmentTranslationsFromRoute(options: {
  localePath: string;
  englishPath: string;
  sourceCulture?: string | null;
  cultures?: string[] | null;
}): number {
  const sourceCulture =
    String(options.sourceCulture || "en").trim() || "en";
  const localeSegs = stripCulturePrefixes(
    normalizeLocalePath(options.localePath)
      .replace(/^\//, "")
      .split("/")
      .filter(Boolean),
    options.cultures ?? [],
  );
  const englishSegs = normalizeEnglishPath(options.englishPath)
    .replace(/^\//, "")
    .split("/")
    .filter(Boolean);

  const n = Math.min(localeSegs.length, englishSegs.length);
  let seeded = 0;
  for (let i = 0; i < n; i++) {
    const localeRaw = decodeURIComponent(
      String(localeSegs[i] || "").replace(/\+/g, " "),
    ).trim();
    const englishRaw = decodeURIComponent(
      String(englishSegs[i] || "").replace(/\+/g, " "),
    ).trim();
    if (!localeRaw || !englishRaw) continue;
    if (localeRaw.toLowerCase() === englishRaw.toLowerCase()) continue;

    const pairs: Array<[string, string]> = [
      [localeRaw, englishRaw],
      [localeRaw.replace(/[-_]+/g, " "), englishRaw.replace(/[-_]+/g, " ")],
      [titleCaseSegment(localeRaw), titleCaseSegment(englishRaw)],
    ];
    for (const [src, en] of pairs) {
      if (!src.trim() || !en.trim()) continue;
      if (src.toLowerCase() === en.toLowerCase()) continue;
      if (seedCachedTranslation(src, "en", en, sourceCulture)) seeded += 1;
    }
  }
  return seeded;
}

export function rememberRoute(options: {
  siteKey: string;
  localePath: string;
  englishPath: string;
  itemId: string;
  sourceCulture?: string | null;
  cultures?: string[] | null;
}): void {
  const doc = loadUrlRoutesCache();
  const bucket = siteBucket(doc, options.siteKey);
  const localeKey = normalizeLocalePath(options.localePath);
  const englishKey = normalizeEnglishPath(options.englishPath);
  const itemId = String(options.itemId || "").trim();
  if (!englishKey || !itemId) return;

  const updatedAt = new Date().toISOString();
  bucket.byLocalePath[localeKey] = {
    englishPath: englishKey,
    itemId,
    sourceCulture: options.sourceCulture || undefined,
    updatedAt,
  };

  const en = bucket.byEnglishPath[englishKey] || {
    itemId,
    localePaths: [],
  };
  en.itemId = itemId;
  const locales = new Set(en.localePaths.map((p) => normalizeLocalePath(p)));
  locales.add(localeKey);
  en.localePaths = [...locales].sort();
  bucket.byEnglishPath[englishKey] = en;

  saveUrlRoutesCache(doc);

  seedSegmentTranslationsFromRoute({
    localePath: localeKey,
    englishPath: englishKey,
    sourceCulture: options.sourceCulture,
    cultures: options.cultures,
  });
}
