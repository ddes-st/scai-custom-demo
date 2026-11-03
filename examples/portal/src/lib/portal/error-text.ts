/**
 * Readable error texts for the Marketplace apps and the hub. An API answer can carry its error as
 * the head's own `{ error: "…" }`, as Vercel's platform error `{ error: { code, message } }` (a
 * deployment that isn't there, timed out or is paused — Vercel answers JSON to a JSON request), or
 * as GraphQL `{ errors: [{ message }] }`. Client-safe.
 */

/** Vercel's platform error codes (the `x-vercel-error` header, or `error.code`) in words. */
const VERCEL: Record<string, string> = {
  DEPLOYMENT_NOT_FOUND: "isn't deployed at this address",
  NOT_FOUND: "has no such page (an older version of the portal?)",
  FUNCTION_INVOCATION_TIMEOUT: "took too long to answer",
  FUNCTION_INVOCATION_FAILED: "failed while answering",
  EDGE_FUNCTION_INVOCATION_TIMEOUT: "took too long to answer",
  DEPLOYMENT_DISABLED: "is disabled on Vercel",
  DEPLOYMENT_PAUSED: "is paused on Vercel",
  DEPLOYMENT_BLOCKED: "is blocked on Vercel",
  DEPLOYMENT_NOT_READY_REDIRECTING: "is still being deployed",
  NO_RESPONSE_FROM_FUNCTION: "didn't answer",
};

/** The text of one error value: a string, an Error, `{ message }`, `{ code }`, else a short JSON. */
function textOf(e: unknown): string {
  if (e == null || e === "") return "";
  if (typeof e === "string") return e;
  if (typeof e === "object") {
    const o = e as Record<string, unknown>;
    const message = typeof o.message === "string" ? o.message : typeof o.detail === "string" ? o.detail : typeof o.title === "string" ? o.title : "";
    const code = typeof o.code === "string" || typeof o.code === "number" ? String(o.code) : "";
    if (message && code && !/^\d+$/.test(code) && !message.includes(code)) return `${message} (${code})`;
    if (message || code) return message || code;
    try { return JSON.stringify(e).slice(0, 200); } catch { return ""; }
  }
  return String(e);
}

/** The message of an API answer that failed; `fallback` when the body says nothing. */
export function errorText(body: unknown, fallback = "unknown error"): string {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const fromErrors = Array.isArray(b?.errors) ? b!.errors.map(textOf).filter(Boolean).join("; ") : "";
  return textOf(b?.error) || fromErrors || (typeof body === "string" ? body.trim().slice(0, 200) : "") || fallback;
}

/**
 * The hub's message when a site's portal answered with Vercel's own error instead of its API
 * (the `x-vercel-error` header): which portal, the status and the cause in words. null for the
 * portal's own answers, which are passed on as they are.
 */
export function platformErrorText(host: string, status: number, vercelError: string | null): string | null {
  const code = (vercelError || "").trim().toUpperCase();
  if (!code) return null;
  const cause = VERCEL[code] ?? "answered with a Vercel error";
  return `The site's portal (${host}) ${cause}: HTTP ${status} ${code}.`;
}
