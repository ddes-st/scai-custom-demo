import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTVerifyGetKey } from "jose";
import { CLAIM, verifySitecoreToken } from "../src/lib/portal/sitecore-token";

const ISS = "https://auth.sitecorecloud.io/", AUD = "https://api-webapp.sitecorecloud.io", ORG = "org_Yr0e8LadQ1bxB05s";
let keys: JWTVerifyGetKey, sign: (claims: Record<string, unknown>, opts?: { exp?: string; aud?: string; iss?: string; other?: boolean }) => Promise<string>;

before(async () => {
  const mine = await generateKeyPair("RS256"), other = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(mine.publicKey)), kid: "k1", alg: "RS256" };
  keys = createLocalJWKSet({ keys: [jwk] });
  sign = (claims, o = {}) => new SignJWT(claims).setProtectedHeader({ alg: "RS256", kid: "k1" }).setIssuer(o.iss ?? ISS).setAudience(o.aud ?? AUD).setIssuedAt().setExpirationTime(o.exp ?? "1h").sign(o.other ? other.privateKey : mine.privateKey);
});
const env = { PORTAL_ALLOWED_ORGS: `org_other, ${ORG}` };
const check = (t: string, e: Record<string, string> = env) => verifySitecoreToken(t, { env: e, keys, issuer: ISS, audience: AUD });

describe("verifySitecoreToken", () => {
  test("a token of an allowed organisation passes, with its claims", async () => {
    const r = await check(await sign({ [`${CLAIM}org_id`]: ORG, [`${CLAIM}tenant_name`]: "almuportal" }));
    assert.equal(r.ok, true);
    assert.equal(r.claims?.org, ORG);
    assert.equal(r.claims?.tenantName, "almuportal");
  });
  test("other organisations, audiences, issuers, keys and expired tokens fail", async () => {
    const org = await check(await sign({ [`${CLAIM}org_id`]: "org_x" }));
    assert.match(org.ok ? "" : org.reason, /organisation org_x isn't allowed/);
    const aud = await check(await sign({ [`${CLAIM}org_id`]: ORG }, { aud: "https://api.sitecorecloud.io" }));
    assert.equal(aud.ok, false); assert.match(aud.ok ? "" : aud.reason, /aud doesn't match/);
    assert.equal((await check(await sign({ [`${CLAIM}org_id`]: ORG }, { iss: "https://evil.example/" }))).ok, false);
    const sig = await check(await sign({ [`${CLAIM}org_id`]: ORG }, { other: true }));
    assert.match(sig.ok ? "" : sig.reason, /signature/);
    const exp = await check(await sign({ [`${CLAIM}org_id`]: ORG }, { exp: "-1m" }));
    assert.match(exp.ok ? "" : exp.reason, /expired/);
  });
  test("no allowed organisations or no JWT: nothing passes", async () => {
    const r = await check(await sign({ [`${CLAIM}org_id`]: ORG }), {});
    assert.match(r.ok ? "" : r.reason, /PORTAL_ALLOWED_ORGS/);
    assert.match(((await check("nope")) as { reason: string }).reason, /not a JWT/);
  });
});
