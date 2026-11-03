import React from "react";
import { Link } from "src/i18n/navigation";
import { getSectionPages } from "src/lib/portal/site-pages";
import { requestContext } from "src/lib/portal/request-context";
import { chrome, isEditing, param, type PortalComponentProps } from "src/lib/portal/component";
import { EditorNotice } from "src/lib/portal/editor";
import { ui } from "src/lib/portal/ui-text";
import { getViewer } from "src/lib/ch/viewer";
import { canView } from "src/lib/portal/audience";

/**
 * One card per section page flagged "Show on home" (label + blurb + "Open →"), in the page
 * tree's order. Rendering parameter ExcludeCurrent (checkbox) hides the page it sits on.
 */
export const Default = async (props: PortalComponentProps) => {
  // Checkbox parameter: "1" when ticked. (Home never lists itself anyway — the cards are its children.)
  const exclude = param(props, "ExcludeCurrent") === "1";
  const current = requestContext().segments[0]?.toLowerCase() ?? "";
  const viewer = await getViewer();
  const pages = (await getSectionPages(props.page.siteName, props.page.locale)).filter((p) => canView(viewer.kind, p.visibleTo) && p.showOnHome && !(exclude && p.key === current));
  const c = chrome(props);
  if (!pages.length) {
    return isEditing(props.page) ? (
      <EditorNotice title="Section cards">No published page under Home has “Show on home” ticked yet.</EditorNotice>
    ) : null;
  }
  return (
    <div className={`portal-hub ${c.className}`.trim()} id={c.id}>
      {pages.map((p) => (
        <Link key={p.key} href={p.href} className="portal-hub-card">
          <span className="name">{p.label}</span>
          {p.blurb && <span className="summary">{p.blurb}</span>}
          <span className="sub">{ui("open")}</span>
        </Link>
      ))}
    </div>
  );
};
