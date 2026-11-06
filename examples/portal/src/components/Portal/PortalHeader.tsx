import React from "react";
import { siteModeNow } from "src/lib/portal/sites";
import { Link } from "src/i18n/navigation";
import { Image, Text, type Field, type ImageField } from "@sitecore-content-sdk/nextjs";
import { getSectionPages } from "src/lib/portal/site-pages";
import { requestContext } from "src/lib/portal/request-context";
import { chrome, fieldsOf, isEditing, type PortalComponentProps } from "src/lib/portal/component";
import { fieldValue } from "src/lib/portal/sections";
import { ui } from "src/lib/portal/ui-text";
import { routing } from "src/i18n/routing";
import { getViewer } from "src/lib/ch/viewer";
import { canView } from "src/lib/portal/audience";
import { pickedImage } from "src/lib/portal/image-pick";
import { ChImage } from "components/ui/portal/ChImage";
import { portalImageField } from "src/lib/portal/dam-image";

/**
 * The top bar every page shares (a partial design in SitecoreAI): the wordmark and logo from
 * the datasource (template Portal Header), the sections from the published pages under Home.
 * The navigation shows when more than one section exists, unless ShowNav says otherwise.
 * With more than one site language a switcher links the same path in every language.
 */
const langLabel = (l: string) => { try { return new Intl.DisplayNames([l], { type: "language" }).of(l.split("-")[0]) ?? l; } catch { return l; } };

export const Default = async (props: PortalComponentProps) => {
  const fields = fieldsOf(props);
  const wordmark = fields.Wordmark as Field<string> | undefined;
  const logo = portalImageField(fields.Logo as ImageField | undefined, 320);
  // LogoPick ("Content Hub image", this portal's own tenant) wins over the media-dialog Logo;
  // a logo is shown uncropped (crops would cut it), from the smallest fitting rendition
  const pick = await pickedImage((fields.LogoPick as Field<string> | undefined)?.value);
  const logoLinks = pick.image?.links?.filter((l) => !l.crop);
  const showNav = fieldValue(fields, "ShowNav").toLowerCase();
  const bar = fieldValue(fields, "Chrome").toLowerCase() === "bar";
  const editing = isEditing(props.page);
  const { segments, locale } = requestContext();
  const active = segments[0]?.toLowerCase() ?? "";
  const current = locale || props.page.locale;
  const samePath = `/${segments.join("/")}`;
  const viewer = await getViewer();
  const pages = (await getSectionPages(props.page.siteName, props.page.locale)).filter((p) => !p.hideFromNav && canView(viewer.kind, p.visibleTo));
  const signedIn = viewer.kind === "staff" || viewer.kind === "partner";
  // a partner: "<contact> · <partner> · <tier>" (the contact person when the Demo Builder set one)
  const who = viewer.kind === "partner" ? [viewer.partner.contact, viewer.partner.name, viewer.partner.tier].filter(Boolean).join(" · ") : viewer.kind === "staff" ? ui("staff") : "";
  const navVisible = showNav === "always" || (showNav !== "never" && (bar || pages.length > 1));
  const c = chrome(props);
  const homeActive = segments.length === 0;
  const shortLang = (l: string) => l.split("-")[0].toUpperCase();
  // Brand-hub mockup: a fixed demo avatar until the portal session carries a Content Hub user name.
  const initial = bar ? "JD" : (who || ui("signIn")).trim().charAt(0).toUpperCase();

  return (
    <div className={`site-topbar${bar ? " hub-bar" : ""} ${c.className}`.trim()} id={c.id}>
      {(pick.image || logo?.value?.src || !bar) && (
      <Link className="wordmark" href="/">
        {pick.image
          ? <ChImage links={logoLinks?.length ? logoLinks : pick.image.links} fallback={pick.image.src} slot="logo" alt={pick.image.title} loading="eager" className="wordmark-logo" />
          : logo?.value?.src ? <Image field={logo} className="wordmark-logo" /> : null}
        {!bar && (wordmark?.value || editing ? <Text field={wordmark} /> : ui("brandPortal") === "Brand portal" ? <>Brand <span className="italic">Portal</span></> : ui("brandPortal"))}
      </Link>
      )}
      {navVisible && (
        <nav className="site-nav" aria-label={ui("portalSections")}>
          {bar && (
            <Link href="/" className={homeActive ? "active" : undefined} aria-current={homeActive ? "page" : undefined}>
              {ui("brandPortal")}
            </Link>
          )}
          {pages.map((p) => (
            <Link key={p.key} href={p.href} className={p.key === active ? "active" : undefined} aria-current={p.key === active ? "page" : undefined}>
              {p.label}
            </Link>
          ))}
        </nav>
      )}
      <div className="meta">
        {(routing.locales.length > 1 || bar) && (
          <nav className="site-lang" aria-label={ui("language")}>
            {(routing.locales.length > 1 ? routing.locales : [current || routing.defaultLocale]).map((l) => (
              routing.locales.length > 1 ? (
                <Link key={l} href={samePath} locale={l} hrefLang={l} lang={l} className={l === current ? "active" : undefined} aria-current={l === current ? "true" : undefined}>{bar ? shortLang(l) : langLabel(l)}</Link>
              ) : (
                <span key={l} className="active" lang={l}>{shortLang(l)}</span>
              )
            ))}
          </nav>
        )}
        {siteModeNow() !== "public" && (signedIn ? (
          <form method="post" action="/api/logout" className="site-session">
            {bar ? <button type="submit" className="hub-avatar" title={`${who} — ${ui("signOut")}`}>{initial}</button> : <><span className="who">{who}</span><button type="submit" className="link">{ui("signOut")}</button></>}
          </form>
        ) : (
          <a className={bar ? "hub-avatar" : "site-session"} title={ui("signIn")} href={`/login?from=${encodeURIComponent(current && current !== routing.defaultLocale ? `/${current}${samePath === "/" ? "" : samePath}` : samePath)}`}>{bar ? initial : ui("signIn")}</a>
        ))}
        {!bar && <span>{ui("poweredBy")}</span>}
      </div>
    </div>
  );
};
