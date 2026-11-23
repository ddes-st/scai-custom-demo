/**
 * Stream AI / Brand Management API OAuth (client credentials).
 * Separate from Sites API Environment automation clients.
 */
const DEFAULT_AUTHORITY = 'https://auth.sitecorecloud.io';
const DEFAULT_AUDIENCE = 'https://api.sitecorecloud.io';

/** @type {{ token: string, expiresAt: number } | null} */
let cached = null;

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveBrandkitAuthConfig(env = process.env) {
  const clientId = String(
    env.SITECORE_STREAM_AI_CLIENT_ID || env.BQ_STREAM_AI_CLIENT_ID || '',
  ).trim();
  const clientSecret = String(
    env.SITECORE_STREAM_AI_CLIENT_SECRET || env.BQ_STREAM_AI_CLIENT_SECRET || '',
  ).trim();
  const organizationId = String(
    env.SITECORE_ORGANIZATION_ID || env.BQ_SITECORE_ORGANIZATION_ID || '',
  ).trim();
  const authority = String(
    env.SITECORE_STREAM_AI_AUTHORITY || DEFAULT_AUTHORITY,
  )
    .trim()
    .replace(/\/$/, '');
  const audience = String(
    env.SITECORE_STREAM_AI_AUDIENCE || DEFAULT_AUDIENCE,
  ).trim();

  const missing = [];
  if (!clientId) missing.push('SITECORE_STREAM_AI_CLIENT_ID');
  if (!clientSecret) missing.push('SITECORE_STREAM_AI_CLIENT_SECRET');
  if (!organizationId) missing.push('SITECORE_ORGANIZATION_ID');

  if (missing.length) {
    return {
      ok: false,
      skipReason: `Brand kit auth incomplete: missing ${missing.join(', ')}`,
    };
  }

  return {
    ok: true,
    clientId,
    clientSecret,
    organizationId,
    authority,
    audience,
  };
}

/**
 * @param {{
 *   clientId: string,
 *   clientSecret: string,
 *   authority: string,
 *   audience: string,
 *   forceRefresh?: boolean,
 * }} opts
 */
export async function getBrandkitAccessToken(opts) {
  const now = Date.now();
  if (
    !opts.forceRefresh &&
    cached?.token &&
    cached.expiresAt > now + 60_000
  ) {
    return cached.token;
  }

  const body = new URLSearchParams({
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    audience: opts.audience,
    grant_type: 'client_credentials',
  });

  const response = await fetch(`${opts.authority}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const text = await response.text().catch(() => '');
  if (!response.ok) {
    throw new Error(
      `[bq:brandkit:auth] Token request failed (${response.status}). ` +
        `Use Stream Admin → AI API keys credentials (scopes ai.org.brd:*). ${text.slice(0, 300)}`,
    );
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `[bq:brandkit:auth] Token response was not JSON: ${text.slice(0, 200)}`,
    );
  }

  const accessToken = String(json.access_token || '').trim();
  if (!accessToken) {
    throw new Error('[bq:brandkit:auth] Token response missing access_token');
  }

  const expiresInSec = Number(json.expires_in) || 86400;
  cached = {
    token: accessToken,
    expiresAt: now + expiresInSec * 1000,
  };
  return accessToken;
}

/** Test helper — clear cached token. */
export function clearBrandkitTokenCache() {
  cached = null;
}
