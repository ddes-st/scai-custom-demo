import { sitecoreMediaOrigin } from 'src/lib/sitecore-media-origin';

type MediaRouteParams = { kind: string; path?: string[] };

/**
 * Experience Edge addresses media as `https://<public-site>/-/media/Project/...`.
 * The rendering host does not store those files. Fetch them from the CM with a
 * clean request so Sitecore media-request protection still accepts the hash.
 */
async function proxyMedia(request: Request, params: Promise<MediaRouteParams>): Promise<Response> {
  const { kind, path } = await params;
  if (kind !== 'media' && kind !== 'jssmedia') {
    return new Response('Not found', { status: 404 });
  }

  const incoming = new URL(request.url);
  const target = new URL(
    `${sitecoreMediaOrigin()}/-/${kind}/${(path ?? []).map((segment) => encodeURIComponent(segment)).join('/')}`,
  );
  target.search = incoming.search;

  const upstream = await fetch(target, {
    headers: { Accept: request.headers.get('accept') || '*/*' },
  });

  const headers = new Headers();
  const contentType = upstream.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  headers.set(
    'cache-control',
    upstream.headers.get('cache-control') || 'public, max-age=86400',
  );

  return new Response(upstream.body, { status: upstream.status, headers });
}

export function GET(request: Request, context: { params: Promise<MediaRouteParams> }) {
  return proxyMedia(request, context.params);
}

export function HEAD(request: Request, context: { params: Promise<MediaRouteParams> }) {
  return proxyMedia(request, context.params);
}
