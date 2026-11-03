/**
 * Same-origin binary proxy for the two consumers that need CORS-clean bytes in the browser:
 * PDF.js documents and FontFace font loading. Restricted to this tenant's public-link URLs —
 * everything else is refused, so the route cannot be used as an open proxy. Files above the
 * rendering host's function-response limit (Vercel: 4.5 MB) are redirected to the public link.
 */
import { NextRequest } from "next/server";
import { env } from "src/lib/ch/env";
import { proxiedFileHeaders } from "src/lib/ch/assetAccess";

export const dynamic = "force-dynamic";

const MAX_PROXIED_BYTES = 4 * 1024 * 1024;

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get("u");
  if (!target) return new Response("Missing u parameter", { status: 400 });

  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return new Response("Invalid URL", { status: 400 });
  }

  const allowedOrigin = new URL(env.chHost).origin;
  if (url.origin !== allowedOrigin || !url.pathname.startsWith("/api/public/")) {
    return new Response("URL not allowed", { status: 403 });
  }

  const upstream = await fetch(url, { cache: "no-store" });
  if (!upstream.ok || !upstream.body) {
    return new Response(`Upstream ${upstream.status}`, { status: 502 });
  }
  const length = Number(upstream.headers.get("content-length") || 0);
  if (length > MAX_PROXIED_BYTES) {
    await upstream.body.cancel().catch(() => undefined);
    return Response.redirect(url.toString(), 302);
  }

  return new Response(upstream.body, { headers: proxiedFileHeaders(upstream.headers.get("Content-Type") || "", "public, max-age=300, s-maxage=3600") });
}
