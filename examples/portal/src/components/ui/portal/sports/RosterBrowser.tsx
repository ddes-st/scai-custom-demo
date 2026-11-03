"use client";
import { useMemo, useState } from "react";
import { Link } from "src/i18n/navigation";
import { useUi } from "src/lib/portal/ui-text-client";
import { playerHref } from "src/lib/portal/sections";
import { keyStats, positionLabel } from "src/lib/portal/sports-format";
import { ChImage } from "components/ui/portal/ChImage";
import type { ImageLink } from "src/lib/ch/image-links";

export interface RosterPlayer {
  id: string; name: string; number: number | null; position: string; group: "G" | "D" | "F"; status: string; active: boolean; farm: boolean;
  stats: Record<string, number | null>; headshot: { preview: string; links?: ImageLink[] } | null;
}

type Filter = "active" | "all" | "farm";

/** Player cards grouped Forwards / Defence / Goalies, filtered Active / All / farm team. */
export function RosterBrowser({ players, initial = "active" }: { players: RosterPlayer[]; initial?: Filter }) {
  const t = useUi();
  const hasFarm = players.some((p) => p.farm);
  const [filter, setFilter] = useState<Filter>(initial);
  const shown = useMemo(() => players.filter((p) => filter === "all" || (filter === "farm" ? p.farm : !p.farm && p.active)), [players, filter]);
  const groups: Array<[string, RosterPlayer[]]> = [[t("spForwards"), shown.filter((p) => p.group === "F")], [t("spDefence"), shown.filter((p) => p.group === "D")], [t("spGoalies"), shown.filter((p) => p.group === "G")]];
  const chips: Array<[Filter, string]> = [["active", t("spActive")], ["all", t("spAllPlayers")], ...(hasFarm ? [["farm", t("spFarm")] as [Filter, string]] : [])];
  return (
    <div className="sp-roster">
      <div className="portal-chips" role="group" aria-label={t("spRoster")}>
        {chips.map(([id, label]) => (
          <button key={id} type="button" className={filter === id ? "active" : undefined} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>
      {shown.length === 0 && <p className="portal-empty">{t("spNoPlayers")}</p>}
      {groups.filter(([, list]) => list.length).map(([label, list]) => (
        <section key={label} className="sp-group">
          <h3>{label}</h3>
          <div className="sp-players">
            {list.map((p) => (
              <Link key={p.id} href={playerHref(p.id)} className="sp-player">
                <span className="photo">
                  {p.headshot ? <ChImage links={p.headshot.links} fallback={p.headshot.preview} slot="card" alt="" /> : <span className="glyph">{p.name.charAt(0)}</span>}
                  {p.number != null && <span className="num">{p.number}</span>}
                </span>
                <span className="body">
                  <span className="name">{p.name}</span>
                  <span className="sub">{[positionLabel(p.position, t), !p.active || p.farm ? p.status : ""].filter(Boolean).join(" · ")}</span>
                  <span className="stats">
                    {keyStats(p, t).map(([k, v]) => <span key={k}><b>{v}</b> {k}</span>)}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
