import "server-only";
import { parseHTML } from "linkedom";
import { cleanHtml } from "../../components/ui/portal/sanitize";

/**
 * The portal's HTML allowlist sanitizer run on the server (linkedom's DOM instead of the
 * browser's DOMParser) so rich text from Content Hub is clean in the first HTML byte. The
 * client panels keep the browser sanitizer as defence in depth.
 */
export function sanitizeHtmlServer(html: string): string {
  if (!html) return "";
  try {
    const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
    return cleanHtml(document as unknown as Document);
  } catch {
    return html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}
