/**
 * /login — the portal's sign-in page (hybrid and gated modes). Outside the SitecoreAI site
 * tree like the Marketplace apps: no layout from SitecoreAI, the site's theme still applies.
 */
import type { Metadata } from "next";
import { env } from "src/lib/ch/env";
import { getViewer } from "src/lib/ch/viewer";
import { getPortalTheme, googleFontsHref, themeCss } from "src/lib/portal/theme";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// same-origin paths only: no "//host", no backslashes and no control characters (browsers drop tabs and newlines, turning "/\t/evil" into "//evil")
const safePath = (from: string) => (from.startsWith("/") && !from.startsWith("//") && !/[\\\u0000-\u001f\u007f]/.test(from) ? from : "/");

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const from = safePath(String(Array.isArray(sp.from) ? sp.from[0] : sp.from || "/"));
  const error = sp.error === "1" ? "Unknown user or wrong password." : sp.error === "2" ? "Too many attempts. Please wait a few minutes and try again." : "";
  const viewer = await getViewer();
  if (viewer.kind === "staff" || viewer.kind === "partner") redirect(from);
  const theme = await getPortalTheme().catch(() => null);
  const fontsHref = theme ? googleFontsHref(theme) : "";
  const enabled = env.siteMode !== "public" && !!env.authSecret;
  return (
    <div className="site-shell portal-login">
      {fontsHref && <link rel="stylesheet" href={fontsHref} />}
      {theme && <style dangerouslySetInnerHTML={{ __html: themeCss(theme) }} />}
      <div className="card">
        <span className="eyebrow">Brand portal</span>
        <h1>Sign in</h1>
        {!enabled ? (
          <p className="lead">This portal is public — there is nothing to sign in to.</p>
        ) : (
          <>
            <p className="lead">Staff sign in with the portal login, partners with their partner login.</p>
            <form method="post" action="/api/login">
              <input type="hidden" name="from" value={from} />
              <label>User<input name="user" autoComplete="username" required autoFocus /></label>
              <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
              {error && <p className="error" role="alert">{error}</p>}
              <button type="submit" className="site-button">Sign in</button>
            </form>
          </>
        )}
        <p className="back"><Link href="/">← Back to the portal</Link></p>
      </div>
    </div>
  );
}
