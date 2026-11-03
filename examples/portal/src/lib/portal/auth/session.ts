/**
 * The portal's stateless session: an HMAC-SHA256 signed token `<expiry>.<subject>.<signature>`
 * in an HttpOnly cookie, keyed by AUTH_SECRET. The subject says who signed in — `staff` (the
 * portal's own login: every section) or `p:<user>` (a channel partner: the public sections and
 * its own partner kit). Web Crypto only, so the proxy (edge runtime) and the route handlers
 * verify it the same way. Replace this module with an identity provider (Auth.js) when the
 * portal goes beyond a demo; getViewer() and the gate only depend on the subject.
 */
export const SESSION_COOKIE = "portal_session";
export const SESSION_TTL_S = 12 * 60 * 60;

const SUBJECT = /^(staff|p:[a-z0-9-]{1,40})$/;

const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");

async function hmac(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
}

const equal = (a: string, b: string) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

export async function createSessionToken(secret: string, subject: string): Promise<string> {
  if (!SUBJECT.test(subject)) throw new Error("invalid session subject");
  const exp = String(Date.now() + SESSION_TTL_S * 1000);
  return `${exp}.${subject}.${await hmac(`${exp}.${subject}`, secret)}`;
}

/** The token's subject ("staff" or "p:<user>"), or null when it is missing, expired or forged. */
export async function sessionSubject(token: string | undefined, secret: string): Promise<string | null> {
  if (!token || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [exp, subject, sig] = parts;
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now() || !SUBJECT.test(subject)) return null;
  return equal(sig, await hmac(`${exp}.${subject}`, secret)) ? subject : null;
}

export const partnerUserOf = (subject: string | null) => (subject?.startsWith("p:") ? subject.slice(2) : "");
