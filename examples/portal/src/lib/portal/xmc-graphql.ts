import "server-only";
import { createGraphQLClientFactory } from "@sitecore-content-sdk/nextjs/client";
import scConfig from "sitecore.config";

/**
 * Plain GraphQL queries against the SitecoreAI Experience Edge endpoint (the one the layout
 * comes from — context id, retries and endpoint all from sitecore.config). Used for the
 * site-level data the Content SDK doesn't load with the page: the Portal Settings item and
 * the section pages for navigation and home cards.
 */
const factory = createGraphQLClientFactory({ api: scConfig.api, retries: scConfig.retries.count, retryStrategy: scConfig.retries.retryStrategy });

export async function xmcQuery<T = any>(query: string, variables?: Record<string, unknown>): Promise<T> {
  return factory().request<T>(query, variables);
}
