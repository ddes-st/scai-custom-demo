/**
 * /ch-info — the "Content Hub info" Marketplace app for the SitecoreAI Page builder context
 * panel (register this route as a Page context panel extension point; SitecoreAI API access
 * required). Lists the Content Hub items the open page shows, with Edge, approval and language
 * status and links into Content Hub, and refreshes the portal's Content Hub caches. Outside the
 * Content SDK's proxy and site tree, like the other Marketplace routes.
 */
import type { Metadata } from "next";
import "src/styles/ch-info.css";
import { ChInfoApp } from "components/ui/portal/chinfo/ChInfoApp";

export const metadata: Metadata = { title: "Content Hub info", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function ChInfoPage() {
  return <ChInfoApp />;
}
