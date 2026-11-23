/**
 * Ensure English pages under site Home (via Authoring/CM) for same-site General Link
 * URLs, then encode links as linktype=internal with item id.
 * Identity comes from Sitecore paths (resolveItemIdByPath), never from SCS YAML on disk.
 */
import fs from "node:fs";
import path from "node:path";
import { applyAuthoringItem } from "./authoring-apply-bridge";
import { braceGuid } from "./ids";
import {
  resolveItemIdByPath,
  type ResolveItemIdByPathOptions,
} from "./resolve-item-id-by-path";
import {
  encodeGeneralLink,
  normalizeAnchorValue,
  splitUrlHash,
  type GeneralLinkInput,
  toSystemName,
  unwrapStringValue,
} from "./naming";
import { BQ_CAPTURES_DIR } from "./paths";
import {
  emptyWriteStats,
  mergeWriteStats,
  recordWrite,
  type ScsField,
  type ScsLanguageBlock,
  type ScsWriteStats
} from "./authoring-item-model";
import { translateText } from "./translate";
import {
  normalizeCultureKey,
  resolveContentLanguages,
} from "./resolve-content-languages";
import {
  lookupByEnglishPath,
  lookupByLocalePath,
  makeSiteKey,
  normalizeLocalePath,
  rememberRoute,
  resolveCanonicalEnglishPath,
  stripCulturePrefixes,
  toEnglishPathSegment,
} from "./url-route-cache";

/** Fallback Page template (axa Project/Page) when Home.yml template cannot be read. */
export const DEFAULT_HOME_PAGE_TEMPLATE =
  "16fe29a1-9efb-4cfa-91bc-a016b7876d85";

/** NavigationTitle (shared foundation field; matches Home.yml across collections). */
const NAV_TITLE_FIELD_ID = "4e0720e9-9d50-4ddc-87cf-ecd65e8e94c8";

export type LinkHomeContext = {
  collectionSystem: string;
  siteSystem: string;
  /** Capture / site origin e.g. https://www.axa.be — optional. */
  siteOrigin?: string | null;
  /** Source culture for path/page translation into en. */
  sourceLanguage?: string | null;
  /** Extra Sitecore cultures to emit on the same page YAML (e.g. nl-BE, fr-BE). */
  cultures?: string[] | null;
};

export type EnsureHomePageResult = {
  itemId: string;
  sitecorePath: string;
  itemUrlPath: string;
  created: boolean;
  stats: ScsWriteStats;
};

export type ClassifyLinkKind = "special" | "external" | "internal-home";

export function titleCaseSegment(seg: string): string {
  return String(seg || "")
    .split(/[-_]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

export type ResolveSiteOriginOptions = {
  /** Prefer captures for this site (e.g. axa-be → www-axa-be), never another host. */
  siteSystem?: string | null;
};

/**
 * Capture host folder slug → site system folder (www-axa-be → axa-be).
 * Mirrors create-section-components `hostToHostSlugFolder`.
 */
function captureHostFolderToSiteSystem(hostFolder: string): string {
  return String(hostFolder || "")
    .toLowerCase()
    .replace(/^www-/, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Collapse separators so `domsecurity-com` matches capture `www-dom-security-com`. */
function normalizeSiteSystemKey(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/^www[.-]/, "")
    .replace(/[^a-z0-9]/g, "");
}

function listCaptureHostRoots(siteSystem?: string | null): string[] {
  if (!fs.existsSync(BQ_CAPTURES_DIR)) return [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(BQ_CAPTURES_DIR, { withFileTypes: true });
  } catch {
    return [];
  }
  const site = String(siteSystem || "")
    .trim()
    .toLowerCase();
  const siteKey = normalizeSiteSystemKey(site);
  const roots: string[] = [];
  for (const ent of entries) {
    if (!ent.isDirectory() || ent.name.startsWith(".") || ent.name.startsWith("_")) {
      continue;
    }
    const full = path.join(BQ_CAPTURES_DIR, ent.name);
    if (!site) {
      roots.push(full);
      continue;
    }
    const folder = ent.name.toLowerCase();
    const asSite = captureHostFolderToSiteSystem(ent.name);
    if (
      folder === site ||
      asSite === site ||
      folder === `www-${site}` ||
      folder.endsWith(`-${site}`) ||
      (siteKey.length > 0 &&
        (normalizeSiteSystemKey(folder) === siteKey ||
          normalizeSiteSystemKey(asSite) === siteKey))
    ) {
      roots.push(full);
    }
  }
  return roots;
}

function walkCaptureFile(
  roots: string[],
  fileName: string,
  read: (fullPath: string) => string | undefined,
): string | undefined {
  const stack = [...roots].reverse();
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isFile() && ent.name === fileName) {
        const value = read(full);
        if (value) return value;
      } else if (ent.isDirectory() && !ent.name.startsWith(".")) {
        stack.push(full);
      }
    }
  }
  return undefined;
}

function findCaptureSourceUrl(siteSystem?: string | null): string | undefined {
  const site = String(siteSystem || "").trim();
  const roots = listCaptureHostRoots(site || undefined);
  // With a site hint, never fall back to another host's capture (that made
  // https://www.axa.be/... look external when voetbalvlaanderen was first).
  if (site && !roots.length) return undefined;
  if (!site && roots.length !== 1) {
    // Ambiguous multi-host captures — require BQ_SITE_ORIGIN or explicit origin.
    return undefined;
  }
  return walkCaptureFile(roots.length ? roots : [BQ_CAPTURES_DIR], "source-url.txt", (full) => {
    try {
      const raw = fs.readFileSync(full, "utf8").trim();
      return raw || undefined;
    } catch {
      return undefined;
    }
  });
}

function findCapturePageLanguage(siteSystem?: string | null): string | undefined {
  const site = String(siteSystem || "").trim();
  const roots = listCaptureHostRoots(site || undefined);
  if (site && !roots.length) return undefined;
  if (!site && roots.length !== 1) return undefined;
  return walkCaptureFile(roots.length ? roots : [BQ_CAPTURES_DIR], "page-meta.json", (full) => {
    try {
      const meta = JSON.parse(fs.readFileSync(full, "utf8")) as {
        pageLanguage?: string;
      };
      const lang = String(meta.pageLanguage || "").trim();
      return lang || undefined;
    } catch {
      return undefined;
    }
  });
}

/** Resolve capture / site language for →en path and page-name translation. */
export function resolveSourceLanguage(
  explicit?: string | null,
  options?: ResolveSiteOriginOptions,
): string {
  const fromCtx = String(explicit || "").trim();
  if (fromCtx) return fromCtx;
  const fromEnv = String(
    process.env.BQ_PAGE_LANGUAGE || process.env.BQ_SOURCE_LANGUAGE || "",
  ).trim();
  if (fromEnv) return fromEnv;
  return findCapturePageLanguage(options?.siteSystem) || "en";
}

export function resolveSiteOrigin(
  explicit?: string | null,
  options?: ResolveSiteOriginOptions,
): string | undefined {
  const fromCtx = String(explicit || "").trim();
  if (fromCtx) {
    try {
      return new URL(fromCtx).origin;
    } catch {
      /* fall through */
    }
  }
  const fromEnv = String(process.env.BQ_SITE_ORIGIN || "").trim();
  if (fromEnv) {
    try {
      return new URL(fromEnv).origin;
    } catch {
      /* fall through */
    }
  }
  const fromCapture = findCaptureSourceUrl(options?.siteSystem);
  if (fromCapture) {
    try {
      return new URL(fromCapture).origin;
    } catch {
      /* fall through */
    }
  }
  return undefined;
}

/** True for tel:/callto:/sms: and bare phone-number hrefs. */
export function isPhoneLinkUrl(rawUrl: string): boolean {
  const u = String(rawUrl || "").trim();
  if (!u) return false;
  if (/^(tel|callto|sms|fax):/i.test(u)) return true;
  // Bare phone-looking values (no scheme / path), e.g. "+32 2 123 45 67"
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return false;
  if (u.startsWith("/") || u.startsWith("#") || u.includes("://")) return false;
  const compact = u.replace(/[\s().\-/]/g, "");
  return /^\+?\d{6,15}$/.test(compact);
}

export function classifyLinkUrl(
  rawUrl: string,
  siteOrigin?: string | null,
  options?: ResolveSiteOriginOptions,
): ClassifyLinkKind {
  const u = String(rawUrl || "").trim();
  if (!u) return "internal-home";
  if (/^mailto:/i.test(u)) return "special";
  if (/^javascript:/i.test(u)) return "special";
  if (u.startsWith("#")) return "special";
  // Phone numbers are external links (not Home items / not "special" mailto-style).
  if (isPhoneLinkUrl(u)) return "external";
  if (
    /^\{?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}?$/i.test(
      u,
    )
  ) {
    return "special";
  }

  if (/^https?:\/\//i.test(u)) {
    const origin = resolveSiteOrigin(siteOrigin, options);
    if (!origin) return "external";
    try {
      return new URL(u).origin === origin ? "internal-home" : "external";
    } catch {
      return "external";
    }
  }

  // Site-relative path (incl. "/").
  return "internal-home";
}

function pathnameFromUrl(
  rawUrl: string,
  siteOrigin?: string | null,
  options?: ResolveSiteOriginOptions,
): string {
  const u = String(rawUrl || "").trim() || "/";
  if (/^https?:\/\//i.test(u)) {
    try {
      return new URL(u).pathname || "/";
    } catch {
      return "/";
    }
  }
  if (u.startsWith("/")) {
    const q = u.indexOf("?");
    const h = u.indexOf("#");
    let end = u.length;
    if (q >= 0) end = Math.min(end, q);
    if (h >= 0) end = Math.min(end, h);
    return u.slice(0, end) || "/";
  }
  // Bare path without leading slash
  try {
    const origin =
      resolveSiteOrigin(siteOrigin, options) || "https://example.com";
    return new URL(u, origin).pathname || "/";
  } catch {
    return `/${u.replace(/^\//, "")}`;
  }
}

/**
 * Home / App Route pages: CM + SCS pull keep **NavigationTitle only**.
 * Emitting `__Display name` or Page `Title` causes emit↔pull churn (NavigationTitle
 * is the stable author-facing label for App Route / Home link pages).
 */
function pageVersionFields(display: string): ScsField[] {
  return [
    {
      id: NAV_TITLE_FIELD_ID,
      hint: "NavigationTitle",
      value: display,
    },
  ];
}

/**
 * Build language blocks for a Home page: item name is always English;
 * NavigationTitle is English on `en` and translated per culture.
 */
async function buildHomePageLanguageBlocks(options: {
  /** English display string (for language `en`). */
  englishDisplay: string;
  /** Display string in source culture (seed / capture). */
  sourceDisplay: string;
  sourceCulture: string;
  cultures: string[];
}): Promise<ScsLanguageBlock[]> {
  const { sourceCulture: src, emitCultures } = resolveContentLanguages({
    culture: options.sourceCulture,
    cultures: options.cultures,
  });
  const srcKey = normalizeCultureKey(src).toLowerCase();
  const blocks: ScsLanguageBlock[] = [];

  for (const lang of emitCultures) {
    const key = normalizeCultureKey(lang).toLowerCase();
    let display: string;
    if (key === "en") {
      display = options.englishDisplay;
    } else if (key === srcKey) {
      display = options.sourceDisplay;
    } else {
      display = await translateText(options.sourceDisplay, lang, "en", {
        purpose: "link-page-display",
      });
    }
    const label = display || options.englishDisplay;
    blocks.push({
      language: lang,
      versions: [
        {
          version: 1,
          versionFields: pageVersionFields(label),
        },
      ],
    });
  }
  return blocks;
}

/** CM lookup knobs (tests / offline) forwarded to {@link resolveItemIdByPath}. */
export type HomePageCmLookupOptions = Pick<
  ResolveItemIdByPathOptions,
  "endpointName" | "lookupPath" | "skipCm"
>;

/**
 * Create-if-missing English-named page items under Home for a route pathname.
 * Created pages get `en` + source + cultures[] language blocks (translated display fields).
 *
 * Identity is Sitecore-path based: Home and each segment are resolved via
 * {@link resolveItemIdByPath}; missing pages are created through Authoring and the
 * returned live id is used as the next parent. No SCS YAML is read or written.
 *
 * Uses `.bq/definitions/cache/url-routes.json` so NL/FR locale URLs that map to the
 * same English path always reuse one Home item id.
 */
export async function ensureHomePageFromRoute(
  options: {
    collectionSystem: string;
    siteSystem: string;
    pathname: string;
    /** Preferred display name for the leaf in source culture (link text). */
    leafDisplayName?: string | null;
    sourceLanguage?: string | null;
    cultures?: string[];
    /** Retained for call-site compat (ids are no longer minted from a handle). */
    handleKey?: string;
    /**
     * Template id for the leaf page only (e.g. News Article).
     * Intermediate path segments keep the Home / default page template.
     */
    leafTemplateId?: string | null;
  } & HomePageCmLookupOptions,
): Promise<EnsureHomePageResult | null> {
  const collectionSystem = toSystemName(options.collectionSystem);
  const siteSystem = toSystemName(options.siteSystem);
  const cmLookup: HomePageCmLookupOptions = {
    endpointName: options.endpointName,
    lookupPath: options.lookupPath,
    skipCm: options.skipCm,
  };
  const logPrefix = "[bq:apply:link-page]";

  const homeSitecorePath = `/sitecore/content/${collectionSystem}/${siteSystem}/Home`;
  const home = await resolveItemIdByPath({
    sitecorePath: homeSitecorePath,
    ...cmLookup,
    logPrefix,
  });
  if (!home.found) {
    console.warn(
      `${logPrefix} Home missing in CM at ${homeSitecorePath} (run site generate first)`,
    );
    return null;
  }
  const homeId = home.id;
  const leafTemplateId = options.leafTemplateId?.replace(/[{}]/g, "").trim().toLowerCase();

  const sourceLanguage = resolveSourceLanguage(options.sourceLanguage);
  const cultures = options.cultures ?? [];
  const siteKey = makeSiteKey(collectionSystem, siteSystem);
  const localePath = normalizeLocalePath(options.pathname);

  const rawSegments = options.pathname
    .replace(/^\//, "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
  const localeSegments = stripCulturePrefixes(rawSegments, cultures);

  if (!localeSegments.length) {
    return {
      itemId: homeId,
      sitecorePath: homeSitecorePath,
      itemUrlPath: "/",
      created: false,
      stats: emptyWriteStats(),
    };
  }

  const cachedLocale = lookupByLocalePath(siteKey, localePath);
  let englishPath =
    cachedLocale?.englishPath ||
    (await resolveCanonicalEnglishPath({
      pathname: options.pathname,
      sourceCulture: sourceLanguage,
      cultures,
    }));
  englishPath = normalizeLocalePath(englishPath);

  const enNameSegments = englishPath
    .replace(/^\//, "")
    .split("/")
    .filter(Boolean);
  if (!enNameSegments.length) {
    return {
      itemId: homeId,
      sitecorePath: homeSitecorePath,
      itemUrlPath: "/",
      created: false,
      stats: emptyWriteStats(),
    };
  }

  let stats = emptyWriteStats();
  let parentId = homeId;
  let sitecorePath = homeSitecorePath;
  let createdAny = false;
  // Resolved lazily — only needed when a page actually has to be created.
  let pageTemplate: string | undefined;
  const resolvePageTemplate = async (): Promise<string> => {
    if (pageTemplate) return pageTemplate;
    const projectPage = await resolveItemIdByPath({
      sitecorePath: `/sitecore/templates/Project/${collectionSystem}/Page`,
      ...cmLookup,
      logPrefix,
    });
    pageTemplate = projectPage.found
      ? projectPage.id
      : DEFAULT_HOME_PAGE_TEMPLATE;
    return pageTemplate;
  };

  for (let i = 0; i < enNameSegments.length; i++) {
    const itemName = enNameSegments[i]!;
    const isLeaf = i === enNameSegments.length - 1;
    const localeSeg = localeSegments[Math.min(i, localeSegments.length - 1)]!;
    const sourceSegDisplay = titleCaseSegment(
      decodeURIComponent(localeSeg.replace(/\+/g, " ")).replace(/[-_]+/g, " "),
    );
    // Prefer glossary/translate display from the locale segment; item name stays cached English.
    const englishTitle =
      (await toEnglishPathSegment(localeSeg, sourceLanguage, "link-page-path")) ||
      titleCaseSegment(itemName.replace(/-/g, " "));

    let englishDisplay = englishTitle;
    let sourceDisplay = sourceSegDisplay;
    if (isLeaf && options.leafDisplayName?.trim()) {
      sourceDisplay = options.leafDisplayName.trim();
      const srcLang = (sourceLanguage || "en").toLowerCase().split("-")[0];
      if (srcLang === "en") {
        englishDisplay = sourceDisplay;
      } else {
        const leafEn = await translateText(sourceDisplay, "en", sourceLanguage, {
          purpose: "link-page-name",
        });
        const leafTitle = titleCaseSegment(leafEn.replace(/\s+/g, "-")) || leafEn;
        if (leafTitle.trim()) englishDisplay = leafTitle.trim();
      }
    } else {
      englishDisplay = titleCaseSegment(itemName.replace(/-/g, " ")) || englishTitle;
    }

    sitecorePath = `${sitecorePath}/${itemName}`;

    // Existing pages (any depth) keep their CM NavigationTitle / languages — child
    // stubs derive segment labels from the URL ("company"), which would fight the
    // leaf stub's navigationTitle ("About Us") if rewritten on every apply.
    const existing = await resolveItemIdByPath({
      sitecorePath,
      ...cmLookup,
      logPrefix,
    });
    if (existing.found) {
      recordWrite(stats, "unchanged");
      parentId = existing.id;
      continue;
    }

    const languages = await buildHomePageLanguageBlocks({
      englishDisplay: itemName === "*" ? (options.leafDisplayName?.trim() || "Wildcard") : englishDisplay,
      sourceDisplay: itemName === "*" ? (options.leafDisplayName?.trim() || "Wildcard") : sourceDisplay,
      sourceCulture: sourceLanguage,
      cultures,
    });

    const written = await applyAuthoringItem(
      `link-page:${sitecorePath}`,
      {
        parent: parentId,
        template:
          isLeaf && leafTemplateId ? leafTemplateId : await resolvePageTemplate(),
        path: sitecorePath,
        sharedFields: [],
        languages,
      },
      { endpointName: options.endpointName },
    );
    recordWrite(stats, written);
    if (written.created) createdAny = true;
    parentId = written.itemId;
  }

  const itemUrlPath = `/${enNameSegments.join("/")}`;
  rememberRoute({
    siteKey,
    localePath,
    englishPath: itemUrlPath,
    itemId: braceGuid(parentId),
    sourceCulture: sourceLanguage,
    cultures,
  });

  return {
    itemId: parentId,
    sitecorePath,
    itemUrlPath,
    created: createdAny,
    stats,
  };
}

function normalizeLinkInput(
  raw: string | GeneralLinkInput,
): GeneralLinkInput | null {
  if (typeof raw === "string") {
    const trimmed = unwrapStringValue(raw.trim());
    if (!trimmed) return null;
    if (trimmed.startsWith("<link")) return null;
    const { url, fragment } = splitUrlHash(trimmed);
    return {
      text: trimmed,
      url,
      ...(fragment ? { anchor: normalizeAnchorValue(fragment) } : {}),
    };
  }
  if (!raw || typeof raw !== "object") return null;
  const rawUrl = unwrapStringValue(String(raw.url ?? "").trim());
  const rawText =
    typeof raw.text === "string" ? unwrapStringValue(raw.text) : raw.text;
  if (!rawUrl && !rawText) return null;
  const { url, fragment } = splitUrlHash(rawUrl || "/");
  const explicitAnchor = normalizeAnchorValue(raw.anchor);
  const anchor = explicitAnchor || normalizeAnchorValue(fragment);
  return {
    ...raw,
    text: rawText,
    title:
      typeof raw.title === "string"
        ? unwrapStringValue(raw.title)
        : raw.title,
    url: rawUrl.startsWith("#") ? rawUrl : url || "/",
    ...(anchor ? { anchor } : { anchor: raw.anchor }),
  };
}

/**
 * True when an ancestor folder already has a Sitecore wildcard page (`*`)
 * that should handle this deeper route — do not materialize a concrete leaf page.
 *
 * Example: Home/products/categories/* covers /products/categories/digital-cylinders.
 * Resolved by Sitecore path (CM / in-run cache), not by scanning SCS YAML on disk.
 */
export async function isRouteCoveredByHomeWildcard(
  collectionSystem: string,
  siteSystem: string,
  pathname: string,
  cmLookup: HomePageCmLookupOptions = {},
): Promise<boolean> {
  const collection = toSystemName(collectionSystem);
  const site = toSystemName(siteSystem);
  const segments = pathname
    .replace(/^\//, "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length < 2) return false;

  const homePath = `/sitecore/content/${collection}/${site}/Home`;
  // A wildcard at Home/a/b/* covers Home/a/b/c (and deeper).
  for (let depth = 1; depth < segments.length; depth++) {
    const wildcardPath = `${homePath}/${segments.slice(0, depth).join("/")}/*`;
    const hit = await resolveItemIdByPath({
      sitecorePath: wildcardPath,
      ...cmLookup,
      logPrefix: "[bq:apply:link-page]",
    });
    if (hit.found) return true;
  }
  return false;
}

/**
 * Materialize same-site Home pages and return General Link XML
 * (internal with id, or external/special unchanged encoding).
 */
export async function materializeGeneralLinkXml(
  raw: string | GeneralLinkInput,
  ctx: LinkHomeContext | null | undefined,
): Promise<{ value: string; stats: ScsWriteStats }> {
  const empty = emptyWriteStats();
  if (typeof raw === "string" && raw.trim().startsWith("<link")) {
    return { value: raw.trim(), stats: empty };
  }

  const input = normalizeLinkInput(raw);
  if (!input) return { value: "", stats: empty };

  if (!ctx?.collectionSystem || !ctx?.siteSystem) {
    return { value: encodeGeneralLink(input), stats: empty };
  }

  const originOpts: ResolveSiteOriginOptions = { siteSystem: ctx.siteSystem };
  // Prefer capture origin for this siteSystem over a pre-resolved siteOrigin
  // (callers used to resolve the first capture globally — wrong host).
  const siteOrigin =
    resolveSiteOrigin(undefined, originOpts) ||
    resolveSiteOrigin(ctx.siteOrigin, originOpts);
  const kind = classifyLinkUrl(input.url, siteOrigin, originOpts);
  if (kind === "special" || kind === "external") {
    return { value: encodeGeneralLink(input), stats: empty };
  }

  const pathname = pathnameFromUrl(input.url, siteOrigin, originOpts);
  // Wildcard pages (e.g. /products/categories/*) already serve these routes.
  // Creating empty concrete pages steals the URL and breaks presentation.
  if (
    await isRouteCoveredByHomeWildcard(
      ctx.collectionSystem,
      ctx.siteSystem,
      pathname,
    )
  ) {
    return { value: encodeGeneralLink(input), stats: empty };
  }

  const ensured = await ensureHomePageFromRoute({
    collectionSystem: ctx.collectionSystem,
    siteSystem: ctx.siteSystem,
    pathname,
    leafDisplayName: input.text,
    sourceLanguage: resolveSourceLanguage(ctx.sourceLanguage, originOpts),
    cultures: ctx.cultures ?? undefined,
  });

  if (!ensured) {
    return { value: encodeGeneralLink(input), stats: empty };
  }

  const { fragment } = splitUrlHash(String(input.url ?? ""));
  const anchor =
    normalizeAnchorValue(input.anchor) || normalizeAnchorValue(fragment);
  const internal: GeneralLinkInput = {
    text: input.text || ensured.itemUrlPath,
    url: ensured.itemUrlPath,
    target: input.target,
    anchor: anchor || undefined,
    title: input.title,
    class: input.class,
    querystring: input.querystring,
    linktype: "internal",
    id: braceGuid(ensured.itemId),
  };

  return {
    value: encodeGeneralLink(internal),
    stats: ensured.stats,
  };
}

export function mergeLinkStats(
  base: ScsWriteStats,
  extra: ScsWriteStats,
): ScsWriteStats {
  return mergeWriteStats(base, extra);
}
