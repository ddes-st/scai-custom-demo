import React from "react";
import { env } from "src/lib/ch/env";
import { loadMedia } from "src/lib/ch/media";
import { attempt } from "src/lib/ch/portalEdge";
import { chrome, isEditing, type PortalComponentProps } from "src/lib/portal/component";
import { EditorNotice, LoadError } from "src/lib/portal/editor";
import { getPortalSettings } from "src/lib/portal/settings";
import { getViewer } from "src/lib/ch/viewer";
import { loadPartners } from "src/lib/portal/partners";
import { MediaBrowser } from "components/ui/portal/MediaBrowser";
import { ui } from "src/lib/portal/ui-text";

/** The media library: approved assets in scope with collection chips, search, filters and a lightbox. */
export const Default = async (props: PortalComponentProps) => {
  const editing = isEditing(props.page);
  const c = chrome(props);
  if (!env.edgeToken) {
    const msg = "This section reads Experience Edge for Content Hub, which isn't connected (EDGE_TOKEN).";
    return editing ? <EditorNotice title="Media library">{msg}</EditorNotice> : <LoadError message={msg} />;
  }
  const res = await attempt(() => loadMedia());
  if (res.error) return editing ? <EditorNotice title="Media library">{res.error}</EditorNotice> : <LoadError message={res.error} />;
  const lib = res.data;
  if (!lib || lib.items.length === 0) return <p className="portal-empty">{ui("noMedia")}</p>;
  const settings = await getPortalSettings(props.page.siteName, props.page.locale);
  // Files that exist only in partner kits are private: listed for staff and the kit's partner only.
  const viewer = await getViewer();
  const kits = viewer.kind === "staff" ? new Set<string>() : new Set((await loadPartners()).map((p) => p.kit).filter(Boolean));
  const own = viewer.kind === "partner" ? viewer.partner.kit : "";
  const items = kits.size ? lib.items.filter((i) => !i.collectionIds.length || i.collectionIds.some((id) => !kits.has(id)) || (own && i.collectionIds.includes(own))) : lib.items;
  return (
    <div className={c.className || undefined} id={c.id}>
      <MediaBrowser items={items} collections={lib.collectionLink ? lib.collections : []} brands={lib.brands} trackViews={settings.trackUsage && !editing} />
      {lib.capped && <p className="portal-empty">{ui("mediaCapped", { count: lib.items.length })}</p>}
    </div>
  );
};
