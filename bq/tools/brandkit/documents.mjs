/**
 * Document Management API — upload brand guideline PDF to a brand kit.
 * https://api-docs.sitecore.com/ai-skills/ai-document-management-rest-api
 */
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import {
  getBrandkitAccessToken,
  resolveBrandkitAuthConfig,
} from './auth.mjs';

export const DEFAULT_DOCUMENTS_API_BASE =
  'https://edge-platform.sitecorecloud.io/ai/ai-document-api';

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveDocumentsApiBase(env = process.env) {
  const raw = String(env.BQ_DOCUMENTS_API_BASE || '')
    .trim()
    .replace(/\/$/, '');
  return raw || DEFAULT_DOCUMENTS_API_BASE;
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export async function createDocumentsApiContext(env = process.env) {
  const auth = resolveBrandkitAuthConfig(env);
  if (!auth.ok) return { ok: false, skipReason: auth.skipReason };
  const token = await getBrandkitAccessToken(auth);
  return {
    ok: true,
    organizationId: auth.organizationId,
    baseUrl: resolveDocumentsApiBase(env),
    token,
  };
}

/**
 * Upload a local PDF as a brand kit document.
 * @param {{
 *   organizationId: string,
 *   baseUrl: string,
 *   token: string,
 * }} ctx
 * @param {{
 *   brandkitId: string,
 *   filePath: string,
 *   title?: string,
 *   summary?: string,
 * }} opts
 */
export async function uploadBrandkitDocument(ctx, opts) {
  const filePath = opts.filePath;
  const buf = await readFile(filePath);
  const fileStat = await stat(filePath);
  const fileName = path.basename(filePath);

  const createRequest = {
    url: '',
    setMetadata: true,
    status: 'pending',
    type: 'brand guidelines',
    fileType: 'PDF',
    size: `${Math.max(1, Math.round(fileStat.size / 1024))}KB`,
    title: opts.title || fileName,
    summary: opts.summary || 'BQ-generated brand guidelines from website capture',
    references: [
      {
        type: 'brandkit',
        id: opts.brandkitId,
        path: `/api/brands/v1/organizations/${ctx.organizationId}/brandkits/${opts.brandkitId}/references`,
      },
    ],
  };

  const form = new FormData();
  form.append(
    'file',
    new Blob([buf], { type: 'application/pdf' }),
    fileName,
  );
  form.append('create_request', JSON.stringify(createRequest));

  const url = `${ctx.baseUrl}/api/documents/v2/organizations/${encodeURIComponent(ctx.organizationId)}/documents`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      Accept: 'application/json',
    },
    body: form,
  });

  const raw = await response.text().catch(() => '');
  let data;
  try {
    data = raw.trim() ? JSON.parse(raw) : undefined;
  } catch {
    data = undefined;
  }

  if (!response.ok) {
    throw new Error(
      `[bq:brandkit:docs] upload failed (${response.status}). ${raw.slice(0, 500)}`,
    );
  }

  const documentId = String(
    data?.id || data?.documentId || data?.data?.id || '',
  ).trim();
  if (!documentId) {
    throw new Error(
      `[bq:brandkit:docs] upload response missing document id: ${raw.slice(0, 300)}`,
    );
  }

  return { documentId, data };
}

/**
 * @param {unknown} payload
 */
function asDocumentArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

/**
 * List documents for a brand kit (Documents API v2).
 * @param {{
 *   organizationId: string,
 *   baseUrl: string,
 *   token: string,
 * }} ctx
 * @param {{
 *   brandkitId: string,
 *   type?: string,
 *   pageSize?: number,
 * }} opts
 */
export async function listBrandkitDocuments(ctx, opts) {
  const qs = new URLSearchParams({
    pageNumber: '1',
    pageSize: String(opts.pageSize ?? 50),
    referenceType: 'brandkit',
    referenceId: opts.brandkitId,
    includeDeleted: 'false',
  });
  if (opts.type) qs.set('type', opts.type);

  const url = `${ctx.baseUrl}/api/documents/v2/organizations/${encodeURIComponent(ctx.organizationId)}/documents?${qs}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      Accept: 'application/json',
    },
  });

  const raw = await response.text().catch(() => '');
  let data;
  try {
    data = raw.trim() ? JSON.parse(raw) : undefined;
  } catch {
    data = undefined;
  }

  if (!response.ok) {
    throw new Error(
      `[bq:brandkit:docs] list failed (${response.status}). ${raw.slice(0, 500)}`,
    );
  }

  return asDocumentArray(data);
}

/**
 * Delete a document by id (Documents API v1). 404 is treated as already gone.
 * @param {{
 *   organizationId: string,
 *   baseUrl: string,
 *   token: string,
 * }} ctx
 * @param {string} documentId
 */
export async function deleteBrandkitDocument(ctx, documentId) {
  const id = String(documentId || '').trim();
  if (!id) return { ok: true, skipped: true, reason: 'empty documentId' };

  const url = `${ctx.baseUrl}/api/documents/v1/organizations/${encodeURIComponent(ctx.organizationId)}/documents/${encodeURIComponent(id)}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      Accept: 'application/json',
    },
  });

  if (response.ok || response.status === 404) {
    return { ok: true, status: response.status, alreadyGone: response.status === 404 };
  }

  const raw = await response.text().catch(() => '');
  throw new Error(
    `[bq:brandkit:docs] delete ${id} failed (${response.status}). ${raw.slice(0, 500)}`,
  );
}

/**
 * Union of state.documentId + listed brand-guidelines docs for this kit.
 * @param {{
 *   organizationId: string,
 *   baseUrl: string,
 *   token: string,
 * }} ctx
 * @param {{
 *   brandkitId: string,
 *   stateDocumentId?: string|null,
 * }} opts
 * @returns {Promise<string[]>}
 */
export async function resolvePriorGuidelineDocumentIds(ctx, opts) {
  /** @type {Set<string>} */
  const ids = new Set();
  const fromState = String(opts.stateDocumentId || '').trim();
  if (fromState) ids.add(fromState);

  try {
    const listed = await listBrandkitDocuments(ctx, {
      brandkitId: opts.brandkitId,
      type: 'brand guidelines',
    });
    for (const doc of listed) {
      const id = String(doc?.id || '').trim();
      if (id) ids.add(id);
    }
  } catch (err) {
    console.warn(
      `  ⚠ brandkit: list prior documents failed: ${err instanceof Error ? err.message : err}`,
    );
  }

  return [...ids];
}
