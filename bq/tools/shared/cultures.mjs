/**
 * Resolve Sitecore cultures for definition content seeds.
 * CLI `--cultures` wins; otherwise `BQ_CULTURES` from env / .env.local.
 *
 * Capture source culture (decide at capture, create only stamps):
 * - Path language folder (`/nl/…`) wins when present.
 * - Else `<html lang>` / design-AI `contentLanguage` × host ccTLD region.
 * - Else monolingual ccTLD default (`.nl` → `nl-NL`); ambiguous TLDs (`.be`) stay `en`.
 * - Optional market/language pattern `/be/en/…` → language from 2nd segment; region from 1st or TLD.
 */

/** ISO 639-1 content languages commonly used as first URL folders (not country codes like `be`). */
export const CONTENT_LANGUAGE_CODES = new Set([
  'en',
  'nl',
  'fr',
  'de',
  'es',
  'it',
  'pt',
  'pl',
  'sv',
  'da',
  'fi',
  'no',
  'nb',
  'nn',
  'cs',
  'sk',
  'hu',
  'ro',
  'bg',
  'el',
  'tr',
  'ru',
  'uk',
  'ja',
  'zh',
  'ko',
  'ar',
  'he',
  'hi',
  'th',
  'vi',
  'id',
  'ms',
  'lt',
  'lv',
  'et',
  'sl',
  'hr',
  'sr',
  'bs',
  'mt',
  'ga',
  'cy',
  'is',
  'lb',
  'ca',
  'eu',
  'gl',
]);

/** ccTLD / market folder → ISO 3166-1 alpha-2 region for Sitecore cultures. */
export const TLD_TO_REGION = {
  be: 'BE',
  fr: 'FR',
  de: 'DE',
  nl: 'NL',
  uk: 'GB',
  gb: 'GB',
  ie: 'IE',
  es: 'ES',
  it: 'IT',
  pt: 'PT',
  ch: 'CH',
  at: 'AT',
  lu: 'LU',
  us: 'US',
  ca: 'CA',
  au: 'AU',
  nz: 'NZ',
  jp: 'JP',
  cn: 'CN',
  in: 'IN',
  br: 'BR',
  mx: 'MX',
  pl: 'PL',
  se: 'SE',
  no: 'NO',
  dk: 'DK',
  fi: 'FI',
};

/** Fallback when language is known but no TLD/region is available. */
const SHORT_LANGUAGE_DEFAULT_CULTURE = {
  nl: 'nl-BE',
  fr: 'fr-BE',
  de: 'de-DE',
  es: 'es-ES',
  it: 'it-IT',
  pt: 'pt-PT',
  pl: 'pl-PL',
};

/**
 * Primary content language for monolingual ccTLDs when the URL has no language folder.
 * Ambiguous markets (be, ch, ca, lu, …) are omitted → stay `en` without html/AI lang.
 */
export const DEFAULT_LANGUAGE_BY_TLD = {
  nl: 'nl',
  de: 'de',
  fr: 'fr',
  at: 'de',
  it: 'it',
  es: 'es',
  pt: 'pt',
  pl: 'pl',
  se: 'sv',
  no: 'nb',
  dk: 'da',
  fi: 'fi',
  jp: 'ja',
  br: 'pt',
  mx: 'es',
  ie: 'en',
  uk: 'en',
  gb: 'en',
  us: 'en',
  au: 'en',
  nz: 'en',
};

const NON_COUNTRY_TLDS = new Set([
  'com',
  'net',
  'org',
  'io',
  'co',
  'app',
  'dev',
  'ai',
  'cloud',
  'info',
  'biz',
  'edu',
  'gov',
  'mil',
  'int',
  'eu',
  'museum',
  'name',
  'pro',
  'xyz',
  'online',
  'site',
  'shop',
  'store',
]);

/**
 * @param {string | null | undefined} raw
 * @returns {string[]}
 */
export function parseCulturesList(raw) {
  if (!raw || typeof raw !== 'string') return [];
  return [
    ...new Set(
      raw
        .split(/[,;\s]+/)
        .map((c) => c.trim())
        .filter(Boolean),
    ),
  ];
}

/**
 * @param {string[]} argv
 * @returns {string | null} raw cultures string from --cultures / --cultures=
 */
export function culturesArgFromArgv(argv = process.argv.slice(2)) {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--cultures') return argv[i + 1] ?? null;
    if (a.startsWith('--cultures=')) return a.slice('--cultures='.length);
  }
  return null;
}

/**
 * True when BQ_CULTURES is present on env (including empty string).
 * Empty `BQ_CULTURES=` means "no extra cultures" and must win over page-meta.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function isBqCulturesEnvSet(env = process.env) {
  return Object.prototype.hasOwnProperty.call(env, 'BQ_CULTURES');
}

/**
 * @param {{ argv?: string[], env?: NodeJS.ProcessEnv }} [options]
 * @returns {string[]}
 */
export function resolveCultures(options = {}) {
  const argv = options.argv ?? process.argv.slice(2);
  const env = options.env ?? process.env;
  const fromArg = culturesArgFromArgv(argv);
  if (fromArg != null && String(fromArg).trim()) {
    return parseCulturesList(fromArg);
  }
  // Explicit empty CLI `--cultures=` → no extras
  if (fromArg != null) return [];
  return parseCulturesList(env.BQ_CULTURES);
}

/**
 * Extra Sitecore cultures for create:sectioncomponents (translation targets).
 * Priority: CLI `--cultures` → `BQ_CULTURES` (incl. empty).
 * Not stored on page-meta — a captured page has one source `culture` only.
 * @param {{
 *   cliCultures?: string | null,
 *   env?: NodeJS.ProcessEnv,
 * }} [options]
 * @returns {string[]}
 */
export function resolveCreateSectionCultures(options = {}) {
  const env = options.env ?? process.env;
  const cli = options.cliCultures;
  if (cli != null && String(cli).trim()) {
    return parseCulturesList(String(cli));
  }
  if (cli != null && String(cli).trim() === '') {
    return [];
  }
  if (isBqCulturesEnvSet(env)) {
    return parseCulturesList(env.BQ_CULTURES);
  }
  return [];
}

/**
 * @param {string | null | undefined} segment
 * @returns {boolean}
 */
export function isContentLanguageSegment(segment) {
  const raw = String(segment || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
  if (!raw) return false;
  if (CONTENT_LANGUAGE_CODES.has(raw)) return true;
  const m = raw.match(/^([a-z]{2})-([a-z]{2})$/);
  if (!m) return false;
  return CONTENT_LANGUAGE_CODES.has(m[1]);
}

/**
 * @param {string | null | undefined} segment
 * @returns {boolean}
 */
export function isMarketOrCountrySegment(segment) {
  const raw = String(segment || '')
    .trim()
    .toLowerCase();
  if (!raw || raw.length !== 2) return false;
  if (CONTENT_LANGUAGE_CODES.has(raw) && !TLD_TO_REGION[raw]) return false;
  return Boolean(TLD_TO_REGION[raw]);
}

/**
 * @param {string | null | undefined} hostOrUrl
 * @returns {string} lowercase ccTLD / last label, or ''
 */
export function tldFromHostOrUrl(hostOrUrl) {
  const raw = String(hostOrUrl || '').trim();
  if (!raw) return '';
  let hostname = raw;
  try {
    hostname = new URL(raw.includes('://') ? raw : `https://${raw}`).hostname;
  } catch {
    hostname = raw.replace(/^https?:\/\//i, '').split('/')[0] || '';
  }
  hostname = hostname.replace(/^www\./i, '').toLowerCase();
  const labels = hostname.split('.').filter(Boolean);
  if (labels.length < 2) return '';
  const tld = labels[labels.length - 1] || '';
  if (NON_COUNTRY_TLDS.has(tld)) return '';
  return tld;
}

/**
 * @param {string} language short code e.g. nl
 * @param {string | null | undefined} regionOrTld BE / be / fr
 * @returns {string} Sitecore culture e.g. nl-BE
 */
export function cultureFromLanguageAndRegion(language, regionOrTld) {
  const lang = String(language || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
  if (!lang || lang === 'en' || lang.startsWith('en-')) return 'en';

  const regional = lang.match(/^([a-z]{2})-([a-z]{2})$/);
  if (regional) {
    return `${regional[1]}-${regional[2].toUpperCase()}`;
  }

  const regionRaw = String(regionOrTld || '')
    .trim()
    .toLowerCase();
  const region =
    TLD_TO_REGION[regionRaw] ||
    (regionRaw.length === 2 && /^[a-z]{2}$/.test(regionRaw)
      ? regionRaw.toUpperCase()
      : '');
  if (region) return `${lang}-${region}`;
  return SHORT_LANGUAGE_DEFAULT_CULTURE[lang] || lang;
}

/**
 * Parse language (+ optional market) from a pathname.
 * - `/nl/…` → language nl
 * - `/fr-be/…` → language fr, region BE
 * - `/be/en/…` → language en, region BE (market then language)
 * - `/products` → language en (no prefix)
 *
 * @param {string | null | undefined} pathname
 * @returns {{ language: string, region: string | null, stripCount: number }}
 */
export function parseLocaleFromPathname(pathname) {
  const segs = String(pathname || '')
    .replace(/\\/g, '/')
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!segs.length) {
    return { language: 'en', region: null, stripCount: 0 };
  }

  const first = segs[0].toLowerCase().replace(/_/g, '-');
  const second = segs[1] ? segs[1].toLowerCase().replace(/_/g, '-') : '';

  // Explicit regional locale folder: /nl-be/… or /fr-FR/…
  const regional = first.match(/^([a-z]{2})-([a-z]{2})$/);
  if (regional && CONTENT_LANGUAGE_CODES.has(regional[1])) {
    return {
      language: regional[1],
      region: regional[2].toUpperCase(),
      stripCount: 1,
    };
  }

  // Language-first: /nl/… /fr/… /en/…
  if (CONTENT_LANGUAGE_CODES.has(first)) {
    return { language: first, region: null, stripCount: 1 };
  }

  // Market then language: /be/en/… /be/nl/… (DOM Security style)
  if (
    segs.length >= 2 &&
    isMarketOrCountrySegment(first) &&
    CONTENT_LANGUAGE_CODES.has(second.split('-')[0])
  ) {
    const langPart = second.match(/^([a-z]{2})(?:-([a-z]{2}))?$/);
    if (langPart) {
      return {
        language: langPart[1],
        region: langPart[2]
          ? langPart[2].toUpperCase()
          : TLD_TO_REGION[first] || first.toUpperCase(),
        stripCount: 2,
      };
    }
  }

  return { language: 'en', region: null, stripCount: 0 };
}

/**
 * Strip leading locale / market-language folders from path segments.
 * Sitecore stores one item tree; cultures are language versions, not folders.
 *
 * @param {string[]} segments
 * @param {string[]} [cultures]
 * @returns {string[]}
 */
export function stripLocalePathSegments(segments, cultures = []) {
  const cultureSet = new Set(
    (cultures || [])
      .map((c) => String(c || '').trim().toLowerCase().replace(/_/g, '-'))
      .filter(Boolean)
      .concat(['en', 'en-us', 'en-gb', 'en-ca']),
  );
  const out = [...segments];
  while (out.length) {
    const head = String(out[0] || '')
      .trim()
      .toLowerCase()
      .replace(/_/g, '-');
    if (cultureSet.has(head) || isContentLanguageSegment(head)) {
      out.shift();
      continue;
    }
    const next = out[1]
      ? String(out[1]).trim().toLowerCase().replace(/_/g, '-')
      : '';
    if (
      out.length >= 2 &&
      isMarketOrCountrySegment(head) &&
      isContentLanguageSegment(next)
    ) {
      out.shift();
      out.shift();
      continue;
    }
    break;
  }
  return out;
}

/**
 * @param {string | null | undefined} pathname
 * @param {string[]} [cultures]
 * @returns {string} pathname without locale folders (leading `/`, no trailing slash except `/`)
 */
export function stripLocalePrefixFromPathname(pathname, cultures = []) {
  const raw = String(pathname || '').trim() || '/';
  const segs = raw.replace(/^\//, '').split('/').filter(Boolean);
  const stripped = stripLocalePathSegments(segs, cultures);
  if (!stripped.length) return '/';
  return `/${stripped.join('/')}`.toLowerCase();
}

/**
 * @param {string | null | undefined} url
 * @returns {{ pathname: string, tld: string }}
 */
function parseUrlPathAndTld(url) {
  if (!url || typeof url !== 'string') return { pathname: '/', tld: '' };
  try {
    const parsed = new URL(
      url.includes('://')
        ? url
        : `https://placeholder.local${url.startsWith('/') ? url : `/${url}`}`,
    );
    return {
      pathname: parsed.pathname || '/',
      tld: tldFromHostOrUrl(parsed.hostname),
    };
  } catch {
    if (String(url).startsWith('/')) return { pathname: url, tld: '' };
    return { pathname: '/', tld: '' };
  }
}

/**
 * Normalize a language hint (`nl`, `nl-NL`, `nl_BE`, `nl-be`) to short language + optional region.
 * @param {string | null | undefined} raw
 * @returns {{ language: string, region: string | null } | null}
 */
export function normalizeLanguageHint(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
  if (!s) return null;
  const regional = s.match(/^([a-z]{2})-([a-z]{2})$/);
  if (regional && CONTENT_LANGUAGE_CODES.has(regional[1])) {
    return { language: regional[1], region: regional[2].toUpperCase() };
  }
  const short = s.match(/^([a-z]{2})$/);
  if (short && CONTENT_LANGUAGE_CODES.has(short[1])) {
    return { language: short[1], region: null };
  }
  return null;
}

/**
 * Read `lang` from an HTML document (`<html lang="…">`).
 * @param {string | null | undefined} html
 * @returns {string | null}
 */
export function parseHtmlLangAttribute(html) {
  const text = String(html || '');
  if (!text) return null;
  const m =
    text.match(/<html\b[^>]*\blang\s*=\s*["']\s*([^"']+)\s*["']/i) ||
    text.match(/<html\b[^>]*\blang\s*=\s*([^\s>]+)/i);
  if (!m) return null;
  const raw = String(m[1] || '')
    .trim()
    .replace(/^['"]|['"]$/g, '');
  return raw || null;
}

/**
 * Capture-time source culture: path language × html/AI language × monolingual TLD × region.
 *
 * @param {{
 *   url?: string | null,
 *   htmlLang?: string | null,
 *   aiLanguage?: string | null,
 *   cultures?: string[],
 * }} [options]
 * @returns {{ culture: string, pageLanguage: string }}
 */
export function resolveCaptureSourceCulture(options = {}) {
  const cultures = Array.isArray(options.cultures) ? options.cultures : [];
  const { pathname, tld } = parseUrlPathAndTld(options.url);
  const pathLocale = parseLocaleFromPathname(pathname);
  const pathHasLangFolder = pathLocale.stripCount > 0;

  /** @type {string | null} */
  let language = null;
  /** @type {string | null} */
  let region = pathLocale.region || (tld ? tld : null);

  if (pathHasLangFolder) {
    if (!pathLocale.language || pathLocale.language === 'en') {
      return { culture: 'en', pageLanguage: 'en' };
    }
    language = pathLocale.language;
    region = pathLocale.region || tld || null;
  } else {
    const fromHtml = normalizeLanguageHint(options.htmlLang);
    const fromAi = normalizeLanguageHint(options.aiLanguage);
    if (fromHtml?.language && fromHtml.language !== 'en') {
      language = fromHtml.language;
      region = fromHtml.region || tld || null;
    } else if (fromAi?.language && fromAi.language !== 'en') {
      language = fromAi.language;
      region = fromAi.region || tld || null;
    } else if (tld && DEFAULT_LANGUAGE_BY_TLD[tld]) {
      const tldLang = DEFAULT_LANGUAGE_BY_TLD[tld];
      if (!tldLang || tldLang === 'en') {
        return { culture: 'en', pageLanguage: 'en' };
      }
      language = tldLang;
      region = tld;
    } else {
      return { culture: 'en', pageLanguage: 'en' };
    }
  }

  const candidate = cultureFromLanguageAndRegion(language, region);
  const culture = toSitecoreCulture(candidate, cultures);
  const pageLanguage =
    culture === 'en' ? 'en' : String(culture).split('-')[0].toLowerCase() || language || 'en';
  return { culture, pageLanguage };
}

/**
 * Infer a short language code from a page URL.
 * Path language folder wins; else monolingual ccTLD default; else `en`.
 * @param {string | null | undefined} url
 * @returns {string}
 */
export function inferPageLanguageFromUrl(url) {
  return resolveCaptureSourceCulture({ url }).pageLanguage;
}

/**
 * Infer Sitecore culture from a full page URL (path + monolingual ccTLD fallback).
 * Prefer `resolveCaptureSourceCulture` at capture when html/AI language is available.
 *
 * @param {string | null | undefined} url
 * @param {string[]} [cultures] optional preferred cultures list
 * @returns {string}
 */
export function inferSitecoreCultureFromUrl(url, cultures = []) {
  return resolveCaptureSourceCulture({ url, cultures }).culture;
}

/**
 * Insert, replace, or strip `cultures: [...]` inside the `content: { ... }` block.
 * Empty `cultures` removes any AI-baked list so emit stays en + source only.
 * @param {string} source
 * @param {string[]} cultures
 * @returns {string}
 */
export function ensureDefinitionCultures(source, cultures) {
  const list = Array.isArray(cultures) ? cultures.filter(Boolean) : [];
  let text = String(source || '');

  if (!list.length) {
    // Strip cultures array so stale nl-BE/fr-BE from AI/prompts do not emit.
    if (/\bcontent\s*:\s*\{/.test(text) && /\bcultures\s*:/.test(text)) {
      text = text.replace(
        /(\bcontent\s*:\s*\{[\s\S]*?)\bcultures\s*:\s*\[[^\]]*\]\s*,?/,
        '$1',
      );
    }
    return text;
  }

  const culturesLiteral = `cultures: ${JSON.stringify(list)}`;

  // Replace existing cultures inside content block
  if (/\bcontent\s*:\s*\{/.test(text) && /\bcultures\s*:/.test(text)) {
    text = text.replace(
      /(\bcontent\s*:\s*\{[\s\S]*?)\bcultures\s*:\s*\[[^\]]*\]/,
      `$1${culturesLiteral}`,
    );
    return text;
  }

  // Insert after `content: {` (before location or items)
  if (/\bcontent\s*:\s*\{/.test(text)) {
    return text.replace(
      /(\bcontent\s*:\s*\{)\s*/,
      `$1\n    ${culturesLiteral},\n    `,
    );
  }

  return text;
}

/**
 * Insert or replace `culture: "…"` (source language) inside `content: { … }`.
 * @param {string} source
 * @param {string} culture Sitecore culture e.g. nl-BE
 * @returns {string}
 */
export function ensureDefinitionSourceCulture(source, culture) {
  const c = String(culture || '').trim();
  if (!c) return String(source || '');
  const cultureLiteral = `culture: ${JSON.stringify(c)}`;
  let text = String(source || '');

  if (/\bcontent\s*:\s*\{/.test(text) && /\bculture\s*:\s*["']/.test(text)) {
    text = text.replace(
      /(\bcontent\s*:\s*\{[\s\S]*?)\bculture\s*:\s*["'][^"']*["']/,
      `$1${cultureLiteral}`,
    );
    return text;
  }

  if (/\bcontent\s*:\s*\{/.test(text)) {
    return text.replace(
      /(\bcontent\s*:\s*\{)\s*/,
      `$1\n    ${cultureLiteral},\n    `,
    );
  }

  return text;
}

/**
 * Map capture pageLanguage (often short `nl`) to Sitecore culture.
 * @param {string | null | undefined} pageLanguage
 * @param {string[]} [cultures]
 * @returns {string}
 */
export function toSitecoreCulture(pageLanguage, cultures = []) {
  const raw = String(pageLanguage || '')
    .trim()
    .replace(/_/g, '-');
  if (!raw) return 'en';
  const lower = raw.toLowerCase();
  if (lower === 'en' || lower.startsWith('en-')) return 'en';

  const SHORT = { nl: 'nl-BE', fr: 'fr-BE', de: 'de-DE' };
  let candidate = SHORT[lower] || raw;
  const m = lower.match(/^([a-z]{2})-([a-z]{2})$/);
  if (m) candidate = `${m[1]}-${m[2].toUpperCase()}`;
  else if (SHORT[lower]) candidate = SHORT[lower];

  const list = (cultures || []).map((c) => String(c || '').trim()).filter(Boolean);
  const candLower = candidate.toLowerCase();
  const exact = list.find((c) => c.toLowerCase() === candLower);
  if (exact) return exact;
  const prefix = list.find((c) =>
    c.toLowerCase().startsWith(`${candLower.split('-')[0]}-`),
  );
  if (prefix) return prefix;
  return candidate;
}

/**
 * Read `contentLanguage` from DESIGN.md YAML front matter (design-AI piggyback).
 * @param {string | null | undefined} markdown
 * @returns {string | null}
 */
export function extractContentLanguageFromDesignMd(markdown) {
  const text = String(markdown || '').trim();
  if (!text.startsWith('---')) return null;
  const end = text.indexOf('\n---', 3);
  if (end < 0) return null;
  const fm = text.slice(3, end);
  const m = fm.match(/^\s*contentLanguage\s*:\s*["']?([A-Za-z]{2}(?:-[A-Za-z]{2})?)["']?\s*$/m);
  return m ? m[1] : null;
}

/**
 * Overwrite page-meta culture/pageLanguage and fill/overwrite section-information culture.
 * Used during capture when language is re-resolved after HTML / design AI.
 *
 * @param {string} pageDir
 * @param {{ culture: string, pageLanguage?: string, url?: string | null, overwriteSections?: boolean }} fields
 * @returns {Promise<{ culture: string, pageLanguage: string, sectionsUpdated: number, pageMetaUpdated: boolean }>}
 */
export async function writePageCaptureSourceCulture(pageDir, fields) {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');

  const culture = String(fields.culture || '').trim() || 'en';
  const pageLanguage =
    String(fields.pageLanguage || '').trim() ||
    (culture === 'en' ? 'en' : culture.split('-')[0].toLowerCase());
  const metaPath = path.join(pageDir, 'page-meta.json');
  let meta = {};
  try {
    meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
  } catch {
    meta = {};
  }

  const next = {
    ...(fields.url ? { url: fields.url } : meta.url ? { url: meta.url } : {}),
    pageLanguage,
    culture,
    capturedAt: meta.capturedAt || new Date().toISOString(),
  };
  // Drop legacy page-meta.cultures — extras live on CLI / BQ_CULTURES only.
  const pageMetaUpdated =
    meta.culture !== next.culture ||
    meta.pageLanguage !== next.pageLanguage ||
    !meta.culture ||
    Object.prototype.hasOwnProperty.call(meta, 'cultures');
  await fs.mkdir(path.dirname(metaPath), { recursive: true });
  await fs.writeFile(metaPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');

  let sectionsUpdated = 0;
  const overwriteSections = fields.overwriteSections !== false;
  const sectionsDir = path.join(pageDir, 'sections');
  let entries = [];
  try {
    entries = await fs.readdir(sectionsDir, { withFileTypes: true });
  } catch {
    return { culture, pageLanguage, sectionsUpdated, pageMetaUpdated };
  }

  for (const ent of entries) {
    if (!ent.isDirectory() || !/^section-\d+$/i.test(ent.name)) continue;
    const infoPath = path.join(sectionsDir, ent.name, 'section-information.json');
    let info;
    try {
      info = JSON.parse(await fs.readFile(infoPath, 'utf8'));
    } catch {
      continue;
    }
    const prev = info.culture && String(info.culture).trim();
    if (!overwriteSections && prev) continue;
    if (prev === culture) continue;
    info.culture = culture;
    await fs.writeFile(infoPath, `${JSON.stringify(info, null, 2)}\n`, 'utf8');
    sectionsUpdated += 1;
  }

  return { culture, pageLanguage, sectionsUpdated, pageMetaUpdated };
}

/**
 * Re-resolve culture for an existing capture page from URL + page.html (+ optional design md).
 * Capture-side repair only — create must not invent culture.
 *
 * @param {string} pageDir
 * @param {{ cultures?: string[], designMdPath?: string | null }} [opts]
 * @returns {Promise<{ culture: string, pageLanguage: string, htmlLang: string | null, aiLanguage: string | null, sectionsUpdated: number, pageMetaUpdated: boolean }>}
 */
export async function repairPageCaptureSourceCulture(pageDir, opts = {}) {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');

  const metaPath = path.join(pageDir, 'page-meta.json');
  let meta = {};
  try {
    meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
  } catch {
    meta = {};
  }

  let url = meta.url || '';
  if (!url) {
    try {
      url = (await fs.readFile(path.join(pageDir, 'source-url.txt'), 'utf8')).trim();
    } catch {
      url = '';
    }
  }

  const htmlCandidates = [
    path.join(pageDir, 'html', 'page.html'),
    path.join(pageDir, 'page.html'),
  ];
  let htmlLang = null;
  for (const htmlPath of htmlCandidates) {
    try {
      const html = await fs.readFile(htmlPath, 'utf8');
      htmlLang = parseHtmlLangAttribute(html);
      if (htmlLang) break;
    } catch {
      /* try next */
    }
  }

  let aiLanguage = null;
  const designMdPath =
    opts.designMdPath || path.join(pageDir, 'ai-derived-design.md');
  try {
    aiLanguage = extractContentLanguageFromDesignMd(
      await fs.readFile(designMdPath, 'utf8'),
    );
  } catch {
    /* optional */
  }

  const cultures = Array.isArray(opts.cultures) ? opts.cultures : [];
  const resolved = resolveCaptureSourceCulture({
    url,
    htmlLang,
    aiLanguage,
    cultures,
  });
  const written = await writePageCaptureSourceCulture(pageDir, {
    ...resolved,
    url: url || undefined,
    overwriteSections: true,
  });

  return {
    culture: written.culture,
    pageLanguage: written.pageLanguage,
    htmlLang,
    aiLanguage,
    sectionsUpdated: written.sectionsUpdated,
    pageMetaUpdated: written.pageMetaUpdated,
  };
}

/**
 * Ensure page-meta.json and each section-information.json under sections/ carry Sitecore culture.
 * Create-if-absent / fill-missing only (does not overwrite a non-empty culture).
 * @param {string} pageDir absolute capture page directory
 * @param {{ cultures?: string[], pageLanguage?: string | null, culture?: string | null, url?: string | null }} [hints]
 * @returns {Promise<{ culture: string, sectionsUpdated: number, pageMetaUpdated: boolean }>}
 */
export async function ensurePageCaptureSourceCulture(pageDir, hints = {}) {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');

  const metaPath = path.join(pageDir, 'page-meta.json');
  let meta = {};
  try {
    meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
  } catch {
    meta = {};
  }

  const cultures = Array.isArray(hints.cultures) ? hints.cultures : [];
  const pageUrl = meta.url || hints.url || '';
  const pageLanguage =
    hints.pageLanguage ||
    meta.pageLanguage ||
    (pageUrl ? inferPageLanguageFromUrl(pageUrl) : '') ||
    'en';
  const culture =
    (hints.culture && String(hints.culture).trim()) ||
    (meta.culture && String(meta.culture).trim()) ||
    (pageUrl
      ? inferSitecoreCultureFromUrl(pageUrl, cultures)
      : toSitecoreCulture(pageLanguage, cultures));

  let pageMetaUpdated = false;
  const hadLegacyCultures = Object.prototype.hasOwnProperty.call(meta, 'cultures');
  if (
    meta.culture !== culture ||
    meta.pageLanguage !== pageLanguage ||
    hadLegacyCultures
  ) {
    meta = {
      ...(pageUrl || meta.url ? { url: pageUrl || meta.url } : {}),
      pageLanguage: meta.pageLanguage || pageLanguage,
      culture,
      capturedAt: meta.capturedAt || new Date().toISOString(),
    };
    await fs.writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
    pageMetaUpdated = true;
  }

  let sectionsUpdated = 0;
  const sectionsDir = path.join(pageDir, 'sections');
  let entries = [];
  try {
    entries = await fs.readdir(sectionsDir, { withFileTypes: true });
  } catch {
    return { culture, sectionsUpdated, pageMetaUpdated };
  }

  for (const ent of entries) {
    if (!ent.isDirectory() || !/^section-\d+$/i.test(ent.name)) continue;
    const infoPath = path.join(sectionsDir, ent.name, 'section-information.json');
    let info;
    try {
      info = JSON.parse(await fs.readFile(infoPath, 'utf8'));
    } catch {
      continue;
    }
    if (info.culture && String(info.culture).trim()) continue;
    info.culture = culture;
    await fs.writeFile(infoPath, `${JSON.stringify(info, null, 2)}\n`, 'utf8');
    sectionsUpdated += 1;
  }

  return { culture, sectionsUpdated, pageMetaUpdated };
}
