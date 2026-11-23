/**
 * Brand Management REST API client.
 * Docs: https://api-docs.sitecore.com/ai-skills/ai-brand-management-rest-api
 */
import {
  getBrandkitAccessToken,
  resolveBrandkitAuthConfig,
} from './auth.mjs';

export const DEFAULT_BRANDS_API_BASE =
  'https://edge-platform.sitecorecloud.io/ai/ai-brands-api';

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveBrandsApiBase(env = process.env) {
  const raw = String(env.BQ_BRANDS_API_BASE || '').trim().replace(/\/$/, '');
  return raw || DEFAULT_BRANDS_API_BASE;
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export async function createBrandkitApiContext(env = process.env) {
  const auth = resolveBrandkitAuthConfig(env);
  if (!auth.ok) {
    return { ok: false, skipReason: auth.skipReason };
  }
  const token = await getBrandkitAccessToken(auth);
  return {
    ok: true,
    organizationId: auth.organizationId,
    baseUrl: resolveBrandsApiBase(env),
    token,
  };
}

/**
 * @param {{ baseUrl: string, token: string }} ctx
 * @param {string} method
 * @param {string} apiPath — path starting with /api/...
 * @param {unknown} [body]
 */
export async function brandkitFetch(ctx, method, apiPath, body) {
  const url = `${ctx.baseUrl}${apiPath}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      Accept: 'application/json',
      ...(body !== undefined
        ? { 'Content-Type': 'application/json' }
        : undefined),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const raw = await response.text().catch(() => '');
  let data;
  if (raw.trim()) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = undefined;
    }
  }

  if (!response.ok) {
    const err = new Error(
      `[bq:brandkit] ${method} ${apiPath} failed (${response.status}). ${raw.slice(0, 500)}`,
    );
    err.status = response.status;
    err.body = data ?? raw;
    throw err;
  }

  return { status: response.status, data, raw };
}

/**
 * @param {unknown} err
 */
export function isDuplicateBrandKitNameError(err) {
  const status = err?.status;
  const text = `${err?.message || ''} ${typeof err?.body === 'string' ? err.body : JSON.stringify(err?.body || '')}`.toLowerCase();
  if (status === 400 || status === 409) {
    return /duplicate|already exists|name.*exist|conflict/.test(text);
  }
  return /duplicate brand kit name/.test(text);
}

function asArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

/**
 * @param {{ organizationId: string, baseUrl: string, token: string }} ctx
 * @param {{ search?: string, pageSize?: number, pageNumber?: number }} [opts]
 */
export async function listBrandKits(ctx, opts = {}) {
  const pageSize = opts.pageSize ?? 100;
  const pageNumber = opts.pageNumber ?? 1;
  const qs = new URLSearchParams({
    pageNumber: String(pageNumber),
    pageSize: String(pageSize),
  });
  if (opts.search) qs.set('search', opts.search);
  const { data } = await brandkitFetch(
    ctx,
    'GET',
    `/api/brands/v1/organizations/${encodeURIComponent(ctx.organizationId)}/brandkits?${qs}`,
  );
  return asArray(data);
}

/**
 * Paginate until match or pages exhausted (cap 10 pages).
 * @param {{ organizationId: string, baseUrl: string, token: string }} ctx
 * @param {string} kitName
 */
export async function findBrandKitByName(ctx, kitName) {
  const want = String(kitName || '')
    .trim()
    .toLowerCase();
  if (!want) return null;
  const pageSize = 100;
  for (let page = 1; page <= 10; page++) {
    const kits = await listBrandKits(ctx, {
      search: kitName,
      pageSize,
      pageNumber: page,
    });
    const match = kits.find(
      (k) => String(k?.name || '').trim().toLowerCase() === want,
    );
    if (match?.id) return match;
    if (kits.length < pageSize) break;
  }
  // Fallback: unfiltered pages (search may be fuzzy-only)
  for (let page = 1; page <= 5; page++) {
    const kits = await listBrandKits(ctx, { pageSize, pageNumber: page });
    const match = kits.find(
      (k) => String(k?.name || '').trim().toLowerCase() === want,
    );
    if (match?.id) return match;
    if (kits.length < pageSize) break;
  }
  return null;
}

/**
 * @param {{ organizationId: string, baseUrl: string, token: string }} ctx
 * @param {string} brandkitId
 */
export async function getBrandKit(ctx, brandkitId) {
  const { data } = await brandkitFetch(
    ctx,
    'GET',
    `/api/brands/v1/organizations/${encodeURIComponent(ctx.organizationId)}/brandkits/${encodeURIComponent(brandkitId)}`,
  );
  return data;
}

/**
 * @param {{ organizationId: string, baseUrl: string, token: string }} ctx
 * @param {{
 *   name: string,
 *   description?: string,
 *   industry?: string,
 *   brandName?: string,
 *   companyName?: string,
 *   logo?: string,
 * }} body
 */
export async function createBrandKit(ctx, body) {
  const { data } = await brandkitFetch(
    ctx,
    'POST',
    `/api/brands/v1/organizations/${encodeURIComponent(ctx.organizationId)}/brandkits`,
    body,
  );
  return data;
}

/**
 * Best-effort partial update of kit metadata (e.g. logo). May 404/405 if unsupported.
 * @param {{ organizationId: string, baseUrl: string, token: string }} ctx
 * @param {string} brandkitId
 * @param {{ logo?: string, description?: string, brandName?: string }} patch
 */
export async function patchBrandKit(ctx, brandkitId, patch) {
  const { data } = await brandkitFetch(
    ctx,
    'PATCH',
    `/api/brands/v1/organizations/${encodeURIComponent(ctx.organizationId)}/brandkits/${encodeURIComponent(brandkitId)}`,
    patch,
  );
  return data;
}

/**
 * @param {{ organizationId: string, baseUrl: string, token: string }} ctx
 * @param {string} brandkitId
 */
export async function listBrandKitSections(ctx, brandkitId) {
  const { data } = await brandkitFetch(
    ctx,
    'GET',
    `/api/brands/v1/organizations/${encodeURIComponent(ctx.organizationId)}/brandkits/${encodeURIComponent(brandkitId)}/sections`,
  );
  return asArray(data);
}

/**
 * @param {{ organizationId: string, baseUrl: string, token: string }} ctx
 * @param {string} brandkitId
 * @param {string} sectionId
 */
export async function listBrandKitSectionFields(ctx, brandkitId, sectionId) {
  const { data } = await brandkitFetch(
    ctx,
    'GET',
    `/api/brands/v2/organizations/${encodeURIComponent(ctx.organizationId)}/brandkits/${encodeURIComponent(brandkitId)}/sections/${encodeURIComponent(sectionId)}/fields`,
  );
  return asArray(data);
}

/**
 * Create a custom brand kit subsection (field).
 * @param {{ organizationId: string, baseUrl: string, token: string }} ctx
 * @param {string} brandkitId
 * @param {string} sectionId
 * @param {{
 *   name: string,
 *   type?: string,
 *   value?: unknown,
 *   aiEditable?: boolean,
 *   verified?: boolean,
 *   order?: number,
 * }} body
 */
export async function createBrandKitSectionField(
  ctx,
  brandkitId,
  sectionId,
  body,
) {
  const { data } = await brandkitFetch(
    ctx,
    'POST',
    `/api/brands/v2/organizations/${encodeURIComponent(ctx.organizationId)}/brandkits/${encodeURIComponent(brandkitId)}/sections/${encodeURIComponent(sectionId)}/fields`,
    {
      type: 'text',
      aiEditable: false,
      verified: false,
      ...body,
      name: body.name,
    },
  );
  return data;
}

/**
 * @param {{ organizationId: string, baseUrl: string, token: string }} ctx
 * @param {string} brandkitId
 * @param {string} sectionId
 * @param {string} fieldId
 * @param {{ value?: unknown, aiEditable?: boolean, verified?: boolean }} patch
 */
export async function updateBrandKitSectionField(
  ctx,
  brandkitId,
  sectionId,
  fieldId,
  patch,
) {
  const { data } = await brandkitFetch(
    ctx,
    'PATCH',
    `/api/brands/v2/organizations/${encodeURIComponent(ctx.organizationId)}/brandkits/${encodeURIComponent(brandkitId)}/sections/${encodeURIComponent(sectionId)}/fields/${encodeURIComponent(fieldId)}`,
    patch,
  );
  return data;
}
