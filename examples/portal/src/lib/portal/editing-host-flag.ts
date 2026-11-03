/**
 * Is this deployment an editing host (the Page builder's rendering host)? PORTAL_EDITING_HOST=1, or the pair
 * the Demo Builder sets on every editing host: PORTAL_NOINDEX=1 and PORTAL_FILES=asset. next.config passes
 * the result to the browser bundle as PORTAL_EDITING_HOST. Client-safe.
 */
export function isEditingHost(): boolean {
  if (process.env.PORTAL_EDITING_HOST === "1") return true;
  return process.env.PORTAL_NOINDEX === "1" && (process.env.PORTAL_FILES || "").trim().toLowerCase() === "asset";
}
