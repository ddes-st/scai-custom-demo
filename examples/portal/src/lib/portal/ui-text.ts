import "server-only";
import { requestContext } from "./request-context";
import { translator, type UiKey } from "./ui-keys";

/**
 * UI strings for server components: the site dictionary of the page's language (loaded once
 * per request by the catch-all page into the request context) with English defaults.
 * `ui("download")` → "Download" / "Herunterladen".
 */
export function ui(key: UiKey, vars?: Record<string, string | number>): string {
  let dictionary: Record<string, unknown> = {};
  try { dictionary = requestContext().dictionary; } catch { /* outside a request */ }
  return translator(dictionary)(key, vars);
}
