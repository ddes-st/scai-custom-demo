/**
 * /portal-setup — the "Portal setup" Marketplace app (Full screen / Standalone extension point,
 * SitecoreAI API access required). Checks this deployment and its Content Hub connection, creates
 * the site if needed and runs the portal setup (templates, renderings, pages, settings, partners,
 * languages, publish) with the signed-in author's own rights. Outside the Content SDK's proxy
 * and site tree, like the other Marketplace routes.
 */
import type { Metadata } from "next";
import { AppErrorBoundary } from "components/ui/portal/AppErrorBoundary";
import "src/styles/sitecore-auth.css";
import "src/styles/portal-setup.css";
import { PortalSetupApp } from "components/ui/portal/setup/PortalSetupApp";

export const metadata: Metadata = { title: "Portal setup", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function PortalSetupPage() {
  return <AppErrorBoundary name="Portal setup"><PortalSetupApp /></AppErrorBoundary>;
}
