import "server-only";
import { createRemoteJWKSet, decodeJwt, errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";

/**
 * Verifies a Sitecore Cloud access token (Phase B of the Marketplace hub; see sitecore-auth.ts):
 * RS256 against auth.sitecorecloud.io's published keys, issuer, audience, expiry, and the
 * organisation claim against PORTAL_ALLOWED_ORGS (comma-separated org ids). Without allowed
 * organisations no token is accepted. Reasons and the claim summary never include the token.
 */
export const CLAIM = "https://auth.sitecorecloud.io/claims/";
const ISSUER = process.env.SITECORE_AUTH_ISSUER || "https://auth.sitecorecloud.io/";
const AUDIENCE = process.env.NEXT_PUBLIC_SITECORE_AUTH_AUDIENCE || "https://api-webapp.sitecorecloud.io";
let remote: JWTVerifyGetKey | null = null;
const jwks = () => (remote ??= createRemoteJWKSet(new URL(".well-known/jwks.json", ISSUER.endsWith("/") ? ISSUER : `${ISSUER}/`)));

export interface TokenSummary { iss: string; aud: string[]; org: string; orgName: string; tenant: string; tenantName: string; exp: number }
export type TokenCheck = { ok: true; claims: TokenSummary } | { ok: false; reason: string; claims?: TokenSummary };

export function summary(p: JWTPayload): TokenSummary {
  const s = (k: string) => String((p as Record<string, unknown>)[`${CLAIM}${k}`] ?? "");
  return { iss: String(p.iss ?? ""), aud: ([] as unknown[]).concat(p.aud ?? []).map(String), org: s("org_id"), orgName: s("org_display_name"), tenant: s("tenant_id"), tenantName: s("tenant_name"), exp: Number(p.exp ?? 0) };
}

export async function verifySitecoreToken(token: string, opts: { env?: Record<string, string | undefined>; keys?: JWTVerifyGetKey; issuer?: string; audience?: string } = {}): Promise<TokenCheck> {
  const env = opts.env ?? process.env;
  const allowed = (env.PORTAL_ALLOWED_ORGS || "").split(",").map((o) => o.trim()).filter(Boolean);
  let unverified: TokenSummary | undefined;
  try { unverified = summary(decodeJwt(token)); } catch { return { ok: false, reason: "not a JWT" }; }
  if (!allowed.length) return { ok: false, reason: "the hub has no PORTAL_ALLOWED_ORGS", claims: unverified };
  try {
    const { payload } = await jwtVerify(token, opts.keys ?? jwks(), { issuer: opts.issuer ?? ISSUER, audience: opts.audience ?? AUDIENCE, algorithms: ["RS256"] });
    const claims = summary(payload);
    if (!allowed.includes(claims.org)) return { ok: false, reason: `organisation ${claims.org || "(none)"} isn't allowed`, claims };
    return { ok: true, claims };
  } catch (e) {
    const reason = e instanceof errors.JWTExpired ? "expired"
      : e instanceof errors.JWTClaimValidationFailed ? `${e.claim} doesn't match (expected ${e.claim === "aud" ? opts.audience ?? AUDIENCE : e.claim === "iss" ? opts.issuer ?? ISSUER : "a valid value"})`
      : e instanceof errors.JWSSignatureVerificationFailed || e instanceof errors.JWKSNoMatchingKey ? "signature not from Sitecore's keys"
      : e instanceof errors.JOSEAlgNotAllowed ? "not RS256"
      : `not verifiable (${(e as Error)?.name || "error"})`;
    return { ok: false, reason, claims: unverified };
  }
}

/** The bearer token of a request, or "". */
export const bearerOf = (request: Request) => /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") || "")?.[1] ?? "";
