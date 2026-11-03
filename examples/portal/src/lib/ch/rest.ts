import "server-only";
/**
 * Server-side Content Hub REST access (read-only).
 *
 * Used for brand and asset METADATA only — the three content-backed sections come from
 * Experience Edge (lib/edge.ts), and all binaries are served through public links.
 */
import { env } from "./env";
import { activeCulture, pickCulture } from "./culture";
import { linkExpired } from "./edge";

let cachedToken: { value: string; fetchedAt: number } | null = null;
let signingIn: Promise<string> | null = null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Every Content Hub REST call gives up after this long (it holds one of the few semaphore slots). */
const API_TIMEOUT_MS = 20_000;
/** An upload chunk (up to 4 MB) gets longer. */
const UPLOAD_TIMEOUT_MS = 60_000;
const isTimeout = (e: unknown) => (e as any)?.name === "TimeoutError" || (e as any)?.name === "AbortError";

/** A Content Hub answer that wasn't 2xx; `status` tells a missing entity (404) from a failure. */
export class ChHttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
/** True when the error is Content Hub saying "not there" (404), not a failure. */
export const isNotFound = (e: unknown) => e instanceof ChHttpError && e.status === 404;
/** A delay with jitter, so instances that lost their token at the same moment don't sign in
 *  in lockstep (each sign-in revokes the others' tokens). */
const backoff = (base: number, attempt: number) => sleep(base * attempt + Math.random() * base);

/** One sign-in, retried when Content Hub throttles (429), errs (5xx) or the network drops.
 *  Wrong credentials (other 4xx) fail at once. */
async function signIn(): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    let r: Response | null = null;
    try {
      r = await fetch(`${env.chHost}/api/authenticate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_name: env.chUser, password: env.chPass }),
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      });
    } catch (e) {
      if (attempt >= 3 || isTimeout(e)) throw e;
    }
    if (r?.ok) {
      const { token } = await r.json();
      return token as string;
    }
    if (r && r.status !== 429 && r.status < 500) throw new Error(`Content Hub authentication failed (${r.status})`);
    if (attempt >= 3) throw new Error(`Content Hub authentication failed (${r?.status ?? "network"})`);
    await backoff(800, attempt + 1);
  }
}

/**
 * Content Hub keeps ONE token per user: every sign-in revokes the previous token. So this
 * instance signs in once and shares that token (concurrent first requests wait for the same
 * sign-in instead of revoking each other's tokens). Another holder of the same login (the
 * other portal mode, the demo builder, a second instance) still revokes it now and then —
 * chGet signs in again on a 401.
 */
async function authenticate(): Promise<string> {
  // CH tokens live long; refresh proactively after 30 minutes
  if (cachedToken && Date.now() - cachedToken.fetchedAt < 30 * 60 * 1000) return cachedToken.value;
  signingIn ??= signIn()
    .then((token) => {
      cachedToken = { value: token, fetchedAt: Date.now() };
      return token;
    })
    .finally(() => {
      signingIn = null;
    });
  return signingIn;
}

/**
 * Content Hub rate-limits bursts (429s observed at ~20 concurrent requests), so all REST calls
 * flow through a small semaphore and retry 429/5xx with exponential backoff.
 */
const MAX_IN_FLIGHT = 3;
let inFlight = 0;
const waiters: (() => void)[] = [];

/** A slot; waiting longer than `waitMs` for one fails (a busy Content Hub) instead of holding the request. */
async function acquire(waitMs = Infinity): Promise<void> {
  if (inFlight < MAX_IN_FLIGHT) {
    inFlight++;
    return;
  }
  await new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const waiter = () => {
      if (timer) clearTimeout(timer);
      resolve();
    };
    waiters.push(waiter);
    if (Number.isFinite(waitMs)) {
      timer = setTimeout(() => {
        const i = waiters.indexOf(waiter);
        if (i >= 0) waiters.splice(i, 1);
        reject(new ChHttpError("Content Hub is busy (no free slot in time)", 503));
      }, waitMs);
    }
  });
  inFlight++;
}

/**
 * How long one Content Hub read (chGet) may take in all — the wait for a slot, retries and throttling
 * pauses: a page gives up at about 15 s (maxDuration), so a read that can't finish in time fails
 * instead of holding the request until the platform's limit.
 */
export const CALL_BUDGET_MS = 12_000;

function release(): void {
  inFlight--;
  waiters.shift()?.();
}

/** Retries: a revoked token (401) up to 5 times with a growing, jittered pause — two holders of
 *  the same login can revoke each other a few times before one settles; 429 / 5xx / network
 *  errors 3 times with exponential backoff. */
export async function chGet(path: string): Promise<any> {
  const started = Date.now();
  const left = () => CALL_BUDGET_MS - (Date.now() - started);
  // a pause that would run past the budget ends the read (the caller shows its error state; nothing is cached)
  const pause = async (ms: number, status: number) => {
    if (ms >= left()) throw new ChHttpError(`CH GET ${path} -> ${status} (gave up: Content Hub busy)`, status);
    await sleep(ms);
  };
  await acquire(CALL_BUDGET_MS);
  try {
    let revoked = 0, failed = 0, timedOut = 0;
    for (;;) {
      const token = await authenticate();
      if (process.env.PORTAL_DEBUG_REST === "1") console.log(`[ch-rest] GET ${path.slice(0, 140)}`);
      let r: Response;
      try {
        r = await fetch(`${env.chHost}${path}`, { headers: { "X-Auth-Token": token }, signal: AbortSignal.timeout(Math.max(2000, Math.min(API_TIMEOUT_MS, left()))) });
      } catch (e) {
        // a timeout is retried once (the slot is held meanwhile), a network error up to 3 times — within the budget
        if (isTimeout(e) ? ++timedOut > 1 || left() < 2000 : ++failed > 3) throw e;
        if (!isTimeout(e)) await pause(1000 * 2 ** (failed - 1), 0);
        continue;
      }
      // awaited here: the slot is held (and the timeout applies) while the body arrives
      if (r.ok) return await r.json();
      if (r.status === 401 && ++revoked <= 5) {
        // only when no other request has signed in again meanwhile (else that token is fresh)
        if (cachedToken?.value === token) cachedToken = null;
        if (revoked > 1) await pause(300 * (revoked - 1) + Math.random() * 300, 401);
        continue;
      }
      if ((r.status === 429 || r.status >= 500) && ++failed <= 3) {
        await pause(1000 * 2 ** (failed - 1), r.status);
        continue;
      }
      throw new ChHttpError(`CH GET ${path} -> ${r.status}`, r.status);
    }
  } finally {
    release();
  }
}

/** A write (the portal's usage events), retried like chGet. Returns the status; other 4xx
 *  (e.g. a read-only login: 403) come back as they are, without retries. */
export async function chPost(path: string, body: unknown): Promise<{ status: number; location: string }> {
  await acquire();
  try {
    let revoked = 0, failed = 0;
    for (;;) {
      const token = await authenticate();
      let r: Response;
      try {
        r = await fetch(`${env.chHost}${path}`, { method: "POST", headers: { "X-Auth-Token": token, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(API_TIMEOUT_MS) });
      } catch (e) {
        // a timed-out write may have gone through: never repeated
        if (isTimeout(e) || ++failed > 3) throw e;
        await sleep(1000 * 2 ** (failed - 1));
        continue;
      }
      if (r.status === 401 && ++revoked <= 5) {
        if (cachedToken?.value === token) cachedToken = null;
        if (revoked > 1) await backoff(300, revoked - 1);
        continue;
      }
      if ((r.status === 429 || r.status >= 500) && ++failed <= 3) {
        await sleep(1000 * 2 ** (failed - 1));
        continue;
      }
      return { status: r.status, location: r.headers.get("location") ?? "" };
    }
  } finally {
    release();
  }
}

/**
 * Any write with its answer (partner uploads: entities, relations, the Upload API): POST, PUT or
 * DELETE with a JSON body or FormData (an upload chunk). Retried like chGet; other 4xx come back
 * as they are, with the parsed body and the Location header.
 */
export async function chSend(method: "POST" | "PUT" | "DELETE", path: string, body?: unknown): Promise<{ status: number; data: any; location: string }> {
  await acquire();
  try {
    let revoked = 0, failed = 0;
    for (;;) {
      const token = await authenticate();
      const form = typeof FormData !== "undefined" && body instanceof FormData;
      let r: Response;
      try {
        r = await fetch(`${env.chHost}${path}`, {
          method,
          cache: "no-store",
          headers: { "X-Auth-Token": token, ...(body !== undefined && !form ? { "Content-Type": "application/json" } : {}) },
          ...(body === undefined ? {} : { body: form ? (body as FormData) : JSON.stringify(body) }),
          signal: AbortSignal.timeout(form ? UPLOAD_TIMEOUT_MS : API_TIMEOUT_MS),
        });
      } catch (e) {
        // a timed-out write may have gone through: never repeated
        if (isTimeout(e) || ++failed > 3) throw e;
        await sleep(1000 * 2 ** (failed - 1));
        continue;
      }
      if (r.status === 401 && ++revoked <= 5) {
        if (cachedToken?.value === token) cachedToken = null;
        if (revoked > 1) await backoff(300, revoked - 1);
        continue;
      }
      if ((r.status === 429 || r.status >= 500) && ++failed <= 3) {
        await sleep(1000 * 2 ** (failed - 1));
        continue;
      }
      const text = await r.text().catch(() => "");
      let data: any = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = text; }
      return { status: r.status, data, location: r.headers.get("location") ?? "" };
    }
  } finally {
    release();
  }
}

export async function queryEntities(query: string): Promise<any[]> {
  let skip = 0;
  let all: any[] = [];
  for (let guard = 0; guard < 20; guard++) {
    const data = await chGet(`/api/entities/query?query=${encodeURIComponent(query)}&skip=${skip}&take=100`);
    const items = data?.items || [];
    all = all.concat(items);
    if (items.length < 100) return all;
    skip += 100;
  }
  console.warn(`ch rest: query capped at ${all.length} results: ${query.slice(0, 120)}`);
  return all;
}

/**
 * Every entity of a definition (`/api/entitydefinitions/<name>/entities`), paged 100 at a time
 * up to `max`. Throws when a page fails — a partial list must not be cached as the whole one.
 */
export async function definitionEntities(definition: string, max = 2000): Promise<any[]> {
  const all: any[] = [];
  for (let skip = 0; skip < max; skip += 100) {
    const data = await chGet(`/api/entitydefinitions/${encodeURIComponent(definition)}/entities?skip=${skip}&take=100`);
    const items: any[] = data?.items || data?.content?.items || [];
    all.push(...items);
    const total = Number(data?.total_items ?? data?.content?.total_items);
    if (items.length < 100 || (Number.isFinite(total) && all.length >= total)) return all;
  }
  console.warn(`ch rest: ${definition} entities capped at ${max}`);
  return all.slice(0, max);
}

const identifierIds = new Map<string, number>();

/**
 * An identifier's numeric id; null when Content Hub has no such entity (404). THROWS on any
 * other failure — for cached loaders, where "not there" and "didn't answer" must differ.
 */
export async function resolveIdentifierStrict(identifier: string): Promise<number | null> {
  const hit = identifierIds.get(identifier);
  if (hit !== undefined) return hit;
  let data: any;
  try {
    data = await chGet(`/api/entities/identifier/${encodeURIComponent(identifier)}`);
  } catch (e) {
    if (isNotFound(e)) return null;
    throw e;
  }
  const id = typeof data?.id === "number" ? data.id : null;
  // ONLY cache success — a transient 429/5xx must not poison this lambda instance's cache
  // (symptom: the same asset randomly 404s on some requests but not others)
  if (id != null) identifierIds.set(identifier, id);
  return id;
}

/** resolveIdentifierStrict, with any failure as null (resolved again next time). */
export async function resolveIdentifier(identifier: string): Promise<number | null> {
  try {
    return await resolveIdentifierStrict(identifier);
  } catch {
    return null;
  }
}

export function extractPropValue(props: any, key: string): string {
  const v = props?.[key];
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    if (typeof v.invariant === "string" && v.invariant) return v.invariant;
    return pickCulture(v as Record<string, unknown>, activeCulture());
  }
  return "";
}

export async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}


/**
 * Resolve an asset's PUBLIC LINK for the original rendition with a single query
 * (M.PublicLink filtered by parent asset + Resource) -> https://<host>/api/public/content/<relativeUrl>.
 * Empty string when no usable link exists (none, disabled or expired — create them with
 * scripts/create-public-links.mjs). THROWS when Content Hub doesn't answer (cached loaders).
 */
export async function publicLinkUrlStrict(assetId: number): Promise<string> {
  const q = `Definition.Name=='M.PublicLink' AND Parent('AssetToPublicLink').id==${assetId} AND String('Resource')=='downloadOriginal'`;
  const data = await chGet(`/api/entities/query?query=${encodeURIComponent(q)}&take=10`);
  // assets can carry several downloadOriginal links (named crop variants) — prefer the
  // uncropped one, whose relative URL is the auto-generated 32-hex name
  let fallback = "";
  for (const link of data?.items || []) {
    const props = link?.properties ?? {};
    const relativeUrl = props.RelativeUrl;
    if (!relativeUrl || props.IsDisabled === true || linkExpired(props.ExpirationDate ?? props.ExpiredOn)) continue;
    const version = props.VersionHash ? `?v=${props.VersionHash}` : "";
    const url = `${env.chHost}/api/public/content/${relativeUrl}${version}`;
    if (/^[0-9a-f]{32}$/i.test(relativeUrl)) return url;
    if (!fallback) fallback = url;
  }
  return fallback;
}

/** publicLinkUrlStrict, with a failure as "" (no link). */
export async function publicLinkUrl(assetId: number): Promise<string> {
  try {
    return await publicLinkUrlStrict(assetId);
  } catch {
    return "";
  }
}
