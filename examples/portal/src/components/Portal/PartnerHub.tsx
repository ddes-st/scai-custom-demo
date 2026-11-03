import React from "react";
import { Link } from "src/i18n/navigation";
import { getViewer } from "src/lib/ch/viewer";
import { loadMedia } from "src/lib/ch/media";
import { attempt } from "src/lib/ch/portalEdge";
import { loadPartners } from "src/lib/portal/partners";
import { chrome, isEditing, type PortalComponentProps } from "src/lib/portal/component";
import { EditorNotice } from "src/lib/portal/editor";
import { getPortalSettings } from "src/lib/portal/settings";
import { SECTION_PATH } from "src/lib/portal/sections";
import { ui } from "src/lib/portal/ui-text";
import { PartnerKit } from "components/ui/portal/PartnerKit";

/**
 * The partner hub (page VisibleTo = partners): a signed-in partner sees its own partner area
 * (files, products, content, uploads, campaign kits); staff see every partner as a card (type,
 * tier, region, partner manager) linking to the partner's page. In the Page builder the staff
 * overview stands in.
 */
export const Default = async (props: PortalComponentProps) => {
  const editing = isEditing(props.page);
  const c = chrome(props);
  const settings = await getPortalSettings(props.page.siteName, props.page.locale);
  const viewer = await getViewer();
  const partners = await loadPartners();
  if (viewer.kind === "partner") {
    return <div className={c.className || undefined} id={c.id}><PartnerKit partner={viewer.partner} trackViews={settings.trackUsage && !editing} /></div>;
  }
  if (viewer.kind !== "staff" && !editing) return null; // the route already redirected or 404ed
  if (!partners.length) {
    return editing ? <EditorNotice title="Partner hub">No partners yet: PORTAL_PARTNERS is empty and Data/Partners has no items.</EditorNotice> : <p className="portal-empty">{ui("kitEmpty")}</p>;
  }
  const media = await attempt(() => loadMedia());
  const count = (kit: string) => (kit && media.data ? media.data.items.filter((i) => i.collectionIds.includes(kit)).length : 0);
  return (
    <div className={c.className || undefined} id={c.id}>
      {editing && viewer.kind !== "staff" && <EditorNotice title="Partner hub">Staff view shown; a signed-in partner sees only its own kit.</EditorNotice>}
      <h2 className="portal-section-title">{ui("partners")}</h2>
      <div className="portal-grid">
        {partners.map((p) => (
          <Link key={p.user} href={`${SECTION_PATH.partners}/${encodeURIComponent(p.user)}`} className="portal-card">
            <span className="body">
              <span className="name">{p.name}</span>
              {p.about && <span className="summary">{p.about}</span>}
              <span className="sub">{[p.type, p.tier, p.region, p.kit ? ui("kitCount", { count: count(p.kit) }) : "", p.manager ? ui("partnerManagerOf", { name: p.manager }) : ""].filter(Boolean).join(" · ")}</span>
              {p.contact && <span className="sub">{ui("contact")}: {[p.contact, p.contactEmail].filter(Boolean).join(" · ")}</span>}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
};
