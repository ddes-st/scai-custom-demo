import { draftMode } from 'next/headers';
import Bootstrap from 'src/Bootstrap';
import { getPortalSettings } from 'src/lib/portal/settings';
import { getPortalTheme, googleFontsHref, themeCss } from 'src/lib/portal/theme';
import { UsageTracker } from 'components/ui/portal/UsageTracker';
import { ThemeLiveBridge } from 'components/ui/portal/ThemeLiveBridge';

/**
 * Per-site shell: the portal theme (accent and fonts from the Portal Settings item in
 * SitecoreAI, else Content Hub's BrandSite.Config, else the defaults) as CSS variables, the
 * .site-shell wrapper the portal styles expect, the usage tracker when the Portal Settings
 * item switches tracking on, and — in the editing host — the bridge that lets the theme editor
 * app restyle the Page builder canvas live.
 */
export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ site: string }>;
}) {
  const { site } = await params;
  const { isEnabled } = await draftMode();
  const [settings, theme] = await Promise.all([getPortalSettings(site), getPortalTheme(site)]);
  const fontsHref = googleFontsHref(theme);

  return (
    <>
      <Bootstrap siteName={site} isPreviewMode={isEnabled} />
      {fontsHref && <link rel="stylesheet" href={fontsHref} />}
      <style dangerouslySetInnerHTML={{ __html: themeCss(theme) }} />
      <div className="site-shell">{children}</div>
      {settings.trackUsage && !isEnabled && <UsageTracker />}
      {(isEnabled || process.env.NODE_ENV === 'development') && <ThemeLiveBridge />}
    </>
  );
}
