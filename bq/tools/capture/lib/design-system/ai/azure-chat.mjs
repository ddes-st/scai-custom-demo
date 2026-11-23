/**
 * Azure AI Foundry / Azure OpenAI chat completions (OpenAI-compatible v1).
 * Env: AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY|AZURE_FOUNDRY_API_KEY, AZURE_OPENAI_DEFAULT_MODEL
 *
 * Cost estimates use Retail Prices (cached) / optional Price Sheet via azure-model-rates.mjs.
 */
import { loadLocalEnvFiles } from '../load-env.mjs';
import { bqRoot } from '../../../paths.mjs';
import { ensureModelRates, resolveModelRates } from './azure-model-rates.mjs';

export function resolveAzureChatConfig() {
  loadLocalEnvFiles({ root: bqRoot });
  const endpoint = (
    process.env.AZURE_OPENAI_ENDPOINT ||
    process.env.AZURE_AI_FOUNDRY_ENDPOINT ||
    ''
  )
    .trim()
    .replace(/\/+$/, '');
  const apiKey = (
    process.env.AZURE_OPENAI_API_KEY ||
    process.env.AZURE_FOUNDRY_API_KEY ||
    ''
  ).trim();
  const model = (process.env.AZURE_OPENAI_DEFAULT_MODEL || '').trim();

  if (!endpoint || !apiKey || !model) {
    const missing = [];
    if (!endpoint) missing.push('AZURE_OPENAI_ENDPOINT|AZURE_AI_FOUNDRY_ENDPOINT');
    if (!apiKey) missing.push('AZURE_OPENAI_API_KEY|AZURE_FOUNDRY_API_KEY');
    if (!model) missing.push('AZURE_OPENAI_DEFAULT_MODEL');
    return { ok: false, skipReason: `Azure env incomplete: missing ${missing.join(', ')}` };
  }

  const url = `${endpoint}/chat/completions`;
  return { ok: true, endpoint, url, apiKey, model };
}

export function estimateCostUsd(model, usage) {
  if (!usage) return null;
  const rates = resolveModelRates(model);
  if (!rates) return null;
  const inTok = usage.prompt_tokens ?? usage.inputTokens ?? 0;
  const outTok = usage.completion_tokens ?? usage.outputTokens ?? 0;
  const usd = (inTok / 1e6) * rates.input + (outTok / 1e6) * rates.output;
  const src = rates.source || 'hardcoded';
  return {
    currency: 'USD',
    inputUsd: Math.round((inTok / 1e6) * rates.input * 1e6) / 1e6,
    outputUsd: Math.round((outTok / 1e6) * rates.output * 1e6) / 1e6,
    totalUsd: Math.round(usd * 1e6) / 1e6,
    rateNote: `estimate (${src}) @ ${rates.input}/${rates.output} per 1M in/out for ${model}`,
    rateSource: src,
  };
}

export function normalizeUsage(usage) {
  if (!usage || typeof usage !== 'object') return null;
  const details =
    usage.prompt_tokens_details ||
    usage.promptTokensDetails ||
    usage.input_tokens_details ||
    null;
  const cachedTokens =
    details?.cached_tokens ??
    details?.cachedTokens ??
    usage.cached_tokens ??
    usage.cachedTokens ??
    null;
  return {
    promptTokens: usage.prompt_tokens ?? usage.inputTokens ?? 0,
    completionTokens: usage.completion_tokens ?? usage.outputTokens ?? 0,
    totalTokens: usage.total_tokens ?? usage.totalTokens ?? 0,
    ...(cachedTokens != null ? { cachedTokens: Number(cachedTokens) || 0 } : {}),
  };
}

/**
 * OpenAI-compatible multimodal image part (PNG/JPEG bytes → data URL).
 * @param {Buffer|Uint8Array} bytes
 * @param {string} [mime='image/png']
 */
export function imageContentPart(bytes, mime = 'image/png') {
  const b64 = Buffer.from(bytes).toString('base64');
  return {
    type: 'image_url',
    image_url: { url: `data:${mime};base64,${b64}` },
  };
}

const RATE_LIMIT_MIN_WAIT_MS = 30_000;
const RATE_LIMIT_MAX_ATTEMPTS = 6;
const RATE_LIMIT_MAX_WAIT_MS = 180_000;
/** Shorter backoff for network/gateway blips (Sitecore connection-style). */
const NETWORK_RETRY_MIN_WAIT_MS = 5_000;
const NETWORK_RETRY_MAX_WAIT_MS = 60_000;

/**
 * Wait on 429: honor Retry-After when present, else exponential backoff
 * (30s → 60s → 120s … capped) so token-rate windows can recover.
 * @param {Headers|null|undefined} headers
 * @param {number} attempt — 1-based
 * @param {{ minMs?: number, maxMs?: number }} [bounds]
 */
function rateLimitWaitMs(headers, attempt = 1, bounds = {}) {
  const minMs = bounds.minMs ?? RATE_LIMIT_MIN_WAIT_MS;
  const maxMs = bounds.maxMs ?? RATE_LIMIT_MAX_WAIT_MS;
  const raw = headers?.get?.('retry-after') || headers?.get?.('Retry-After') || '';
  const sec = Number.parseFloat(String(raw).trim());
  if (Number.isFinite(sec) && sec > 0) {
    return Math.min(maxMs, Math.max(minMs, Math.ceil(sec * 1000)));
  }
  const exp = minMs * 2 ** Math.max(0, attempt - 1);
  return Math.min(maxMs, exp);
}

/**
 * True when HTTP status is a transient gateway / timeout (retryable).
 * @param {number} status
 */
export function isAzureChatTransientHttpStatus(status) {
  const n = Number(status);
  return n === 408 || n === 502 || n === 503 || n === 504;
}

/**
 * True when an error / skipReason looks like a transient network blip
 * (same spirit as SitecoreAI ser push BadGateway retries).
 * @param {unknown} errOrReason
 */
export function isAzureChatTransientFailure(errOrReason) {
  const text =
    errOrReason instanceof Error
      ? errOrReason.message
      : typeof errOrReason === 'string'
        ? errOrReason
        : String(errOrReason ?? '');
  if (!text.trim()) return false;
  if (/DeploymentNotFound/i.test(text)) return false;
  if (/Azure env incomplete/i.test(text)) return false;
  // Non-retryable client HTTP errors (429/408 handled elsewhere or matched below).
  if (/\bHTTP 4\d\d\b/i.test(text) && !/\bHTTP 408\b/i.test(text) && !/\bHTTP 429\b/i.test(text)) {
    return false;
  }
  return (
    /fetch failed/i.test(text) ||
    /\bECONNRESET\b/i.test(text) ||
    /\bETIMEDOUT\b/i.test(text) ||
    /\bENOTFOUND\b/i.test(text) ||
    /\bEAI_AGAIN\b/i.test(text) ||
    /\bUND_ERR_/i.test(text) ||
    /socket hang up/i.test(text) ||
    /other side closed/i.test(text) ||
    /Th(?:e|is) operation was aborted/i.test(text) ||
    /AbortError/i.test(text) ||
    /timed?\s*out/i.test(text) ||
    /\btimeout\b/i.test(text) ||
    /Bad\s*Gateway/i.test(text) ||
    /\bHTTP 408\b/i.test(text) ||
    /\bHTTP 502\b/i.test(text) ||
    /\bHTTP 503\b/i.test(text) ||
    /\bHTTP 504\b/i.test(text)
  );
}

/**
 * @param {{
 *   messages: object[],
 *   temperature?: number,
 *   responseFormat?: object,
 *   timeoutMs?: number,
 *   model?: string,
 *   fetchImpl?: typeof fetch,
 *   sleep?: (ms: number) => Promise<void>,
 * }} opts
 */
export async function azureChatCompletion(opts) {
  const config = resolveAzureChatConfig();
  if (!config.ok) {
    return { ok: false, skipReason: config.skipReason };
  }

  const {
    messages,
    temperature = null,
    // null = omit (raw text / markdown). Pass { type: 'json_object' } when needed.
    responseFormat = null,
    timeoutMs = 120000,
    model: modelOverride = null,
    fetchImpl = globalThis.fetch,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  } = opts;

  const model = String(modelOverride || '').trim() || config.model;

  // Warm Retail/Price Sheet rates once (disk-cached); never block estimates on failure.
  try {
    await ensureModelRates();
  } catch {
    /* hardcoded fallback inside resolveModelRates */
  }

  const body = {
    model,
    messages,
  };
  // Many Foundry reasoning / GPT-5 models only allow default temperature (1).
  // Omit unless the caller explicitly sets a value.
  if (temperature != null) body.temperature = temperature;
  if (responseFormat) body.response_format = responseFormat;

  const bodyJson = JSON.stringify(body);
  /** @type {{ ok: false, skipReason: string, model: string, usage?: object|null }|null} */
  let lastFail = null;

  for (let attempt = 1; attempt <= RATE_LIMIT_MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetchImpl(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': config.apiKey,
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: bodyJson,
        signal: controller.signal,
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        const skipReason = `Azure chat non-JSON HTTP ${res.status}: ${text.slice(0, 400)}`;
        lastFail = { ok: false, skipReason, model };
        if (
          isAzureChatTransientHttpStatus(res.status) &&
          attempt < RATE_LIMIT_MAX_ATTEMPTS
        ) {
          const waitMs = rateLimitWaitMs(res.headers, attempt, {
            minMs: NETWORK_RETRY_MIN_WAIT_MS,
            maxMs: NETWORK_RETRY_MAX_WAIT_MS,
          });
          console.warn(
            `  ⚠ Azure chat transient network — waiting ${Math.round(waitMs / 1000)}s then retrying (attempt ${attempt}/${RATE_LIMIT_MAX_ATTEMPTS})`,
          );
          await sleep(waitMs);
          continue;
        }
        return lastFail;
      }

      if (!res.ok) {
        const errMsg = data?.error?.message || data?.message || text.slice(0, 400);
        const code = data?.error?.code || '';
        let skipReason = `Azure chat HTTP ${res.status}: ${errMsg}`;
        if (code === 'DeploymentNotFound' || /deployment/i.test(errMsg)) {
          skipReason +=
            ` (set AZURE_OPENAI_DEFAULT_MODEL or AZURE_OPENAI_SCREENSHOT_CONVERSION_MODEL to a deployed chat model id on this Foundry resource; catalog /models ≠ deployed)`;
        }
        lastFail = {
          ok: false,
          skipReason,
          model,
          usage: normalizeUsage(data?.usage),
        };

        const rateLimited = res.status === 429;
        const gateway =
          isAzureChatTransientHttpStatus(res.status) ||
          isAzureChatTransientFailure(skipReason);

        if (
          (rateLimited || gateway) &&
          attempt < RATE_LIMIT_MAX_ATTEMPTS &&
          code !== 'DeploymentNotFound'
        ) {
          const waitMs = rateLimitWaitMs(res.headers, attempt, {
            minMs: rateLimited ? RATE_LIMIT_MIN_WAIT_MS : NETWORK_RETRY_MIN_WAIT_MS,
            maxMs: rateLimited ? RATE_LIMIT_MAX_WAIT_MS : NETWORK_RETRY_MAX_WAIT_MS,
          });
          console.warn(
            rateLimited
              ? `  ⚠ Azure chat rate limited (HTTP 429) — waiting ${Math.round(waitMs / 1000)}s then retrying (attempt ${attempt}/${RATE_LIMIT_MAX_ATTEMPTS})`
              : `  ⚠ Azure chat transient network — waiting ${Math.round(waitMs / 1000)}s then retrying (attempt ${attempt}/${RATE_LIMIT_MAX_ATTEMPTS})`,
          );
          await sleep(waitMs);
          continue;
        }

        return lastFail;
      }

      const content = data?.choices?.[0]?.message?.content ?? '';
      const usage = normalizeUsage(data?.usage);
      const costEstimate = estimateCostUsd(model, data?.usage);

      return {
        ok: true,
        model,
        provider: 'azure-foundry',
        content,
        usage,
        costEstimate,
        rawUsage: data?.usage ?? null,
      };
    } catch (err) {
      const skipReason = err instanceof Error ? err.message : String(err);
      lastFail = { ok: false, skipReason, model };
      if (
        isAzureChatTransientFailure(err) &&
        attempt < RATE_LIMIT_MAX_ATTEMPTS
      ) {
        const waitMs = rateLimitWaitMs(null, attempt, {
          minMs: NETWORK_RETRY_MIN_WAIT_MS,
          maxMs: NETWORK_RETRY_MAX_WAIT_MS,
        });
        console.warn(
          `  ⚠ Azure chat transient network — waiting ${Math.round(waitMs / 1000)}s then retrying (attempt ${attempt}/${RATE_LIMIT_MAX_ATTEMPTS})`,
        );
        await sleep(waitMs);
        continue;
      }
      return lastFail;
    } finally {
      clearTimeout(timer);
    }
  }

  return (
    lastFail || {
      ok: false,
      skipReason: 'Azure chat retries exhausted',
      model,
    }
  );
}
