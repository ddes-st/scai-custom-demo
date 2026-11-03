/** Client-safe formatting for the university components. */
const tag = (locale: string) => (!locale || locale === "en" ? "en-US" : locale);

/** "$12,480" in the page language (USD — the programs' tuition currency). */
export function usd(v: number | null, locale: string): string {
  if (v == null) return "–";
  try { return new Intl.NumberFormat(tag(locale), { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v); } catch { return `$${Math.round(v)}`; }
}

export function shortDate(iso: string, locale: string, withTime = false): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // a date-only value (00:00 UTC) shows no time
  if (withTime && d.getUTCHours() === 0 && d.getUTCMinutes() === 0) withTime = false;
  const opts: Intl.DateTimeFormatOptions = { weekday: withTime ? "short" : undefined, day: "numeric", month: "short", year: withTime ? undefined : "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}), timeZone: "UTC" };
  try { return d.toLocaleString(tag(locale), opts); } catch { return iso.slice(0, 10); }
}

/** Typical length of a level in years (for the estimator's default). */
export function yearsFor(level: string, creditHours: number | null): number {
  if (creditHours) return Math.max(1, Math.round(creditHours / 30));
  return /bachelor/i.test(level) ? 4 : /master/i.test(level) ? 2 : /doctor|phd/i.test(level) ? 5 : 1;
}
