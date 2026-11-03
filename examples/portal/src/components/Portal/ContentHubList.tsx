import React from "react";
import { env } from "src/lib/ch/env";
import { listEntities, profileFor } from "src/lib/ch/entities";
import { attempt } from "src/lib/ch/portalEdge";
import { chrome, isEditing, param, type PortalComponentProps } from "src/lib/portal/component";
import { EditorNotice, LoadError } from "src/lib/portal/editor";
import { columnsOf, EntityItems, variantOf } from "components/ui/portal/EntityItems";
import { ui } from "src/lib/portal/ui-text";

/**
 * Every published Content Hub entity of one definition (rendering parameters: `Definition`,
 * the Edge type such as M_CMP_Campaign or a dotted name; `Variant`; `Limit`), in the brand
 * scope, as cards, list, tiles, carousel or hero. The listing counterpart of ContentHubItems:
 * a section page for a definition is this component plus a `*` page with the same Definition.
 */
export const Default = async (props: PortalComponentProps) => {
  const editing = isEditing(props.page);
  const c = chrome(props);
  const definition = param(props, "Definition");
  const variant = variantOf(param(props, "Variant"));
  const crop = param(props, "ImageCrop");
  const columns = columnsOf(param(props, "Columns"));
  const limit = Math.min(Math.max(Number(param(props, "Limit")) || 60, 1), 600);
  if (!definition) {
    return editing ? <EditorNotice title="Content Hub list">Set the Definition rendering parameter (Design tab), e.g. M_CMP_Campaign or M.PCM.Product.</EditorNotice> : null;
  }
  if (!env.edgeToken) {
    const msg = "This section reads Experience Edge for Content Hub, which isn't connected (EDGE_TOKEN).";
    return editing ? <EditorNotice title="Content Hub list">{msg}</EditorNotice> : <LoadError message={msg} />;
  }
  const res = await attempt(async () => {
    const profile = await profileFor(definition);
    if (!profile) return null;
    return { profile, cards: (await listEntities(definition)).slice(0, limit) };
  });
  if (res.error) return editing ? <EditorNotice title="Content Hub list">{res.error}</EditorNotice> : <LoadError message={res.error} />;
  if (!res.data) {
    const msg = `Experience Edge doesn't publish ${definition} on this tenant.`;
    return editing ? <EditorNotice title="Content Hub list">{msg}</EditorNotice> : null;
  }
  const { profile, cards } = res.data;
  if (!cards.length) return editing ? <EditorNotice title="Content Hub list">No {profile.labelPlural.toLowerCase()} are published yet.</EditorNotice> : <p className="portal-empty">{ui("nothingPublished")}</p>;
  return (
    <div className={`ch-items ch-items-${variant} ${c.className}`.trim()} id={c.id}>
      <EntityItems variant={variant} cards={cards} crop={crop} columns={columns} />
    </div>
  );
};
