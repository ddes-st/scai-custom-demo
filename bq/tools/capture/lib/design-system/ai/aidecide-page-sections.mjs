/**
 * AI enrich section-information in place under {page}/sections/{section-NN}/.
 * Keeps hybrid band detection unchanged; never renames positional folders.
 */
import { createHash } from 'node:crypto';
import { access, readFile, readdir, rm, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  getAiUsageEntry,
  writeAiUsageMeta,
} from '../../../../shared/ai-usage-meta.mjs';
import { azureChatCompletion, imageContentPart, resolveAzureChatConfig } from './azure-chat.mjs';
import { AI_DERIVED_DESIGN_MD } from './generate-ai-design-guide.mjs';
import { pageSectionsDir } from '../../page-layout.mjs';
import { shouldForce } from '../../force-kinds.mjs';
import { readOriginalSectionHtml } from '../../section-html-files.mjs';

const SECTION_SLOT_RE = /^section-\d+$/;

export const SECTIONS_ENRICH_PURPOSE = 'sections-enrich';
const LEGACY_USE_AI_META = 'use-ai.meta.json';
const DEFAULT_BATCH_CHARS = 120_000;
const MAX_SECTIONS_PER_BATCH = 3;
const MAX_HTML_CHARS = 24_000;
const MAX_OPEN_STATE_HTML_CHARS = 12_000;
const MAX_DESIGN_EXCERPT = 8_000;

function normalizeHtmlForHash(html) {
  return String(html || '')
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
}

function slotContentHash(html) {
  return createHash('sha256').update(normalizeHtmlForHash(html), 'utf8').digest('hex');
}

function resolveBatchCharBudget() {
  const raw =
    process.env.AZURE_AI_DECIDE_MAX_CHARS?.trim() || process.env.AZURE_AI_DESIGN_MAX_CHARS?.trim();
  if (!raw) return DEFAULT_BATCH_CHARS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_BATCH_CHARS;
  return Math.floor(n);
}

async function pathExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function sha256Hex(text) {
  return createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
}

/**
 * Compact Playwright interactionStates for AI enrich (not the full state tree).
 * Prefer deeper menus, then other kinds; cap length for token budget.
 *
 * @param {unknown} states
 * @param {{ max?: number }} [opts]
 * @returns {Array<object>|null}
 */
export function formatInteractionStatesDigestForEnrich(states, opts = {}) {
  const max = Math.max(1, Number(opts.max) || 24);
  if (!Array.isArray(states) || !states.length) return null;

  const kindRank = (kind) => {
    const k = String(kind || '').toLowerCase();
    if (k === 'menu') return 0;
    if (k === 'tab') return 1;
    if (k === 'accordion') return 2;
    return 3;
  };

  const ranked = [...states]
    .filter((s) => s && typeof s === 'object')
    .sort((a, b) => {
      const kr = kindRank(a.kind) - kindRank(b.kind);
      if (kr !== 0) return kr;
      return (Number(b.depth) || 0) - (Number(a.depth) || 0);
    })
    .slice(0, max);

  if (!ranked.length) return null;

  return ranked.map((s) => {
    const outputs =
      s.outputs && typeof s.outputs === 'object' ? s.outputs : null;
    /** @type {string[]} */
    const shots = [];
    if (outputs) {
      for (const vp of [
        'mobile',
        'tablet',
        'desktop',
        'desktopRegular',
        'desktopLarge',
      ]) {
        const pathVal = outputs[vp]?.path;
        if (pathVal) shots.push(vp);
      }
    }
    const entry = {
      kind: s.kind != null ? String(s.kind) : null,
      slug: s.slug != null ? String(s.slug) : null,
      label: s.label != null ? String(s.label) : null,
      depth: Number.isFinite(Number(s.depth)) ? Number(s.depth) : null,
      narrowOnly: Boolean(s.narrowOnly),
      trigger: {
        selector: s.trigger?.selector != null ? String(s.trigger.selector) : null,
        method: s.trigger?.method != null ? String(s.trigger.method) : null,
      },
      panel: {
        selector: s.panel?.selector != null ? String(s.panel.selector) : null,
      },
      shots,
    };
    return entry;
  });
}

function truncate(str, max) {
  const s = String(str || '');
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n<!-- truncated ${s.length - max} chars -->`;
}

/**
 * True when a string looks like a relative URL/path worth absolutizing —
 * not plain words/numbers like "3" or "miljoen".
 * @param {string} t
 */
export function isRelativeUrlPath(t) {
  const s = String(t || '').trim();
  if (!s || /\s/.test(s)) return false;
  if (s.startsWith('/')) return true;
  if (s.includes('/')) return true;
  if (/\.(png|jpe?g|gif|webp|svg|pdf|mp4|webm)(\?|#|$)/i.test(s)) return true;
  return false;
}

/**
 * If a text value was wrongly absolutized via `new URL(token, pageUrl)`, restore
 * the original token (e.g. "3" ← "https://www.axa.be/nl/3").
 * @param {string} pageUrl
 * @param {unknown} value
 */
export function undoSpuriousAbsoluteUrl(pageUrl, value) {
  if (!pageUrl || typeof value !== 'string') return value;
  const t = value.trim();
  if (!/^https?:\/\//i.test(t)) return value;
  try {
    const abs = new URL(t);
    const base = new URL(pageUrl);
    if (abs.origin !== base.origin) return value;
    const segments = abs.pathname.split('/').filter(Boolean);
    const seg = segments[segments.length - 1] || '';
    if (!seg || /\./.test(seg)) return value;
    if (new URL(seg, pageUrl).href === abs.href) {
      try {
        return decodeURIComponent(seg);
      } catch {
        return seg;
      }
    }
  } catch {
    /* ignore */
  }
  return value;
}

/**
 * @param {string} pageUrl
 * @param {unknown} value
 */
export function resolveAbsoluteUrlsInValue(pageUrl, value) {
  if (value == null) return value;
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t) return value;
    if (/^(https?:|data:|mailto:|tel:|#)/i.test(t)) return t;
    if (t.startsWith('//') && pageUrl) {
      try {
        return new URL(pageUrl).protocol + t;
      } catch {
        return value;
      }
    }
    if (pageUrl && isRelativeUrlPath(t)) {
      try {
        return new URL(t, pageUrl).href;
      } catch {
        return value;
      }
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => resolveAbsoluteUrlsInValue(pageUrl, v));
  }
  if (typeof value === 'object') {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = resolveAbsoluteUrlsInValue(pageUrl, v);
    }
    return out;
  }
  return value;
}

function isUrlShaped(s) {
  const t = String(s || '').trim();
  if (!t) return false;
  if (/^https?:\/\//i.test(t)) return true;
  if (/^\/\//.test(t)) return true;
  // Absolute path that looks like a site path without spaces
  if (/^\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+$/.test(t) && t.includes('/')) return true;
  return false;
}

function isNonUrlVisibleText(s) {
  const t = String(s || '').trim();
  return Boolean(t) && !isUrlShaped(t);
}

const LABEL_FIELD_NAMES = new Set([
  'title',
  'heading',
  'name',
  'label',
  'category',
  'caption',
]);

/**
 * Coerce bare URL strings in link/image slots; repair URL-shaped titles from link.text;
 * undo spurious page-relative absolutization of plain text seeds.
 * @param {unknown} value
 * @param {string} [fieldHint] parent field name or type hint
 * @param {string} [pageUrl] page URL for undoing false absolutization
 */
export function sanitizeFieldValueShapes(value, fieldHint = '', pageUrl = '') {
  const hint = String(fieldHint || '').toLowerCase();

  if (Array.isArray(value)) {
    return value.map((v) => sanitizeFieldValueShapes(v, fieldHint, pageUrl));
  }

  if (value && typeof value === 'object') {
    /** @type {Record<string, unknown>} */
    const obj = { ...value };

    // Bare string wrongly placed — handled by caller with type; here fix object slots
    if ('url' in obj || 'text' in obj || hint === 'link') {
      if (typeof obj.url === 'string' || typeof obj.href === 'string') {
        const url = String(obj.url || obj.href || '').trim();
        const text = obj.text != null ? String(obj.text) : '';
        return { text, url };
      }
    }
    if ('src' in obj || hint === 'image') {
      if (typeof obj.src === 'string' || typeof obj.url === 'string') {
        return {
          src: String(obj.src || obj.url || '').trim(),
          alt: obj.alt != null ? String(obj.alt) : '',
        };
      }
    }

    // Item object (array element): repair label fields from link.text
    for (const [k, v] of Object.entries(obj)) {
      obj[k] = sanitizeFieldValueShapes(v, k, pageUrl);
    }

    const link = obj.link;
    const linkText =
      link && typeof link === 'object' && link !== null && 'text' in link
        ? String(/** @type {{ text?: unknown }} */ (link).text || '').trim()
        : '';

    if (isNonUrlVisibleText(linkText)) {
      for (const key of Object.keys(obj)) {
        if (!LABEL_FIELD_NAMES.has(key.toLowerCase())) continue;
        if (typeof obj[key] === 'string' && isUrlShaped(obj[key])) {
          obj[key] = linkText;
        }
      }
    }

    return obj;
  }

  // Bare string in a link/image typed field
  if (typeof value === 'string') {
    if (hint === 'link' && isUrlShaped(value)) {
      return { text: '', url: value.trim() };
    }
    if (hint === 'image' && (isUrlShaped(value) || /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(value))) {
      return { src: value.trim(), alt: '' };
    }
    if (hint !== 'link' && hint !== 'image' && pageUrl) {
      return undoSpuriousAbsoluteUrl(pageUrl, value);
    }
  }

  return value;
}

/**
 * @param {unknown} fields
 * @param {string} pageUrl
 */
export function normalizeSuggestedFields(fields, pageUrl) {
  if (!Array.isArray(fields)) return [];
  return fields.map((f) => {
    if (!f || typeof f !== 'object') return f;
    const field = { ...f };
    const type = String(field.type || '').toLowerCase();
    if (field.type === 'array' && Array.isArray(field.fields)) {
      field.fields = normalizeSuggestedFields(field.fields, pageUrl);
    }
    if ('value' in field) {
      let v = resolveAbsoluteUrlsInValue(pageUrl, field.value);
      if (type === 'array' && Array.isArray(v)) {
        v = v.map((item) => sanitizeFieldValueShapes(item, '', pageUrl));
      } else {
        v = sanitizeFieldValueShapes(
          v,
          type === 'link' || type === 'image' ? type : String(field.name || ''),
          pageUrl,
        );
      }
      field.value = v;
    }
    return field;
  });
}

/**
 * Sync empty repeats[].value ↔ matching array suggestedFields.value; sanitize shapes.
 * @param {unknown} repeats
 * @param {unknown} suggestedFields
 * @param {string} pageUrl
 */
export function normalizeRepeats(repeats, suggestedFields, pageUrl) {
  const fields = Array.isArray(suggestedFields) ? suggestedFields : [];
  const list = Array.isArray(repeats) ? repeats.map((r) => ({ ...r })) : [];

  for (const rep of list) {
    if (!rep || typeof rep !== 'object') continue;
    const name = String(rep.name || '').toLowerCase();
    const hasValue = Array.isArray(rep.value) && rep.value.length > 0;
    if (!hasValue) {
      const match = fields.find(
        (f) =>
          f &&
          typeof f === 'object' &&
          String(f.type || '').toLowerCase() === 'array' &&
          (String(f.name || '').toLowerCase() === name ||
            String(f.itemName || '').toLowerCase() === String(rep.itemName || '').toLowerCase()),
      );
      if (match && Array.isArray(match.value) && match.value.length) {
        rep.value = match.value;
      }
    }
    if (Array.isArray(rep.value)) {
      let v = resolveAbsoluteUrlsInValue(pageUrl, rep.value);
      v = sanitizeFieldValueShapes(v, '', pageUrl);
      rep.value = v;
      if (typeof rep.count !== 'number' || rep.count !== rep.value.length) {
        rep.count = rep.value.length;
      }
    }
  }

  // Fill empty array suggestedFields from repeats
  for (const f of fields) {
    if (!f || typeof f !== 'object') continue;
    if (String(f.type || '').toLowerCase() !== 'array') continue;
    if (Array.isArray(f.value) && f.value.length) continue;
    const match = list.find(
      (r) =>
        r &&
        Array.isArray(r.value) &&
        r.value.length &&
        (String(r.name || '').toLowerCase() === String(f.name || '').toLowerCase() ||
          String(r.itemName || '').toLowerCase() === String(f.itemName || '').toLowerCase()),
    );
    if (match) f.value = match.value;
  }

  return list;
}

function ensureFiveAlternatives(cmsName, alternatives) {
  const primary = String(cmsName || 'ContentBlock');
  const seen = new Set([primary.toLowerCase()]);
  const out = [];
  for (const a of Array.isArray(alternatives) ? alternatives : []) {
    const name = String(a || '').trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
    if (out.length >= 5) break;
  }
  const fillers = [
    `${primary}Block`,
    `${primary}Section`,
    `Page${primary}`,
    `${primary}Module`,
    `Feature${primary}`,
    'ContentBand',
    'ContentBlock',
    'MediaText',
    'PromoBand',
    'FeatureGrid',
  ];
  for (const f of fillers) {
    if (out.length >= 5) break;
    if (seen.has(f.toLowerCase())) continue;
    seen.add(f.toLowerCase());
    out.push(f);
  }
  return out.slice(0, 5);
}

/**
 * Prefer deepest menu interaction state (depth 3 → 2 → 1; skip L0 hamburger-open), else first state.
 * @param {object} info
 * @param {string} sourceDir
 */
async function resolveDeepestInteractionState(info, sourceDir) {
  const states = Array.isArray(info?.interactionStates) ? info.interactionStates : [];
  if (!states.length) return null;

  const menus = states.filter((s) => s && s.kind === 'menu' && (Number(s.depth) || 0) >= 1);
  const pool = menus.length ? menus : states.filter((s) => s && s.kind === 'menu');
  const sorted = [...(pool.length ? pool : states)].sort(
    (a, b) => (Number(b.depth) || 0) - (Number(a.depth) || 0),
  );
  const best = sorted[0];
  if (!best?.slug) return null;

  const stateDir = path.join(sourceDir, 'states', best.slug);
  let openHtml = '';
  try {
    openHtml = await readFile(path.join(stateDir, 'section.html'), 'utf8');
  } catch {
    openHtml = '';
  }

  let statePng = null;
  const folderHint = info.folderName || path.basename(sourceDir);
  const pngCandidates = [
    path.join(stateDir, `${folderHint}-${best.slug}-desktop.png`),
    path.join(stateDir, `${best.slug}-desktop.png`),
  ];
  for (const c of pngCandidates) {
    if (await pathExists(c)) {
      statePng = c;
      break;
    }
  }
  if (!statePng) {
    try {
      const files = await readdir(stateDir);
      const hit = files.find((f) => /-desktop\.png$/i.test(f));
      if (hit) statePng = path.join(stateDir, hit);
    } catch {
      /* ignore */
    }
  }

  return {
    slug: best.slug,
    kind: best.kind || null,
    depth: best.depth || 1,
    label: best.label || null,
    statePng,
    openHtml,
  };
}

/**
 * @param {string} pageDir
 */
export async function collectProgrammaticSections(pageDir) {
  const sectionsRoot = pageSectionsDir(pageDir);
  /** @type {Array<{
   *  index: number,
   *  sourceFolder: string,
   *  sourceDir: string,
   *  info: object,
   *  html: string,
   *  desktopPng: string|null,
   *  interactionState: object|null,
   * }>} */
  const items = [];
  let dirs = [];
  try {
    const entries = await readdir(sectionsRoot, { withFileTypes: true });
    const all = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('__ai-tmp-'))
      .map((e) => e.name);
    const positional = all.filter((n) => SECTION_SLOT_RE.test(n));
    dirs = (positional.length ? positional : all).sort((a, b) => {
      const na = Number(String(a).replace(/^section-/, '')) || 0;
      const nb = Number(String(b).replace(/^section-/, '')) || 0;
      if (na && nb) return na - nb;
      return String(a).localeCompare(String(b));
    });
  } catch {
    return items;
  }

  for (const folderName of dirs) {
    const sourceDir = path.join(sectionsRoot, folderName);
    const infoPath = path.join(sourceDir, 'section-information.json');
    let info = {};
    try {
      info = JSON.parse(await readFile(infoPath, 'utf8'));
    } catch {
      info = { folderName, cmsName: folderName };
    }
    const original = await readOriginalSectionHtml(sourceDir);
    const html = original?.html || '';
    const desktopCandidates = [
      path.join(sourceDir, `${folderName}-desktop.png`),
      path.join(sourceDir, `${info.folderName || folderName}-desktop.png`),
    ];
    let desktopPng = null;
    for (const c of desktopCandidates) {
      if (await pathExists(c)) {
        desktopPng = c;
        break;
      }
    }
    if (!desktopPng) {
      try {
        const files = await readdir(sourceDir);
        const hit = files.find((f) => /-desktop\.png$/i.test(f));
        if (hit) desktopPng = path.join(sourceDir, hit);
      } catch {
        /* ignore */
      }
    }
    const interactionState = await resolveDeepestInteractionState(info, sourceDir);
    items.push({
      index: Number(info.index) || items.length + 1,
      sourceFolder: `sections/${folderName}`,
      sourceDir,
      info,
      html,
      desktopPng,
      interactionState,
    });
  }

  items.sort((a, b) => a.index - b.index);
  return items;
}

function sourceHashForSections(items, designExcerpt) {
  const parts = items.map((it) => {
    const pngKey = it.desktopPng || '';
    const stateKey = it.interactionState?.slug
      ? `${it.interactionState.slug}:${it.interactionState.statePng || ''}`
      : '';
    return [
      it.sourceFolder,
      String(it.info.cmsName || ''),
      String(it.info.folderName || ''),
      sha256Hex(it.html),
      pngKey,
      stateKey,
      String((it.info.interactionStates || []).length),
    ].join('|');
  });
  return sha256Hex(`${parts.join('\n')}\nDESIGN:${sha256Hex(designExcerpt)}`);
}

/**
 * @param {Buffer} buf
 */
function pngToDataUrlPart(buf) {
  return imageContentPart(buf, 'image/png');
}

function parseSectionsJson(content) {
  let text = String(content || '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();
  const parsed = JSON.parse(text);
  const sections = Array.isArray(parsed.sections)
    ? parsed.sections
    : Array.isArray(parsed)
      ? parsed
      : [];
  return sections;
}

function buildSystemPrompt() {
  return [
    'You enrich captured webpage sections for later SitecoreAI / Next.js component generation.',
    'Hybrid detection already chose the bands — do NOT merge or split bands; only name and describe each.',
    'HTML + the desktop PNG are authoritative for purpose, structure, fields, and values.',
    'When an OPEN-STATE desktop PNG and/or open-state HTML excerpt is provided, use it to discover panel/menu/tab content, links, and columns that are hidden in the default shot — fold those into suggestedFields, repeats, and composition.',
    'Do NOT invent or drop capture file paths for interactionStates — preserve path/parentSlug/children/sectionHtml/outputs from capture; you may improve labels or kind if clearly wrong.',
    'Any design-guide excerpt is brand/tone context ONLY — never override what HTML+PNG show.',
    'Return JSON only: { "sections": [ ... ] } with one object per input section (match by index).',
    'Each section object MUST include:',
    '- index (number, same as input)',
    '- cmsName (best PascalCase Sitecore-style REUSABLE component name for the layout/role).',
    '  Name by structure and job (TechnologyHero, ModelIntro, SubNavigation, ComparisonTabs) — NOT the page topic.',
    '  Do NOT prefix with brand, product line, model, campaign, or page-slug tokens (e.g. avoid EtechTechnologyHero → use TechnologyHero).',
    '  Put page/product-specific wording in purpose and suggestedFields values, not in cmsName.',
    '  ROLE-DISTINCT NAMES (HARD): Each distinct layout/band on the page MUST get a distinct cmsName.',
    '  Site chrome (sticky header / main nav / cookie / site footer) MUST NOT reuse a mid-page content-band label',
    '  (e.g. never name a header LocalServicesAndNavigation — use SiteHeader / MainNavigation).',
    '  Mid-page proximity / local-offices / promo bands MUST NOT reuse chrome names (use LocalServicesBand / LocalOfficesPromo).',
    '  Never invent numbered twins (Foo2, Header2) for a different layout — pick another semantic PascalCase name.',
    '  Content-family peers (news list vs article detail) keep DISTINCT cmsNames; shared fields are a later family link, not a shared name.',
    '- alternativeNames (exactly 5 other PascalCase reusable names, no duplicates of cmsName, same no-prefix rule;',
    '  prefer role-distinct stems such as SiteHeader, LocalServicesBand — never Preferred2-style numeric suffixes)',
    '- purpose (one line)',
    '- description (layout + content roles)',
    '- layout: { pattern, structureNotes, interactionNotes, motion?, equalHeightChildren?, equalHeightEvidence? }',
    '  motion (REQUIRED object when any continuous/snap/autoplay motion exists, else { kind:"none" }):',
    '  { kind: "continuous-marquee"|"snap-carousel"|"interval-autoplay"|"css-keyframes"|"hover-zoom"|"none",',
    '    axis: "horizontal"|"vertical"|"none", loop: boolean, controls: "none"|"arrows"|"dots"|"both",',
    '    surface?: "band-ticker"|"item-rail", scrollingSubtree?: "text-track"|"item-track"|"unknown",',
    '    clonesAreNotContent?: boolean, evidence: string }',
    '  Set kind=continuous-marquee + loop=true when: marquee/ticker/logo-rail, CSS animation infinite / @keyframes translate,',
    '  duplicated DOM tracks for seamless loop, or continuous scroll with NO arrows/dots.',
    '  SURFACE (HARD when continuous-marquee): surface=band-ticker when short full-bleed colored bar + nowrap overflowing text',
    '  (announcement/notification) — background stays fixed; only the text track scrolls. surface=item-rail for logo/badge rows.',
    '  Prefer Pre-enrich motionGeometry / layout.motion.surface from capture when present.',
    '  HARD: DOM clones used only for looping are NOT authorable repeats — set clonesAreNotContent=true and keep ONE content seed;',
    '  do NOT emit repeats count=2 for identical clone tracks (announcement/logo rails).',
    '  equalHeightChildren=true when peer cards/tiles share one row height in the crop or CSS uses stretch/eh-grid;',
    '  put a short equalHeightEvidence string. Card carousels/grids of peer tiles should usually set this true.',
    '  interactionNotes: ground behavior on interactionStatesDigest when present (click vs hover triggers,',
    '  narrowOnly drawers, tab/accordion exclusive selection, menu depth). Digest is read-only Playwright evidence —',
    '  do NOT invent triggers/panels/paths not listed; do NOT drop or rewrite capture interactionStates paths.',
    '  interactionNotes MUST name the motion kind in one explicit sentence when motion.kind !== none.',
    '- repeats: [{ name, itemName, count, whatRepeats, fields, suggestedAs: "array-field"|"placeholder-items", value: [{...}] }]',
    '  value[] length should match count. Each item uses the same field shapes as suggestedFields.',
    '- composition: { strategy: "single"|"container-with-placeholder", container?, placeholder?, itemComponent? }',
    '  Prefer container-with-placeholder for card carousels / peer tile rows authors would reorder — not single + array-field.',
    '- suggestedFields: functional types only (text, multiline, richText, image, link, boolean, number, video, icon, array, …).',
    '  For repeats use type "array" with itemName, fields[], value[{...}]. Never Title1/Title2.',
    '  INLINE PROSE + LINK (HARD): When one nowrap sentence/ticker line has plain text AND an inline <a> in the same',
    '  parent (announcement/notification bars), emit ONE richText field (e.g. message) whose value is the HTML',
    '  including the <a href> — NOT three fields (introText + eventLink + supportingText). Separate link fields',
    '  only for standalone CTAs (own button/pill). Do NOT invent announcementTracks arrays from marquee DOM clones.',
    '  VALUE RULES (brand-agnostic):',
    '  - Text MAY be a URL when that is the visible label on the page. Do not ban URLs in text.',
    '  - For title/heading/name/label/category: prefer the most prominent VISIBLE label for that item',
    '    (link text, heading/caption, aria-label, img alt) — NOT the raw href or src.',
    '  - Use a URL string as title only when no better visible label exists (or the label is the URL).',
    '  - link values: { text, url } — text = visible anchor label; url = absolute href from HTML.',
    '  - richText values: HTML string with inline tags (<a>, <strong>, …) when the crop is one prose unit.',
    '  - image values: { src, alt } — absolute src from HTML.',
    '  - Do NOT invent site-specific title swaps (e.g. promo ribbon → title). Promo/ribbon stay separate fields.',
    '  For image/link/video values use REAL absolute URLs from the HTML (resolve relative to the page URL).',
    'Use container-with-placeholder when authors would add/reorder child items in a placeholder; else single + array field.',
  ].join('\n');
}

/** Tokens from URL/host that must not become cmsName prefixes. */
export function banHintsFromUrl(pageUrl) {
  /** @type {Set<string>} */
  const hints = new Set();
  const add = (s) => {
    const t = String(s || '').trim();
    if (t.length < 2) return;
    hints.add(t);
    hints.add(t.toLowerCase());
    hints.add(t.charAt(0).toUpperCase() + t.slice(1));
  };
  try {
    const u = new URL(pageUrl);
    const hostParts = u.hostname.replace(/^www\./i, '').split('.');
    const tlds = new Set(['com', 'be', 'nl', 'fr', 'de', 'uk', 'co', 'org', 'net', 'io', 'eu']);
    for (const p of hostParts) {
      if (!p || tlds.has(p.toLowerCase())) continue;
      add(p);
    }
    for (const part of u.pathname.split(/[/_.]+/)) {
      if (!part || /^(html?|php|aspx?|jsp)$/i.test(part)) continue;
      for (const seg of part.split('-').filter(Boolean)) add(seg);
      const compact = part.replace(/-/g, '');
      add(compact);
      const pascal = part
        .split(/[-_]+/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join('');
      add(pascal);
    }
  } catch {
    /* ignore */
  }
  return [...hints];
}

function leadingPascalToken(name) {
  // ETechTechnologyHero → ["ETech","Technology","Hero"]; ModelIntro → ["Model","Intro"]
  const parts = String(name || '').match(/[A-Z]+[a-z]*|[a-z]+|[0-9]+/g);
  return parts?.[0] || '';
}

function isChromeLikeSection(cmsName, info) {
  const name = String(cmsName || info?.cmsName || '');
  const blob = [name, info?.folderName, info?.selector, info?.type].filter(Boolean).join(' ');
  // Consent/CMP only — do not treat mis-tagged overlay heroes or *Navigation* names as chrome for prefix strip.
  if (/cookie|consent|onetrust|cmp|didomi|osano|cookiebot/i.test(blob)) return true;
  if (/^(Site)?(Header|Footer|MainNav|PrimaryNav)$/i.test(name)) return true;
  if (/^(Cookie|Consent)/i.test(name)) return true;
  return false;
}

/**
 * Strip a leading PascalCase token shared by a majority of non-chrome cmsNames.
 * @param {Map<number, object>} byIndex
 * @param {Array<{ index: number, info: object }>} items
 */
export function stripSharedPagePrefixes(byIndex, items) {
  /** @type {object[]} */
  const candidates = [];
  for (const item of items) {
    const ai = byIndex.get(item.index);
    if (!ai?.cmsName) continue;
    if (isChromeLikeSection(ai.cmsName, item.info)) continue;
    candidates.push(ai);
  }
  if (candidates.length < 2) return null;

  /** @type {Map<string, { count: number, canonical: string }>} */
  const counts = new Map();
  for (const ai of candidates) {
    const lead = leadingPascalToken(ai.cmsName);
    if (!lead || lead.length < 2) continue;
    const key = lead.toLowerCase();
    const prev = counts.get(key) || { count: 0, canonical: lead };
    prev.count += 1;
    counts.set(key, prev);
  }

  let bestKey = null;
  let bestCount = 0;
  let bestCanonical = '';
  for (const [key, { count, canonical }] of counts) {
    if (count > bestCount) {
      bestKey = key;
      bestCount = count;
      bestCanonical = canonical;
    }
  }
  const majority = Math.ceil(candidates.length / 2);
  if (!bestKey || bestCount < majority) return null;

  const stripOne = (name) => {
    const lead = leadingPascalToken(name);
    if (lead.toLowerCase() !== bestKey) return name;
    const rest = String(name).slice(lead.length);
    if (rest && /^[A-Z]/.test(rest)) return rest;
    return name;
  };

  for (const ai of candidates) {
    const before = ai.cmsName;
    ai.cmsName = stripOne(ai.cmsName);
    if (Array.isArray(ai.alternativeNames)) {
      ai.alternativeNames = ai.alternativeNames.map(stripOne);
    }
    if (ai.cmsName !== before) {
      ai._strippedPrefix = bestCanonical;
    }
  }
  return bestCanonical;
}

function formatCostUsd(costUsd) {
  return costUsd > 0 ? `~$${Math.round(costUsd * 1e6) / 1e6}` : 'cost n/a';
}

/**
 * @param {object} opts
 * @param {Awaited<ReturnType<typeof collectProgrammaticSections>>} opts.batch
 * @param {string} opts.pageUrl
 * @param {string} opts.designExcerpt
 * @param {string[]} opts.banHints
 * @param {object} opts.usageAcc
 */
async function askAzureForBatch({ batch, pageUrl, designExcerpt, banHints, usageAcc }) {
  const banLine =
    banHints.length > 0
      ? `Do NOT use these as cmsName / alternativeNames prefixes: ${banHints.slice(0, 40).join(', ')}`
      : '';
  /** @type {Array<object>} */
  const userContent = [
    {
      type: 'text',
      text: [
        `Page URL: ${pageUrl}`,
        banLine,
        designExcerpt
          ? `Design guide excerpt (NON-LEADING brand context only):\n${designExcerpt}`
          : 'Design guide: (none)',
        `Analyze ${batch.length} section(s). Respond with JSON { "sections": [ ... ] }.`,
      ]
        .filter(Boolean)
        .join('\n\n'),
    },
  ];

  for (const item of batch) {
    const interactionStatesDigest = formatInteractionStatesDigestForEnrich(
      item.info.interactionStates,
    );
    const meta = {
      index: item.index,
      programmaticCmsName: item.info.cmsName || null,
      programmaticFolderName: item.info.folderName || path.basename(item.sourceDir),
      selector: item.info.selector || null,
      heading: item.info.heading || null,
      track: item.info.track || null,
      rect: item.info.rect || null,
      sourceFolder: item.sourceFolder,
      interactionSummary: item.info.interactionSummary || null,
      interactionStateCount: Array.isArray(item.info.interactionStates)
        ? item.info.interactionStates.length
        : 0,
      ...(interactionStatesDigest ? { interactionStatesDigest } : {}),
      ...(item.info.layout?.motion
        ? { captureLayoutMotion: item.info.layout.motion }
        : {}),
      ...(item.info.motionGeometry
        ? { captureMotionGeometry: item.info.motionGeometry }
        : {}),
    };
    let authoredCss = '';
    try {
      const cssPath = path.join(item.sourceDir, 'section.authored.css');
      authoredCss = await readFile(cssPath, 'utf8');
    } catch {
      /* optional */
    }
    let motionHintsText = '';
    try {
      const { extractMotionHintsFromCapture } = await import(
        '../../../../create-section-components/motion-hints.mjs'
      );
      const hints = extractMotionHintsFromCapture(item.html, authoredCss);
      if (hints.evidence.length || hints.suggestsBandTicker) {
        motionHintsText = `\nPre-enrich motion/CSS hints (machine): ${JSON.stringify(hints)}`;
      }
    } catch {
      /* optional */
    }
    userContent.push({
      type: 'text',
      text: `--- SECTION index=${item.index} ---\n${JSON.stringify(meta, null, 2)}${motionHintsText}\n\nHTML (default/closed):\n${truncate(item.html, MAX_HTML_CHARS)}`,
    });
    if (item.desktopPng) {
      try {
        const buf = await readFile(item.desktopPng);
        userContent.push({
          type: 'text',
          text: `(default/closed desktop PNG for index=${item.index})`,
        });
        userContent.push(pngToDataUrlPart(buf));
      } catch (err) {
        console.warn(
          `  … AI sections: could not read PNG for index=${item.index}: ${err instanceof Error ? err.message : err}`,
        );
      }
    } else {
      console.warn(`  … AI sections: no desktop PNG for index=${item.index} (${item.sourceFolder}); HTML-only`);
    }

    const ist = item.interactionState;
    if (ist && (ist.statePng || ist.openHtml)) {
      userContent.push({
        type: 'text',
        text: [
          `OPEN-STATE (deepest captured) index=${item.index}:`,
          JSON.stringify(
            { slug: ist.slug, kind: ist.kind, depth: ist.depth, label: ist.label },
            null,
            2,
          ),
          ist.openHtml
            ? `\nOpen-state HTML excerpt:\n${truncate(ist.openHtml, MAX_OPEN_STATE_HTML_CHARS)}`
            : '',
        ]
          .filter(Boolean)
          .join('\n'),
      });
      if (ist.statePng) {
        try {
          const buf = await readFile(ist.statePng);
          userContent.push({
            type: 'text',
            text: `(open-state desktop PNG slug=${ist.slug} for index=${item.index})`,
          });
          userContent.push(pngToDataUrlPart(buf));
        } catch (err) {
          console.warn(
            `  … AI sections: could not read open-state PNG for index=${item.index}: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    }
  }

  const result = await azureChatCompletion({
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: userContent },
    ],
    responseFormat: { type: 'json_object' },
    timeoutMs: 300000,
  });

  const callUsage = {
    promptTokens: result.usage?.promptTokens || 0,
    completionTokens: result.usage?.completionTokens || 0,
    totalTokens: result.usage?.totalTokens || 0,
    costUsd: result.costEstimate?.totalUsd || 0,
  };

  usageAcc.calls += 1;
  if (result.model) usageAcc.model = result.model;
  usageAcc.promptTokens += callUsage.promptTokens;
  usageAcc.completionTokens += callUsage.completionTokens;
  usageAcc.totalTokens += callUsage.totalTokens;
  usageAcc.costUsd += callUsage.costUsd;

  if (!result.ok) {
    return { ok: false, skipReason: result.skipReason || 'azure failed', callUsage };
  }

  try {
    const sections = parseSectionsJson(result.content);
    return { ok: true, sections, model: result.model, callUsage };
  } catch (err) {
    return {
      ok: false,
      skipReason: `JSON parse: ${err instanceof Error ? err.message : err}`,
      callUsage,
    };
  }
}

function chunkBatch(items, budget) {
  /** @type {typeof items[]} */
  const batches = [];
  let current = [];
  let used = 0;
  for (const item of items) {
    const size = Math.min(item.html.length, MAX_HTML_CHARS) + 2048;
    if (
      current.length &&
      (current.length >= MAX_SECTIONS_PER_BATCH || used + size > budget)
    ) {
      batches.push(current);
      current = [];
      used = 0;
    }
    current.push(item);
    used += size;
  }
  if (current.length) batches.push(current);
  return batches;
}

function rewriteOutputs(outputs, folderName) {
  if (!outputs || typeof outputs !== 'object') return outputs;
  /** @type {Record<string, object|null>} */
  const next = {};
  for (const [device, entry] of Object.entries(outputs)) {
    if (!entry || typeof entry !== 'object') {
      next[device] = entry;
      continue;
    }
    const e = { ...entry };
    if (typeof e.path === 'string') {
      e.path = e.path.replace(/^ai-sections\//, 'sections/');
      // Normalize legacy purpose-named prefixes to positional folder
      e.path = e.path.replace(
        new RegExp(`sections/${folderName}/[^/]+-(${device}\\.png)$`),
        `sections/${folderName}/${folderName}-$1`,
      );
    }
    next[device] = e;
  }
  return next;
}

function rewritePathString(p, folderName) {
  if (typeof p !== 'string') return p;
  return p.replace(/^ai-sections\//, 'sections/');
}

/**
 * Preserve capture interactionStates tree. Optionally merge AI-improved labels/kind.
 */
function mergeInteractionStates(captured, aiStates, folderName) {
  const list = Array.isArray(captured) ? captured : [];
  if (!list.length) return undefined;
  const aiBySlug = new Map();
  if (Array.isArray(aiStates)) {
    for (const s of aiStates) {
      if (s && s.slug) aiBySlug.set(s.slug, s);
    }
  }
  return list.map((state) => {
    const ai = aiBySlug.get(state.slug) || {};
    return {
      ...state,
      label: typeof ai.label === 'string' && ai.label.trim() ? ai.label.trim() : state.label,
      kind: typeof ai.kind === 'string' && ai.kind.trim() ? ai.kind.trim() : state.kind,
      sectionHtml: rewritePathString(state.sectionHtml, folderName),
      panel: state.panel
        ? {
            ...state.panel,
            htmlPath: rewritePathString(state.panel.htmlPath, folderName),
          }
        : state.panel,
      outputs: rewriteOutputs(state.outputs, folderName),
      path: state.path,
      parentSlug: state.parentSlug,
      children: state.children,
      slug: state.slug,
      depth: state.depth,
      trigger: state.trigger,
    };
  });
}

/**
 * True when this slot already has AI enrichment for the same section HTML hash.
 * @param {{ info: object, html: string }} item
 * @param {boolean} forceSections
 */
function slotAiAlreadyCurrent(item, forceSections) {
  if (forceSections) return false;
  const info = item.info || {};
  const hash = info.contentHash || slotContentHash(item.html);
  if (!hash) return false;
  if (slotContentHash(item.html) !== hash) return false;
  const enriched =
    Boolean(info.purpose) ||
    Boolean(info.description) ||
    (Array.isArray(info.suggestedFields) && info.suggestedFields.length > 0) ||
    String(info.matchStatus || '').includes('ai');
  return enriched;
}

/**
 * @param {{ pageDir: string, url: string, force?: boolean|object|null }} opts
 */
export async function buildAiDecidePageSections(opts) {
  const { pageDir, url, force = null } = opts;
  const pageSlug = path.basename(pageDir);
  const sectionsRoot = pageSectionsDir(pageDir);

  const usageAcc = {
    calls: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    model: null,
  };

  const items = await collectProgrammaticSections(pageDir);
  if (!items.length) {
    console.log('  … AI sections skipped: no sections/ folders');
    return { ok: false, skipReason: 'no sections', usage: usageAcc };
  }

  let designExcerpt = '';
  const designPath = path.join(pageDir, AI_DERIVED_DESIGN_MD);
  if (await pathExists(designPath)) {
    try {
      designExcerpt = truncate(await readFile(designPath, 'utf8'), MAX_DESIGN_EXCERPT);
    } catch {
      designExcerpt = '';
    }
  } else {
    console.log(`  … AI sections: no ${AI_DERIVED_DESIGN_MD} (continuing without design context)`);
  }

  const sourceHash = sourceHashForSections(items, designExcerpt);
  const forceSections = shouldForce(force, 'sections');

  if (!forceSections) {
    const prior = await getAiUsageEntry(sectionsRoot, SECTIONS_ENRICH_PURPOSE);
    if (prior?.context?.sourceHash === sourceHash) {
      console.log(`  ✓ sections/ AI enrich (unchanged sourceHash)`);
      return {
        ok: true,
        skipped: true,
        skipReason: 'sourceHash match',
        usage: usageAcc,
        sectionsRoot,
      };
    }
  }

  const needAi = [];
  let skippedSlots = 0;
  for (const item of items) {
    if (slotAiAlreadyCurrent(item, forceSections)) {
      skippedSlots += 1;
      continue;
    }
    needAi.push(item);
  }

  async function writeSectionsEnrichMeta(fields) {
    await writeAiUsageMeta(sectionsRoot, {
      purpose: SECTIONS_ENRICH_PURPOSE,
      model: fields.model ?? null,
      ok: true,
      usage: null,
      costEstimate: null,
      aggregates: {
        calls: fields.calls ?? 0,
        promptTokens: fields.promptTokens ?? 0,
        completionTokens: fields.completionTokens ?? 0,
        totalTokens: fields.totalTokens ?? 0,
        costEstimateUsd: fields.costEstimateUsd ?? null,
      },
      context: {
        sourceHash,
        url: url || null,
        pageSlug,
        sectionCount: fields.sectionCount ?? 0,
        inputSectionCount: items.length,
        skippedUnchangedSlots: fields.skippedUnchangedSlots ?? skippedSlots,
        strippedSharedPrefix: fields.strippedSharedPrefix ?? null,
        banHints: fields.banHints ?? [],
      },
    });
    await unlink(path.join(sectionsRoot, LEGACY_USE_AI_META)).catch(() => {});
  }

  if (!needAi.length) {
    console.log(
      `  ✓ sections/ AI enrich (all ${items.length} slot(s) unchanged contentHash; skipped Azure)`,
    );
    await writeSectionsEnrichMeta({
      model: null,
      sectionCount: 0,
      skippedUnchangedSlots: skippedSlots,
      calls: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      costEstimateUsd: null,
      strippedSharedPrefix: null,
      banHints: [],
    });
    return {
      ok: true,
      skipped: true,
      skipReason: 'all slots contentHash unchanged',
      usage: usageAcc,
      sectionCount: 0,
      sectionsRoot,
    };
  }

  const config = resolveAzureChatConfig();
  if (!config.ok) {
    console.warn(`  … AI sections skipped: ${config.skipReason}`);
    return { ok: false, skipReason: config.skipReason, usage: usageAcc };
  }

  console.log(
    `  … AI sections: enriching ${needAi.length}/${items.length} section(s) in place` +
      (skippedSlots ? ` (${skippedSlots} unchanged contentHash skipped)` : '') +
      ` → sections/`,
  );

  const banHints = banHintsFromUrl(url);
  const batches = chunkBatch(needAi, resolveBatchCharBudget());
  /** @type {Map<number, object>} */
  const byIndex = new Map();

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`  … AI sections batch ${i + 1}/${batches.length} (${batch.length} section(s))`);
    const res = await askAzureForBatch({
      batch,
      pageUrl: url,
      designExcerpt,
      banHints,
      usageAcc,
    });
    console.log(
      `  … AI sections batch ${i + 1}/${batches.length}: model=${usageAcc.model || '?'} in=${usageAcc.promptTokens} out=${usageAcc.completionTokens} total=${usageAcc.totalTokens} ${formatCostUsd(usageAcc.costUsd)}`,
    );

    if (!res.ok) {
      console.warn(`  … AI sections batch failed: ${res.skipReason}`);
      continue;
    }
    for (const s of res.sections) {
      const idx = Number(s.index);
      if (Number.isFinite(idx)) byIndex.set(idx, s);
    }
  }

  const strippedPrefix = stripSharedPagePrefixes(byIndex, needAi);
  if (strippedPrefix) {
    console.log(
      `  … AI sections: stripped shared cmsName prefix "${strippedPrefix}" from majority of content sections`,
    );
  }

  // Write enriched JSON only — keep positional folderName (section-NN)
  let written = 0;
  for (const item of needAi) {
    const ai = byIndex.get(item.index) || {};
    const cmsName = String(ai.cmsName || item.info.cmsName || 'ContentBlock').trim() || 'ContentBlock';
    const alternativeNames = ensureFiveAlternatives(cmsName, ai.alternativeNames);
    const folderName = path.basename(item.sourceDir);
    const destDir = item.sourceDir;

    const suggestedFields = normalizeSuggestedFields(ai.suggestedFields || [], url);
    const repeats = normalizeRepeats(ai.repeats || [], suggestedFields, url);
    const interactionStates = mergeInteractionStates(
      item.info.interactionStates,
      ai.interactionStates,
      folderName,
    );
    const contentHash = item.info.contentHash || slotContentHash(item.html);
    const sectionJson = {
      ...item.info,
      index: item.index,
      cmsName,
      folderName,
      contentHash,
      alternativeNames,
      purpose: ai.purpose || null,
      description: ai.description || null,
      layout: ai.layout || null,
      repeats,
      composition: ai.composition || { strategy: 'single' },
      suggestedFields,
      provenance: {
        sourceIndex: item.index,
        sourceFolder: `sections/${folderName}`,
        sourceCmsName: item.info.cmsName || null,
        sourceFolderName: item.info.folderName || folderName,
        pageSlug,
        sourceUrl: url || null,
      },
      outputs: rewriteOutputs(item.info.outputs, folderName),
      sectionHtml: `sections/${folderName}/section.html`,
      ...(item.info.sectionStyledHtml
        ? {
            sectionStyledHtml: rewritePathString(item.info.sectionStyledHtml, folderName),
          }
        : {}),
      ...(item.info.sectionStyledByViewport
        ? {
            sectionStyledByViewport: Object.fromEntries(
              Object.entries(item.info.sectionStyledByViewport).map(([k, v]) => [
                k,
                rewritePathString(v, folderName),
              ]),
            ),
          }
        : {}),
      ...(interactionStates
        ? {
            interactionStates,
            interactionSummary: item.info.interactionSummary || null,
          }
        : {}),
      matchStatus: ai.matchStatus || item.info.matchStatus || 'ai-enriched',
      confidence: typeof ai.confidence === 'number' ? ai.confidence : item.info.confidence,
      reasons: Array.isArray(ai.reasons)
        ? ai.reasons
        : [
            'AI sections enrich',
            ...(strippedPrefix && ai._strippedPrefix
              ? [`stripped shared prefix ${strippedPrefix}`]
              : []),
            ...(item.info.reasons || []),
          ],
    };

    await writeFile(
      path.join(destDir, 'section-information.json'),
      `${JSON.stringify(sectionJson, null, 2)}\n`,
      'utf8',
    );
    written += 1;
  }

  // Drop leftover page ai-sections/ if present from older runs
  await rm(path.join(pageDir, 'ai-sections'), { recursive: true, force: true }).catch(() => {});

  // Drop any leftover temp rename dirs from older AI runs
  try {
    const entries = await readdir(sectionsRoot, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.isDirectory() && ent.name.startsWith('__ai-tmp-')) {
        await rm(path.join(sectionsRoot, ent.name), { recursive: true, force: true }).catch(
          () => {},
        );
      }
    }
  } catch {
    /* ignore */
  }

  console.log(
    `  ✓ AI sections: sections=${written} skipped=${skippedSlots} calls=${usageAcc.calls} in=${usageAcc.promptTokens} out=${usageAcc.completionTokens} total=${usageAcc.totalTokens} ${formatCostUsd(usageAcc.costUsd)} → sections/`,
  );

  await writeSectionsEnrichMeta({
    model: usageAcc.model,
    sectionCount: written,
    skippedUnchangedSlots: skippedSlots,
    calls: usageAcc.calls,
    promptTokens: usageAcc.promptTokens,
    completionTokens: usageAcc.completionTokens,
    totalTokens: usageAcc.totalTokens,
    costEstimateUsd: usageAcc.costUsd > 0 ? Math.round(usageAcc.costUsd * 1e6) / 1e6 : null,
    strippedSharedPrefix: strippedPrefix || null,
    banHints: banHints.slice(0, 40),
  });

  return {
    ok: true,
    usage: usageAcc,
    sectionCount: written,
    sectionsRoot,
  };
}
