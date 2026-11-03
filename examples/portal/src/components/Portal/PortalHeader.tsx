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
  const navVisible = showNav === "always" || (showNav !== "never" && pages.length > 1);
  const c = chrome(props);

  return (
    <div className={`site-topbar ${c.className}`.trim()} id={c.id}>
      <Link className="wordmark" href="/">
        {pick.image
          ? <ChImage links={logoLinks?.length ? logoLinks : pick.image.links} fallback={pick.image.src} slot="logo" alt={pick.image.title} loading="eager" className="wordmark-logo" />
          : (logo?.value?.src || editing) && <Image field={logo} className="wordmark-logo" />}
        {wordmark?.value || editing ? <Text field={wordmark} /> : ui("brandPortal") === "Brand portal" ? <>Brand <span className="italic">Portal</span></> : ui("brandPortal")}
      </Link>
      {navVisible && (
        <nav className="site-nav" aria-label={ui("portalSections")}>
          {pages.map((p) => (
            <Link key={p.key} href={p.href} className={p.key === active ? "active" : undefined} aria-current={p.key === active ? "page" : undefined}>
              {p.label}
            </Link>
          ))}
        </nav>
      )}
      <div className="meta">
        {routing.locales.length > 1 && (
          <nav className="site-lang" aria-label={ui("language")}>
            {routing.locales.map((l) => (
              <Link key={l} href={samePath} locale={l} hrefLang={l} lang={l} className={l === current ? "active" : undefined} aria-current={l === current ? "true" : undefined}>{langLabel(l)}</Link>
            ))}
          </nav>
        )}
        {siteModeNow() !== "public" && (signedIn ? (
          <form method="post" action="/api/logout" className="site-session">
            <span className="who">{who}</span>
            <button type="submit" className="link">{ui("signOut")}</button>
          </form>
        ) : (
          <a className="site-session" href={`/login?from=${encodeURIComponent(current && current !== routing.defaultLocale ? `/${current}${samePath === "/" ? "" : samePath}` : samePath)}`}>{ui("signIn")}</a>
        ))}
        <span>{ui("poweredBy")}</span>
      </div>
    </div>
  );
};
