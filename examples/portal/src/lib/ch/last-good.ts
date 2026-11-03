import "server-only";
/**
 * Degrading OUTSIDE a cache: a cached loader throws when its source doesn't answer (so the
 * failure is never cached), and the caller falls back here — to the last value this instance
 * loaded for the same key, else to a fixed fallback. Logged once per failure; after a failure
 * the source is left alone for a few seconds (the fallback answers), so an outage doesn't make
 * every render wait for its timeouts.
 */
const COOLDOWN_MS = 10_000;
const MAX_KEYS = 200;

export function withLastGood<A extends unknown[], R>(
  label: string,
  load: (...args: A) => Promise<R>,
  fallback: (...args: A) => R,
  keyOf: (...args: A) => string = (...args) => JSON.stringify(args),
): (...args: A) => Promise<R> {
  const good = new Map<string, R>();
  const failedAt = new Map<string, number>();
  return async (...args: A): Promise<R> => {
    const key = keyOf(...args);
    const prev = good.get(key);
    if (Date.now() - (failedAt.get(key) ?? 0) < COOLDOWN_MS) return prev !== undefined ? prev : fallback(...args);
    try {
      const value = await load(...args);
      good.delete(key);
      good.set(key, value);
      if (good.size > MAX_KEYS) good.delete(good.keys().next().value as string);
      failedAt.delete(key);
      return value;
    } catch (e: any) {
      failedAt.set(key, Date.now());
      if (failedAt.size > MAX_KEYS) failedAt.delete(failedAt.keys().next().value as string);
      console.warn(`${label}: source didn't answer, using ${prev !== undefined ? "the last good value" : "the fallback"}:`, e?.message ?? e);
      return prev !== undefined ? prev : fallback(...args);
    }
  };
}
