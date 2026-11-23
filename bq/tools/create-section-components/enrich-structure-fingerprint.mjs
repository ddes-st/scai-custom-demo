/**
 * Enrich-driven structure fingerprint for registry reuse gates.
 * Distinct from HTML skeleton fingerprints in capture/lib/structure-fingerprint.mjs:
 * this captures layout.pattern, chrome role, and enrich repeat roles so a wrong
 * first plan cannot permanently skip AI when enrich describes a different structure.
 */
import { createHash } from 'node:crypto';

/**
 * Desktop scrollBehavior block from section-information (if present).
 * @param {object|null|undefined} info
 */
function desktopScrollBehavior(info) {
  return info?.scrollBehavior?.desktop || info?.scrollBehavior || {};
}

/**
 * Sticky/fixed chrome pinned to the top of the viewport.
 * @param {object|null|undefined} info
 */
export function isStickyTopChrome(info) {
  const sb = desktopScrollBehavior(info);
  const pos = String(sb.cssPosition || '').toLowerCase();
  const pinned = String(sb.pinnedEdge || '').toLowerCase();
  // Measured bottom pin (cookie bars) is never top chrome — even with stickyTopPx.
  if (pinned === 'bottom') return false;
  if (pinned === 'top') return true;
  if (!(sb.sticky || pos === 'fixed' || pos === 'sticky')) return false;
  if (sb.visibleAtTop === true) return true;
  if (sb.stickyTopPx != null && Number.isFinite(Number(sb.stickyTopPx))) return true;
  return false;
}

/**
 * Infer chrome / page role from section-information (no AI).
 * Prefer position / layout signals over cmsName string matching so mid-page
 * "Footer CTA" bands stay `page` while stacked-footer / sticky top become partials.
 * @param {object|null|undefined} info
 * @returns {string}
 */
export function inferEnrichPageRole(info) {
  const wiring = info?.pageWiring?.role || info?.role;
  if (wiring) return String(wiring);

  const track = String(info?.track || '').toLowerCase();
  const pattern = String(info?.layout?.pattern || info?.layout?.type || '')
    .trim()
    .toLowerCase();
  const names = [
    info?.cmsName,
    info?.folderName,
    ...(Array.isArray(info?.alternativeNames) ? info.alternativeNames : []),
  ]
    .map((x) => String(x || '').toLowerCase())
    .join(' ');
  const purpose = String(info?.purpose || info?.description || '').toLowerCase();
  const reasons = Array.isArray(info?.reasons)
    ? info.reasons.map((r) => String(r || '').toLowerCase()).join(' ')
    : '';
  const blob = `${names} ${purpose} ${reasons}`;

  const chromeKind = String(info?.chromeKind || '').toLowerCase();
  const isFloatOverlay =
    chromeKind === 'float-overlay' ||
    (info?.isOverlay === true && track === 'overlay') ||
    (track === 'overlay' && chromeKind !== 'header-stack');

  // Cookie partial retired — float CMP/consent stays page (or header band via catalogue).
  if (pattern === 'stacked-footer' || /^stacked-footer\b/.test(pattern)) {
    return 'partial-footer';
  }

  const stickyTop = isStickyTopChrome(info);
  const index = Number(info?.index);
  const earlyBand = Number.isFinite(index) && index > 0 && index <= 4;

  // Heroes / media / promo bands stay on the page body even when sticky or early.
  const bodyMarketing =
    /\b(hero|video.?feature|video.?hero|media.?slider|media.?section|technology.?hero|platform.?hero|ai.?assisted|callout|demo.?callout|conversion.?banner|capability.?card|card.?grid|awards.?carousel|logo.?carousel|event.?carousel|case.?study|analyst.?report)\b/.test(
      blob,
    ) &&
    !/\b(main.?nav|site.?header|announcement|notification.?bar|cookie|consent|gdpr|osano|cmp)\b/.test(
      blob,
    );
  // Sticky header stack (capture track:header) or sticky/fixed top chrome.
  // Never promote marketing body bands (hero / media / callout) to partial-header.
  // Never treat true float overlays (cookie) as partial-header.
  if (track === 'header' || chromeKind === 'header-stack') {
    if (!bodyMarketing && !(/cookie|consent|gdpr|privacy|osano|cmp/.test(blob) && isFloatOverlay)) {
      return 'partial-header';
    }
  }
  if (
    stickyTop &&
    !bodyMarketing &&
    !isFloatOverlay &&
    (earlyBand ||
      track === 'overlay' ||
      /site header|main nav|announcement|notification|top.?bar/.test(purpose))
  ) {
    return 'partial-header';
  }

  // Strong purpose for site-wide footer bands without stacked-footer pattern yet.
  if (
    /signpost.?module|legal.?footer|navigation columns|social links/.test(purpose) &&
    /footer|signpost|legal|social/.test(blob)
  ) {
    return 'partial-footer';
  }

  return 'page';
}

/**
 * @param {object|null|undefined} info
 * @returns {string[]}
 */
export function enrichRepeatRoleKeys(info) {
  const repeats = Array.isArray(info?.repeats) ? info.repeats : [];
  return repeats
    .map((r) => {
      const name = String(r?.name || r?.itemName || '').trim();
      if (!name) return '';
      const count = Number(r?.count);
      return Number.isFinite(count) && count > 0 ? `${name}:${count}` : name;
    })
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

/** Parent-shell-only repeat names ignored for registry fingerprint equality. */
const FINGERPRINT_SHELL_REPEAT_NOISE =
  /^(PrimaryActions|SecondaryActions|ConversionActions|CtaButtons|PrimaryCtas)$/i;

/**
 * Collapse composite pattern suffix noise so registry-shared sections match
 * (e.g. stacked-footer-with-signposts-and-columns → stacked-footer).
 * @param {string} pattern
 */
export function normalizeLayoutPatternStem(pattern) {
  const p = String(pattern || '')
    .trim()
    .toLowerCase();
  if (!p || p === '(none)') return p || '(none)';
  if (/^stacked-footer\b/.test(p)) return 'stacked-footer';
  // Generic: drop -with-… suffixes that do not change child roles
  if (/-with-/.test(p)) return p.replace(/-with-.*$/, '') || p;
  return p;
}

/**
 * Collapse site-header enrich pattern synonyms so partial-header twins merge
 * (e.g. brand-row vs horizontal-brand-navigation vs responsive-header).
 * Mid-page nav grids stay distinct.
 * @param {string} pattern
 * @returns {string}
 */
export function normalizePartialHeaderPatternFamily(pattern) {
  const stem = normalizeLayoutPatternStem(pattern);
  if (
    /responsive-header|brand-row|horizontal-brand|mega.?menu|mega.?nav|main.?header|header-stack|site-header/.test(
      stem,
    )
  ) {
    return 'site-header';
  }
  return stem;
}

/**
 * Collapse consent/CMP modal enrich pattern synonyms so cross-page twins merge
 * (e.g. modal-overlay vs modal-dialog for the same cookie wall).
 * @param {string} pattern
 */
export function normalizeConsentModalPatternFamily(pattern) {
  const stem = normalizeLayoutPatternStem(pattern);
  if (
    /^(modal-overlay|modal-dialog|cookie-modal|consent-modal|cmp-modal|cookie-banner|consent-banner)$/.test(
      stem,
    ) ||
    /^(modal|cookie|consent|cmp)[-_]?(overlay|dialog|banner|wall|modal)?$/.test(stem)
  ) {
    return 'consent-modal';
  }
  return stem;
}

/**
 * Repeat role names (no counts) for fingerprint — ignores shell-only CTA noise.
 * @param {object|null|undefined} info
 * @returns {string[]}
 */
export function enrichRepeatRoleKeysForFingerprint(info) {
  const repeats = Array.isArray(info?.repeats) ? info.repeats : [];
  return [
    ...new Set(
      repeats
        .map((r) => String(r?.name || r?.itemName || '').trim())
        .filter(
          (name) => name && !FINGERPRINT_SHELL_REPEAT_NOISE.test(name),
        ),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

/**
 * Screenshot basename used as provenance (rejects registry plans pointing at another section's crops).
 * @param {object|null|undefined} info
 * @returns {string|null}
 */
export function enrichScreenshotIdentity(info) {
  const desktop =
    info?.outputs?.desktop?.path ||
    info?.assets?.screenshots?.desktop ||
    null;
  if (!desktop) return null;
  const base = String(desktop).replace(/\\/g, '/').split('/').pop();
  return base || null;
}

/**
 * Stable payload used for hashing / comparison (also stored on registry entries).
 * @param {object|null|undefined} info
 * @returns {{
 *   layoutPattern: string,
 *   pageRole: string,
 *   repeatRoles: string[],
 *   screenshotIdentity: string|null,
 * }}
 */
export function buildEnrichStructurePayload(info) {
  const rawPattern = String(info?.layout?.pattern || info?.layout?.type || '')
    .trim()
    .toLowerCase();
  const layoutPattern = normalizeLayoutPatternStem(rawPattern);
  const motionKind = String(info?.layout?.motion?.kind || '')
    .trim()
    .toLowerCase();
  const repeats = Array.isArray(info?.repeats) ? info.repeats : [];
  const inventoryRepeatMax = Math.max(
    0,
    ...repeats.map((r) => Number(r?.count) || 0),
  );
  const pageRole = inferEnrichPageRole(info);
  // Fingerprint uses role names without counts; shell CTA repeats ignored for
  // partial-footer so home/platform stacked footers share one registry skip.
  const repeatRoles =
    pageRole === 'partial-footer' || /^stacked-footer\b/.test(rawPattern)
      ? enrichRepeatRoleKeysForFingerprint(info)
      : enrichRepeatRoleKeys(info);
  return {
    layoutPattern: layoutPattern || '(none)',
    motionKind: motionKind || 'none',
    pageRole,
    repeatRoles,
    /** Distinct logo-rail inventories (e.g. awards:15 vs logos:22) must not share one fingerprint. */
    inventoryRepeatMax:
      pageRole === 'partial-footer' ? 0 : inventoryRepeatMax,
    screenshotIdentity: enrichScreenshotIdentity(info),
  };
}

/**
 * @param {object|null|undefined} info
 * @returns {{ payload: object, fingerprint: string }}
 */
export function computeEnrichStructureFingerprint(info) {
  const payload = buildEnrichStructurePayload(info);
  const canonical = JSON.stringify(payload);
  const fingerprint = createHash('sha256').update(canonical, 'utf8').digest('hex').slice(0, 16);
  return { payload, fingerprint };
}

/**
 * Layout / chrome roles that must not share one registry folder.
 * stacked-footer partial-footer vs mid-page CTA "footer" naming.
 * @param {object|null|undefined} incoming — section-information or stored payload
 * @param {object|null|undefined} existing — registry entry or stored payload
 * @returns {{ ok: boolean, reason?: string }}
 */
export function layoutRolesCompatible(incoming, existing) {
  if (!incoming || !existing) return { ok: true };

  const a = incoming.layoutPattern
    ? incoming
    : buildEnrichStructurePayload(incoming);
  const b = existing.layoutPattern
    ? existing
    : buildEnrichStructurePayload(existing);

  const aRole = String(a.pageRole || '').toLowerCase();
  const bRole = String(b.pageRole || '').toLowerCase();

  const aPat = normalizeLayoutPatternStem(a.layoutPattern);
  const bPat = normalizeLayoutPatternStem(b.layoutPattern);
  // Distinct pattern stems (after stacked-footer* / *-with-* normalize) must not
  // share a registry folder or skip gate — e.g. mega-menu header vs mid-page nav grid.
  // Exceptions: partial-header synonym families; consent modal-overlay ≈ modal-dialog.
  const bothPartialHeader =
    aRole === 'partial-header' && bRole === 'partial-header';
  const aConsent = normalizeConsentModalPatternFamily(a.layoutPattern || aPat);
  const bConsent = normalizeConsentModalPatternFamily(b.layoutPattern || bPat);
  const bothConsentModal =
    aConsent === 'consent-modal' && bConsent === 'consent-modal';
  const aFam = bothPartialHeader
    ? normalizePartialHeaderPatternFamily(a.layoutPattern || aPat)
    : bothConsentModal
      ? 'consent-modal'
      : aPat;
  const bFam = bothPartialHeader
    ? normalizePartialHeaderPatternFamily(b.layoutPattern || bPat)
    : bothConsentModal
      ? 'consent-modal'
      : bPat;
  if (aFam && bFam && aFam !== '(none)' && bFam !== '(none)' && aFam !== bFam) {
    return {
      ok: false,
      reason: `layout.pattern mismatch (${aPat} vs ${bPat})`,
    };
  }

  if (aRole && bRole && aRole !== bRole) {
    // partial-footer vs page (mid-page CTA band wrongly named Footer) must not collapse.
    // partial-header / partial-cookie vs page is OK — registry often unifies multiple
    // header HTML slices into one folder (e.g. sticky bar + values nav).
    if (
      (aRole === 'partial-footer' && bRole !== 'partial-footer') ||
      (bRole === 'partial-footer' && aRole !== 'partial-footer')
    ) {
      return { ok: false, reason: `pageRole mismatch (${aRole} vs ${bRole})` };
    }
  }

  return { ok: true };
}

/**
 * Compare live enrich fingerprint to a stored registry fingerprint/payload.
 * Missing stored fingerprint → mismatch (force re-decompose; never trust blind package reuse).
 * @param {object|null|undefined} info — current section-information
 * @param {{ enrichStructureFingerprint?: string, enrichStructurePayload?: object }|null|undefined} stored
 * @returns {{ match: boolean, reason: string, live: { payload: object, fingerprint: string } }}
 */
export function enrichStructureFingerprintsMatch(info, stored) {
  const live = computeEnrichStructureFingerprint(info);
  if (!stored?.enrichStructureFingerprint && !stored?.enrichStructurePayload) {
    return {
      match: false,
      reason: 'no registry enrich fingerprint yet',
      live,
    };
  }

  const roleCheck = layoutRolesCompatible(
    live.payload,
    stored.enrichStructurePayload || stored,
  );
  if (!roleCheck.ok) {
    return { match: false, reason: roleCheck.reason || 'layout role mismatch', live };
  }

  if (
    stored.enrichStructureFingerprint &&
    stored.enrichStructureFingerprint === live.fingerprint
  ) {
    return { match: true, reason: 'enrichStructureFingerprint match', live };
  }

  // Payload field-level compare when hash missing or drifted formatting
  if (stored.enrichStructurePayload) {
    const a = live.payload;
    const b = stored.enrichStructurePayload;
    if (
      a.layoutPattern === b.layoutPattern &&
      JSON.stringify(a.repeatRoles) === JSON.stringify(b.repeatRoles || [])
    ) {
      // pageRole may differ (partial-header vs page) after layoutRolesCompatible passed
      return { match: true, reason: 'enrichStructurePayload match', live };
    }
  }

  return {
    match: false,
    reason: `fingerprint differs (current=${live.fingerprint} registry=${stored.enrichStructureFingerprint || 'n/a'})`,
    live,
  };
}

/**
 * True when section looks like site header chrome with separable product / mega nav.
 * @param {object|null|undefined} info
 * @returns {boolean}
 */
export function isResponsiveHeaderCompositeCandidate(info) {
  const pattern = String(info?.layout?.pattern || info?.layout?.type || '')
    .trim()
    .toLowerCase();
  const role = inferEnrichPageRole(info);
  const purpose = String(info?.purpose || info?.description || '').toLowerCase();
  const chrome = String(info?.chromeKind || info?.track || '').toLowerCase();
  if (
    /responsive-header|mega-menu|mega.?nav|brand-row-with-mega|horizontal-brand-navigation/.test(
      pattern,
    )
  ) {
    return true;
  }
  if (
    (role === 'partial-header' ||
      chrome === 'header-stack' ||
      chrome === 'header') &&
    /mega.?menu|product.?nav|primary.?nav|expandable|menu--products|navigation/.test(
      purpose + ' ' + pattern,
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Pattern table: enrich repeat roles → child stubs + parent placeholder keys.
 * Add rows here instead of new `if (footer)` branches.
 * @typedef {{
 *   id: string,
 *   match: (info: object) => boolean,
 *   roles: Array<{
 *     repeat: RegExp,
 *     componentName: string,
 *     placeholder: string,
 *     repeatHint?: number | 'count',
 *   }>,
 *   requiredChildren?: Array<{
 *     componentName: string,
 *     placeholder: string,
 *     repeatHint?: number,
 *     enrichRepeat?: string,
 *   }>,
 *   defaultPlaceholderKey: string,
 * }} EnrichCompositePattern
 */

/** @type {EnrichCompositePattern[]} */
export const ENRICH_COMPOSITE_PATTERNS = [
  {
    id: 'stacked-footer',
    match(info) {
      const pattern = String(info?.layout?.pattern || '').toLowerCase();
      const role = inferEnrichPageRole(info);
      const purpose = String(info?.purpose || info?.description || '').toLowerCase();
      return (
        pattern === 'stacked-footer' ||
        (role === 'partial-footer' &&
          (/signpost|navigation column|social|legal/.test(purpose) ||
            enrichRepeatRoleKeys(info).some((k) =>
              /Signpost|NavigationGroup|SocialLink|LegalLink/i.test(k),
            )))
      );
    },
    // Placeholders are kebab of component names — no legacy four-band checklist.
    roles: [
      {
        repeat: /Signpost/i,
        componentName: 'FooterSignpost',
        placeholder: 'footer-signpost',
        repeatHint: 'count',
      },
      {
        repeat: /NavigationGroup/i,
        componentName: 'FooterNavigationGroup',
        placeholder: 'footer-navigation-group',
        repeatHint: 'count',
      },
      {
        repeat: /SocialLink/i,
        componentName: 'FooterBrandingSocial',
        placeholder: 'footer-branding-social',
        repeatHint: 1,
      },
      {
        repeat: /LegalLink/i,
        componentName: 'FooterLegal',
        placeholder: 'footer-legal-links',
        repeatHint: 1,
      },
    ],
    defaultPlaceholderKey: 'footer-navigation-group',
  },
  {
    id: 'responsive-header',
    match(info) {
      return isResponsiveHeaderCompositeCandidate(info);
    },
    // sitecoreize decides single vs composite — do not force a HeaderNavigation child.
    roles: [],
    defaultPlaceholderKey: '',
  },
];

/**
 * Resolve the first matching enrich composite pattern for section-information.
 * @param {object|null|undefined} info
 * @returns {EnrichCompositePattern|null}
 */
export function matchEnrichCompositePattern(info) {
  if (!info || typeof info !== 'object') return null;
  for (const pat of ENRICH_COMPOSITE_PATTERNS) {
    if (pat.match(info)) return pat;
  }
  return null;
}

/**
 * Child component stubs implied by enrich repeats (any matched pattern).
 * Used by presentation backstops.
 * @param {object|null|undefined} info
 * @param {string} [parentPascal]
 * @returns {Array<{ componentName: string, repeatHint: number, enrichRepeat: string, placeholder?: string, patternId?: string }>}
 */
export function compositeChildrenFromEnrichRepeats(info, parentPascal = '') {
  void parentPascal; // brand prefix applied later by resolveComponentName
  const pat = matchEnrichCompositePattern(info);
  if (!pat) return [];

  /** @type {Array<{ componentName: string, repeatHint: number, enrichRepeat: string, placeholder?: string, patternId?: string }>} */
  const out = [];
  const repeats = Array.isArray(info?.repeats) ? info.repeats : [];
  for (const r of repeats) {
    const name = String(r?.name || '');
    const count = Number(r?.count) || 2;
    for (const role of pat.roles) {
      if (!role.repeat.test(name)) continue;
      const hint =
        role.repeatHint === 'count'
          ? count
          : typeof role.repeatHint === 'number'
            ? role.repeatHint
            : count;
      out.push({
        componentName: role.componentName,
        repeatHint: hint,
        enrichRepeat: name,
        placeholder: role.placeholder,
        patternId: pat.id,
      });
      break;
    }
  }
  // Always-inject required children (e.g. HeaderNavigation) even when repeats omit them.
  for (const req of pat.requiredChildren || []) {
    const name = String(req.componentName || '').trim();
    if (!name) continue;
    out.push({
      componentName: name,
      repeatHint: Number(req.repeatHint) > 0 ? Number(req.repeatHint) : 1,
      enrichRepeat: String(req.enrichRepeat || name),
      placeholder: req.placeholder,
      patternId: pat.id,
    });
  }

  const byName = new Map();
  for (const c of out) {
    const prev = byName.get(c.componentName);
    if (!prev || (c.repeatHint || 0) > (prev.repeatHint || 0)) {
      byName.set(c.componentName, c);
    }
  }
  return [...byName.values()];
}

/**
 * Parent placeholder keys implied by enrich composite pattern + child stubs.
 * @param {object|null|undefined} info
 * @param {Array<{ componentName?: string, placeholder?: string }>|null} [children]
 * @returns {{ patternId: string, keys: string[], controlsByPh: Record<string, string[]>, defaultPlaceholderKey: string }|null}
 */
export function compositeParentPlaceholdersFromEnrich(info, children = null) {
  const pat = matchEnrichCompositePattern(info);
  if (!pat) return null;
  const stubs = Array.isArray(children) && children.length
    ? children
    : compositeChildrenFromEnrichRepeats(info);
  if (!stubs.length) return null;

  /** @type {Record<string, string[]>} */
  const controlsByPh = {};
  for (const role of pat.roles) {
    controlsByPh[role.placeholder] = controlsByPh[role.placeholder] || [];
  }
  for (const c of stubs) {
    const n = String(c?.componentName || '').toLowerCase();
    let ph = String(c?.placeholder || '').trim();
    if (!ph) {
      const role = pat.roles.find((r) =>
        n.includes(String(r.componentName).toLowerCase().replace(/^footer/, '')),
      );
      if (role) ph = role.placeholder;
      else if (n) {
        // Generic kebab from component name — never invent four-band keys.
        ph = n.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      }
    }
    if (!ph) continue;
    if (!controlsByPh[ph]) controlsByPh[ph] = [];
    // Caller supplies definition keys; here we keep component names for mapping.
    controlsByPh[ph].push(String(c.componentName || ''));
  }
  const keys = Object.keys(controlsByPh).filter((k) => (controlsByPh[k] || []).length);
  return {
    patternId: pat.id,
    keys,
    controlsByPh,
    defaultPlaceholderKey: pat.defaultPlaceholderKey,
  };
}

/**
 * Child component stubs implied by stacked-footer enrich repeats.
 * Thin wrapper over {@link compositeChildrenFromEnrichRepeats} for callers.
 * @param {object|null|undefined} info
 * @param {string} [parentPascal]
 * @returns {Array<{ componentName: string, repeatHint: number, enrichRepeat: string }>}
 */
export function stackedFooterChildrenFromEnrich(info, parentPascal = '') {
  return compositeChildrenFromEnrichRepeats(info, parentPascal);
}

/**
 * Explicit alias → canonical child names (table rows; not footer-only ifs).
 * Matched against the unprefixed PascalCase tail.
 * @type {Array<{ match: RegExp, canonical: string }>}
 */
export const CHILD_COMPONENT_ALIAS_RULES = [
  { match: /SignpostLink$/i, canonical: 'FooterSignpost' },
  { match: /SignpostLinks$/i, canonical: 'FooterSignpost' },
  { match: /NavigationGroupLink$/i, canonical: 'FooterNavigationGroup' },
  { match: /BrandingSocialLink$/i, canonical: 'FooterBrandingSocial' },
  { match: /LegalLink$/i, canonical: 'FooterLegal' },
];

/**
 * Strip brand prefix for alias / core comparison.
 * @param {string} name
 * @returns {string}
 */
export function stripBrandPrefixFromComponentName(name) {
  return String(name || '').replace(
    /^(Sitecore|Axa|DomSecurity|Bq)(?=[A-Z])/i,
    '',
  );
}

/**
 * Apply explicit CHILD_COMPONENT_ALIAS_RULES to a component name.
 * @param {string} componentName
 * @returns {string}
 */
export function applyChildComponentAlias(componentName) {
  const raw = String(componentName || '').trim();
  if (!raw) return raw;
  const tail = stripBrandPrefixFromComponentName(raw);
  for (const rule of CHILD_COMPONENT_ALIAS_RULES) {
    if (rule.match.test(tail) || rule.match.test(raw)) {
      return rule.canonical;
    }
  }
  return raw;
}

/**
 * Core key for grouping competing children (Signpost vs SignpostLink → same core).
 * @param {string} componentName
 * @returns {string}
 */
export function childComponentCoreKey(componentName) {
  let n = stripBrandPrefixFromComponentName(applyChildComponentAlias(componentName));
  n = n.replace(/(?:Link|Item|Card|Tile|Entry|Row)$/i, '');
  return n.toLowerCase();
}

/**
 * Prefer names without Link/Item/Card suffix (canonical package).
 * @param {string} componentName
 * @returns {number}
 */
function childNamePreferScore(componentName) {
  const n = String(componentName || '');
  if (/(?:Link|Item|Card|Tile|Entry|Row)$/i.test(stripBrandPrefixFromComponentName(n))) {
    return 0;
  }
  return 1;
}

/**
 * Collapse plan children that share the same content role onto one canonical name.
 * Generic: alias table + suffix peers (FooLink vs Foo). Used by run presentation wiring.
 * @param {Array<{ componentName: string, repeatHint?: number, enrichRepeat?: string, placeholder?: string }>} children
 * @returns {typeof children}
 */
export function collapsePlanChildrenToCanonical(children) {
  const list = Array.isArray(children) ? children : [];
  if (!list.length) return [];

  /** @type {Map<string, (typeof list)[0]>} */
  const byCore = new Map();
  for (const raw of list) {
    const aliased = applyChildComponentAlias(raw.componentName);
    const c = {
      ...raw,
      componentName: aliased,
    };
    const key = childComponentCoreKey(c.componentName);
    const prev = byCore.get(key);
    if (!prev) {
      byCore.set(key, c);
      continue;
    }
    const preferCurrent =
      childNamePreferScore(c.componentName) > childNamePreferScore(prev.componentName) ||
      (childNamePreferScore(c.componentName) === childNamePreferScore(prev.componentName) &&
        (c.repeatHint || 0) >= (prev.repeatHint || 0));
    const winner = preferCurrent ? c : prev;
    const loser = preferCurrent ? prev : c;
    winner.repeatHint = Math.max(winner.repeatHint || 0, loser.repeatHint || 0);
    if (!winner.enrichRepeat && loser.enrichRepeat) {
      winner.enrichRepeat = loser.enrichRepeat;
    }
    if (!winner.placeholder && loser.placeholder) {
      winner.placeholder = loser.placeholder;
    }
    byCore.set(key, winner);
  }
  return [...byCore.values()];
}
