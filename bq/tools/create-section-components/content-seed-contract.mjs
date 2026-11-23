/**
 * Exact Title / Link seed contracts for codegen prompts + validate-loop detect.
 * Built from section-information repeats / suggestedFields so the model emits
 * correct seeds without relying on post-AI salvage.
 */
import {
  captureGroupTitlesFromRepeats,
  collectOrderedActionLinksFromSectionInfo,
  normalizeCaptureGroupHeading,
} from './ai-source-fixup.mjs';

/**
 * @param {string} s
 */
function normalizeLabel(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Sibling suffixes that mark a *Title suggestedField as band-scoped (not parent chrome). */
const BAND_SCOPED_TITLE_SIBLINGS = [
  'Text',
  'Body',
  'Image',
  'Cta',
  'CTA',
  'CallToAction',
  'Copy',
];

/**
 * Collect child package / allowedControl name hints from a codegen plan.
 * @param {object|null|undefined} plan
 * @returns {string[]}
 */
export function collectPlanChildNameHints(plan) {
  if (!plan || typeof plan !== 'object') return [];
  /** @type {string[]} */
  const out = [];
  const push = (v) => {
    const s = String(v || '').trim();
    if (s) out.push(s);
  };
  const walkNode = (node) => {
    if (!node) return;
    if (typeof node === 'string') {
      push(node);
      return;
    }
    if (typeof node !== 'object') return;
    const rec = /** @type {Record<string, unknown>} */ (node);
    push(rec.componentName);
    push(rec.definitionKey);
    push(rec.name);
    push(rec.cmsName);
    if (Array.isArray(rec.allowedControls)) {
      for (const c of rec.allowedControls) push(c);
    }
    if (Array.isArray(rec.children)) {
      for (const c of rec.children) walkNode(c);
    }
    if (Array.isArray(rec.placeholders)) {
      for (const ph of rec.placeholders) walkNode(ph);
    }
  };
  walkNode(plan);
  walkNode(/** @type {{ section?: unknown }} */ (plan).section);
  walkNode(/** @type {{ components?: unknown }} */ (plan).components);
  if (Array.isArray(/** @type {{ children?: unknown }} */ (plan).children)) {
    for (const c of /** @type {unknown[]} */ (
      /** @type {{ children?: unknown }} */ (plan).children
    )) {
      walkNode(c);
    }
  }
  return [...new Set(out)];
}

/**
 * True when the plan has a feature-band child that should own *Title/*Image chrome
 * (ProximityFeature, HeroFeature, …). Card/teaser/promo-only plans return false.
 *
 * @param {object|null|undefined} plan
 * @param {{ prefix?: string, ownerHint?: string } | null} [band]
 * @returns {boolean}
 */
export function planHasMatchingFeatureChild(plan, band = null) {
  const hints = collectPlanChildNameHints(plan);
  if (!hints.length) return false;
  const prefix = String(band?.prefix || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const ownerHint = String(band?.ownerHint || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  for (const raw of hints) {
    const compact = String(raw)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    // Promo/card/teaser/logo leaves are never the feature-band owner.
    if (
      /(?:promo|promotional|card|teaser|badge|logo|slide|story|tile)(?:s)?$/.test(
        compact,
      ) &&
      !/feature/.test(compact)
    ) {
      continue;
    }
    if (ownerHint && compact.includes(ownerHint)) return true;
    if (prefix && compact.includes(`${prefix}feature`)) return true;
    if (
      /proximityfeature|herofeature|bannerfeature|featureband/.test(compact)
    ) {
      return true;
    }
    // e.g. SitecoreFeatureSplit / CrelanFeature — not NavigationCard
    if (
      /feature$/.test(compact) &&
      !/(?:card|promo|teaser|badge|logo|nav|menu|link|column)/.test(compact)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Detect suggestedFields that own a feature-band heading (map|copy+CTA), not
 * parent section chrome. e.g. proximityTitle + proximityText/Image/Cta.
 *
 * When `opts.plan` is provided, only returns a hit if the plan has a matching
 * feature child (ProximityFeature / *Feature). Card-only plans (promotional-card)
 * keep heroTitle/heroImage on the parent — never invent a HeroFeature owner.
 *
 * @param {Record<string, unknown>|null|undefined} info
 * @param {{ plan?: object|null }} [opts]
 * @returns {{ fieldName: string, prefix: string, value: string, ownerHint: string } | null}
 */
export function detectBandScopedFeatureHeading(info, opts = {}) {
  if (!info || typeof info !== 'object') return null;
  const fields = Array.isArray(
    /** @type {{ suggestedFields?: unknown }} */ (info).suggestedFields,
  )
    ? /** @type {unknown[]} */ (
        /** @type {{ suggestedFields?: unknown }} */ (info).suggestedFields
      )
    : [];
  if (!fields.length) return null;

  /** @type {Map<string, { name: string, value: string }>} */
  const byLower = new Map();
  for (const raw of fields) {
    if (!raw || typeof raw !== 'object') continue;
    const rec = /** @type {Record<string, unknown>} */ (raw);
    const name = String(rec.name || '').trim();
    if (!name) continue;
    const value =
      typeof rec.value === 'string'
        ? rec.value.trim()
        : rec.value != null && typeof rec.value !== 'object'
          ? String(rec.value).trim()
          : '';
    byLower.set(name.toLowerCase(), { name, value });
  }

  /**
   * @param {string} fieldName
   * @param {string} prefix
   * @param {string} value
   */
  const toHit = (fieldName, prefix, value) => {
    const ownerHint =
      prefix.toLowerCase() === 'proximity'
        ? 'ProximityFeature'
        : `${prefix.charAt(0).toUpperCase()}${prefix.slice(1)}Feature`;
    return { fieldName, prefix, value, ownerHint };
  };

  /** @type {{ fieldName: string, prefix: string, value: string, ownerHint: string } | null} */
  let hit = null;

  for (const [lower, entry] of byLower) {
    const known = lower.match(/^(proximity|feature|hero|banner)title$/);
    if (known) {
      hit = toHit(entry.name, known[1], entry.value);
      break;
    }
  }

  if (!hit) {
    for (const [lower, entry] of byLower) {
      const m = lower.match(/^(.+)title$/);
      if (!m || m[1].length < 2) continue;
      const prefix = m[1];
      const hasSibling = BAND_SCOPED_TITLE_SIBLINGS.some((suf) =>
        byLower.has(`${prefix}${suf.toLowerCase()}`),
      );
      if (!hasSibling) continue;
      // Prefer original casing from the Title field name minus "Title"
      const prefixDisplay = entry.name.replace(/Title$/i, '') || prefix;
      hit = toHit(entry.name, prefixDisplay, entry.value);
      break;
    }
  }

  if (!hit) return null;

  // When a plan is supplied, only hand off to a feature child that actually exists.
  if (Object.prototype.hasOwnProperty.call(opts, 'plan')) {
    if (!planHasMatchingFeatureChild(opts.plan, hit)) return null;
  }

  return hit;
}

/**
 * Raw *Title suggestedField hit without plan gating (for parent-chrome messaging).
 * @param {Record<string, unknown>|null|undefined} info
 * @returns {{ fieldName: string, prefix: string, value: string, ownerHint: string } | null}
 */
function detectBandScopedFeatureHeadingRaw(info) {
  return detectBandScopedFeatureHeading(info);
}

/**
 * Prompt block: when does info.heading belong to parent chrome vs a feature child?
 *
 * @param {Record<string, unknown>|null|undefined} info
 * @param {{ role?: string|null, plan?: object|null }} [opts]
 * @returns {string}
 */
export function formatHeadingOwnershipForPrompt(info, opts = {}) {
  const role = String(opts.role || '').toLowerCase();
  const heading = normalizeCaptureGroupHeading(
    String(/** @type {{ heading?: unknown }} */ (info || {}).heading || ''),
  );
  const hasPlanOpt = Object.prototype.hasOwnProperty.call(opts, 'plan');
  const band = detectBandScopedFeatureHeading(
    info,
    hasPlanOpt ? { plan: opts.plan } : {},
  );
  /** @type {string[]} */
  const lines = [];

  if (band) {
    const bandVal = band.value || heading;
    lines.push(
      `HEADING OWNERSHIP (hard): suggestedFields.${band.fieldName}${
        bandVal ? ` ${JSON.stringify(bandVal)}` : ''
      } owns the feature-band H2 — seed/render it on the ${band.ownerHint} child (map|copy+CTA), NOT as parent chrome.`,
    );
    lines.push(
      'HARD: parent composite must NOT seed or render Heading for that string; mount a full-width feature AppPlaceholder only — never a parent flex-row shell with Heading in the other column (nested feature-split).',
    );
    if (heading && bandVal && normalizeLabel(heading) === normalizeLabel(bandVal)) {
      lines.push(
        `HARD: info.heading ${JSON.stringify(heading)} equals ${band.fieldName} — do NOT also put it on parent Heading.`,
      );
    }
    if (role === 'section' || role === 'parent') {
      lines.push(
        'You are the PARENT: leave feature-band Heading/Body/Image/CTA to the child package; parent chrome fields for that band = none.',
      );
    } else if (role === 'child') {
      lines.push(
        `You are the CHILD package (${band.ownerHint}): own the full two-column feature split (image | heading+body+CTA). Seed Heading from ${band.fieldName}.`,
      );
    }
    return lines.join('\n');
  }

  // Plan has only card/teaser leaves but suggestedFields still name heroTitle —
  // parent owns that chrome (do not invent a HeroFeature child).
  if (hasPlanOpt) {
    const raw = detectBandScopedFeatureHeadingRaw(info);
    if (raw && !planHasMatchingFeatureChild(opts.plan, raw)) {
      const bandVal = raw.value || heading;
      lines.push(
        `HEADING OWNERSHIP (hard): suggestedFields.${raw.fieldName}${
          bandVal ? ` ${JSON.stringify(bandVal)}` : ''
        } is PARENT chrome — plan children are card/teaser leaves only (no ${raw.ownerHint}). Seed/render Heading/Text/Image on the PARENT; do not invent a ${raw.ownerHint} child.`,
      );
      if (role === 'section' || role === 'parent') {
        lines.push(
          'You are the PARENT: own section-level hero/banner Title + Text + Image as chrome above the promotional-card placeholder; child packages seed only repeat card fields.',
        );
      } else if (role === 'child') {
        lines.push(
          `You are a CARD/TEASER child — do not seed Heading from ${raw.fieldName}; use REQUIRED TITLE rows / repeat values. Parent owns the section hero image.`,
        );
      }
      return lines.join('\n');
    }
  }

  if (!heading) return '';

  lines.push(
    `HARD: info.heading ${JSON.stringify(heading)} → parent Heading only when it sits above all placeholder bands (true section chrome) — NEVER copy onto child Title / displayName.`,
  );
  if (role === 'section' || role === 'parent') {
    lines.push(
      'You are the PARENT: use Heading from info.heading for chrome above bands. Child card Titles are seeded on child packages — not repeated as the parent Heading on every item.',
    );
  } else if (role === 'child') {
    lines.push(
      'You are the CHILD package: do not seed Title/displayName from info.heading; use REQUIRED TITLE rows / repeat values.',
    );
  }
  return lines.join('\n');
}

/**
 * Build numbered Title/displayName contract from capture repeats.
 * Empty string when no capture titles.
 *
 * @param {Record<string, unknown>|null|undefined} info
 * @param {{ role?: string|null, plan?: object|null }} [opts]
 * @returns {string}
 */
export function formatRequiredTitleSeedsForPrompt(info, opts = {}) {
  const titles = captureGroupTitlesFromRepeats(info);
  if (!titles.length) return '';
  const role = String(opts.role || '').toLowerCase();
  const lines = [
    `REQUIRED TITLE / displayName SEEDS (${titles.length}) — exact capture-language strings for each repeating card/group item (in order):`,
    ...titles.map((t, i) => `${i + 1}. ${JSON.stringify(t)}`),
    'HARD: each content.items[] (or child package seed) Title + displayName MUST match that index. Item `name` = English Title Case of the same meaning.',
  ];
  const hasPlanOpt = Object.prototype.hasOwnProperty.call(opts, 'plan');
  const band = detectBandScopedFeatureHeading(
    info,
    hasPlanOpt ? { plan: opts.plan } : {},
  );
  const heading = normalizeCaptureGroupHeading(
    String(/** @type {{ heading?: unknown }} */ (info || {}).heading || ''),
  );
  if (band) {
    lines.push(
      `HARD: do not copy ${band.fieldName} / info.heading onto repeating card Titles — see HEADING OWNERSHIP above for feature-child ownership.`,
    );
  } else if (heading) {
    lines.push(
      `HARD: info.heading ${JSON.stringify(heading)} → parent Heading only — NEVER copy onto child Title / displayName.`,
    );
  }
  if (role === 'child') {
    lines.push(
      'You are the CHILD package: seed one Title/displayName per REQUIRED TITLE row (or the subset for this card type). Do not collapse every item to the section heading.',
    );
  } else if (role === 'section' || role === 'parent') {
    if (!band) {
      lines.push(
        'You are the PARENT: use Heading from info.heading for chrome. Child card Titles are seeded on child packages (or nested children) — not repeated as the parent Heading on every item.',
      );
    } else {
      lines.push(
        'You are the PARENT: repeating card Titles come from REQUIRED TITLE rows; feature-band Heading is owned by the child (see HEADING OWNERSHIP) — not parent chrome beside the PH.',
      );
    }
  }
  return lines.join('\n');
}

/**
 * Parent seeded Heading that belongs to a band-scoped feature child.
 *
 * @param {{
 *   definitionTs?: string|null,
 *   sectionInfo?: Record<string, unknown>|null,
 *   role?: string|null,
 *   plan?: object|null,
 * }} opts
 * @returns {string[]} CONTRACT diagnostics (unprefixed; caller adds CONTRACT:)
 */
export function collectBandScopedHeadingOwnershipDiagnostics(opts = {}) {
  const role = String(opts.role || '').toLowerCase();
  if (role !== 'parent' && role !== 'section') return [];
  const def = String(opts.definitionTs || '');
  const info = opts.sectionInfo || null;
  if (!def.trim() || !info) return [];

  const hasPlanOpt = Object.prototype.hasOwnProperty.call(opts, 'plan');
  const band = detectBandScopedFeatureHeading(
    info,
    hasPlanOpt ? { plan: opts.plan } : {},
  );
  if (!band) return [];

  const heading = normalizeCaptureGroupHeading(
    String(/** @type {{ heading?: unknown }} */ (info).heading || ''),
  );
  const expected = normalizeLabel(band.value || heading);
  if (!expected) return [];

  /** @type {string[]} */
  const seededHeadings = [];
  for (const m of def.matchAll(/\bHeading\s*:\s*(["'])((?:\\.|(?!\1)[^\\])*)\1/g)) {
    seededHeadings.push(m[2]);
  }
  if (!seededHeadings.length) return [];

  const stolen = seededHeadings.filter((t) => normalizeLabel(t) === expected);
  if (!stolen.length) return [];

  return [
    `Parent seeds Heading ${JSON.stringify(stolen[0])} but suggestedFields.${band.fieldName} owns that feature-band title — omit parent Heading; ${band.ownerHint} child owns map|copy+CTA (no nested feature-split shell)`,
  ];
}

/**
 * Collect per-item Link/CTA seeds from repeats rows (links[] / link / cta) plus
 * ordered action links from suggestedFields.
 *
 * @param {Record<string, unknown>|null|undefined} info
 * @returns {Array<{ text: string, url: string, itemTitle?: string }>}
 */
export function collectRequiredLinkCtaSeeds(info) {
  /** @type {Array<{ text: string, url: string, itemTitle?: string }>} */
  const out = [];
  if (!info || typeof info !== 'object') return out;

  const repeats = Array.isArray(info.repeats) ? info.repeats : [];
  for (const rep of repeats) {
    if (!rep || typeof rep !== 'object') continue;
    const values = /** @type {{ value?: unknown }} */ (rep).value;
    if (!Array.isArray(values)) continue;
    for (const row of values) {
      if (!row || typeof row !== 'object') continue;
      const rec = /** @type {Record<string, unknown>} */ (row);
      const itemTitle = normalizeCaptureGroupHeading(
        String(rec.title || rec.heading || rec.name || ''),
      );
      /** @type {unknown[]} */
      const linkNodes = [];
      if (Array.isArray(rec.links)) linkNodes.push(...rec.links);
      if (rec.link && typeof rec.link === 'object') linkNodes.push(rec.link);
      if (rec.cta && typeof rec.cta === 'object') linkNodes.push(rec.cta);
      for (const ln of linkNodes) {
        if (!ln || typeof ln !== 'object') continue;
        const o = /** @type {Record<string, unknown>} */ (ln);
        const urlRaw = o.url ?? o.href;
        if (typeof urlRaw !== 'string' || !urlRaw.trim()) continue;
        if (/^(#|javascript:|void\()/i.test(urlRaw.trim())) continue;
        const text = o.text != null ? String(o.text).trim() : '';
        if (!text) continue;
        out.push({
          text,
          url: String(urlRaw).trim(),
          ...(itemTitle ? { itemTitle } : {}),
        });
      }
    }
  }

  for (const l of collectOrderedActionLinksFromSectionInfo(info)) {
    out.push({ text: l.text, url: l.url });
  }

  const seen = new Set();
  return out.filter((l) => {
    const key = `${normalizeLabel(l.text)}|${l.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Prompt block listing required Link/CTA {text,url} seeds.
 *
 * @param {Record<string, unknown>|null|undefined} info
 * @param {{ role?: string|null, maxLinks?: number }} [opts]
 * @returns {string}
 */
export function formatRequiredLinkCtaSeedsForPrompt(info, opts = {}) {
  const links = collectRequiredLinkCtaSeeds(info);
  if (!links.length) return '';
  const hasCap =
    opts.maxLinks != null &&
    Number.isFinite(Number(opts.maxLinks)) &&
    Number(opts.maxLinks) > 0;
  const maxLinks = hasCap ? Math.max(1, Number(opts.maxLinks)) : links.length;
  const listed = links.slice(0, maxLinks);
  const lines = [
    `REQUIRED LINK / CTA SEEDS (${links.length}) — each must appear as a General Link field seed { text, url } on the matching item (or section chrome for conversion CTAs):`,
    ...listed.map((l, i) => {
      const item = l.itemTitle ? ` [item: ${JSON.stringify(l.itemTitle)}]` : '';
      return `${i + 1}. text=${JSON.stringify(l.text)} url=${JSON.stringify(l.url)}${item}`;
    }),
    'HARD: do not omit these links from content.items[].fields — missing / empty / placeholder url: "/" seeds trigger CONTRACT validate retries (AI must fix; no post-AI inject).',
  ];
  if (links.length > maxLinks) {
    lines.push(`… and ${links.length - maxLinks} more in AUTHORITATIVE CONTENT SEEDS`);
  }
  return lines.join('\n');
}

/**
 * Detect Link/CTA seeds missing a real href (text-only, empty url, or url: "/").
 * Prefer section HTML / capture — AI validate retries must fill these (no salvage).
 *
 * @param {{ definitionTs?: string|null }} opts
 * @returns {string[]} CONTRACT diagnostics (unprefixed; caller adds CONTRACT:)
 */
export function collectLinkSeedContractDiagnostics(opts = {}) {
  const def = String(opts.definitionTs || '');
  if (!def.trim()) return [];

  /** @type {string[]} */
  const out = [];
  let textOnly = 0;
  let emptyUrl = 0;
  let slashUrl = 0;

  for (const _ of def.matchAll(
    /\b(?:Link|CTA)\s*:\s*\{\s*text\s*:\s*(["'])(?:\\.|(?!\1)[^\\])*\1\s*\}/g,
  )) {
    textOnly += 1;
  }
  for (const _ of def.matchAll(
    /\b(?:Link|CTA)\s*:\s*\{[^}]*?\burl\s*:\s*(["'])\1/g,
  )) {
    emptyUrl += 1;
  }
  for (const m of def.matchAll(/\b(?:Link|CTA)\s*:\s*\{([^}]*)\}/g)) {
    if (/\burl\s*:\s*(["'])\/\1/.test(m[1])) slashUrl += 1;
  }

  if (textOnly > 0) {
    out.push(
      `${textOnly} Link/CTA seed(s) have text but no url — add url from section HTML / capture hrefs (do not leave for post-processors)`,
    );
  }
  if (emptyUrl > 0) {
    out.push(
      `${emptyUrl} Link/CTA seed(s) have empty url: "" — fill from section HTML / capture hrefs`,
    );
  }
  if (slashUrl > 0) {
    out.push(
      `${slashUrl} Link/CTA seed(s) use placeholder url: "/" — replace with real capture hrefs from section HTML (never invent "/")`,
    );
  }
  return out;
}

/**
 * Detect collapsed / parent-copied Title seeds in definitionTs vs capture repeats.
 *
 * @param {{
 *   definitionTs?: string|null,
 *   sectionInfo?: Record<string, unknown>|null,
 *   role?: string|null,
 * }} opts
 * @returns {string[]} CONTRACT diagnostics (unprefixed; caller adds CONTRACT:)
 */
/**
 * Detect capture-language item `name` values and wrong content.culture=en.
 * @param {{ definitionTs?: string|null }} opts
 * @returns {string[]}
 */
export function collectEnglishItemNameAndCultureDiagnostics(opts = {}) {
  const def = String(opts.definitionTs || '');
  if (!def.trim()) return [];

  /** @type {string[]} */
  const out = [];

  const cultureMatch = def.match(
    /\bcontent\s*:\s*\{[\s\S]*?\bculture\s*:\s*["']([^"']+)["']/,
  );
  const culture = String(cultureMatch?.[1] || '')
    .trim()
    .toLowerCase();

  const nonAscii = /[àâäáéèêëïîíôóùûüúçœæñÀÂÄÁÉÈÊËÏÎÍÔÓÙÛÜÚÇŒÆÑ]/u;
  const captureLangNameRe =
    /\b(zoeken|contacteer|netwerk|particulieren|ondernemers|cooperanten|coöperanten|beleggen|lenen|sparen|betalen|verzekeren|ons\s+aanbod|directe\s+links|thema'?s|chercher|particuliers|reseau|réseau)\b/iu;
  // Sitecore item names: no path/wildcard punctuation (incl. apostrophe).
  const invalidSitecoreItemNameRe = /[/\\?%*:|"<>']/;

  /** @type {string[]} */
  const itemNames = [];
  for (const m of def.matchAll(/\bname\s*:\s*(["'])((?:\\.|(?!\1)[^\\])*)\1/g)) {
    const n = String(m[2] || '').trim();
    if (!n) continue;
    // Skip definitionKey-ish / package names (kebab / camel component ids)
    if (/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(n)) continue;
    if (/^(crelan|axa|dom|sitecore)/i.test(n) && /-/.test(n)) continue;
    itemNames.push(n);
  }

  const captureLangNames = itemNames.filter(
    (n) => nonAscii.test(n) || captureLangNameRe.test(n),
  );
  if (captureLangNames.length) {
    out.push(
      `HARD: content.items[].name must be English Title Case (path identity) — capture-language name(s): ${captureLangNames
        .slice(0, 8)
        .map((n) => JSON.stringify(n))
        .join(', ')}. Keep Title/Heading/displayName in content.culture.`,
    );
  }

  const invalidItemNames = itemNames.filter((n) =>
    invalidSitecoreItemNameRe.test(n),
  );
  if (invalidItemNames.length) {
    out.push(
      `HARD: content.items[].name must be a valid Sitecore item name (no / \\ ? % * : | " < > ') — invalid: ${invalidItemNames
        .slice(0, 8)
        .map((n) => JSON.stringify(n))
        .join(', ')}`,
    );
  }

  if (culture === 'en' || culture === 'en-us' || culture === 'en-gb') {
    const titleHits = [];
    for (const m of def.matchAll(
      /\bTitle\s*:\s*(["'])((?:\\.|(?!\1)[^\\])*)\1/g,
    )) {
      const t = String(m[2] || '').trim();
      if (t && (nonAscii.test(t) || captureLangNameRe.test(t))) titleHits.push(t);
    }
    // Also scan Multi-Line / free strings that look Dutch/French
    const blobSample = def.slice(0, 12000);
    if (
      titleHits.length >= 1 ||
      (captureLangNameRe.test(blobSample) &&
        /\b(Ik ben|Geef je|Contacteer|Ons aanbod|Particulieren)\b/.test(blobSample))
    ) {
      out.push(
        `content.culture is "${cultureMatch?.[1] || 'en'}" but seed copy looks non-English — set culture to the capture language (e.g. nl-BE / fr-BE). Wrong culture poisons Home path translation.`,
      );
    }
  }

  return out;
}

export function collectTitleSeedContractDiagnostics(opts = {}) {
  const def = String(opts.definitionTs || '');
  const info = opts.sectionInfo || null;
  if (!def.trim() || !info) return [];

  const captureTitles = captureGroupTitlesFromRepeats(info);
  if (!captureTitles.length) return [];

  const heading = normalizeCaptureGroupHeading(
    String(/** @type {{ heading?: unknown }} */ (info).heading || ''),
  );
  const headingNorm = normalizeLabel(heading);
  const captureNorms = new Set(captureTitles.map((t) => normalizeLabel(t)));

  /** @type {string[]} */
  const seededTitles = [];
  for (const m of def.matchAll(/\bTitle\s*:\s*(["'])((?:\\.|(?!\1)[^\\])*)\1/g)) {
    seededTitles.push(m[2]);
  }
  if (!seededTitles.length) return [];

  const collapsed = seededTitles.filter((t) => {
    const n = normalizeLabel(t);
    if (!n) return true;
    if (headingNorm && n === headingNorm) return true;
    if (/^(title|heading|connect|label|untitled)$/i.test(n)) return true;
    return false;
  });

  /** @type {string[]} */
  const out = [];
  if (collapsed.length >= Math.min(2, captureTitles.length)) {
    out.push(
      `Child/group Title seeds look collapsed or copied from section Heading (${collapsed.length} hit(s)). REQUIRED titles: ${captureTitles
        .slice(0, 12)
        .map((t) => JSON.stringify(t))
        .join(', ')}`,
    );
  }

  // When role is child and we have enough seed slots, flag if none match capture
  const role = String(opts.role || '').toLowerCase();
  if (role === 'child' && seededTitles.length >= 2) {
    const anyMatch = seededTitles.some((t) =>
      captureNorms.has(normalizeLabel(t)),
    );
    if (!anyMatch && captureTitles.length) {
      out.push(
        `No Title seed matches capture repeats. Use exact strings: ${captureTitles
          .slice(0, 8)
          .map((t) => JSON.stringify(t))
          .join(', ')}`,
      );
    }
  }

  return out;
}
