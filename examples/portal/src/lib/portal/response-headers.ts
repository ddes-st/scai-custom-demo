/**
 * Response headers for every route (next.config headers()):
 * - /api/editing/*: Referrer-Policy no-referrer. SitecoreAI loads /api/editing/render?secret=… as a page
 *   (its screenshot renderer among others); without the policy every image, script and style of that page
 *   sent the full address — the editing secret included — as its Referer, into every request log line.
 * - PORTAL_NOINDEX=1 (an editing host): every response asks crawlers not to index or follow.
 */
export interface HeaderRule { source: string; headers: Array<{ key: string; value: string }> }

export function portalHeaders(env: Record<string, string | undefined> = process.env): HeaderRule[] {
  const rules: HeaderRule[] = [{ source: "/api/editing/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] }];
  if (env.PORTAL_NOINDEX === "1") rules.push({ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] });
  return rules;
}
