import React from "react";
import { Link } from "src/i18n/navigation";
import { env } from "src/lib/ch/env";
import { formatDate, loadPress } from "src/lib/ch/press";
import { attempt } from "src/lib/ch/portalEdge";
import { requestContext } from "src/lib/portal/request-context";
import { pressHref, SECTION_PATH } from "src/lib/portal/sections";
import { chrome, isEditing, type PortalComponentProps } from "src/lib/portal/component";
import { EditorNotice, LoadError } from "src/lib/portal/editor";
import { ui } from "src/lib/portal/ui-text";
import { ChImage } from "components/ui/portal/ChImage";

/** Press releases, newest first: brand chips (?brand=), the newest as a lead card, the rest as a list. */
export const Default = async (props: PortalComponentProps) => {
  const editing = isEditing(props.page);
  const c = chrome(props);
  if (!env.edgeToken) {
    const msg = "This section reads Experience Edge for Content Hub, which isn't connected (EDGE_TOKEN).";
    return editing ? <EditorNotice title="Press list">{msg}</EditorNotice> : <LoadError message={msg} />;
  }
  const res = await attempt(() => loadPress());
  const all = res.data;
  if (!all) {
    const err = res.error ?? "The Press release content type isn't published to Experience Edge on this tenant.";
    return editing ? <EditorNotice title="Press list">{err}</EditorNotice> : <LoadError message={err} />;
  }
  if (!all.length) return <p className="portal-empty">{ui("noPress")}</p>;
  const brands = [...new Set(all.flatMap((r) => r.brands))].sort();
  const wanted = requestContext().search.brand ?? "";
  const brand = wanted && brands.includes(wanted) ? wanted : "";
  const releases = all.filter((r) => !brand || r.brands.includes(brand));
  const [lead, ...rest] = releases;

  return (
    <div className={c.className || undefined} id={c.id}>
      {brands.length > 1 && (
        <div className="portal-chips" role="group" aria-label={ui("brands")}>
          <Link href={SECTION_PATH.press} className={!brand ? "active" : undefined} aria-current={!brand ? "page" : undefined}>{ui("allBrands")}</Link>
          {brands.map((b) => <Link key={b} href={`${SECTION_PATH.press}?brand=${encodeURIComponent(b)}`} className={brand === b ? "active" : undefined} aria-current={brand === b ? "page" : undefined}>{b}</Link>)}
        </div>
      )}
      {lead && (
        <Link href={pressHref(lead.id)} className="portal-press-lead">
          {lead.image && <span className="media"><ChImage links={lead.imageLinks} fallback={lead.image} slot="lead" alt="" loading="eager" /></span>}
          <span className="body">
            <span className="sub">{[formatDate(lead.date), lead.brands.join(", ")].filter(Boolean).join(" · ")}</span>
            <span className="name">{lead.title}</span>
            {lead.lead && <span className="summary">{lead.lead}</span>}
            <span className="more">{ui("readRelease")}</span>
          </span>
        </Link>
      )}
      <div className="portal-press-list">
        {rest.map((r) => (
          <Link key={r.id} href={pressHref(r.id)} className="portal-press-item">
            {r.image && <span className="media"><ChImage links={r.imageLinks} fallback={r.image} slot="row" alt="" /></span>}
            <span className="body">
              <span className="sub">{[formatDate(r.date), r.brands.join(", ")].filter(Boolean).join(" · ")}</span>
              <span className="name">{r.title}</span>
              {r.lead && <span className="summary">{r.lead}</span>}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
};
