/**
 * Naming helpers for collection / site / component folders.
 */

/** Common ccTLDs → country display + adjectival form for site copy. */
const CCTLD_MARKETS = {
  be: { countryName: 'Belgium', countryAdjective: 'Belgian' },
  fr: { countryName: 'France', countryAdjective: 'French' },
  de: { countryName: 'Germany', countryAdjective: 'German' },
  nl: { countryName: 'Netherlands', countryAdjective: 'Dutch' },
  uk: { countryName: 'United Kingdom', countryAdjective: 'UK' },
  gb: { countryName: 'United Kingdom', countryAdjective: 'UK' },
  ie: { countryName: 'Ireland', countryAdjective: 'Irish' },
  es: { countryName: 'Spain', countryAdjective: 'Spanish' },
  it: { countryName: 'Italy', countryAdjective: 'Italian' },
  pt: { countryName: 'Portugal', countryAdjective: 'Portuguese' },
  ch: { countryName: 'Switzerland', countryAdjective: 'Swiss' },
  at: { countryName: 'Austria', countryAdjective: 'Austrian' },
  lu: { countryName: 'Luxembourg', countryAdjective: 'Luxembourgish' },
  us: { countryName: 'United States', countryAdjective: 'US' },
  ca: { countryName: 'Canada', countryAdjective: 'Canadian' },
  au: { countryName: 'Australia', countryAdjective: 'Australian' },
  nz: { countryName: 'New Zealand', countryAdjective: 'New Zealand' },
  jp: { countryName: 'Japan', countryAdjective: 'Japanese' },
  cn: { countryName: 'China', countryAdjective: 'Chinese' },
  in: { countryName: 'India', countryAdjective: 'Indian' },
  br: { countryName: 'Brazil', countryAdjective: 'Brazilian' },
  mx: { countryName: 'Mexico', countryAdjective: 'Mexican' },
  pl: { countryName: 'Poland', countryAdjective: 'Polish' },
  se: { countryName: 'Sweden', countryAdjective: 'Swedish' },
  no: { countryName: 'Norway', countryAdjective: 'Norwegian' },
  dk: { countryName: 'Denmark', countryAdjective: 'Danish' },
  fi: { countryName: 'Finland', countryAdjective: 'Finnish' },
};

/** gTLDs / other suffixes that are not country markets. */
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
  'tv',
  'me',
  'xyz',
]);

/**
 * Legacy host squeeze (www.axa.be → axabe). Prefer parseHostnameBrandMarket for
 * collection/site systemNames.
 */
export function hostToSystemName(hostnameOrSlug) {
  // www.axa.be → axabe ; www-axa-be → axabe
  const raw = String(hostnameOrSlug || '')
    .toLowerCase()
    .replace(/^www[.-]/, '')
    .replace(/\./g, '')
    .replace(/-/g, '');
  return raw.replace(/[^a-z0-9]/g, '') || 'site';
}

/**
 * Sitecore system name from a human display name (e.g. "AXA Belgium" → "axabelgium").
 * Prefer parseHostnameBrandMarket for collection/site identity.
 */
export function displayNameToSystemName(displayName) {
  const cleaned = String(displayName || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
  return cleaned || 'collection';
}

export function hostToHostSlugFolder(hostSlug) {
  // www-axa-be → axa-be
  return String(hostSlug || '')
    .toLowerCase()
    .replace(/^www-/, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'site';
}

/**
 * How brand display labels are cased (`BQ_BRAND_LABEL_CASE`).
 * - `title` (default): Sitecore
 * - `upper`: SITECORE
 * - `lower`: sitecore
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {'title'|'upper'|'lower'}
 */
export function resolveBrandLabelCase(env = process.env) {
  const raw = String(env?.BQ_BRAND_LABEL_CASE || '')
    .trim()
    .toLowerCase();
  if (raw === 'upper' || raw === 'lower' || raw === 'title') return raw;
  return 'title';
}

/**
 * Format a brand system token for display names / descriptions.
 * @param {string} brandSystem lowercase alphanumeric (e.g. sitecore)
 * @param {'title'|'upper'|'lower'} [mode]
 * @returns {string}
 */
export function formatBrandLabel(brandSystem, mode = resolveBrandLabelCase()) {
  const s = String(brandSystem || 'site').trim() || 'site';
  if (mode === 'upper') return s.toUpperCase();
  if (mode === 'lower') return s.toLowerCase();
  // title: first letter upper, rest lower (per contiguous token)
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function hostToDisplayName(hostname) {
  try {
    const h = new URL(
      hostname.includes('://') ? hostname : `https://${hostname}`,
    ).hostname;
    const hostNoWww = h.replace(/^www\./, '');
    const mode = resolveBrandLabelCase();
    return hostNoWww
      .split('.')
      .filter(Boolean)
      .map((seg) => formatBrandLabel(seg.replace(/[^a-zA-Z0-9]/g, '') || seg, mode))
      .join('.');
  } catch {
    return formatBrandLabel(String(hostname || 'site'), resolveBrandLabelCase());
  }
}

/**
 * Parse brand + market from a capture URL/hostname.
 * www.axa.be → brand axa / Sitecore-style Title Case label (or upper/lower via env),
 * collectionSystemName axa, siteSystemName axa-be.
 *
 * @param {string} urlOrHost
 * @returns {{
 *   hostname: string,
 *   brandLabel: string,
 *   brandSystem: string,
 *   tld: string,
 *   countryName: string|null,
 *   countryAdjective: string|null,
 *   collectionSystemName: string,
 *   siteSystemName: string,
 * }}
 */
export function parseHostnameBrandMarket(urlOrHost) {
  let hostname = String(urlOrHost || '')
    .trim()
    .toLowerCase();
  try {
    hostname = new URL(
      hostname.includes('://') ? hostname : `https://${hostname}`,
    ).hostname.toLowerCase();
  } catch {
    hostname = hostname.replace(/^https?:\/\//, '').split('/')[0] || 'site';
  }

  const hostNoWww = hostname.replace(/^www\./, '');
  const labels = hostNoWww.split('.').filter(Boolean);

  let brandRaw = labels[0] || 'site';
  let tld = labels.length > 1 ? labels[labels.length - 1] : '';

  // www-axa-be style slug (no dots)
  if (labels.length === 1 && hostNoWww.includes('-')) {
    const parts = hostNoWww.split('-').filter(Boolean);
    if (parts.length >= 2) {
      const maybeTld = parts[parts.length - 1];
      if (CCTLD_MARKETS[maybeTld] || maybeTld.length === 2) {
        tld = maybeTld;
        brandRaw = parts.slice(0, -1).join('');
      }
    }
  }

  const brandSystem = brandRaw.replace(/[^a-z0-9]/g, '') || 'site';
  const brandLabel = formatBrandLabel(brandSystem);

  const market = tld && !NON_COUNTRY_TLDS.has(tld) ? CCTLD_MARKETS[tld] : null;
  const countryName = market?.countryName ?? null;
  const countryAdjective = market?.countryAdjective ?? null;

  const collectionSystemName = brandSystem;
  const siteSystemName =
    tld && brandSystem ? `${brandSystem}-${tld}` : brandSystem;

  return {
    hostname: hostNoWww,
    brandLabel,
    brandSystem,
    tld,
    countryName,
    countryAdjective,
    collectionSystemName,
    siteSystemName,
  };
}

/** Curly apostrophe used in editor-facing copy. */
const APOS = '\u2019';

/**
 * @param {ReturnType<typeof parseHostnameBrandMarket>} parts
 */
export function deriveCollectionDisplayName(parts) {
  const brand = parts?.brandLabel || 'Brand';
  return `${brand} Web Estate`;
}

/**
 * @param {ReturnType<typeof parseHostnameBrandMarket>} parts
 */
export function deriveCollectionDescription(parts) {
  const brand = parts?.brandLabel || 'Brand';
  return `${brand}${APOS}s portfolio of web properties across markets and audiences.`;
}

/**
 * Collapse line breaks into a single-line string (site/collection Name + Description).
 * Mirrors `sanitizeSingleLineText` in tools/shared/naming.ts.
 * @param {string | null | undefined} value
 * @returns {string}
 */
export function sanitizeSingleLineText(value) {
  return String(value ?? '')
    .replace(/[\r\n\u2028\u2029\u0085\u000b\u000c]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {ReturnType<typeof parseHostnameBrandMarket>} parts
 */
export function deriveSiteDisplayName(parts) {
  const brand = parts?.brandLabel || 'Brand';
  if (parts?.countryName) return `${brand} ${parts.countryName}`;
  return brand;
}

/**
 * @param {ReturnType<typeof parseHostnameBrandMarket>} parts
 */
export function deriveSiteDescription(parts) {
  const brand = parts?.brandLabel || 'Brand';
  if (parts?.countryAdjective) {
    return `${brand}${APOS}s web presence for the ${parts.countryAdjective} market.`;
  }
  return `${brand}${APOS}s web presence.`;
}

export function toPascalCase(name) {
  return String(name || '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

/**
 * Spaced Title Case for Sitecore template leaf names (e.g. `Trust Metrics`).
 * @param {string} input
 * @returns {string}
 */
export function toSpacedItemName(input) {
  const trimmed = String(input || '').trim();
  if (!trimmed) return trimmed;
  if (/[\s_-]/.test(trimmed)) {
    return trimmed
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
  return trimmed
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim();
}

/** Platform Data folders that must keep their exact names. */
export const PLATFORM_DATA_FOLDER_NAMES = [
  'Link Lists',
  'Icon Link Lists',
  'Image Link Lists',
];

const PLATFORM_DATA_FOLDER_SET = new Set(
  PLATFORM_DATA_FOLDER_NAMES.map((n) => n.toLowerCase()),
);

/**
 * Spaced Title Case for a site `Data/…` folder segment.
 * @param {string} input
 * @returns {string}
 */
export function toSpacedDataFolderSegment(input) {
  const trimmed = String(input || '').trim();
  if (!trimmed) return trimmed;
  if (PLATFORM_DATA_FOLDER_SET.has(trimmed.toLowerCase())) {
    return (
      PLATFORM_DATA_FOLDER_NAMES.find(
        (n) => n.toLowerCase() === trimmed.toLowerCase(),
      ) ?? trimmed
    );
  }
  return toSpacedItemName(trimmed);
}

/**
 * @param {string[]|undefined|null} folder
 * @returns {string[]|undefined}
 */
export function normalizeDataFolderSegments(folder) {
  if (!folder?.length) return folder ?? undefined;
  return folder.map(toSpacedDataFolderSegment);
}

export function toKebabCase(name) {
  return String(name || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export function toDefinitionKey(name) {
  return toKebabCase(name);
}

/**
 * Normalize a capture-meta `children[]` entry (string or object) to package identity.
 * Objects use `componentName` / `definitionKey`; never `String(object)` → "object-object".
 *
 * @param {unknown} entry
 * @returns {{ componentName: string, definitionKey: string }|null}
 */
export function normalizeCaptureMetaChild(entry) {
  if (entry == null) return null;
  if (typeof entry === 'string') {
    const componentName = toPascalCase(entry.trim());
    if (!componentName) return null;
    // Reject the classic String(object) accident.
    if (/^object-object$/i.test(toKebabCase(componentName))) return null;
    return {
      componentName,
      definitionKey: toDefinitionKey(componentName),
    };
  }
  if (typeof entry !== 'object') return null;
  const obj = /** @type {Record<string, unknown>} */ (entry);
  const rawName = String(obj.componentName || '').trim();
  const rawKey = String(obj.definitionKey || '').trim();
  let componentName = rawName ? toPascalCase(rawName) : '';
  if (!componentName && rawKey) {
    componentName = toPascalCase(rawKey.replace(/-/g, ' '));
  }
  if (!componentName) return null;
  if (/^object-object$/i.test(toKebabCase(componentName))) return null;
  const definitionKey = rawKey
    ? toDefinitionKey(rawKey)
    : toDefinitionKey(componentName);
  if (!definitionKey || definitionKey === 'object-object') return null;
  return { componentName, definitionKey };
}

/**
 * True when two component names differ only by letter case (same when lowercased).
 * Used to treat AI casing remints as rename/retire of sibling kebabs, not new packages.
 * @param {string|null|undefined} a
 * @param {string|null|undefined} b
 */
export function namesDifferOnlyByCase(a, b) {
  const left = String(a || '').trim();
  const right = String(b || '').trim();
  if (!left || !right || left === right) return false;
  return left.toLowerCase() === right.toLowerCase();
}

/**
 * Brand PascalCase prefix for FE folders / componentName (Axa, DomSecurity).
 * Uses the hostname's first label so `dom-security.com` → DomSecurity (not Domsecurity).
 *
 * @param {string} urlOrHost
 * @returns {string}
 */
export function componentCodePrefixFromUrl(urlOrHost) {
  const parts = parseHostnameBrandMarket(urlOrHost);
  const firstLabel = String(parts.hostname || '')
    .split('.')
    .filter(Boolean)[0] || parts.brandSystem;
  return toPascalCase(String(firstLabel).replace(/-/g, ' '));
}

/**
 * Brand prefix from a host slug folder (`axa-be`, `dom-security-com`, `www-axa-be`).
 * Drops a trailing TLD/ccTLD segment when present.
 *
 * @param {string} hostSlug
 * @returns {string}
 */
export function componentCodePrefixFromHostSlug(hostSlug) {
  const raw = String(hostSlug || '')
    .toLowerCase()
    .replace(/^www[.-]/, '')
    .replace(/\./g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const parts = raw.split('-').filter(Boolean);
  if (parts.length >= 2) {
    const tld = parts[parts.length - 1];
    if (NON_COUNTRY_TLDS.has(tld) || CCTLD_MARKETS[tld] || tld.length <= 3) {
      return toPascalCase(parts.slice(0, -1).join(' '));
    }
  }
  return toPascalCase(raw.replace(/-/g, ' '));
}

/**
 * Ensure `componentName` carries the brand code prefix (idempotent).
 * SiteFooter + Axa → AxaSiteFooter; AxaSiteFooter + Axa → AxaSiteFooter.
 *
 * @param {string} componentName
 * @param {string} prefix
 * @returns {string}
 */
export function ensureBrandComponentPrefix(componentName, prefix) {
  const name = toPascalCase(componentName);
  const p = toPascalCase(prefix);
  if (!name) return name;
  if (!p) return name;
  if (name.toLowerCase().startsWith(p.toLowerCase())) {
    return `${p}${name.slice(p.length)}`;
  }
  return `${p}${name}`;
}

/**
 * Strip brand PascalCase prefix from a component name (idempotent).
 * SitecoreCapabilityCarousel + Sitecore → CapabilityCarousel.
 *
 * @param {string} componentName
 * @param {string} prefix
 * @returns {string}
 */
export function stripBrandComponentPrefix(componentName, prefix) {
  const name = toPascalCase(componentName);
  const p = toPascalCase(prefix);
  if (!name || !p) return name;
  if (
    name.length > p.length &&
    name.toLowerCase().startsWith(p.toLowerCase())
  ) {
    return name.slice(p.length);
  }
  return name;
}

/**
 * Spaced Title Case displayName from componentName **without** brand/site prefix.
 * SitecoreCapabilityCarousel + Sitecore → "Capability Carousel".
 *
 * @param {string} componentName
 * @param {string} [codePrefix]
 * @returns {string}
 */
export function displayNameFromComponentName(componentName, codePrefix = '') {
  const stem = stripBrandComponentPrefix(componentName, codePrefix);
  return toSpacedItemName(stem || componentName);
}

/**
 * Strip a leading site brand from a Sitecore label (Pascal or spaced), then
 * spaced Title Case. Mid-string brand is kept (`Anderzorg becomes Menzis`).
 * Menzis Introduction Hero + Menzis → Introduction Hero.
 *
 * @param {string} label
 * @param {string} [codePrefix]
 * @returns {string}
 */
export function stripLeadingBrandSpacedLabel(label, codePrefix = '') {
  const raw = String(label || '').trim();
  if (!raw) return raw;
  const p = toPascalCase(String(codePrefix || '').trim());
  let spaced = toSpacedItemName(raw);
  if (!p) return spaced;

  const brandSpaced = toSpacedItemName(p);
  if (!brandSpaced) return spaced;

  const brandRe = new RegExp(
    `^${brandSpaced.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s+|$)`,
    'i',
  );
  if (brandRe.test(spaced)) {
    const rest = spaced.replace(brandRe, '').trim();
    if (rest) return toSpacedItemName(rest);
  }

  const pascalStripped = stripBrandComponentPrefix(raw, p);
  if (
    pascalStripped &&
    pascalStripped.toLowerCase() !== toPascalCase(raw).toLowerCase()
  ) {
    return toSpacedItemName(pascalStripped);
  }
  return spaced;
}

/**
 * Unbranded spaced Path/template stem for a component package.
 * Prefer a short displayName that does not start with the brand; else derive
 * from componentName.
 *
 * @param {{
 *   componentName?: string|null,
 *   displayName?: string|null,
 *   codePrefix?: string|null,
 * }} opts
 * @returns {string}
 */
export function sitecoreSpacedStemFromComponent(opts = {}) {
  const codePrefix = String(opts.codePrefix || '').trim();
  const componentName = String(opts.componentName || '').trim();
  const displayName = String(opts.displayName || '').trim();
  if (displayName) {
    const fromDisplay = stripLeadingBrandSpacedLabel(displayName, codePrefix);
    if (
      fromDisplay &&
      fromDisplay.length <= 48 &&
      !/^[®™©]/.test(fromDisplay)
    ) {
      return fromDisplay;
    }
  }
  if (componentName) {
    return displayNameFromComponentName(componentName, codePrefix);
  }
  return displayName ? toSpacedItemName(displayName) : '';
}

/**
 * Ensure a kebab definitionKey / allowedControls entry carries the brand prefix.
 * footer-link-list + axa → axa-footer-link-list (idempotent).
 * Skips empty keys and known platform shared keys.
 *
 * @param {string} definitionKey
 * @param {string} prefix Pascal or kebab brand prefix
 * @returns {string}
 */
export function ensureBrandDefinitionKeyPrefix(definitionKey, prefix) {
  const key = toDefinitionKey(definitionKey);
  const p = toDefinitionKey(prefix);
  if (!key || !p) return key;
  if (PLATFORM_DEFINITION_KEYS.has(key)) return key;
  if (key === p || key.startsWith(`${p}-`)) return key;
  return `${p}-${key}`;
}

/** Shared platform rendering keys that must not receive a site brand prefix. */
export const PLATFORM_DEFINITION_KEYS = new Set([
  'link-list',
  'icon-link-list',
  'image-link-list',
  'title',
  'rich-text',
  'image',
  'link',
  'page-content',
  'partial-design-dynamic-placeholder',
]);

/**
 * When a composite child was named the same as its parent (e.g. both
 * `SitecoreFeatureCardCarousel`), derive a distinct card/item Pascal name.
 *
 * @param {string} parentPascal
 * @param {string} [childPascal]
 * @returns {string}
 */
export function distinctCompositeChildPascal(parentPascal, childPascal = '') {
  const parent = toPascalCase(parentPascal);
  const child = toPascalCase(childPascal || parent);
  if (!parent) return child || 'Item';
  if (child.toLowerCase() !== parent.toLowerCase()) return child;

  const stripped = parent.replace(/(?:Carousel|Slider|Grid|List|Track)+$/i, '');
  if (stripped && stripped.toLowerCase() !== parent.toLowerCase()) {
    if (/(?:Card|Item|Badge|Tile|Link|Column|Group)$/i.test(stripped)) {
      return stripped;
    }
    return `${stripped}Item`;
  }
  return `${parent}Item`;
}

/**
 * Rename any composite children whose Pascal name equals the parent.
 * Mutates and returns the children array.
 *
 * @template {{ componentName?: string }} T
 * @param {string} parentPascal
 * @param {T[]} children
 * @param {{ warn?: (msg: string) => void }} [opts]
 * @returns {T[]}
 */
export function ensureDistinctCompositeChildren(parentPascal, children, opts = {}) {
  const parent = toPascalCase(parentPascal);
  if (!parent || !Array.isArray(children)) return children || [];
  const warn = typeof opts.warn === 'function' ? opts.warn : () => {};
  const used = new Set(
    children
      .map((c) => toPascalCase(c?.componentName || '').toLowerCase())
      .filter(Boolean),
  );

  for (const child of children) {
    if (!child || typeof child !== 'object') continue;
    const current = toPascalCase(child.componentName || 'Item');
    if (current.toLowerCase() !== parent.toLowerCase()) continue;

    let next = distinctCompositeChildPascal(parent, current);
    let n = 2;
    while (
      next.toLowerCase() === parent.toLowerCase() ||
      (used.has(next.toLowerCase()) && next.toLowerCase() !== current.toLowerCase())
    ) {
      next = `${distinctCompositeChildPascal(parent, current)}${n}`;
      n += 1;
      if (n > 20) break;
    }
    used.delete(current.toLowerCase());
    used.add(next.toLowerCase());
    warn(
      `  ⚠ Plan: renamed self-same composite child "${current}" → "${next}" (must differ from parent)`,
    );
    child.componentName = next;
  }
  return children;
}

/**
 * Semantic PascalCase fallbacks when preferred cmsName is taken by another package.
 * Never returns numeric-suffix twins (Foo2). Used by resolveComponentName.
 *
 * @param {{
 *   presentationRole?: string|null,
 *   chromeKind?: string|null,
 *   track?: string|null,
 *   purpose?: string|null,
 *   packageRole?: string|null,
 * }} [opts]
 * @returns {string[]}
 */
export function roleDerivedComponentNameStems(opts = {}) {
  const presentationRole = String(opts.presentationRole || '').toLowerCase();
  const chromeKind = String(opts.chromeKind || '').toLowerCase();
  const track = String(opts.track || '').toLowerCase();
  const purpose = String(opts.purpose || '').toLowerCase();
  const packageRole = String(opts.packageRole || '').toLowerCase();
  /** @type {string[]} */
  const stems = [];
  const push = (name) => {
    const n = toPascalCase(name);
    if (n && !stems.includes(n)) stems.push(n);
  };

  const isHeader =
    presentationRole === 'partial-header' ||
    chromeKind === 'header-stack' ||
    track === 'header';
  const isFooter =
    presentationRole === 'partial-footer' ||
    chromeKind === 'footer-stack' ||
    track === 'footer' ||
    /^stacked-footer\b/.test(String(opts.chromeKind || opts.presentationRole || ''));
  const isCookie =
    presentationRole === 'partial-cookie' ||
    /cookie|consent|gdpr|cmp/.test(`${chromeKind} ${purpose}`);

  if (isHeader) {
    push('SiteHeader');
    push('MainNavigation');
    push('SiteNavigation');
  }
  if (isFooter) {
    push('SiteFooter');
    push('FooterColumns');
  }
  if (isCookie) {
    push('CookiePreferenceModal');
    push('CookieBanner');
  }
  if (
    /local.?service|local.?office|kantoor|office.?finder|proximity|agentschap|nearby/.test(
      purpose,
    )
  ) {
    push('LocalServicesBand');
    push('LocalOfficesPromo');
    push('ProximityServices');
  }
  if (packageRole === 'child' && isHeader) {
    push('NavMenuItem');
    push('ProductNavigationItem');
  }
  return stems;
}

/**
 * Base placeholder key for definitions / AppPlaceholder (no `-{*}` suffix).
 * @param {string} key
 * @returns {string}
 */
export function toBasePlaceholderKey(key) {
  const k = String(key || '').trim();
  if (!k) return k;
  return k.replace(/-\{\*\}$/, '').replace(/\{\*\}$/, '');
}

/**
 * Sitecore Placeholder Settings "Placeholder Key" field value (`base-{*}`).
 * Idempotent when already suffixed.
 * @param {string} key
 * @returns {string}
 */
export function ensureDynamicPlaceholderKey(key) {
  const base = toBasePlaceholderKey(key);
  if (!base) return base;
  return `${base}-{*}`;
}
