/** Rendering parameter field on the Service Request Form parameters template. */
export const SERVICE_REQUEST_POST_ENDPOINT_PARAM = 'Post Endpoint';

export const DEFAULT_SERVICE_REQUEST_POST_ENDPOINT =
  'https://webhooks.eu.workato.com/webhooks/rest/99427827-2367-4264-88c3-eb6701fe0d85/service-request';

type RenderingParams = Record<string, string | undefined>;

/**
 * Sitecore AI rendering parameter, falling back to the Workato service-request webhook.
 * An empty or non-http value keeps the default.
 */
export function resolveServiceRequestPostEndpoint(
  params: RenderingParams | undefined,
): string {
  const raw = String(
    params?.[SERVICE_REQUEST_POST_ENDPOINT_PARAM] ||
      params?.PostEndpoint ||
      params?.postEndpoint ||
      '',
  ).trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  return DEFAULT_SERVICE_REQUEST_POST_ENDPOINT;
}
