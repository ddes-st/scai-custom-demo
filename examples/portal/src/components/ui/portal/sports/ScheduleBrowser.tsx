"use client";
import { useMemo, useState } from "react";
import { Link } from "src/i18n/navigation";
import { useUi } from "src/lib/portal/ui-text-client";
import { gameHref } from "src/lib/portal/sections";
import { canBuy, gameDate, monthLabel, ticketBadge, resultLabel } from "src/lib/portal/sports-format";

export interface ScheduleGame {
  id: string; date: string; opponent: string; home: boolean; themeNight: string; status: string; finalScore: string; result: string; win: boolean | null;
  ticket: { status: string; url: string; soldOut: boolean; completed: boolean; sellThrough: number | null; sold: number | null; capacity: number | null };
}

type Filter = "all" | "upcoming" | "results" | "theme";

/** Every game with filters (all / upcoming / results / theme nights), grouped by month. */
export function ScheduleBrowser({ games, locale, initial = "all" }: { games: ScheduleGame[]; locale: string; initial?: Filter }) {
  const t = useUi();
  const [filter, setFilter] = useState<Filter>(initial);
  const shown = useMemo(() => games.filter((g) => filter === "all" || (filter === "upcoming" && g.status !== "closed") || (filter === "results" && g.status === "closed") || (filter === "theme" && !!g.themeNight)), [games, filter]);
  const months = useMemo(() => {
    const out: Array<{ key: string; label: string; games: ScheduleGame[] }> = [];
    for (const g of shown) {
      const key = g.date.slice(0, 7);
      const last = out[out.length - 1];
      if (last?.key === key) last.games.push(g);
      else out.push({ key, label: monthLabel(g.date, locale), games: [g] });
    }
    return out;
  }, [shown, locale]);
  const chips: Array<[Filter, string]> = [["all", t("spAllGames")], ["upcoming", t("spUpcoming")], ["results", t("spResults")], ["theme", t("spThemeNights")]];
  return (
    <div className="sp-schedule">
      <div className="portal-chips" role="group" aria-label={t("spSchedule")}>
        {chips.map(([id, label]) => (
          <button key={id} type="button" className={filter === id ? "active" : undefined} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>
      {months.length === 0 && <p className="portal-empty">{t("spNoMatches")}</p>}
      {months.map((m) => (
        <section key={m.key} className="sp-month">
          <h3>{m.label}</h3>
          <ol className="sp-games">
            {m.games.map((g) => {
              const badge = g.status === "closed" ? "" : ticketBadge(g.ticket, t);
              return (
                <li key={g.id} className={`sp-game ${g.status === "closed" ? "closed" : "upcoming"}${g.win === true ? " win" : g.win === false ? " loss" : ""}`}>
                  <span className="when">{gameDate(g.date, locale)}</span>
                  <span className="ha" title={g.home ? t("spHome") : t("spAway")}>{g.home ? t("spHome") : t("spAway")}</span>
                  <Link className="who" href={gameHref(g.id)}>{g.home ? t("spVs", { team: g.opponent }) : t("spAt", { team: g.opponent })}</Link>
                  {g.themeNight && <span className="sp-theme">{g.themeNight}</span>}
                  <span className="what">
                    {g.status === "closed"
                      ? <><b className="score">{g.finalScore}</b> <span className="result">{resultLabel(g.result, t)}</span></>
                      : <>
                          {badge && <span className={`sp-badge${g.ticket.soldOut ? " sold-out" : ""}`}>{badge}</span>}
                          {canBuy(g) ? <a className="sp-buy" href={g.ticket.url} target="_blank" rel="noopener noreferrer">{t("spBuyTickets")}</a> : !g.home && g.ticket.status ? <span className="sub">{g.ticket.status}</span> : null}
                        </>}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
