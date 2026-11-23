/**
 * Verbose terminal lines for item-id resolution (CM / disk / mint).
 * Gated by create --verbose / BQ_CREATE_LOG=verbose (same as create-log).
 */

const CREATE_LOG_ENV = "BQ_CREATE_LOG";

export function isIdResolveVerbose(): boolean {
  const raw = String(process.env[CREATE_LOG_ENV] || "")
    .trim()
    .toLowerCase();
  return raw === "verbose" || raw === "debug" || raw === "v";
}

/** Same gate as create `--verbose` / `BQ_CREATE_LOG=verbose` (alias for shared tools). */
export function isCreateVerbose(): boolean {
  return isIdResolveVerbose();
}

/**
 * Warn-level chatter for soft-fails / detail. Silent on default create log.
 * @param {...unknown} args
 */
export function warnCreateVerbose(...args: unknown[]): void {
  if (!isCreateVerbose()) return;
  console.warn(...args);
}

export type IdResolveSource = "cm" | "disk" | "mint" | "cache" | "missing";

/**
 * @param opts.sitecorePath Sitecore path being resolved (or short label)
 * @param opts.source Where the id came from
 * @param opts.id Canonical or dashed id that was chosen
 * @param opts.ms CM round-trip ms (only for source=cm)
 * @param opts.detail Extra note e.g. healed
 */
export function logIdResolve(opts: {
  sitecorePath: string;
  source: IdResolveSource;
  id: string;
  ms?: number;
  detail?: string;
  prefix?: string;
}): void {
  if (!isIdResolveVerbose()) return;
  const prefix = opts.prefix || "[bq:scaffold]";
  const pathLabel = String(opts.sitecorePath || "").trim() || "(unknown)";
  const id = String(opts.id || "").trim();
  const detail = opts.detail ? ` ${opts.detail}` : "";
  if (opts.source === "cm" && opts.ms != null && Number.isFinite(opts.ms)) {
    console.log(
      `${prefix} id ${pathLabel} → cm ${id} (${Math.max(0, Math.round(opts.ms))}ms)${detail}`,
    );
    return;
  }
  console.log(`${prefix} id ${pathLabel} → ${opts.source} ${id}${detail}`);
}
