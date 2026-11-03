import React from "react";
import { attempt } from "src/lib/ch/portalEdge";
import { loadEvents, type CampusEvent } from "src/lib/ch/university";
import { chrome, isEditing, param, type PortalComponentProps } from "src/lib/portal/component";
import { EditorNotice, LoadError } from "src/lib/portal/editor";
import { ui } from "src/lib/portal/ui-text";
import { ChImage } from "components/ui/portal/ChImage";
import { shortDate } from "components/ui/portal/university/format";
import { pageLocale } from "components/ui/portal/sports/shared";
import { universityMissing } from "components/ui/portal/university/shared";

const languageBadge = (e: CampusEvent) => (/bilingual|biling/i.test(e.language) ? ui("unBilingual") : /spanish|español|espanol/i.test(e.language) ? ui("unSpanish") : "");

/**
 * Campus events: upcoming ones with date, location, a Spanish / Bilingual badge, the event
 * platform's status ("x seats left", Waitlist, Full) and Register; past ones with "x attended".
 * Rendering parameter Limit caps the upcoming list (e.g. 3 for a home page teaser; past events are
 * then left out).
 */
export const Default = async (props: PortalComponentProps) => {
  const editing = isEditing(props.page);
  const c = chrome(props);
  const missing = universityMissing("events", "Events", editing);
  if (missing !== false) return missing;
  const res = await attempt(() => loadEvents());
  if (res.error) return editing ? <EditorNotice title="Events">{res.error}</EditorNotice> : <LoadError message={res.error} />;
  const all = res.data ?? [];
  const limit = Math.max(0, Number(param(props, "Limit")) || 0);
  const upcoming = all.filter((e) => !e.past).slice(0, limit || undefined);
  const past = limit ? [] : all.filter((e) => e.past).reverse();
  if (!upcoming.length && !past.length) return editing ? <EditorNotice title="Events">{ui("unNoEvents")}</EditorNotice> : <p className="portal-empty">{ui("unNoEvents")}</p>;
  const locale = pageLocale();
  const card = (e: CampusEvent) => {
    const badge = languageBadge(e);
    const status = e.past ? (e.checkedIn != null ? ui("unAttended", { n: e.checkedIn }) : "") : e.full ? ui("unFull") : e.waitlisted ? ui("unWaitlist") : e.seatsLeft != null ? ui("unSeatsLeft", { n: e.seatsLeft }) : e.status;
    return (
      <article key={e.id} className={`un-event${e.past ? " past" : ""}`}>
        {e.image && <span className="media"><ChImage links={e.image.links} fallback={e.image.preview} slot="card" alt="" /></span>}
        <div className="body">
          <span className="eyebrow">{shortDate(e.date, locale, true)}</span>
          <h3>{e.name}</h3>
          <p className="sub">{[e.location, e.audience].filter(Boolean).join(" · ")}</p>
          <div className="actions">
            {badge && <span className="un-tag lang">{badge}</span>}
            {status && <span className={`sp-badge${e.full ? " sold-out" : ""}`}>{status}</span>}
            {!e.past && !e.full && e.url && <a className="sp-buy" href={e.url} target="_blank" rel="noopener noreferrer">{e.waitlisted ? ui("unWaitlist") : ui("unRegister")}</a>}
          </div>
        </div>
      </article>
    );
  };
  return (
    <section className={`un-events ${c.className}`.trim()} id={c.id}>
      {upcoming.length > 0 && <>{!limit && <h2 className="un-h">{ui("unUpcomingEvents")}</h2>}<div className="un-event-grid">{upcoming.map(card)}</div></>}
      {past.length > 0 && <><h2 className="un-h">{ui("unPastEvents")}</h2><div className="un-event-grid">{past.map(card)}</div></>}
    </section>
  );
};
