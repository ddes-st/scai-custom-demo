/**
 * Shared Azure OpenAI translation with disk cache.
 * Used by translate.ts (authoring emit). Definition seeds stay in capture culture
 * (translate-definition-seeds.mjs is a no-op — do not force English at codegen).
 *
 * Cache v3: .bq/definitions/cache/translations.json
 *   { version: 3, entries: { "<opaque-32-hex-guid>": { sourceCulture, translations: { en, nl-BE, … } } } }
 * Lookup is only via cultureTextIndex (culture|text → id). Entry keys are never derived from phrase text.
 * Env: BQ_FORCE_TRANSLATIONS, AZURE_OPENAI_*
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = path.resolve(__dirname, '../../../.bq/definitions/cache/translations.json');

/** @type {boolean | null} */
let forceTranslationsOverride = null;

/** @type {{ record: (entry: object) => unknown } | null} */
let translationAiLedger = null;

/**
 * @typedef {{
 *   sourceCulture: string,
 *   translations: Record<string, string>,
 * }} TranslationEntry
 */

/**
 * @typedef {{
 *   version: 3,
 *   entries: Record<string, TranslationEntry>,
 * }} TranslationCacheV3
 */

/** @type {TranslationCacheV3 | null} */
let memoryCache = null;
/** @type {Map<string, string>} culture|text → entry id (exact + lowercased text keys) */
let cultureTextIndex = new Map();

/** Run stats for cache hits vs OpenAI calls (reset per generate if desired). */
const translationRunStats = {
  cacheHits: 0,
  cacheMissAi: 0,
  skippedSameCulture: 0,
  skippedNonTranslatable: 0,
};

/**
 * @returns {'verbose' | 'misses' | 'silent'}
 * Default: misses — MISS + WRITE (HIT/SKIP never logged).
 * BQ_TRANSLATE_CACHE_LOG=verbose|1|all → same as misses today (reserved for extra detail).
 * BQ_TRANSLATE_CACHE_LOG=silent|off → nothing.
 */
function cacheLogMode() {
  const v = (process.env.BQ_TRANSLATE_CACHE_LOG || '').trim().toLowerCase();
  if (v === 'silent' || v === 'off') return 'silent';
  if (v === '1' || v === 'true' || v === 'verbose' || v === 'all') return 'verbose';
  // Default and BQ_TRANSLATE_CACHE_LOG=0|false|misses
  return 'misses';
}

/**
 * @param {string} kind HIT|MISS|SKIP|WRITE
 * @param {string} line
 */
function logCacheDiag(kind, line) {
  // Hits and skips are noise — never print them.
  if (kind === 'HIT' || kind === 'SKIP') return;
  const mode = cacheLogMode();
  if (mode === 'silent') return;
  // misses + verbose: show MISS (needs AI) and WRITE (proves the culture was stored).
  console.log(`  translate cache ${kind} ${line}`);
}

/**
 * Active cultures from BQ_CULTURES (comma-separated Sitecore codes).
 * @returns {string[]}
 */
function activeCulturesFromEnv() {
  return String(process.env.BQ_CULTURES || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * @param {string} text
 */
function truncateLogText(text) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (s.length <= 60) return s;
  return `${s.slice(0, 57)}...`;
}

export function getTranslationRunStats() {
  return { ...translationRunStats };
}

export function resetTranslationRunStats() {
  translationRunStats.cacheHits = 0;
  translationRunStats.cacheMissAi = 0;
  translationRunStats.skippedSameCulture = 0;
  translationRunStats.skippedNonTranslatable = 0;
}

/**
 * Wire AI usage ledger for OpenAI translate calls (create:sectioncomponents / definitions:generate).
 * @param {{ record: (entry: object) => unknown } | null | undefined} ledger
 */
export function setTranslationAiLedger(ledger) {
  translationAiLedger = ledger || null;
}

export function getTranslationAiLedger() {
  return translationAiLedger;
}

function envForceTranslations() {
  const v = (process.env.BQ_FORCE_TRANSLATIONS || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export function setForceTranslations(enabled) {
  forceTranslationsOverride = Boolean(enabled);
  if (enabled) process.env.BQ_FORCE_TRANSLATIONS = '1';
}

export function isForceTranslations() {
  if (forceTranslationsOverride != null) return forceTranslationsOverride;
  return envForceTranslations();
}

/**
 * Pure numbers / phones / metrics / emails — do not send to OpenAI.
 * @param {string} value
 */
export function isNonTranslatable(value) {
  const s = String(value || '').trim();
  if (!s) return true;
  // Standalone email (optional mailto:)
  const emailCandidate = s.replace(/^mailto:/i, '').trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(emailCandidate)) return true;
  // Any letter → translate (e.g. "120 000 klanten", "+ info")
  if (/\p{L}/u.test(s)) return false;
  // Must contain at least one digit; only numeric/phone punctuation otherwise.
  // Covers: "+ 3238291087", "120 000", "€3,200", "(03) 829-10-87", "3%"
  if (!/\d/.test(s)) return false;
  return /^[+€$£\d\s.,\-()/%]+$/.test(s);
}

/** Distinctive Dutch tokens — avoid ambiguous short words shared with English. */
const DUTCH_RE =
  /\b(je|jouw|onze|uw|het|een|zijn|niet|nog|ook|maar|waar|waarom|deze|dit|hier|daar|redenen|voorwaarden|cookiebeleid|belangrijke|contacteer|netwerk|personeel|algemene|juridische|verklaring|voorkeuren|hulp|particulieren|veelgestelde|toegankelijkheid|volg\s+ons|pensioen|pensioenen|verzekering|verzekeringen|mobiliteit|woning|gezondheid|beleggingen|thuis|gezin|schadegeval|welkom|bij|dicht|klanten|klant|haar|staan|bedankt|graag|alstublieft|hierbij|onderstaande|rekening|rekeningen|bankieren|zoeken|zoekresultaten|beleggen|lenen|sparen|betalen|verzekeren|ondernemers|cooperanten|coöperanten|kantoorzoeker|klachtenbehandeling)\b/iu;

/** Distinctive French tokens (avoid words identical in English: conditions, plus, …). */
const FRENCH_RE =
  /\b(nous|vous|les|des|une|pour|avec|dans|sur|cette|ces|qui|que|quoi|comment|pourquoi|g[eé]n[eé]rales|juridiques|aide|contactez|r[eé]seau|emplois|[aà] propos|suivez|confidentialit[eé]|pr[eé]f[eé]rences|accessibilit[eé]|m[eé]t[eé]o|extr[eê]mes|chercher|recherche|particuliers)\b/iu;

const NON_ASCII_LETTER_RE = /[àâäáéèêëïîíôóùûüúçœæñÀÂÄÁÉÈÊËÏÎÍÔÓÙÛÜÚÇŒÆÑ]/u;

const URL_ONLY_RE = /^(https?:\/\/|mailto:|tel:|javascript:|#|\/)\S*$/i;

/**
 * Normalize markup to plain text for language heuristics.
 * @param {string} value
 * @returns {string}
 */
export function plainTextForLangDetect(value) {
  let s = String(value || '');
  s = s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/&lsquo;|&rsquo;|&#8216;|&#8217;/gi, "'")
    .replace(/&hellip;|&#8230;/gi, '...')
    .replace(/&#\d+;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ');
  // Drop tags (keeps text nodes; href URLs inside attributes are removed with the tag)
  s = s.replace(/<[^>]+>/g, ' ');
  // Curly / typographic quotes → ASCII
  s = s.replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"');
  s = s.replace(/[\u2018\u2019\u201A\u201B]/g, "'");
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/**
 * True when we should not call translation APIs for EN-seed (already English / noise).
 * @param {string} value
 * @returns {boolean}
 */
export function looksAlreadyEnglish(value) {
  const raw = String(value || '').trim();
  if (!raw) return true;
  if (isNonTranslatable(raw)) return true;
  if (URL_ONLY_RE.test(raw)) return true;

  const s = plainTextForLangDetect(raw);
  if (!s) return true;
  if (isNonTranslatable(s)) return true;
  if (URL_ONLY_RE.test(s)) return true;
  // Only URLs / punctuation left after strip
  if (/^[\s\d.,;:!?…\-_/\\#@€$£%&*()[\]{}'"`~+|=<>]*$/u.test(s)) return true;
  // Strip standalone URLs from plain text; if nothing meaningful remains, skip
  const withoutUrls = s
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/www\.\S+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!withoutUrls || isNonTranslatable(withoutUrls)) return true;

  if (/^[A-Z0-9][A-Z0-9.&+\-]{0,24}$/.test(withoutUrls)) return true;
  if (NON_ASCII_LETTER_RE.test(withoutUrls)) return false;
  if (DUTCH_RE.test(withoutUrls) || FRENCH_RE.test(withoutUrls)) return false;
  return true;
}

function normPhraseKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * True when text is clearly non-English (Dutch markers / accented letters).
 * Used to detect poisoned EN cache identities (en === Dutch source).
 * @param {string} sourceText
 * @returns {boolean}
 */
export function isClearlyNonEnglishSource(sourceText) {
  const s = String(sourceText || '').trim();
  if (!s) return false;
  const plain = plainTextForLangDetect(s);
  if (!plain) return false;
  if (NON_ASCII_LETTER_RE.test(plain)) return true;
  if (DUTCH_RE.test(plain) || FRENCH_RE.test(plain)) return true;
  return false;
}

/**
 * Poisoned EN identity: cached/AI `en` equals a clearly non-English source.
 * @param {string} sourceText
 * @param {string} enValue
 * @returns {boolean}
 */
export function isPoisonedEnglishIdentity(sourceText, enValue) {
  if (!sourceText?.trim() || !enValue?.trim()) return false;
  if (normPhraseKey(sourceText) !== normPhraseKey(enValue)) return false;
  if (
    looksAlreadyEnglish(sourceText) &&
    !isClearlyNonEnglishSource(sourceText)
  ) {
    return false;
  }
  if (!isClearlyNonEnglishSource(sourceText)) return false;
  // Skip huge HTML blobs — short labels / titles / item names only.
  if (sourceText.length > 200 || /<[a-z][\s\S]*>/i.test(sourceText)) {
    return false;
  }
  return true;
}

function isEnNamePurpose(purpose) {
  return /^(item-name-en|folder-name-en|heal-poisoned-en|link-page-path|link-page-name)$/i.test(
    String(purpose || '').trim(),
  );
}

/**
 * Canonical culture for cache identity (aligned with resolve-content-languages).
 * Resolves ambiguous short codes (e.g. `be`) via BQ_CULTURES when possible.
 * @param {string} culture
 * @param {string[]} [preferredCultures]
 */
export function normalizeCultureKeyForCache(culture, preferredCultures) {
  const raw = String(culture || '')
    .trim()
    .replace(/_/g, '-');
  if (!raw) return 'en';
  const lower = raw.toLowerCase();
  if (lower === 'en' || lower.startsWith('en-')) return 'en';

  const preferred = (preferredCultures?.length
    ? preferredCultures
    : activeCulturesFromEnv()
  ).map((c) =>
    String(c || '')
      .trim()
      .replace(/_/g, '-'),
  );

  // Ambiguous region-only code (e.g. "be") → first *-BE in active cultures, else nl-BE.
  if (/^[a-z]{2}$/.test(lower) && !['nl', 'fr', 'de', 'en', 'it', 'es', 'pt'].includes(lower)) {
    const region = lower.toUpperCase();
    const match = preferred.find((c) => {
      const m = c.match(/^([a-z]{2})-([a-z]{2})$/i);
      return m && m[2].toUpperCase() === region;
    });
    if (match) {
      const m = match.match(/^([a-z]{2})-([a-z]{2})$/i);
      return `${m[1].toLowerCase()}-${m[2].toUpperCase()}`;
    }
    if (lower === 'be') return 'nl-BE';
  }

  const SHORT = { nl: 'nl-BE', fr: 'fr-BE', de: 'de-DE', it: 'it-IT', es: 'es-ES', pt: 'pt-PT' };
  if (SHORT[lower]) {
    // Prefer an explicit list entry with same language prefix when present.
    const lang = lower;
    const fromList = preferred.find((c) => c.toLowerCase().startsWith(`${lang}-`));
    if (fromList) {
      const m = fromList.match(/^([a-z]{2})-([a-z]{2})$/i);
      if (m) return `${m[1].toLowerCase()}-${m[2].toUpperCase()}`;
    }
    return SHORT[lower];
  }

  const m = lower.match(/^([a-z]{2})-([a-z]{2})$/);
  if (m) return `${m[1]}-${m[2].toUpperCase()}`;
  return raw;
}

/**
 * @param {string} text
 */
function normTextKey(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Opaque random entry id (32-hex). Never derived from phrase text — not a search key.
 * @returns {string}
 */
export function mintOpaqueEntryId() {
  return crypto.randomUUID().replace(/-/g, '');
}

/**
 * @deprecated Prefer {@link mintOpaqueEntryId}. Ignores args; returns a new opaque GUID.
 * @param {string} [_sourceCulture]
 * @param {string} [_sourceText]
 */
export function makeEntryId(_sourceCulture, _sourceText) {
  return mintOpaqueEntryId();
}

/**
 * Source phrase for an entry (= translations[sourceCulture], else en, else first value).
 * @param {TranslationEntry | null | undefined} entry
 * @returns {string}
 */
export function sourceTextOf(entry) {
  if (!entry || typeof entry !== 'object') return '';
  const sc = normalizeCultureKeyForCache(entry.sourceCulture || 'en');
  const t = entry.translations || {};
  if (t[sc] != null && String(t[sc]).trim() !== '') return String(t[sc]);
  if (t.en != null && String(t.en).trim() !== '') return String(t.en);
  const first = Object.values(t).find((v) => v != null && String(v).trim() !== '');
  return first != null ? String(first) : '';
}

/**
 * @param {unknown} sourceCulture
 * @returns {string}
 */
function requireSourceCulture(sourceCulture) {
  const raw = String(sourceCulture ?? '').trim();
  if (!raw) {
    throw new Error('sourceCulture is required for translate/seed (no silent default)');
  }
  return normalizeCultureKeyForCache(raw);
}

/**
 * Exact index key (preserves casing of stored text for display; lookup also uses lower).
 * @param {string} culture
 * @param {string} text
 */
function cultureTextKey(culture, text) {
  return `${normalizeCultureKeyForCache(culture)}|${String(text || '').trim()}`;
}

/**
 * Case-insensitive index key.
 * @param {string} culture
 * @param {string} text
 */
function cultureTextKeyLower(culture, text) {
  return `${normalizeCultureKeyForCache(culture)}|${normTextKey(text)}`;
}

/**
 * @returns {TranslationCacheV3}
 */
function emptyCache() {
  return { version: 3, entries: {} };
}

/**
 * Index both exact and lowercased culture|text keys.
 * @param {string} culture
 * @param {string} text
 * @param {string} id
 */
function indexCultureText(culture, text, id) {
  if (text == null || String(text).trim() === '') return;
  cultureTextIndex.set(cultureTextKey(culture, text), id);
  cultureTextIndex.set(cultureTextKeyLower(culture, text), id);
}

/**
 * Rebuild culture|text → entryId index from entries (translations only).
 * @param {TranslationCacheV3} cache
 */
function rebuildIndex(cache) {
  cultureTextIndex = new Map();
  for (const [id, entry] of Object.entries(cache.entries || {})) {
    if (!entry || typeof entry !== 'object') continue;
    const translations = entry.translations || {};
    for (const [culture, text] of Object.entries(translations)) {
      indexCultureText(culture, text, id);
    }
  }
}

/**
 * Normalize one entry to v3 shape (no sourceText/name; canonical culture keys).
 * @param {object} entry
 * @returns {TranslationEntry | null}
 */
function normalizeEntryShape(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const legacySourceText = String(
    /** @type {{ sourceText?: string }} */ (entry).sourceText || '',
  ).trim();
  let sourceCulture = normalizeCultureKeyForCache(
    entry.sourceCulture || (legacySourceText ? 'en' : 'en'),
  );
  /** @type {Record<string, string>} */
  const translations = {};
  for (const [culture, text] of Object.entries(entry.translations || {})) {
    if (text == null || String(text).trim() === '') continue;
    const c = normalizeCultureKeyForCache(culture);
    const t = String(text);
    if (!translations[c]) translations[c] = t;
  }
  if (!translations[sourceCulture] && legacySourceText) {
    translations[sourceCulture] = legacySourceText;
  }
  // Heal mis-keyed sourceCulture=en when source phrase is clearly non-English.
  const srcPhrase = translations[sourceCulture] || legacySourceText;
  if (
    sourceCulture === 'en' &&
    srcPhrase &&
    isClearlyNonEnglishSource(srcPhrase)
  ) {
    sourceCulture = 'nl-BE';
    translations['nl-BE'] = translations['nl-BE'] || srcPhrase;
  }
  // English-looking phrase under a non-en culture (e.g. legacy `be|Hello`) —
  // also store under `en` so mergeDuplicateEntries can collapse with en groups.
  const phraseForEn = translations.en || srcPhrase || legacySourceText;
  if (
    phraseForEn &&
    looksAlreadyEnglish(phraseForEn) &&
    !isClearlyNonEnglishSource(phraseForEn)
  ) {
    if (!translations.en) translations.en = phraseForEn;
    if (sourceCulture !== 'en' && translations[sourceCulture] === phraseForEn) {
      sourceCulture = 'en';
    }
  }
  if (!Object.keys(translations).length) return null;
  return { sourceCulture, translations };
}

/**
 * Remap legacy/non-canonical culture keys (e.g. `be`) then merge duplicates.
 * Keeps opaque GUID keys (does not remint from phrase text).
 * @param {TranslationCacheV3} cache
 * @returns {number} number of entries removed by merge
 */
function healCacheCulturesAndMerge(cache) {
  const before = Object.keys(cache.entries || {}).length;
  /** @type {Record<string, TranslationEntry>} */
  const nextEntries = {};

  for (const [id, entry] of Object.entries(cache.entries || {})) {
    const normalized = normalizeEntryShape(entry);
    if (!normalized) continue;
    // Preserve existing opaque id when already a 32-hex guid; otherwise mint.
    const keepId = /^[0-9a-f]{32}$/i.test(id) ? id.toLowerCase() : mintOpaqueEntryId();
    const existing = nextEntries[keepId];
    if (existing) {
      existing.translations = {
        ...existing.translations,
        ...normalized.translations,
      };
      existing.sourceCulture = normalized.sourceCulture || existing.sourceCulture;
    } else {
      nextEntries[keepId] = normalized;
    }
  }

  cache.version = 3;
  cache.entries = nextEntries;
  mergeDuplicateEntries(cache);
  const after = Object.keys(cache.entries || {}).length;
  return Math.max(0, before - after);
}

/**
 * Merge entries that share any (culture, text) pair.
 * @param {TranslationCacheV3} cache
 */
function mergeDuplicateEntries(cache) {
  /** @type {Map<string, string>} culture|lowerText → entry id */
  const seen = new Map();
  const ids = Object.keys(cache.entries);
  for (const id of ids) {
    const entry = cache.entries[id];
    if (!entry) continue;
    /** @type {string|null} */
    let mergeInto = null;
    for (const [culture, text] of Object.entries(entry.translations || {})) {
      const k = cultureTextKeyLower(culture, text);
      const existing = seen.get(k);
      if (existing && existing !== id) {
        mergeInto = existing;
        break;
      }
    }
    if (!mergeInto) {
      for (const [culture, text] of Object.entries(entry.translations || {})) {
        seen.set(cultureTextKeyLower(culture, text), id);
      }
      continue;
    }
    const target = cache.entries[mergeInto];
    if (!target) continue;
    target.translations = { ...target.translations, ...entry.translations };
    const targetCount = Object.keys(target.translations).length;
    const srcCount = Object.keys(entry.translations || {}).length;
    if (srcCount > targetCount) {
      target.sourceCulture = entry.sourceCulture;
    }
    delete cache.entries[id];
    for (const [culture, text] of Object.entries(target.translations)) {
      seen.set(cultureTextKeyLower(culture, text), mergeInto);
    }
  }
}

/**
 * Normalize a v3 cache document (culture-key heal + duplicate merge).
 * Non-v3 documents are rejected (empty cache) — no v1/v2 migration.
 * @param {unknown} raw
 * @returns {{ cache: TranslationCacheV3, migrated: boolean, healed: number }}
 */
export function normalizeCacheDocument(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { cache: emptyCache(), migrated: false, healed: 0 };
  }
  if (Number(raw.version) === 3 && raw.entries && typeof raw.entries === 'object') {
    /** @type {TranslationCacheV3} */
    const cache = {
      version: 3,
      entries: { ...raw.entries },
    };
    const healed = healCacheCulturesAndMerge(cache);
    return { cache, migrated: false, healed };
  }
  console.warn(
    `  ⚠ translations cache ignored: expected version 3, got ${String(/** @type {{ version?: unknown }} */ (raw).version ?? 'none')} (v1/v2 no longer supported)`,
  );
  return { cache: emptyCache(), migrated: false, healed: 0 };
}

/**
 * @returns {TranslationCacheV3}
 */
function loadCache() {
  if (memoryCache) return memoryCache;
  try {
    if (!fs.existsSync(CACHE_PATH)) {
      memoryCache = emptyCache();
      rebuildIndex(memoryCache);
      return memoryCache;
    }
    const raw = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    const { cache, healed } = normalizeCacheDocument(raw);
    memoryCache = cache;
    rebuildIndex(memoryCache);
    if (healed > 0) {
      saveCache(memoryCache);
      console.warn(
        `  ⚠ translations cache healed: ${healed} duplicate/legacy entries merged`,
      );
    }
    return memoryCache;
  } catch {
    memoryCache = emptyCache();
    rebuildIndex(memoryCache);
    return memoryCache;
  }
}

/**
 * @param {TranslationCacheV3} cache
 */
function saveCache(cache) {
  // Strip legacy fields in place (keep object identity for callers holding entry refs).
  for (const entry of Object.values(cache.entries || {})) {
    if (!entry || typeof entry !== 'object') continue;
    delete /** @type {{ sourceText?: string }} */ (entry).sourceText;
    delete /** @type {{ name?: string }} */ (entry).name;
  }
  cache.version = 3;
  memoryCache = cache;
  rebuildIndex(cache);
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
}

/**
 * Reset in-memory cache (tests).
 */
export function resetTranslationCacheMemory() {
  memoryCache = null;
  cultureTextIndex = new Map();
}

/**
 * Find grouped phrase by any culture + text (case-insensitive; tries en for English text).
 * @param {string} culture
 * @param {string} text
 * @returns {{ id: string, entry: TranslationEntry, nearId?: string } | null}
 */
export function findEntryByCultureText(culture, text) {
  const cache = loadCache();
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;

  const tryKeys = [
    cultureTextKey(culture, trimmed),
    cultureTextKeyLower(culture, trimmed),
  ];
  if (looksAlreadyEnglish(trimmed)) {
    tryKeys.push(cultureTextKey('en', trimmed), cultureTextKeyLower('en', trimmed));
  }

  let id;
  for (const k of tryKeys) {
    id = cultureTextIndex.get(k);
    if (id) break;
  }
  if (!id) {
    rebuildIndex(cache);
    for (const k of tryKeys) {
      id = cultureTextIndex.get(k);
      if (id) break;
    }
  }

  if (!id) {
    // Near-miss: same lowercased text under any culture
    const needle = normTextKey(trimmed);
    let nearId;
    for (const [k, entryId] of cultureTextIndex) {
      const sep = k.indexOf('|');
      if (sep < 0) continue;
      if (normTextKey(k.slice(sep + 1)) === needle) {
        nearId = entryId;
        break;
      }
    }
    return nearId ? { id: '', entry: null, nearId } : null;
  }

  const entry = cache.entries[id];
  if (!entry) return null;
  return { id, entry };
}

/**
 * Lookup all known translations for a phrase (any culture input).
 * @param {string} culture
 * @param {string} text
 * @returns {{ sourceCulture: string, sourceText: string, translations: Record<string, string> } | null}
 */
export function lookupPhrase(culture, text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;
  const hit = findEntryByCultureText(culture, trimmed);
  if (!hit?.entry) return null;
  const { entry } = hit;
  return {
    sourceCulture: entry.sourceCulture,
    sourceText: sourceTextOf(entry),
    translations: { ...entry.translations },
  };
}

/**
 * Seed a phrase translation without calling OpenAI.
 * Does not overwrite an existing target value unless replaceExisting is set.
 *
 * @param {string} sourceText
 * @param {string} targetCulture
 * @param {string} translatedText
 * @param {string} sourceCulture required
 * @param {{ replaceExisting?: boolean }} [options]
 * @returns {boolean} true when the cache was written/updated
 */
export function seedCachedTranslation(
  sourceText,
  targetCulture,
  translatedText,
  sourceCulture,
  options = {},
) {
  const trimmed = String(sourceText || '').trim();
  const result = String(translatedText || '').trim();
  if (!trimmed || !result) return false;

  const from = requireSourceCulture(sourceCulture);
  const to = normalizeCultureKeyForCache(targetCulture || '');
  if (!to || from.toLowerCase() === to.toLowerCase()) return false;

  const cache = loadCache();
  const hit = findEntryByCultureText(from, trimmed);
  const replaceExisting = Boolean(options?.replaceExisting);

  if (hit?.entry) {
    const existing = hit.entry.translations?.[to];
    if (existing && !replaceExisting) return false;
    setTranslationOnEntry(cache, hit.id, hit.entry, to, result, trimmed);
    hit.entry.translations[from] = hit.entry.translations[from] || trimmed;
    if (from === 'en') hit.entry.translations.en = hit.entry.translations.en || trimmed;
    if (to === 'en') hit.entry.translations.en = result;
    saveCache(cache);
    return true;
  }

  const id = mintOpaqueEntryId();
  /** @type {TranslationEntry} */
  const entry = {
    sourceCulture: from,
    translations: {
      [from]: trimmed,
      [to]: result,
    },
  };
  if (from === 'en') entry.translations.en = trimmed;
  if (to === 'en') entry.translations.en = result;
  cache.entries[id] = entry;
  saveCache(cache);
  return true;
}

function preserveSourcePunctuation(source, translated) {
  let out = String(translated || '')
    .trim()
    .replace(/^QUOTA EXCEEDED\.\s*/i, '')
    .trim();
  const sourceTrail = source.match(/[.:;!?…]+$/)?.[0] ?? '';
  if (!sourceTrail) {
    out = out.replace(/[.:;!?…]+$/u, '').trim();
  } else if (!out.endsWith(sourceTrail)) {
    out = out.replace(/[.:;!?…]+$/u, '').trim() + sourceTrail;
  }
  return out;
}

/**
 * @param {string} text
 * @param {string} targetCulture
 * @param {string} sourceCulture
 * @param {string} [purpose]
 * @returns {Promise<string>}
 */
async function translateWithOpenAi(text, targetCulture, sourceCulture, purpose = 'translate') {
  const azure = await import('../capture/lib/design-system/ai/azure-chat.mjs');
  const { azureChatCompletion } = azure;
  const result = await azureChatCompletion({
    messages: [
      {
        role: 'system',
        content:
          'You are a precise translator. Return ONLY the translated text with no quotes, labels, or explanation. Preserve HTML tags and placeholders if present.',
      },
      {
        role: 'user',
        content: `Translate from ${sourceCulture} to ${targetCulture}:\n\n${text}`,
      },
    ],
  });

  translationAiLedger?.record({
    purpose,
    ok: result.ok,
    model: result.model,
    usage: result.usage,
    costEstimate: result.costEstimate,
    skipReason: result.skipReason,
  });

  if (!result.ok) {
    throw new Error(
      `Azure OpenAI translation failed for "${text.slice(0, 48)}" → ${targetCulture}: ${result.skipReason}`,
    );
  }
  const content = String(result.content || '').trim();
  if (!content) {
    throw new Error(
      `Azure OpenAI translation empty for "${text.slice(0, 48)}" → ${targetCulture}`,
    );
  }
  return preserveSourcePunctuation(text, content.replace(/^["']|["']$/g, ''));
}

/** @type {typeof translateWithOpenAi | null} */
let translateWithOpenAiOverride = null;

/**
 * Inject OpenAI translator for unit tests (null restores default).
 * @param {typeof translateWithOpenAi | null} fn
 */
export function setTranslateWithOpenAiForTests(fn) {
  translateWithOpenAiOverride = fn;
}

/**
 * @param {string} text
 * @param {string} targetCulture
 * @param {string} sourceCulture
 * @param {string} [purpose]
 */
async function callTranslateWithOpenAi(text, targetCulture, sourceCulture, purpose = 'translate') {
  const impl = translateWithOpenAiOverride || translateWithOpenAi;
  return impl(text, targetCulture, sourceCulture, purpose);
}

/**
 * Store / heal a translation on an entry and persist.
 * @param {TranslationCacheV3} cache
 * @param {string} entryId
 * @param {TranslationEntry} entry
 * @param {string} toCulture
 * @param {string} value
 * @param {string} healSource text used for punctuation heal
 */
function setTranslationOnEntry(cache, entryId, entry, toCulture, value, healSource) {
  const to = normalizeCultureKeyForCache(toCulture);
  const healed = preserveSourcePunctuation(healSource, value);
  entry.translations[to] = healed;
  cache.entries[entryId] = entry;
  saveCache(cache);
  return healed;
}

/**
 * Ensure translations.en exists on an entry (AI if needed).
 * @param {TranslationCacheV3} cache
 * @param {string} entryId
 * @param {TranslationEntry} entry
 * @param {string} apiFrom
 * @param {string} apiText
 * @param {string} purpose
 */
async function ensureEnglishTranslation(
  cache,
  entryId,
  entry,
  apiFrom,
  apiText,
  purpose,
) {
  if (entry.translations?.en && String(entry.translations.en).trim()) {
    return entry.translations.en;
  }
  if (apiFrom === 'en') {
    entry.translations.en = apiText;
    cache.entries[entryId] = entry;
    return apiText;
  }
  translationRunStats.cacheMissAi += 1;
  let from = apiFrom;
  if (from === 'en' && isClearlyNonEnglishSource(apiText)) from = 'nl-BE';
  const translated = await callTranslateWithOpenAi(
    apiText,
    'en',
    from,
    purpose || 'ensure-en',
  );
  let result = preserveSourcePunctuation(apiText, translated) || translated;
  if (isPoisonedEnglishIdentity(apiText, result)) {
    const retry = await callTranslateWithOpenAi(
      apiText,
      'en',
      from === 'en' ? 'nl-BE' : from,
      purpose || 'ensure-en',
    );
    const retryClean = preserveSourcePunctuation(apiText, retry);
    if (retryClean && !isPoisonedEnglishIdentity(apiText, retryClean)) {
      result = retryClean;
    }
  }
  entry.translations.en = result;
  if (
    entry.sourceCulture === 'en' &&
    isClearlyNonEnglishSource(apiText)
  ) {
    entry.sourceCulture = from === 'en' ? 'nl-BE' : from;
    entry.translations[entry.sourceCulture] =
      entry.translations[entry.sourceCulture] || apiText;
  }
  cache.entries[entryId] = entry;
  return result;
}

/**
 * @param {string} text
 * @param {string} targetCulture
 * @param {string} sourceCulture required
 * @param {{ purpose?: string, replaceExisting?: boolean }} [options]
 * @returns {Promise<string>}
 */
/**
 * Peel wrapping quotes / &quot; before cache lookup (safety net for sticky CM).
 * Primary unwrap is apply/codegen — this only catches already-poisoned inputs.
 * @param {string} value
 * @returns {string}
 */
function unwrapTranslateInput(value) {
  let s = String(value || '').trim();
  if (!s) return s;
  const entity =
    /^&quot;([\s\S]*)&quot;$/i.exec(s) ||
    /^&#34;([\s\S]*)&#34;$/i.exec(s) ||
    /^&#x22;([\s\S]*)&#x22;$/i.exec(s);
  if (entity) s = entity[1] ?? s;
  if (s.length >= 2 && s.startsWith('"')) {
    try {
      const parsed = JSON.parse(s);
      if (typeof parsed === 'string') return parsed;
    } catch {
      /* keep */
    }
  }
  if (s.length >= 2 && s.startsWith("'") && s.endsWith("'")) {
    const inner = s.slice(1, -1);
    if (!inner.includes("'")) return inner;
  }
  return s;
}

export async function translateText(text, targetCulture, sourceCulture, options = {}) {
  const trimmed = unwrapTranslateInput(String(text || '').trim());
  if (!trimmed) return text;

  const from = requireSourceCulture(sourceCulture);
  const to = normalizeCultureKeyForCache(targetCulture || '');
  const purpose = String(options?.purpose || 'translate').trim() || 'translate';
  const preview = JSON.stringify(truncateLogText(trimmed));

  if (!to || from.toLowerCase() === to.toLowerCase()) {
    translationRunStats.skippedSameCulture += 1;
    logCacheDiag(
      'SKIP',
      `[${purpose}]: ${preview} ${from}→${to} — same_culture`,
    );
    return trimmed;
  }

  if (isNonTranslatable(trimmed)) {
    translationRunStats.skippedNonTranslatable += 1;
    logCacheDiag(
      'SKIP',
      `[${purpose}]: ${preview} ${from}→${to} — non_translatable`,
    );
    return trimmed;
  }

  const cache = loadCache();
  const entryCount = Object.keys(cache.entries || {}).length;
  const hit = findEntryByCultureText(from, trimmed);
  const nearId = hit && !hit.entry ? hit.nearId : undefined;
  let replaceExisting =
    Boolean(options?.replaceExisting) || isForceTranslations();

  // Already-English → en only when the *source culture* is English.
  if (
    to === 'en' &&
    from === 'en' &&
    looksAlreadyEnglish(trimmed) &&
    !replaceExisting
  ) {
    let entry = hit?.entry;
    let entryId = hit?.entry ? hit.id : '';
    if (!entry) {
      entryId = mintOpaqueEntryId();
      entry = {
        sourceCulture: 'en',
        translations: { en: trimmed },
      };
      cache.entries[entryId] = entry;
    } else {
      entry.translations = entry.translations || {};
      entry.translations.en = entry.translations.en || trimmed;
      cache.entries[entryId] = entry;
    }
    saveCache(cache);
    translationRunStats.cacheHits += 1;
    logCacheDiag(
      'SKIP',
      `[${purpose}]: ${preview} ${from}→${to} — already_english (seeded ${entryId}; cultures: ${Object.keys(entry.translations).join(',')})`,
    );
    return trimmed;
  }

  if (hit?.entry && !replaceExisting) {
    const { id, entry } = hit;
    const existing = entry.translations?.[to];
    if (existing) {
      const healed = preserveSourcePunctuation(trimmed, existing);
      const poisonedEn =
        to === 'en' &&
        isEnNamePurpose(purpose) &&
        isPoisonedEnglishIdentity(trimmed, healed);
      if (poisonedEn) {
        logCacheDiag(
          'MISS',
          `[${purpose}]: ${preview} ${from}→${to} — poisoned_en_identity (entry ${id}; will AI+store)`,
        );
        replaceExisting = true;
      } else {
        if (healed !== existing) {
          setTranslationOnEntry(cache, id, entry, to, healed, trimmed);
        }
        translationRunStats.cacheHits += 1;
        logCacheDiag(
          'HIT',
          `[${purpose}]: ${preview} ${from}→${to} (entry ${id}; cultures: ${Object.keys(entry.translations || {}).join(',')})`,
        );
        return healed;
      }
    } else {
      logCacheDiag(
        'MISS',
        `[${purpose}]: ${preview} ${from}→${to} — missing_target_culture (entry ${id}; have: ${Object.keys(entry.translations || {}).join(',')}; need: ${to}; will AI+store)`,
      );
    }
  } else if (replaceExisting) {
    logCacheDiag(
      'MISS',
      `[${purpose}]: ${preview} ${from}→${to} — force_translations` +
        (hit?.entry ? ` (entry ${hit.id})` : '') +
        `; will AI+store`,
    );
  } else {
    logCacheDiag(
      'MISS',
      `[${purpose}]: ${preview} ${from}→${to} — no_phrase_entry (lookup=${from}|${truncateLogText(trimmed)}` +
        (nearId ? `; near=${nearId}` : '') +
        `; entries=${entryCount}; will AI+store)`,
    );
  }

  // Prefer translating from entry source phrase when we found a group via a variant
  let apiFrom = from;
  let apiText = trimmed;
  if (hit?.entry?.sourceCulture) {
    const src = sourceTextOf(hit.entry);
    if (src) {
      apiFrom = normalizeCultureKeyForCache(hit.entry.sourceCulture);
      apiText = src;
    }
  }

  translationRunStats.cacheMissAi += 1;
  if (
    to === 'en' &&
    isEnNamePurpose(purpose) &&
    apiFrom === 'en' &&
    isClearlyNonEnglishSource(apiText)
  ) {
    apiFrom = 'nl-BE';
  }
  const translated = await callTranslateWithOpenAi(apiText, to, apiFrom, purpose);
  const cleaned = preserveSourcePunctuation(apiText, translated);
  let result = cleaned || translated;
  if (
    to === 'en' &&
    isEnNamePurpose(purpose) &&
    isPoisonedEnglishIdentity(apiText, result)
  ) {
    logCacheDiag(
      'MISS',
      `[${purpose}]: ${preview} AI echoed non-English — retry once`,
    );
    const retry = await callTranslateWithOpenAi(
      apiText,
      to,
      apiFrom === 'en' ? 'nl-BE' : apiFrom,
      purpose,
    );
    const retryClean = preserveSourcePunctuation(apiText, retry);
    if (retryClean && !isPoisonedEnglishIdentity(apiText, retryClean)) {
      result = retryClean;
    }
  }

  if (hit?.entry) {
    setTranslationOnEntry(cache, hit.id, hit.entry, to, result, apiText);
    hit.entry.translations[from] = hit.entry.translations[from] || trimmed;
    if (to === 'en') {
      hit.entry.translations.en = result;
    }
    if (
      to === 'en' &&
      hit.entry.sourceCulture === 'en' &&
      isClearlyNonEnglishSource(apiText)
    ) {
      hit.entry.sourceCulture = 'nl-BE';
      hit.entry.translations['nl-BE'] =
        hit.entry.translations['nl-BE'] || apiText;
    }
    await ensureEnglishTranslation(
      cache,
      hit.id,
      hit.entry,
      apiFrom,
      apiText,
      purpose,
    );
    saveCache(cache);
    logCacheDiag(
      'WRITE',
      `[${purpose}]: stored ${to} under entry ${hit.id} (now: ${Object.keys(hit.entry.translations).join(',')})`,
    );
    return result;
  }

  // New phrase group — opaque GUID; always materialize en
  const id = mintOpaqueEntryId();
  /** @type {TranslationEntry} */
  const entry = {
    sourceCulture: from,
    translations: {
      [from]: trimmed,
      [to]: result,
    },
  };
  if (to === 'en') entry.translations.en = result;
  cache.entries[id] = entry;
  await ensureEnglishTranslation(cache, id, entry, apiFrom, apiText, purpose);
  saveCache(cache);
  logCacheDiag(
    'WRITE',
    `[${purpose}]: stored ${to} under new entry ${id} (now: ${Object.keys(entry.translations).join(',')})`,
  );
  return result;
}

/**
 * @param {string[]} texts
 * @param {string} targetCulture
 * @param {string} sourceCulture required
 */
export async function translateMany(texts, targetCulture, sourceCulture) {
  requireSourceCulture(sourceCulture);
  const unique = [...new Set(texts.filter((t) => String(t || '').trim().length > 0))];
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const text of unique) {
    map.set(text, await translateText(text, targetCulture, sourceCulture));
  }
  return texts.map((t) => (String(t || '').trim() ? map.get(t) ?? t : t));
}

export { CACHE_PATH as TRANSLATION_CACHE_PATH };
