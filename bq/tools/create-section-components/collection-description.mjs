/**
 * Optional Azure fallbacks for collection/site labels when URL parse fails.
 * Prefer URL-derived templates in naming.mjs / ensure-collection-site.
 */
import { azureChatCompletion } from '../capture/lib/design-system/ai/azure-chat.mjs';
import {
  deriveCollectionDescription,
  deriveCollectionDisplayName,
  deriveSiteDescription,
  deriveSiteDisplayName,
  hostToDisplayName,
  parseHostnameBrandMarket,
} from './naming.mjs';

const COLLECTION_DISPLAY_NAME_PROMPT = `Write a short English display name for a Sitecore site collection.

The collection is the brand's multi-market web estate (for example "AXA Web Estate"), not a single-country site name (not "AXA Belgium") and not a hostname.

Instructions:

Always write in English.

Return 2–4 words ending with "Web Estate" when a brand is clear. No sentences, no quotation marks.

Do not invent products or legal entity names.

Return only the display name.`;

const COLLECTION_SYSTEM_PROMPT = `Write a short English description for a Sitecore site collection.

The collection is the brand's portfolio of web properties across markets and audiences — not a single market site and not a product pitch.

Instructions:

Always write in English.

Write 1 sentence, under 30 words, in the spirit of: "{Brand}'s portfolio of web properties across markets and audiences."

Do not invent insurance products, audiences, or technical claims.

Return only the description.`;

const SITE_SYSTEM_PROMPT = `Write a short English description for a Sitecore site.

The site is one market web presence (for example "AXA's web presence for the Belgian market."), not the brand-wide collection.

Instructions:

Always write in English.

Write 1 sentence, under 25 words.

Do not invent products or audiences.

Return only the description.`;
function sanitizeDescription(content, maxLen) {
  const description = String(content || '')
    .trim()
    .replace(/^["'`]+/, '')
    .replace(/["'`]+$/, '')
    .replace(/\s+/g, ' ')
    .slice(0, maxLen);
  return description || null;
}

/**
 * @param {{
 *   hostname?: string,
 *   websites: string,
 *   ledger?: { record: (entry: object) => unknown },
 * }} opts
 * @returns {Promise<{ displayName: string|null, source: 'openai'|'fallback', skipReason?: string }>}
 */
export async function generateCollectionDisplayName(opts) {
  const hostname = String(opts.hostname || '').trim() || 'site';
  const websites = String(opts.websites || '').trim() || '(no website content provided)';

  const userPrompt = [
    `Hostname (fallback only — do not return this as the name): ${hostname}`,
    `Website URLs and available content:`,
    websites,
  ].join('\n');

  const result = await azureChatCompletion({
    messages: [
      { role: 'system', content: COLLECTION_DISPLAY_NAME_PROMPT },
      { role: 'user', content: userPrompt },
    ],
  });

  opts.ledger?.record({
    purpose: 'collection-display-name',
    componentName: hostname,
    ok: result.ok,
    model: result.model,
    usage: result.usage,
    costEstimate: result.costEstimate,
    skipReason: result.skipReason,
  });

  if (!result.ok || !result.content?.trim()) {
    return {
      displayName: null,
      source: 'fallback',
      skipReason: result.skipReason || 'empty content',
    };
  }

  const displayName = sanitizeDisplayName(result.content);
  if (!displayName) {
    return { displayName: null, source: 'fallback', skipReason: 'empty after sanitize' };
  }

  return { displayName, source: 'openai' };
}

function sanitizeDisplayName(content) {
  const cleaned = String(content || '')
    .trim()
    .replace(/^["'`]+/, '')
    .replace(/["'`]+$/, '')
    .replace(/\s+/g, ' ')
    .replace(/[.!?]+$/g, '')
    .slice(0, 80)
    .trim();
  if (!cleaned) return null;
  // Reject obvious hostname / system-style answers
  if (/^[a-z0-9.-]+$/i.test(cleaned) && cleaned.includes('.')) return null;
  if (/^www\./i.test(cleaned)) return null;
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 8) return null;
  return cleaned;
}

/**
 * True when the collection display name still looks hostname-derived (e.g. AXA.BE).
 */
export function isHostnameStyleCollectionDisplayName(name, hostnameOrUrl) {
  const n = String(name || '').trim();
  if (!n) return true;
  if (/^[A-Z0-9.-]+$/.test(n) && /[.-]/.test(n)) return true;
  const hostStyle = hostToDisplayName(hostnameOrUrl || '');
  if (hostStyle && n.toUpperCase() === hostStyle.toUpperCase()) return true;
  return false;
}

/**
 * True when collection name looks like a market site label (e.g. "AXA Belgium")
 * instead of the estate template ("AXA Web Estate").
 */
export function isMarketScopedCollectionDisplayName(name, hostnameOrUrl) {
  const n = String(name || '').trim();
  if (!n) return false;
  if (/\bWeb Estate\b/i.test(n)) return false;
  try {
    const parts = parseHostnameBrandMarket(hostnameOrUrl || '');
    const siteName = deriveSiteDisplayName(parts);
    if (siteName && n.toLowerCase() === siteName.toLowerCase()) return true;
    if (parts.countryName && n.toLowerCase() === `${parts.brandLabel} ${parts.countryName}`.toLowerCase()) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Whether ensure-collection-site should refresh the collection display `name`.
 * Skips manual; upgrades hostname-style or market-scoped names, or mismatch vs URL template.
 */
export function shouldGenerateCollectionDisplayName(opts) {
  const source = String(opts.descriptionSource || '')
    .trim()
    .toLowerCase();
  if (source === 'manual') return false;
  if (isHostnameStyleCollectionDisplayName(opts.name, opts.hostnameOrUrl)) return true;
  if (isMarketScopedCollectionDisplayName(opts.name, opts.hostnameOrUrl)) return true;
  try {
    const expected = deriveCollectionDisplayName(
      parseHostnameBrandMarket(opts.hostnameOrUrl || ''),
    );
    if (expected && String(opts.name || '').trim() !== expected) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Whether site display name should be refreshed from URL templates.
 */
export function shouldGenerateSiteDisplayName(opts) {
  const source = String(opts.descriptionSource || '')
    .trim()
    .toLowerCase();
  if (source === 'manual') return false;
  const n = String(opts.name || '').trim();
  if (!n) return true;
  if (/\bWeb Estate\b/i.test(n)) return true;
  if (isHostnameStyleCollectionDisplayName(n, opts.hostnameOrUrl)) return true;
  try {
    const expected = deriveSiteDisplayName(
      parseHostnameBrandMarket(opts.hostnameOrUrl || ''),
    );
    if (expected && n !== expected) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * @param {{
 *   collectionName: string,
 *   websites: string,
 *   ledger?: { record: (entry: object) => unknown },
 * }} opts
 * @returns {Promise<{ description: string|null, source: 'openai'|'fallback', skipReason?: string }>}
 */
export async function generateCollectionDescription(opts) {
  const collectionName = String(opts.collectionName || '').trim() || 'Collection';
  const websites = String(opts.websites || '').trim() || '(no website content provided)';

  const userPrompt = [
    `Collection name: ${collectionName}`,
    `Website URLs and available content:`,
    websites,
  ].join('\n');

  const result = await azureChatCompletion({
    messages: [
      { role: 'system', content: COLLECTION_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
  });

  opts.ledger?.record({
    purpose: 'collection-description',
    componentName: collectionName,
    ok: result.ok,
    model: result.model,
    usage: result.usage,
    costEstimate: result.costEstimate,
    skipReason: result.skipReason,
  });

  if (!result.ok || !result.content?.trim()) {
    return {
      description: null,
      source: 'fallback',
      skipReason: result.skipReason || 'empty content',
    };
  }

  const description = sanitizeDescription(result.content, 600);
  if (!description) {
    return { description: null, source: 'fallback', skipReason: 'empty after sanitize' };
  }

  return { description, source: 'openai' };
}

/**
 * @param {{
 *   siteName: string,
 *   siteScope?: string,
 *   websites: string,
 *   ledger?: { record: (entry: object) => unknown },
 * }} opts
 * @returns {Promise<{ description: string|null, source: 'openai'|'fallback', skipReason?: string }>}
 */
export async function generateSiteDescription(opts) {
  const siteName = String(opts.siteName || '').trim() || 'Site';
  const siteScope = String(opts.siteScope || '').trim() || '(none)';
  const websites = String(opts.websites || '').trim() || '(no website content provided)';

  const userPrompt = [
    `Site name: ${siteName}`,
    `Site scope, if known: ${siteScope}`,
    `Website URLs and available content:`,
    websites,
  ].join('\n');

  const result = await azureChatCompletion({
    messages: [
      { role: 'system', content: SITE_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
  });

  opts.ledger?.record({
    purpose: 'site-description',
    componentName: siteName,
    ok: result.ok,
    model: result.model,
    usage: result.usage,
    costEstimate: result.costEstimate,
    skipReason: result.skipReason,
  });

  if (!result.ok || !result.content?.trim()) {
    return {
      description: null,
      source: 'fallback',
      skipReason: result.skipReason || 'empty content',
    };
  }

  const description = sanitizeDescription(result.content, 320);
  if (!description) {
    return { description: null, source: 'fallback', skipReason: 'empty after sanitize' };
  }

  return { description, source: 'openai' };
}

/** True when description is the auto template from ensure-collection-site (pre-AI). */
export function isPlaceholderCollectionDescription(description, hostname) {
  const d = String(description || '').trim();
  if (!d) return false; // empty on disk ≠ regenerate; only capture placeholders upgrade
  if (/^Collection generated from capture of /i.test(d)) return true;
  if (hostname && d === `Collection generated from capture of ${hostname}.`) return true;
  return false;
}

/** True when description is the auto site template from ensure-collection-site (pre-AI). */
export function isPlaceholderSiteDescription(description, hostname) {
  const d = String(description || '').trim();
  if (!d) return false;
  if (/^Site generated from capture of /i.test(d)) return true;
  if (hostname && d === `Site generated from capture of ${hostname}.`) return true;
  return false;
}

/**
 * Whether ensure-collection-site should refresh description from URL templates.
 * Skips manual. Refreshes placeholders and text that no longer matches the derived template.
 */
export function shouldGenerateDescription(opts) {
  const source = String(opts.descriptionSource || '')
    .trim()
    .toLowerCase();
  if (source === 'manual') return false;

  const kind = opts.kind === 'site' ? 'site' : 'collection';
  const isPlaceholder =
    kind === 'site'
      ? isPlaceholderSiteDescription(opts.description, opts.hostname)
      : isPlaceholderCollectionDescription(opts.description, opts.hostname);
  if (isPlaceholder) return true;

  const hostnameOrUrl = opts.hostnameOrUrl || opts.hostname || '';
  try {
    const parts = parseHostnameBrandMarket(hostnameOrUrl);
    const expected =
      kind === 'site'
        ? deriveSiteDescription(parts)
        : deriveCollectionDescription(parts);
    const current = String(opts.description || '').trim();
    if (expected && current && current !== expected) return true;
    if (expected && !current) return true;
  } catch {
    /* ignore */
  }

  // Legacy: keep ai-stamped non-placeholder text only when it already matches template
  // (checked above). Otherwise refresh so old insurance blurbs upgrade.
  if (source === 'ai') {
    try {
      const parts = parseHostnameBrandMarket(hostnameOrUrl);
      const expected =
        kind === 'site'
          ? deriveSiteDescription(parts)
          : deriveCollectionDescription(parts);
      return Boolean(expected) && String(opts.description || '').trim() !== expected;
    } catch {
      return false;
    }
  }
  return false;
}

export {
  deriveCollectionDescription,
  deriveCollectionDisplayName,
  deriveSiteDescription,
  deriveSiteDisplayName,
  parseHostnameBrandMarket,
};

/**
 * Build websites context block for the prompt from URL + optional design notes.
 * @param {{ url: string, hostname?: string, designMd?: string }} opts
 */
export function buildCollectionWebsitesContext(opts) {
  const parts = [];
  if (opts.url) parts.push(`URL: ${opts.url}`);
  if (opts.hostname) parts.push(`Hostname: ${opts.hostname}`);
  const design = String(opts.designMd || '').trim();
  if (design) {
    parts.push('');
    parts.push('Page / brand design notes (excerpt):');
    parts.push(design.slice(0, 4000));
  }
  return parts.join('\n');
}
