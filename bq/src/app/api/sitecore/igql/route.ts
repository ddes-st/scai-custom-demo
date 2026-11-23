import { NextRequest, NextResponse } from 'next/server';
import { resolveEdgeUrl } from '@sitecore-content-sdk/core/tools';
import scConfig from 'sitecore.config';
import { WILDCARD_CHILDREN_QUERY, WILDCARD_ITEM_QUERY } from 'src/lib/wildcard/queries';

const QUERY_MAP: Record<string, string> = {
  'wildcard-item': WILDCARD_ITEM_QUERY,
  'wildcard-children': WILDCARD_CHILDREN_QUERY,
};

function edgeEndpoint(): string | null {
  const contextId =
    scConfig.api?.edge?.contextId ||
    process.env.SITECORE_EDGE_CONTEXT_ID ||
    process.env.NEXT_PUBLIC_SITECORE_EDGE_CONTEXT_ID ||
    '';
  if (!contextId) return null;

  const edgeUrl = resolveEdgeUrl(
    scConfig.api?.edge?.edgeUrl ||
      process.env.NEXT_PUBLIC_SITECORE_EDGE_PLATFORM_HOSTNAME ||
      process.env.SITECORE_EDGE_PLATFORM_HOSTNAME,
  );
  const base = edgeUrl.replace(/\/+$/, '');
  return `${base}/v1/content/api/graphql/v1?sitecoreContextId=${encodeURIComponent(contextId)}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      query?: string;
      variables?: Record<string, unknown>;
    };
    const queryName = body.query?.trim();
    if (!queryName || !(queryName in QUERY_MAP)) {
      return NextResponse.json({ error: 'Query not allowed' }, { status: 400 });
    }

    const endpoint = edgeEndpoint();
    if (!endpoint) {
      return NextResponse.json({ error: 'Edge not configured' }, { status: 503 });
    }

    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: QUERY_MAP[queryName],
        variables: body.variables ?? {},
      }),
      cache: 'no-store',
    });

    const payload = await upstream.json();
    return NextResponse.json(payload, { status: upstream.ok ? 200 : upstream.status });
  } catch (error) {
    console.error('[igql]', error);
    return NextResponse.json({ error: 'IGQL proxy failed' }, { status: 500 });
  }
}
