/**
 * /theme-editor — the portal's Page builder context panel (register this route as the
 * Marketplace app's Page context panel; SitecoreAI API access required). One route per extension
 * point, so it shows both panel apps as tabs: Theme (the "Portal theme" app: colours, fonts and
 * radius live in the canvas, saved to the Portal Settings item's Theme section) and Content Hub
 * (the Content Hub items of the open page, also served alone at /ch-info). Outside the Content
 * SDK's proxy and site tree: no Sitecore layout, no site chrome.
 */
import type { Metadata } from "next";
import { AppErrorBoundary } from "components/ui/portal/AppErrorBoundary";
import "src/styles/sitecore-auth.css";
import "src/styles/theme-editor.css";
import "src/styles/ch-info.css";
import "src/styles/page-panel.css";
import { PagePanel } from "components/ui/portal/PagePanel";

export const metadata: Metadata = { title: "Portal panel", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function ThemeEditorPage() {
  return <AppErrorBoundary name="The portal panel"><PagePanel /></AppErrorBoundary>;
}
