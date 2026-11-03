import { createSitemapRouteHandler } from '@sitecore-content-sdk/nextjs/route-handler';
import { NextRequest, NextResponse } from 'next/server';
import sites from '.sitecore/sites.json';
import client from 'lib/sitecore-client';
import { getBaseUrl } from 'lib/utils';
import { contentHubSitemapEntries, sitemapIndexEntryXml, urlXml, urlsetXml } from 'src/lib/portal/sitemap';
import { closedSiteResponse } from 'src/lib/portal/auth/closed';

export const dynamic = 'force-dynamic';

/**
 * API route for generating sitemap.xml
 *
 * SitecoreAI's sitemap (configured in the site settings) lists the page items; the Content Hub
 * detail pages — brand books, products, press releases — are added here:
 *  - a sitemap index gets one more <sitemap> pointing at /sitemap-ch.xml,
 *  - a single urlset (sitemap.xml) gets the detail URLs appended,
 *  - numbered sitemaps (/sitemap-N.xml) pass through unchanged,
 *  - no SitecoreAI sitemap at all → a sitemap made of the detail URLs alone.
 */
const { GET: sitecoreGET } = createSitemapRouteHandler({ client, sites });

export async function GET(request: NextRequest) {
  const closed = closedSiteResponse("xml");
  if (closed) return closed;
  const pathname = request.nextUrl.pathname;
  const numbered = /^\/sitemap-\d+\.xml$/i.test(pathname) || /^\/sitemap-\d+\.xml$/i.test(request.headers.get('x-invoke-path') || '');
  const base = process.env.NEXT_PUBLIC_SITE_URL || getBaseUrl(request.headers.get('x-forwarded-host') || request.headers.get('host'));
  const headers = { 'Content-Type': 'text/xml;charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=900' };

  const res = await sitecoreGET(request);
  if (numbered) return res;
  const xml = res.ok ? await res.text() : '';

  if (/<sitemapindex[\s>]/i.test(xml)) {
    return new NextResponse(xml.replace(/<\/sitemapindex>/i, `${sitemapIndexEntryXml(`${base}/sitemap-ch.xml`)}</sitemapindex>`), { headers });
  }
  const entries = await contentHubSitemapEntries(base);
  if (/<urlset[\s>]/i.test(xml)) {
    return new NextResponse(normalize(xml, base).replace(/<\/urlset>/i, `${entries.map(urlXml).join('')}</urlset>`), { headers });
  }
  return new NextResponse(urlsetXml(entries), { headers });
}

/**
 * SitecoreAI writes its sitemap with the site's target hostname — the CM host when none is set
 * in the site settings — and lists the wildcard pages (`,-w-,`) as pages. Rewrite the origin to
 * the public one and drop the wildcard entries (their real URLs come from Content Hub).
 */
function normalize(xml: string, base: string): string {
  const origin = base.replace(/\/$/, '');
  return xml.replace(/<url>[\s\S]*?<\/url>/gi, (block) => {
    const loc = /<loc>([^<]*)<\/loc>/i.exec(block)?.[1] ?? '';
    if (/,-w-,|%2C-w-%2C/i.test(loc)) return '';
    try {
      const u = new URL(loc.trim());
      const fixed = `${origin}${u.pathname === '/' ? '' : u.pathname}${u.search}`;
      return block.replace(loc, fixed);
    } catch {
      return block;
    }
  });
}
