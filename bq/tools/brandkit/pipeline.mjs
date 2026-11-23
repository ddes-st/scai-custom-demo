/**
 * Pipeline API — BrandIngestionPipeline (Stream "Publish").
 * https://api-docs.sitecore.com/ai-skills/ai-pipeline-rest-api
 */
import {
  getBrandkitAccessToken,
  resolveBrandkitAuthConfig,
} from './auth.mjs';

export const DEFAULT_PIPELINE_API_BASE =
  'https://edge-platform.sitecorecloud.io/ai/ai-pipeline-api';

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolvePipelineApiBase(env = process.env) {
  const raw = String(env.BQ_PIPELINE_API_BASE || '')
    .trim()
    .replace(/\/$/, '');
  return raw || DEFAULT_PIPELINE_API_BASE;
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export async function createPipelineApiContext(env = process.env) {
  const auth = resolveBrandkitAuthConfig(env);
  if (!auth.ok) return { ok: false, skipReason: auth.skipReason };
  const token = await getBrandkitAccessToken(auth);
  return {
    ok: true,
    organizationId: auth.organizationId,
    baseUrl: resolvePipelineApiBase(env),
    token,
  };
}

/**
 * Start brand ingestion for uploaded document(s).
 * @param {{
 *   organizationId: string,
 *   baseUrl: string,
 *   token: string,
 * }} ctx
 * @param {{
 *   brandkitId: string,
 *   documentId?: string,
 *   populateSections?: boolean,
 * }} opts
 */
export async function runBrandIngestionPipeline(ctx, opts) {
  const parameters = {
    brand_kit_id: opts.brandkitId,
    populateSections: opts.populateSections === true,
  };
  if (opts.documentId) {
    parameters.documentIdsList = opts.documentId;
  }

  const url = `${ctx.baseUrl}/api/data/v1/organizations/${encodeURIComponent(ctx.organizationId)}/pipeline/BrandIngestionPipeline`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ parameters }),
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
      `[bq:brandkit:pipeline] BrandIngestionPipeline failed (${response.status}). ${raw.slice(0, 500)}`,
    );
  }

  return {
    pipelineRunId: String(data?.id || '').trim() || null,
    status: data?.status || null,
    data,
  };
}
