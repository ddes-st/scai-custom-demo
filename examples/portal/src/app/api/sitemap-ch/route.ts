/**
 * GET /sitemap-ch.xml (rewritten to /api/sitemap-ch): the Content Hub detail pages — brand
 * books, products and press releases — as a plain sitemap. Referenced from the main sitemap
 * (see /api/sitemap) and usable on its own.
 */
import { NextRequest, NextResponse } from "next/server";
import { getBaseUrl } from "lib/utils";
import { contentHubSitemapEntries, urlsetXml } from "src/lib/portal/sitemap";
import { closedSiteResponse } from "src/lib/portal/auth/closed";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const closed = closedSiteResponse("xml");
  if (closed) return closed;
  const base = process.env.NEXT_PUBLIC_SITE_URL || getBaseUrl(request.headers.get("host"));
  const entries = await contentHubSitemapEntries(base);
  return new NextResponse(urlsetXml(entries), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=300, s-maxage=900" },
  });
}
