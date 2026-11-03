import React from "react";
import { Link } from "src/i18n/navigation";
import { getViewer } from "src/lib/ch/viewer";
import { findPartner, loadPartners } from "src/lib/portal/partners";
import { requestContext } from "src/lib/portal/request-context";
import { chrome, isEditing, type PortalComponentProps } from "src/lib/portal/component";
import { EditorNotice } from "src/lib/portal/editor";
import { getPortalSettings } from "src/lib/portal/settings";
import { SECTION_PATH } from "src/lib/portal/sections";
import { ui } from "src/lib/portal/ui-text";
import { PartnerKit } from "components/ui/portal/PartnerKit";

/** One partner's page (/partners/<user>, wildcard page with DetailKind "partner"): staff see any
 *  partner; a partner reaches only its own (the route resolver 404s the rest). */
export const Default = async (props: PortalComponentProps) => {
  const editing = isEditing(props.page);
  const c = chrome(props);
  const { slug } = requestContext();
  const settings = await getPortalSettings(props.page.siteName, props.page.locale);
  const viewer = await getViewer();
  const partner = slug ? await findPartner(slug) : editing ? (await loadPartners())[0] ?? null : null;
  if (!partner) return editing ? <EditorNotice title="Partner page">No partner items under Data/Partners yet.</EditorNotice> : null;
  if (!editing && viewer.kind !== "staff" && !(viewer.kind === "partner" && viewer.partner.user === partner.user)) return null;
  return (
    <div className={c.className || undefined} id={c.id}>
      {editing && !slug && <EditorNotice title="Sample partner shown">The live page renders the partner from the URL (/partners/&lt;user&gt;).</EditorNotice>}
      {viewer.kind === "staff" && <p className="portal-note"><Link href={SECTION_PATH.partners}>{ui("allPartnersBack")}</Link></p>}
      <PartnerKit partner={partner} trackViews={settings.trackUsage && !editing} heading={partner.name} as={viewer.kind === "partner" ? "partner" : "staff"} />
    </div>
  );
};
