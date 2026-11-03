import React from "react";
import { attempt } from "src/lib/ch/portalEdge";
import { loadMicrosite } from "src/lib/ch/automotive";
import { chrome, isEditing, type PortalComponentProps } from "src/lib/portal/component";
import { EditorNotice, LoadError } from "src/lib/portal/editor";
import { ui } from "src/lib/portal/ui-text";
import { pageLocale } from "components/ui/portal/sports/shared";
import { automotiveMissing, longDate, serverNow } from "components/ui/portal/automotive/shared";
import { Countdown } from "components/ui/portal/automotive/Countdown";

/**
 * The teaser countdown to the microsite's reveal (the Microsite record's reveal date, PORTAL_MICROSITE);
 * from the reveal on it says when the model was revealed. Before the go-live too, under "Coming soon".
 */
export const Default = async (props: PortalComponentProps) => {
  const editing = isEditing(props.page);
  const c = chrome(props);
  const missing = automotiveMissing("microsites", "Countdown", editing);
  if (missing !== false) return missing;
  const res = await attempt(() => loadMicrosite(editing));
  if (res.error) return editing ? <EditorNotice title="Countdown">{res.error}</EditorNotice> : <LoadError message={res.error} />;
  const m = res.data;
  if (!m) return editing ? <EditorNotice title="Countdown">No Microsite record for this deployment (PORTAL_MICROSITE — set by the Demo Builder&apos;s microsite deploy).</EditorNotice> : null;
  if (!m.revealDate) return editing ? <EditorNotice title="Countdown">The Microsite record “{m.name}” has no reveal date.</EditorNotice> : null;
  const locale = pageLocale();
  const revealed = ui("auRevealedOn", { date: longDate(m.revealDate, locale) });
  return (
    <section className={`au-countdown au-phase-${m.phase} ${c.className}`.trim()} id={c.id}>
      {editing && m.phase === "down" && <EditorNotice title="Countdown">“{m.name}” is taken down: live visitors are sent to the marque&apos;s page on the portal.</EditorNotice>}
      {m.phase === "planned" && <p className="au-count-label">{ui("auComingSoon")}</p>}
      {m.phase === "planned" || m.phase === "teaser" ? (
        <Countdown target={m.revealDate} serverNow={serverNow()} labels={{ revealIn: ui("auRevealIn"), days: ui("auDays"), hours: ui("auHours"), minutes: ui("auMinutes"), seconds: ui("auSeconds"), revealed }} />
      ) : (
        <p className="au-count-done">{revealed}</p>
      )}
    </section>
  );
};
