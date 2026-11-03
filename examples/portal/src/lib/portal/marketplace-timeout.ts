/**
 * The Marketplace SDK client's request timeout for the apps that write to SitecoreAI (the Portal setup,
 * the Page context panel). Long enough for SitecoreAI's slow writes: making a template field shared
 * converts its values on every item inside the request. The handshake has its own retries, so
 * connecting stays fast. Client-safe.
 */
export const MARKETPLACE_REQUEST_TIMEOUT = 60_000;
