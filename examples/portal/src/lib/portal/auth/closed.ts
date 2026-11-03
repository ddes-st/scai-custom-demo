import "server-only";
import { NextResponse } from "next/server";

/**
 * Gated mode, or a deployment that mustn't be indexed (PORTAL_NOINDEX=1, e.g. an editing host):
 * the discovery files (sitemaps, llms.txt, ai.txt) are empty and robots.txt keeps every crawler
 * out. Null otherwise.
 */
export function closedSiteResponse(kind: "xml" | "text" | "robots"): NextResponse | null {
  if ((process.env.SITE_MODE || "public") !== "gated" && process.env.PORTAL_NOINDEX !== "1") return null;
  const headers = { "Cache-Control": "public, max-age=300", "X-Robots-Tag": "noindex" };
  if (kind === "xml") return new NextResponse('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n', { headers: { ...headers, "Content-Type": "application/xml; charset=utf-8" } });
  if (kind === "robots") return new NextResponse("User-agent: *\nDisallow: /\n", { headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" } });
  return new NextResponse("", { status: 404, headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" } });
}
