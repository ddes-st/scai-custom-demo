import React from "react";
import { attempt } from "src/lib/ch/portalEdge";
import { loadMicrosite } from "src/lib/ch/automotive";
import { chrome, isEditing, type PortalComponentProps } from "src/lib/portal/component";
import { EditorNotice, LoadError } from "src/lib/portal/editor";
import { ui } from "src/lib/portal/ui-text";
import { ChImage } from "components/ui/portal/ChImage";
import { automotiveMissing } from "components/ui/portal/automotive/shared";

/**
 * The reveal visual: the Microsite record's master asset (else its first image), full width with
 * the marque's name. Before the reveal it stays a dimmed, blurred teaser; from the reveal on it shows.
 */
export const Default = async (props: PortalComponentProps) => {
  const editing = isEditing(props.page);
  const c = chrome(props);
  const missing = automotiveMissing("microsites", "Reveal hero", editing);
  if (missing !== false) return missing;
  const res = await attempt(() => loadMicrosite(editing));
  if (res.error) return editing ? <EditorNotice title="Reveal hero">{res.error}</EditorNotice> : <LoadError message={res.error} />;
  const m = res.data;
  if (!m) return editing ? <EditorNotice title="Reveal hero">No Microsite record for this deployment (PORTAL_MICROSITE).</EditorNotice> : null;
  if (!m.hero) return editing ? <EditorNotice title="Reveal hero">The Microsite record “{m.name}” has no image yet — relate its hero to the record in Content Hub.</EditorNotice> : null;
  const teaser = m.phase === "teaser" || m.phase === "planned";
  return (
    <section className={`au-hero${teaser ? " teaser" : ""} ${c.className}`.trim()} id={c.id}>
      <span className="media"><ChImage links={m.hero.links} fallback={m.hero.preview} slot="wide" alt={teaser ? "" : m.hero.title} loading="eager" /></span>
      <div className="caption">
        {m.brand?.name && <span className="eyebrow">{m.brand.name}</span>}
        {teaser && <strong>{ui("auComingSoon")}</strong>}
      </div>
    </section>
  );
};
