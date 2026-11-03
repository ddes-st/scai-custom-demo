export function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/** A short date in the page's language (`locale`, else British English), by its calendar day in UTC. */
export function formatDate(iso: string | null, locale = ""): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "2-digit", timeZone: "UTC" };
  try {
    return d.toLocaleDateString(locale && locale !== "en" ? locale : "en-GB", opts);
  } catch {
    return d.toLocaleDateString("en-GB", opts);
  }
}

/**
 * Content Hub stores FileSize in MEGABYTES on stock tenants (verified live).
 * Values large enough to be implausible as MB are treated as raw bytes.
 */
export function fileSizeToBytes(raw: any): number | null {
  const n = Number(raw) || null;
  if (n == null) return null;
  return n > 100_000 ? n : Math.round(n * 1024 * 1024);
}

export function fileExtension(fileName: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(fileName || "");
  return (m?.[1] || "PDF").toUpperCase();
}
