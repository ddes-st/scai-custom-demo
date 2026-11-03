/**
 * /ch-picker — the "Content Hub picks" Marketplace app for the SitecoreAI Page builder
 * custom field (register this route as the app's custom-field route (single path segment, as the Cloud Portal requires); see doc/sitecoreai-setup.md).
 * Outside the Content SDK's proxy and site tree: no Sitecore layout, no site chrome.
 */
import type { Metadata } from "next";
import { AppErrorBoundary } from "components/ui/portal/AppErrorBoundary";
import "src/styles/sitecore-auth.css";
import "src/styles/picker.css";
import { PickerApp } from "components/ui/portal/picker/PickerApp";

export const metadata: Metadata = { title: "Content Hub picks", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function PickerPage() {
  return <AppErrorBoundary name="The Content Hub picker"><PickerApp /></AppErrorBoundary>;
}
