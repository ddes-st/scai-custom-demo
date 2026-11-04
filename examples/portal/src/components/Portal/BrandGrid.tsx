import React from "react";
import { imageFromOrigin } from "src/lib/ch/fileUrl";
import { Link } from "src/i18n/navigation";
import { listBrands } from "src/lib/ch/data";
import { getBrandVisibilityMap, getGlobalConfig } from "src/lib/ch/siteConfig";
import { computeBrandPaletteVars } from "src/lib/ch/brandPalette";
import { env } from "src/lib/ch/env";
import { attempt } from "src/lib/ch/portalEdge";
import { brandHref, SECTION_PATH } from "src/lib/portal/sections";
import { chrome, isEditing, param, type PortalComponentProps } from "src/lib/portal/component";
import { brandMasters, type BrandMaster } from "src/lib/ch/brand-masters";
import { ChImage } from "components/ui/portal/ChImage";
import { EditorNotice, LoadError } from "src/lib/portal/editor";
import { ui } from "src/lib/portal/ui-text";

/**
 * A card per visible brand, linking to its brand book. Rendering parameter Variant:
 *  - "default": logo tile and name (the logo file of the Brand guidelines app, else the brand's
 *    master asset, else its initial);
 *  - "logo": the brand's master asset alone, large and uncropped (the name as its alt text);
 *  - "name": the name only.
 *  - "swatch": the brand colour as the whole tile, logo centred (brand-hub home).
 */
export const Default = async (props: PortalComponentProps) => {
  const editing = isEditing(props.page);
  const c = chrome(props);
  const res = await attempt(async () => {
    const [brands, config, visibility, masters] = await Promise.all([listBrands(), getGlobalConfig(), getBrandVisibilityMap(), brandMasters().catch(() => new Map<string, BrandMaster>())]);
    return { brands, config, visibility, masters };
  });
  if (!res.data) return editing ? <EditorNotice title="Brand grid">{res.error}</EditorNotice> : <LoadError message={res.error} />;
  const { brands, config, visibility, masters } = res.data;
  const v = param(props, "Variant").toLowerCase();
  const variant = v === "logo" || v === "name" || v === "swatch" ? v : "default";
  const uncropped = (m: BrandMaster) => { const l = m.links?.filter((x) => !x.crop); return l?.length ? l : m.links; };
  const fallbackAccent = /^#[0-9a-f]{6}$/i.test(config.site.accent) ? config.site.accent : env.fallbackAccent;
  const visible = brands.filter((b) => (visibility[b.brandId] || "visible") !== "hidden");
  if (!visible.length) {
    return editing ? <EditorNotice title="Brand grid">No brands in scope on this Content Hub tenant (check the Portal Settings brand scope).</EditorNotice> : <p className="portal-empty">{ui("noBrands")}</p>;
  }
  if (variant === "swatch") {
    return (
      <section className={`hub-brands ${c.className}`.trim()} id={c.id}>
        <div className="portal-section-head hub-section-head">
          <h2>{ui("hubOurBrands")}</h2>
          <Link href={SECTION_PATH.brands} className="hub-see-all">{ui("allBrands")}</Link>
        </div>
        <div className="hub-swatch-grid">
          {visible.map((b) => {
            const edge = computeBrandPaletteVars(b.visualizationColor, fallbackAccent)["--bgd-accent-vivid"];
            const comingSoon = (visibility[b.brandId] || "visible") === "comingSoon";
            const master = masters.get(b.identifier);
            const logo = b.logoUrl
              ? <img src={imageFromOrigin(b.logoUrl)} alt="" loading="lazy" />
              : master
                ? <ChImage links={uncropped(master)} fallback={master.src} slot="row" alt="" />
                : <span className="glyph" aria-hidden="true">{b.name.charAt(0)}</span>;
            const body = (
              <>
                <span className="hub-swatch-logo">{logo}</span>
                <span className="sr-only">{b.name}{comingSoon ? `, ${ui("comingSoon")}` : ""}</span>
              </>
            );
            return comingSoon ? (
              <span key={b.brandId} className="hub-swatch coming-soon" style={{ background: edge }}>{body}</span>
            ) : (
              <Link key={b.brandId} href={brandHref(b.slug)} className="hub-swatch" style={{ background: edge }}>{body}</Link>
            );
          })}
        </div>
      </section>
    );
  }
  return (
    <div className={`site-brand-grid variant-${variant} ${c.className}`.trim()} id={c.id}>
      {visible.map((b) => {
        const edge = computeBrandPaletteVars(b.visualizationColor, fallbackAccent)["--bgd-accent-vivid"];
        const comingSoon = (visibility[b.brandId] || "visible") === "comingSoon";
        const master = masters.get(b.identifier);
        const sub = <span className="sub">{comingSoon ? <span className="soon">{ui("comingSoon")}</span> : ui("brandGuidelines")}</span>;
        const tile = variant === "logo" ? (
          <span className="logo">
            {master ? <ChImage links={uncropped(master)} fallback={master.src} slot="tile" alt={b.name} />
              : b.logoUrl ? <img src={imageFromOrigin(b.logoUrl)} alt={b.name} loading="lazy" />
              : <span className="name">{b.name}</span>}
          </span>
        ) : variant === "name" ? (
          <span><span className="name">{b.name}</span>{sub}</span>
        ) : (
          <>
            <span className="tile">
              {b.logoUrl ? <img src={imageFromOrigin(b.logoUrl)} alt={`${b.name} logo`} loading="lazy" />
                : master ? <ChImage links={uncropped(master)} fallback={master.src} slot="row" alt={`${b.name} logo`} />
                : <span className="glyph" aria-hidden="true">{b.name.charAt(0)}</span>}
            </span>
            <span>
              <span className="name">{b.name}</span>
              {sub}
            </span>
          </>
        );
        return comingSoon ? (
          <span key={b.brandId} className="site-brand-card coming-soon" style={{ ["--brand-edge" as string]: edge }}>{tile}</span>
        ) : (
          <Link key={b.brandId} href={brandHref(b.slug)} className="site-brand-card" style={{ ["--brand-edge" as string]: edge }}>{tile}</Link>
        );
      })}
    </div>
  );
};
