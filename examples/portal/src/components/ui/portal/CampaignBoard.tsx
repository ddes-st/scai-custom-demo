"use client";

import { useState } from "react";
import { Link } from "src/i18n/navigation";
import type { EntityCard } from "src/lib/ch/entities";
import { useUi } from "src/lib/portal/ui-text-client";
import { ChImage } from "components/ui/portal/ChImage";

const MONTHS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];
const STATES = ["live", "upcoming", "planning", "ended"] as const;

/** Campaign cards from Content Hub. The timeline, status and approval counts are not on the feed. */
export function CampaignBoard({ cards }: { cards: EntityCard[] }) {
  const t = useUi();
  const [state, setState] = useState("");
  const shown = state ? [] : cards;
  const label = (id: string) => t(id === "live" ? "hubLive" : id === "upcoming" ? "hubUpcoming" : id === "planning" ? "hubPlanning" : "hubEnded");

  return (
    <div className="hub-campaigns">
      <div className="hub-timeline" aria-hidden={false}>
        <div className="hub-months">{MONTHS.map((m) => <span key={m}>{m}</span>)}</div>
        <p className="hub-gap">{t("hubNotOnFeed")}</p>
      </div>
      <div className="hub-chip-line">
        <div>
          <button type="button" className={!state ? "is-on" : undefined} onClick={() => setState("")}>{t("all")} {cards.length}</button>
          {STATES.map((id) => <button key={id} type="button" className={state === id ? "is-on" : undefined} onClick={() => setState(state === id ? "" : id)}>{label(id)}</button>)}
        </div>
      </div>
      {state && <p className="hub-gap">{t("hubNotOnFeed")}</p>}
      <div className="hub-campaign-grid">
        {shown.map((c) => {
          const body = (
            <>
              <span className="media">{c.image ? <ChImage links={c.imageLinks} fallback={c.image} slot="card" alt="" /> : <span className="hub-needed">{t("hubImageNeeded")}</span>}</span>
              <span className="meta">{[c.brand, c.subtitle].filter(Boolean).join(" · ")}</span>
              <span className="name">{c.title}</span>
              <span className="hub-meter" title={t("hubNotOnFeed")} />
            </>
          );
          return c.href ? <Link key={c.id} href={c.href} className="hub-campaign">{body}</Link> : <article key={c.id} className="hub-campaign">{body}</article>;
        })}
      </div>
    </div>
  );
}
