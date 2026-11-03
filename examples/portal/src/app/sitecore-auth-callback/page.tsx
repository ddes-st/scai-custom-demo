/**
 * /sitecore-auth-callback — where Sitecore's login (auth.sitecorecloud.io) returns a redirect
 * sign-in of the hub apps (Phase B; register it as an allowed callback URL of the hub app's
 * client credentials in App Studio). Finishes the sign-in and goes back to the app page.
 */
import type { Metadata } from "next";
import { AuthCallback } from "components/ui/portal/auth/AuthCallback";

export const metadata: Metadata = { title: "Signing in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function SitecoreAuthCallbackPage() {
  return <AuthCallback />;
}
