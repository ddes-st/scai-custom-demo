import React from "react";
import { Link } from "src/i18n/navigation";
import { listBrands, loadBrandData } from "src/lib/ch/data";
import { getBrandConfig, getBrandVisibilityMap, toBookConfig } from "src/lib/ch/siteConfig";
import { computeBrandPaletteVars } from "src/lib/ch/brandPalette";
import { env } from "src/lib/ch/env";
import { attempt } from "src/lib/ch/portalEdge";
import type { LayoutKind } from "src/lib/ch/types";
import { requestContext } from "src/lib/portal/request-context";
import { brandHref, SECTION_PATH } from "src/lib/portal/sections";
import { chrome, isEditing, param, type PortalComponentProps } from "src/lib/portal/component";
import { EditorNotice, LoadError } from "src/lib/portal/editor";
import { getPortalTheme } from "src/lib/portal/theme";
import { JsonLd } from "components/ui/portal/JsonLd";
import { getBaseUrl } from "lib/utils";
import { BrandBookClient } from "components/ui/portal/BrandBookClient";
import { TrackView } from "components/ui/portal/UsageTracker";
import { getPortalSettings } from "src/lib/portal/settings";
import { ui } from "src/lib/portal/ui-text";

/**
 * The brand book of the brand in the URL (/brands/<slug>, a wildcard page): files via REST,
 * do & don'ts / personas / characteristics via Content Hub Edge, settings from BrandSite.Config.
 * Rendering parameter LayoutOverride: auto | tabbed | editorial (auto = ?layout= or the
 * brand's configured default). In the Page builder (no slug) the first visible brand is shown.
 */
export const Default = async (props: PortalComponentProps) => {
  const editing = isEditing(props.page);
  const { slug: urlSlug, search } = requestContext();
  const c = chrome(props);

  let slug = urlSlug;
  if (!slug && editing) {
    const sample = await attempt(async () => {
      const [brands, visibility] = await Promise.all([listBrands(), getBrandVisibilityMap()]);
      return brands.find((b) => (visibility[b.brandId] || "visible") === "visible")?.slug ?? "";
    });
    slug = sample.data ?? "";
    if (!slug) return <EditorNotice title="Brand book">{sample.error ?? "No visible brand on the tenant yet — the live page renders the brand from the URL (/brands/<slug>)."}</EditorNotice>;
  }
  if (!slug) return <LoadError message="No brand in the URL." missing />;

  const res = await attempt(async () => {
    const data = await loadBrandData(slug);
    if (!data) return null;
    const config = await getBrandConfig(data.brandId);
    return { data, config };
  });
  if (res.error) return editing ? <EditorNotice title="Brand book">{res.error}</EditorNotice> : <LoadError message={res.error} />;
  if (!res.data) return editing ? <EditorNotice title="Brand book">No brand matches “{slug}”.</EditorNotice> : <LoadError message="This brand isn't published." missing />;
  const { data, config } = res.data;

  if (config.brand.visibility === "comingSoon") {
    return (
      <div className={`site-settings ${c.className}`.trim()} id={c.id}>
        <div className="card">
          <span className="eyebrow">{ui("comingSoon")}</span>
          <h1>{data.brandName}</h1>
          <p className="lead">{ui("comingSoonLead")}</p>
          <Link href={SECTION_PATH.brands}>{ui("allBrandsBack")}</Link>
        </div>
      </div>
    );
  }

  const override = param(props, "LayoutOverride").toLowerCase();
  const wanted = search.layout === "editorial" || search.layout === "tabbed" ? search.layout : override === "editorial" || override === "tabbed" ? override : "";
  const theme = await getPortalTheme(props.page.siteName, props.page.locale);
  const initialLayout: LayoutKind = wanted ? (wanted as LayoutKind) : theme.brandBookLayout;
  const fallbackAccent = /^#[0-9a-f]{6}$/i.test(config.site.accent) ? config.site.accent : env.fallbackAccent;
  const paletteVars = computeBrandPaletteVars(data.visualizationColor, fallbackAccent);
  const book = toBookConfig(config);
  const settings = await getPortalSettings(props.page.siteName, props.page.locale);

  return (
    <div className={c.className || undefined} id={c.id}>
      {!editing && <JsonLd data={{ "@type": "Brand", name: data.brandName, url: `${getBaseUrl()}${brandHref(slug)}` }} />}
      {editing && urlSlug === "" && <EditorNotice title="Sample brand shown">The live page renders the brand from the URL (/brands/&lt;slug&gt;).</EditorNotice>}
      {settings.trackUsage && !editing && <TrackView kind="kit" id={String(data.brandId)} title={data.brandName} />}
      <p className="portal-note"><Link href={SECTION_PATH.brands}>{ui("allBrandsBack")}</Link></p>
      <BrandBookClient data={data} initialLayout={initialLayout} paletteVars={paletteVars} book={book} />
    </div>
  );
};
