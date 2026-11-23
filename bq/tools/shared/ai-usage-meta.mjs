/**
 * Canonical on-disk AI usage/cost metadata: `{dir}/ai-meta.json`.
 * Entries are upserted by `purpose` so multiple AI steps can share one file per directory.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const AI_USAGE_META_FILE = 'ai-meta.json';
export const AI_USAGE_META_SCHEMA_VERSION = 1;

/**
 * @param {unknown} n
 * @returns {number}
 */
function asNonNegInt(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.trunc(v);
}

/**
 * @param {unknown} n
 * @returns {number|null}
 */
function asRoundedUsd(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.round(v * 1e6) / 1e6;
}

/**
 * @param {object|null|undefined} usage
 * @returns {{ promptTokens: number, completionTokens: number, totalTokens: number, cachedTokens?: number }|null}
 */
export function normalizeAiUsage(usage) {
  if (!usage || typeof usage !== 'object') return null;
  const out = {
    promptTokens: asNonNegInt(
      usage.promptTokens ?? usage.prompt_tokens ?? usage.inputTokens,
    ),
    completionTokens: asNonNegInt(
      usage.completionTokens ?? usage.completion_tokens ?? usage.outputTokens,
    ),
    totalTokens: asNonNegInt(usage.totalTokens ?? usage.total_tokens),
  };
  const cached =
    usage.cachedTokens ?? usage.cached_tokens ?? usage.promptTokensDetails?.cachedTokens;
  if (cached != null) out.cachedTokens = asNonNegInt(cached);
  return out;
}

/**
 * @param {object|null|undefined} cost
 * @returns {object|null}
 */
export function normalizeAiCostEstimate(cost) {
  if (!cost || typeof cost !== 'object') return null;
  const totalUsd = asRoundedUsd(cost.totalUsd ?? cost.costEstimateUsd ?? cost.costUsd);
  if (totalUsd == null && cost.inputUsd == null && cost.outputUsd == null) return null;
  return {
    currency: String(cost.currency || 'USD'),
    inputUsd: asRoundedUsd(cost.inputUsd) ?? 0,
    outputUsd: asRoundedUsd(cost.outputUsd) ?? 0,
    totalUsd: totalUsd ?? 0,
    rateNote: cost.rateNote != null ? String(cost.rateNote) : null,
    rateSource: cost.rateSource != null ? String(cost.rateSource) : null,
  };
}

/**
 * @param {object|null|undefined} aggregates
 * @returns {object|null}
 */
export function normalizeAiAggregates(aggregates) {
  if (!aggregates || typeof aggregates !== 'object') return null;
  const costEstimateUsd = asRoundedUsd(
    aggregates.costEstimateUsd ?? aggregates.costUsd ?? aggregates.totalUsd,
  );
  return {
    calls: asNonNegInt(aggregates.calls ?? aggregates.called ?? aggregates.callCount),
    promptTokens: asNonNegInt(aggregates.promptTokens),
    completionTokens: asNonNegInt(aggregates.completionTokens),
    totalTokens: asNonNegInt(aggregates.totalTokens),
    costEstimateUsd,
  };
}

/**
 * Build one canonical usage entry.
 * @param {{
 *   purpose: string,
 *   model?: string|null,
 *   writtenAt?: string|null,
 *   ok?: boolean|null,
 *   skipReason?: string|null,
 *   usage?: object|null,
 *   costEstimate?: object|null,
 *   aggregates?: object|null,
 *   context?: object|null,
 * }} partial
 */
export function buildAiUsageEntry(partial = {}) {
  const purpose = String(partial.purpose || '').trim();
  if (!purpose) {
    throw new Error('buildAiUsageEntry requires purpose');
  }
  const context =
    partial.context && typeof partial.context === 'object' && !Array.isArray(partial.context)
      ? { ...partial.context }
      : {};
  return {
    schemaVersion: AI_USAGE_META_SCHEMA_VERSION,
    purpose,
    model: partial.model != null && String(partial.model).trim() ? String(partial.model) : null,
    writtenAt: partial.writtenAt || new Date().toISOString(),
    ok: typeof partial.ok === 'boolean' ? partial.ok : partial.ok == null ? null : Boolean(partial.ok),
    skipReason:
      partial.skipReason != null && String(partial.skipReason).trim()
        ? String(partial.skipReason)
        : null,
    usage: normalizeAiUsage(partial.usage),
    costEstimate: normalizeAiCostEstimate(partial.costEstimate),
    aggregates: normalizeAiAggregates(partial.aggregates),
    context,
  };
}

/**
 * @param {string} dir
 * @returns {string}
 */
export function aiUsageMetaPath(dir) {
  return path.join(String(dir || ''), AI_USAGE_META_FILE);
}

/**
 * @param {string} dir
 * @returns {Promise<{ schemaVersion: number, entries: object[] }>}
 */
export async function readAiUsageMeta(dir) {
  try {
    const raw = JSON.parse(await readFile(aiUsageMetaPath(dir), 'utf8'));
    const entries = Array.isArray(raw?.entries)
      ? raw.entries.filter((e) => e && typeof e === 'object' && e.purpose)
      : [];
    return {
      schemaVersion: Number(raw?.schemaVersion) || AI_USAGE_META_SCHEMA_VERSION,
      entries,
    };
  } catch {
    return { schemaVersion: AI_USAGE_META_SCHEMA_VERSION, entries: [] };
  }
}

/**
 * @param {string} dir
 * @param {string} purpose
 * @returns {Promise<object|null>}
 */
export async function getAiUsageEntry(dir, purpose) {
  const want = String(purpose || '').trim();
  if (!want) return null;
  const doc = await readAiUsageMeta(dir);
  return doc.entries.find((e) => e.purpose === want) || null;
}

/**
 * Upsert one or more entries by purpose into `{dir}/ai-meta.json`.
 * @param {string} dir
 * @param {object|object[]} entryOrEntries — partials or built entries
 * @returns {Promise<{ path: string, doc: { schemaVersion: number, entries: object[] } }>}
 */
export async function writeAiUsageMeta(dir, entryOrEntries) {
  const root = String(dir || '').trim();
  if (!root) throw new Error('writeAiUsageMeta requires dir');

  const incoming = (Array.isArray(entryOrEntries) ? entryOrEntries : [entryOrEntries])
    .filter(Boolean)
    .map((e) => (e.schemaVersion && e.purpose ? { ...e, context: { ...(e.context || {}) } } : buildAiUsageEntry(e)));

  if (!incoming.length) throw new Error('writeAiUsageMeta requires at least one entry');

  const existing = await readAiUsageMeta(root);
  /** @type {Map<string, object>} */
  const byPurpose = new Map();
  for (const e of existing.entries) {
    if (e?.purpose) byPurpose.set(String(e.purpose), e);
  }
  for (const e of incoming) {
    byPurpose.set(String(e.purpose), e);
  }

  const doc = {
    schemaVersion: AI_USAGE_META_SCHEMA_VERSION,
    entries: [...byPurpose.values()].sort((a, b) =>
      String(a.purpose).localeCompare(String(b.purpose)),
    ),
  };

  await mkdir(root, { recursive: true });
  const filePath = aiUsageMetaPath(root);
  await writeFile(filePath, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  return { path: filePath, doc };
}
