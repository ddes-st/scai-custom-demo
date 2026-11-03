import "server-only";

/**
 * Small in-memory limits for the routes anyone can call (sign-in, usage beacons). Per server
 * instance, so a brake rather than a wall — enough to stop a single client hammering one
 * instance; a shared store (KV) would be the next step. Maps are bounded.
 */
export function clientIp(headers: Headers): string {
  // Vercel sets x-vercel-forwarded-for / x-real-ip itself; x-forwarded-for's first entry is client-supplied elsewhere
  return (headers.get("x-vercel-forwarded-for") || headers.get("x-real-ip") || headers.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 64) || "unknown";
}

interface Window { n: number; since: number }

export class Limiter {
  private hits = new Map<string, Window>();
  constructor(private max: number, private windowMs: number, private cap = 10_000) {}

  /** True when `key` has used up its attempts in the current window (does not count). */
  blocked(key: string, now = Date.now()): boolean {
    const w = this.hits.get(key);
    return !!w && now - w.since < this.windowMs && w.n >= this.max;
  }

  /** Counts one attempt; true when it is over the limit. */
  hit(key: string, now = Date.now()): boolean {
    const w = this.hits.get(key);
    if (!w || now - w.since >= this.windowMs) {
      if (this.hits.size >= this.cap) this.sweep(now);
      this.hits.set(key, { n: 1, since: now });
      return this.max < 1;
    }
    w.n++;
    return w.n > this.max;
  }

  reset(key: string) { this.hits.delete(key); }

  private sweep(now: number) {
    for (const [k, w] of this.hits) if (now - w.since >= this.windowMs) this.hits.delete(k);
    // still full: drop the oldest half rather than grow without bound
    if (this.hits.size >= this.cap) [...this.hits.keys()].slice(0, Math.ceil(this.cap / 2)).forEach((k) => this.hits.delete(k));
  }
}
