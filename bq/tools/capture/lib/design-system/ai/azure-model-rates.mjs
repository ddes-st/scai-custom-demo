/**
 * Azure model token rates (USD per 1M tokens) from Retail Prices API,
 * optional negotiated Price Sheet, with disk cache under `.bq/`.
 *
 * Env:
 *   AZURE_MODEL_RATES_TTL_DAYS (default 7)
 *   AZURE_MODEL_RATES_CACHE_PATH (optional absolute/relative path)
 *   AZURE_BILLING_ACCOUNT_NAME + AZURE_BILLING_PROFILE_NAME (+ AZURE_ACCESS_TOKEN or `az login`)
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { bqDotDir, bqRoot } from '../../../paths.mjs';
import { loadLocalEnvFiles } from '../load-env.mjs';

/** Hardcoded fallback — used when retail/sheet miss a model. */
export const HARDCODED_MODEL_RATES_USD_PER_M = {
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4.1-nano': { input: 0.1, output: 0.4 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gpt-5-nano': { input: 0.05, output: 0.4 },
  'gpt-5-mini': { input: 0.25, output: 2.0 },
  'gpt-5.4-nano': { input: 0.2, output: 1.25 },
  'gpt-5.6-luna': { input: 0.2, output: 1.2 },
  'gpt-5.6-terra': { input: 2.0, output: 12.0 },
  'gpt-5.6-sol': { input: 4.0, output: 20.0 },
};

const RETAIL_BASE =
  'https://prices.azure.com/api/retail/prices?api-version=2023-01-01-preview';

/** @type {{ fetchedAt: string, source: string, rates: Record<string, { input: number, output: number }> } | null} */
let memoryCache = null;
let loadPromise = null;
let warnedSheetFail = false;

export function normalizeModelKey(model) {
  return String(model || '')
    .toLowerCase()
    .replace(/[^a-z0-9.\-]/g, '');
}

function defaultCachePath() {
  const override = (process.env.AZURE_MODEL_RATES_CACHE_PATH || '').trim();
  if (override) {
    return path.isAbsolute(override) ? override : path.resolve(bqRoot, override);
  }
  return path.join(bqDotDir, 'azure-model-rates.json');
}

function ttlMs() {
  const days = Number(process.env.AZURE_MODEL_RATES_TTL_DAYS || 7);
  const n = Number.isFinite(days) && days > 0 ? days : 7;
  return n * 24 * 60 * 60 * 1000;
}

function isCacheFresh(doc) {
  if (!doc?.fetchedAt || !doc?.rates) return false;
  const t = Date.parse(doc.fetchedAt);
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < ttlMs();
}

function readDiskCache() {
  const file = defaultCachePath();
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeDiskCache(doc) {
  const file = defaultCachePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
}

function priceToPerMillion(retailPrice, unitOfMeasure) {
  const p = Number(retailPrice);
  if (!Number.isFinite(p)) return null;
  const uom = String(unitOfMeasure || '').toLowerCase();
  if (uom.includes('1m') || uom === '1 m') return p;
  if (uom.includes('1k') || uom === '1 k') return p * 1000;
  if (uom.includes('hour')) return null;
  // bare token / unit — treat as per-token
  if (uom.includes('token') && !uom.includes('1')) return p * 1e6;
  return p;
}

/**
 * Map retail meter blob → canonical model id (gpt-5-mini, gpt-4o-mini, …).
 */
export function inferModelIdFromMeter(item) {
  const blob = `${item.meterName || ''} ${item.skuName || ''} ${item.armSkuName || ''} ${item.productName || ''}`.toLowerCase();
  if (/\b(batch|ft training|fine.?tune training|hosting)\b/.test(blob)) return null;
  if (/1 hour/i.test(item.unitOfMeasure || '')) return null;

  const rules = [
    [/gpt[\s\-]?5\.6[\s\-]?luna|5\.6[\s\-]?luna/, 'gpt-5.6-luna'],
    [/gpt[\s\-]?5\.6[\s\-]?terra|5\.6[\s\-]?terra/, 'gpt-5.6-terra'],
    [/gpt[\s\-]?5\.6[\s\-]?sol|5\.6[\s\-]?sol/, 'gpt-5.6-sol'],
    [/gpt[\s\-]?5\.4[\s\-]?nano|5\.4[\s\-]?nano/, 'gpt-5.4-nano'],
    [/gpt[\s\-]?5[\s\-]?nano|5[\s\-]?nano(?!\.)/, 'gpt-5-nano'],
    [/gpt[\s\-]?5[\s\-]?mini|5[\s\-]?mini/, 'gpt-5-mini'],
    [/gpt[\s\-]?4\.1[\s\-]?nano/, 'gpt-4.1-nano'],
    [/gpt[\s\-]?4\.1[\s\-]?mini/, 'gpt-4.1-mini'],
    [/gpt[\s\-]?4o[\s\-]?mini|4o[\s\-]?mini/, 'gpt-4o-mini'],
  ];
  for (const [re, id] of rules) {
    if (re.test(blob)) return id;
  }
  return null;
}

function meterDirection(item) {
  const blob = `${item.meterName || ''} ${item.skuName || ''} ${item.armSkuName || ''}`.toLowerCase();
  const isOut = /\b(opt|outp|output|outpt)\b/.test(blob);
  const isIn = /\b(inp|input|inpt)\b/.test(blob) || /\binp\b/.test(blob);
  if (isOut && !isIn) return 'output';
  if (isIn && !isOut) return 'input';
  if (isOut) return 'output';
  if (isIn) return 'input';
  return null;
}

function meterPreferenceScore(item) {
  const blob = `${item.meterName || ''} ${item.skuName || ''}`.toLowerCase();
  let score = 0;
  if (/\b(gl|glbl|global)\b/.test(blob)) score += 20;
  else if (/\b(dz|data.?zone)\b/.test(blob)) score += 10;
  else if (/\b(regnl|regional)\b/.test(blob)) score += 5;
  if (!/\bbatch\b/.test(blob)) score += 15;
  if (!/\b(pp|prty|priority)\b/.test(blob)) score += 15;
  if (!/\b(cached|cchd|cd inp|cd in)\b/.test(blob)) score += 10;
  if (!/\b(ft |fine.?tune)\b/.test(blob)) score += 10;
  if (item.isPrimaryMeterRegion) score += 5;
  if (/^(eastus|westeurope|global)$/i.test(item.armRegionName || '')) score += 3;
  return score;
}

/**
 * Build { [modelId]: { input, output } } from retail Items[].
 */
export function ratesFromRetailItems(items) {
  /** @type {Record<string, { input?: { price: number, score: number }, output?: { price: number, score: number } }>} */
  const best = {};

  for (const item of items || []) {
    const modelId = inferModelIdFromMeter(item);
    const dir = meterDirection(item);
    if (!modelId || !dir) continue;
    const perM = priceToPerMillion(item.retailPrice, item.unitOfMeasure);
    if (perM == null || perM <= 0) continue;
    const score = meterPreferenceScore(item);
    if (!best[modelId]) best[modelId] = {};
    const prev = best[modelId][dir];
    if (!prev || score > prev.score) {
      best[modelId][dir] = { price: perM, score };
    }
  }

  /** @type {Record<string, { input: number, output: number }>} */
  const rates = {};
  for (const [id, parts] of Object.entries(best)) {
    const input = parts.input?.price;
    const output = parts.output?.price;
    if (input != null && output != null) {
      rates[id] = {
        input: Math.round(input * 1e6) / 1e6,
        output: Math.round(output * 1e6) / 1e6,
      };
    }
  }
  return rates;
}

async function fetchRetailPages(filter, { maxPages = 40 } = {}) {
  let url = `${RETAIL_BASE}&$filter=${encodeURIComponent(filter)}`;
  const items = [];
  let pages = 0;
  while (url && pages < maxPages) {
    pages += 1;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Retail Prices HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const json = await res.json();
    items.push(...(json.Items || []));
    url = json.NextPageLink || null;
  }
  return items;
}

async function fetchRetailRates() {
  const filters = [
    "serviceName eq 'Foundry Models' and priceType eq 'Consumption' and contains(productName, 'GPT')",
    "serviceName eq 'Azure OpenAI' and priceType eq 'Consumption'",
  ];
  const all = [];
  for (const filter of filters) {
    try {
      const chunk = await fetchRetailPages(filter);
      all.push(...chunk);
    } catch (err) {
      console.warn(
        `  ⚠ Retail Prices fetch failed (${filter.slice(0, 40)}…): ${err instanceof Error ? err.message : err}`,
      );
    }
  }
  return ratesFromRetailItems(all);
}

function billingEnv() {
  loadLocalEnvFiles({ root: bqRoot });
  const account = (process.env.AZURE_BILLING_ACCOUNT_NAME || '').trim();
  const profile = (process.env.AZURE_BILLING_PROFILE_NAME || '').trim();
  return account && profile ? { account, profile } : null;
}

function resolveAccessToken() {
  const fromEnv = (process.env.AZURE_ACCESS_TOKEN || '').trim();
  if (fromEnv) return fromEnv;
  try {
    const out = execFileSync(
      'az',
      ['account', 'get-access-token', '--resource', 'https://management.azure.com/', '-o', 'json'],
      { encoding: 'utf8', timeout: 30000 },
    );
    const json = JSON.parse(out);
    return String(json.accessToken || '').trim() || null;
  } catch {
    return null;
  }
}

/**
 * Optional MCA/MPA price sheet — soft-fail to retail on any error.
 * Parses JSON download bodies when available; zip/CSV left as soft-fail.
 */
async function fetchPriceSheetRates() {
  const billing = billingEnv();
  if (!billing) return null;
  const token = resolveAccessToken();
  if (!token) {
    if (!warnedSheetFail) {
      warnedSheetFail = true;
      console.warn(
        '  ⚠ Price Sheet skipped: set AZURE_ACCESS_TOKEN or run `az login` (falling back to Retail)',
      );
    }
    return null;
  }

  const apiVersion = process.env.AZURE_PRICE_SHEET_API_VERSION || '2025-03-01';
  const url =
    `https://management.azure.com/providers/Microsoft.Billing/billingAccounts/${encodeURIComponent(billing.account)}` +
    `/billingProfiles/${encodeURIComponent(billing.profile)}` +
    `/providers/Microsoft.CostManagement/pricesheets/default/download?api-version=${apiVersion}`;

  try {
    let res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });

    if (res.status === 202) {
      const loc = res.headers.get('Location') || res.headers.get('location');
      if (!loc) return null;
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        res = await fetch(loc, { headers: { Authorization: `Bearer ${token}` } });
        if (res.status === 200) break;
      }
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const text = await res.text();
    if (contentType.includes('json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
      const data = JSON.parse(text);
      const downloadUrl = data.downloadUrl || data.properties?.downloadUrl;
      if (downloadUrl) {
        const fileRes = await fetch(downloadUrl);
        const body = await fileRes.text();
        return ratesFromPriceSheetBody(body);
      }
      return ratesFromPriceSheetBody(text);
    }
    if (!warnedSheetFail) {
      warnedSheetFail = true;
      console.warn(
        '  ⚠ Price Sheet returned non-JSON (zip/csv); use Retail rates. Prefer JSON export when available.',
      );
    }
    return null;
  } catch (err) {
    if (!warnedSheetFail) {
      warnedSheetFail = true;
      console.warn(
        `  ⚠ Price Sheet failed (${err instanceof Error ? err.message : err}); using Retail`,
      );
    }
    return null;
  }
}

function ratesFromPriceSheetBody(body) {
  try {
    const data = JSON.parse(body);
    const rows = Array.isArray(data) ? data : data.Items || data.items || data.value || [];
    // Reuse retail mapper shape when rows look like retail meters
    if (rows[0]?.meterName || rows[0]?.MeterName) {
      const normalized = rows.map((r) => ({
        meterName: r.meterName || r.MeterName,
        skuName: r.skuName || r.SkuName || r.skuId,
        armSkuName: r.armSkuName,
        productName: r.product || r.productName || r.Product,
        retailPrice: r.unitPrice || r.UnitPrice || r.marketPrice || r.retailPrice,
        unitOfMeasure: r.unitOfMeasure || r.UnitOfMeasure,
        isPrimaryMeterRegion: true,
        armRegionName: r.meterRegion || r.armRegionName,
      }));
      return ratesFromRetailItems(normalized);
    }
  } catch {
    /* not JSON */
  }
  return null;
}

function mergeRates(primary, secondary) {
  return { ...secondary, ...primary };
}

/**
 * Ensure in-memory rates are loaded (disk cache or remote fetch). Safe to call often.
 */
export async function ensureModelRates() {
  loadLocalEnvFiles({ root: bqRoot });
  if (memoryCache && isCacheFresh(memoryCache)) return memoryCache;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const disk = readDiskCache();
    if (disk && isCacheFresh(disk)) {
      memoryCache = disk;
      return memoryCache;
    }

    console.log('  ↪ Fetching Azure model rates (Retail Prices API; cache once)…');
    let source = 'retail';
    let rates = {};
    try {
      rates = await fetchRetailRates();
    } catch (err) {
      console.warn(
        `  ⚠ Retail rates unavailable: ${err instanceof Error ? err.message : err}`,
      );
    }

    const sheetRates = await fetchPriceSheetRates();
    if (sheetRates && Object.keys(sheetRates).length) {
      rates = mergeRates(sheetRates, rates);
      source = 'pricesheet';
      console.log(`  ✓ Model rates: Price Sheet override (${Object.keys(sheetRates).length} models) + Retail`);
    } else {
      console.log(`  ✓ Model rates: Retail (${Object.keys(rates).length} models mapped)`);
    }

    memoryCache = {
      fetchedAt: new Date().toISOString(),
      source,
      rates,
    };
    try {
      writeDiskCache(memoryCache);
    } catch (err) {
      console.warn(
        `  ⚠ Could not write rates cache: ${err instanceof Error ? err.message : err}`,
      );
    }
    return memoryCache;
  })().finally(() => {
    loadPromise = null;
  });

  return loadPromise;
}

/**
 * Resolve { input, output, source } for a deployment/model id.
 */
export function resolveModelRates(model) {
  const key = normalizeModelKey(model);
  const table = memoryCache?.rates || readDiskCache()?.rates || {};
  const source = memoryCache?.source || readDiskCache()?.source || 'hardcoded';

  let rates = table[model] || table[key];
  if (!rates) {
    for (const [id, r] of Object.entries(table)) {
      if (key.includes(id) || id.includes(key)) {
        rates = r;
        break;
      }
    }
  }
  if (rates) return { ...rates, source };

  rates = HARDCODED_MODEL_RATES_USD_PER_M[model] || HARDCODED_MODEL_RATES_USD_PER_M[key];
  if (!rates) {
    for (const [id, r] of Object.entries(HARDCODED_MODEL_RATES_USD_PER_M)) {
      if (key.includes(id) || id.includes(key)) {
        rates = r;
        break;
      }
    }
  }
  if (rates) return { ...rates, source: 'hardcoded' };
  return null;
}
