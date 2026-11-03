import React from "react";
import { attempt } from "src/lib/ch/portalEdge";
import { loadMicrosite } from "src/lib/ch/automotive";
import type { MediaItem } from "src/lib/ch/media";
import { chrome, isEditing, type PortalComponentProps } from "src/lib/portal/component";
import { EditorNotice, LoadError } from "src/lib/portal/editor";
import { ui } from "src/lib/portal/ui-text";
import { automotiveMissing } from "components/ui/portal/automotive/shared";
import { GalleryGrid } from "components/ui/portal/automotive/GalleryGrid";

/**
 * The Microsite record's other images and films (everything related to it but the hero), as tiles
 * opening the lightbox. Shown from the reveal on; in the teaser phase only in the Page builder.
 */
export const Default = async (props: PortalComponentProps) => {
  const editing = isEditing(props.page);
  const c = chrome(props);
  const missing = automotiveMissing("microsites", "Gallery", editing);
  if (missing !== false) return missing;
  const res = await attempt(() => loadMicrosite(editing));
  if (res.error) return editing ? <EditorNotice title="Gallery">{res.error}</EditorNotice> : <LoadError message={res.error} />;
  const m = res.data;
  if (!m) return editing ? <EditorNotice title="Gallery">No Microsite record for this deployment (PORTAL_MICROSITE).</EditorNotice> : null;
  const items: MediaItem[] = m.gallery.filter((a) => a.kind === "image" || a.kind === "video").map((a) => ({ ...a, brands: m.brand ? [m.brand.name] : [], collections: [], collectionIds: [] }));
  if (!items.length) return editing ? <EditorNotice title="Gallery">The Microsite record “{m.name}” has no gallery images yet.</EditorNotice> : null;
  const teaser = m.phase === "teaser" || m.phase === "planned";
  if (teaser && !editing) return null;
  return (
    <section className={`au-gallery ${c.className}`.trim()} id={c.id}>
      {teaser && <EditorNotice title="Gallery">Shown from the reveal on — visitors don&apos;t see it during the teaser.</EditorNotice>}
      <h2>{ui("auGallery")}</h2>
      <GalleryGrid items={items} label={ui("auGallery")} />
    </section>
  );
};
