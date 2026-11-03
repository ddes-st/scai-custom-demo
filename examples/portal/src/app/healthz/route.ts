/**
 * GET /healthz — a fast liveness answer for the hosting platform's probes (the proxy matcher
 * already excludes this path, so it never goes through site resolution or Experience Edge).
 */
export const dynamic = "force-dynamic";

export function GET() {
  return new Response("ok", { status: 200, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
}
