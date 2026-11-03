import "server-only";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Who may sign in (demo identity store, replaceable by an identity provider):
 *  - staff: PORTAL_USER with PORTAL_PASSWORD_HASH (preferred) or PORTAL_PASSWORD;
 *  - partners: PORTAL_PARTNERS = JSON array of { "u": "<user>", "h": "<hash>" } (or "p" for a
 *    plain demo password), optionally "l": the sign-in name made from the contact person's name
 *    ("matthias-rothenbacher"), accepted besides `u`. `u` stays the partner's key — the session
 *    subject p:<u>, the kit, the uploads, the routes and the User field of its SitecoreAI item
 *    (Data/Partners) — the profile lives there, the secret never does.
 * Hashes: `scrypt$<salt hex>$<hash hex>` from `node tools/hash-password.mjs` (asks for the password).
 */
export interface Login { user: string; subject: string }

const USER = /^[a-z0-9-]{1,40}$/;

export function hashPassword(password: string, salt = randomBytes(16)): string {
  return `scrypt$${salt.toString("hex")}$${scryptSync(password, salt, 32).toString("hex")}`;
}

export function verifyPassword(password: string, stored: { hash?: string; plain?: string }): boolean {
  if (stored.hash) {
    const m = /^scrypt\$([0-9a-f]+)\$([0-9a-f]+)$/i.exec(stored.hash.trim());
    if (!m) return false;
    const want = Buffer.from(m[2], "hex");
    const got = scryptSync(password, Buffer.from(m[1], "hex"), want.length);
    return want.length === got.length && timingSafeEqual(want, got);
  }
  if (stored.plain && stored.plain.length >= 8) {
    const a = Buffer.from(stored.plain), b = Buffer.from(password);
    return a.length === b.length && timingSafeEqual(a, b);
  }
  return false;
}

interface PartnerLogin { user: string; login: string; hash?: string; plain?: string }

export function partnerLogins(): PartnerLogin[] {
  try {
    const list = JSON.parse(process.env.PORTAL_PARTNERS || "[]");
    return (Array.isArray(list) ? list : [])
      .map((x: any) => ({ user: String(x?.u ?? "").toLowerCase(), login: USER.test(String(x?.l ?? "")) ? String(x.l) : "", hash: typeof x?.h === "string" ? x.h : undefined, plain: typeof x?.p === "string" ? x.p : undefined }))
      .filter((x: PartnerLogin) => USER.test(x.user) && (x.hash || x.plain));
  } catch { return []; }
}

/** The users who may sign in as partners (for the viewer: a partner removed from the list is cut off at once). */
export const partnerUsers = () => new Set(partnerLogins().map((p) => p.user));

// checked when no account matches, so an unknown name costs the same scrypt as a known one
const DUMMY = { hash: hashPassword("portal-dummy-password", Buffer.alloc(16, 7)) };

/** Checks a login; null when it fails. Staff first, then the partner list. */
export function verifyLogin(user: string, password: string): Login | null {
  const u = user.trim().toLowerCase();
  if (!USER.test(u) || !password) return null;
  const staffUser = (process.env.PORTAL_USER || "").trim().toLowerCase();
  if (staffUser && u === staffUser && verifyPassword(password, { hash: process.env.PORTAL_PASSWORD_HASH, plain: process.env.PORTAL_PASSWORD })) return { user: u, subject: "staff" };
  // the key first, then the contact's sign-in name; either way the session is the partner's key
  const logins = partnerLogins();
  const partner = logins.find((p) => p.user === u) ?? logins.find((p) => p.login === u);
  if (partner) return verifyPassword(password, partner) ? { user: partner.user, subject: `p:${partner.user}` } : null;
  verifyPassword(password, DUMMY);
  return null;
}
