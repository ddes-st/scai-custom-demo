import React from "react";
import { Link } from "src/i18n/navigation";
import { attempt } from "src/lib/ch/portalEdge";
import { loadGame, loadGames, loadRecaps, recapFor } from "src/lib/ch/sports";
import { chrome, isEditing, type PortalComponentProps } from "src/lib/portal/component";
import { EditorNotice, LoadError } from "src/lib/portal/editor";
import { requestContext } from "src/lib/portal/request-context";
import { SECTION_PATH } from "src/lib/portal/sections";
import { canBuy, gameDate, n, ticketBadge, resultLabel } from "src/lib/portal/sports-format";
import { ui } from "src/lib/portal/ui-text";
import { ChImage } from "components/ui/portal/ChImage";
import { RichTextServer } from "components/ui/portal/RichTextServer";
import { pageLocale, sportsMissing } from "components/ui/portal/sports/shared";

/**
 * One game (/games/<id>, a wildcard page). Played: final score, the scoring summary as a
 * timeline (parsed from the stats feed's Scoring lines), three stars, shots, power play,
 * goaltending, the game's photos and its recap when one matches. Upcoming: date, theme night
 * and tickets. In the Page builder (no id in the URL) the last played game is the sample.
 */
export const Default = async (props: PortalComponentProps) => {
  const editing = isEditing(props.page);
  const c = chrome(props);
  const missing = sportsMissing("games", "Game", editing);
  if (missing !== false) return missing;
  let id = requestContext().slug;
  if (!id && editing) id = (await attempt(async () => { const all = await loadGames(); return ([...all].reverse().find((g) => g.status === "closed") ?? all[0])?.id ?? ""; })).data ?? "";
  if (!id) return editing ? <EditorNotice title="Game">No published game yet — the live page renders the game from the URL (/games/&lt;id&gt;).</EditorNotice> : <LoadError message="No game in the URL." missing />;
  const res = await attempt(() => loadGame(id));
  if (res.error) return editing ? <EditorNotice title="Game">{res.error}</EditorNotice> : <LoadError message={res.error} />;
  const g = res.data;
  if (!g) return editing ? <EditorNotice title="Game">No published game with id “{id}”.</EditorNotice> : <LoadError message="This game isn't published." missing />;
  const locale = pageLocale();
  const recap = g.status === "closed" ? recapFor(g, (await attempt(() => loadRecaps())).data ?? []) : null;
  const badge = g.status === "closed" ? "" : ticketBadge(g.ticket, ui);
  const matchup = g.home ? ui("spVs", { team: g.opponent }) : ui("spAt", { team: g.opponent });
  return (
    <article className={`portal-detail sp-game-page ${c.className}`.trim()} id={c.id}>
      <p className="portal-note"><Link href={SECTION_PATH.games}>{ui("spAllGamesBack")}</Link></p>
      <header className={`sp-game-head${g.win === true ? " win" : g.win === false ? " loss" : ""}`}>
        {g.image && <span className="bg" aria-hidden="true"><ChImage links={g.image.links} fallback={g.image.preview} slot="wide" alt="" loading="eager" /></span>}
        <div className="body">
          <span className="eyebrow">{[gameDate(g.date, locale), g.home ? ui("spHome") : ui("spAway"), g.gameType, g.themeNight].filter(Boolean).join(" · ")}</span>
          <h1>{matchup}</h1>
          {g.status === "closed"
            ? <p className="score"><span className="label">{ui("spFinal")}</span> <b>{g.finalScore}</b> <span className="result">{resultLabel(g.result, ui)}</span></p>
            : <div className="actions">
                {canBuy(g) && <a className="sp-buy" href={g.ticket.url} target="_blank" rel="noopener noreferrer">{ui("spBuyTickets")}</a>}
                {badge && <span className={`sp-badge${g.ticket.soldOut ? " sold-out" : ""}`}>{badge}</span>}
                {!g.home && g.ticket.status && <span className="sub">{g.ticket.status}</span>}
              </div>}
        </div>
      </header>
      {g.status !== "closed" && <p className="portal-empty">{ui("spNotPlayed")}</p>}
      {g.status === "closed" && (
        <div className="sp-boxscore">
          <section className="portal-section sp-timeline-wrap">
            <div className="portal-section-head"><h2>{ui("spScoringSummary")}</h2></div>
            <ol className="sp-timeline">
              {g.scoring.map((e, i) => (
                <li key={i} className={e.side}>
                  <span className="when">{e.period} {e.time}</span>
                  <span className="what">
                    {e.side === "us"
                      ? <><b>{e.scorer}</b>{e.note && <span className="note">{e.note}</span>}{e.assists && <span className="assists">{ui("spAssists", { names: e.assists })}</span>}</>
                      : <span className="against">{ui("spGoalAgainst")} — {e.team}</span>}
                  </span>
                  <span className="score">{e.score}</span>
                </li>
              ))}
            </ol>
          </section>
          <aside className="sp-side">
            {g.threeStars.length > 0 && <div className="stars"><h3>{ui("spThreeStars")}</h3><ol>{g.threeStars.map((s) => <li key={s}>{s}</li>)}</ol></div>}
            <dl className="sp-statline compact">
              <div><dt>{ui("spShots")}</dt><dd>{n(g.shotsFor)}–{n(g.shotsAgainst)}</dd></div>
              {g.powerPlay && <div><dt>{ui("spPowerPlay")}</dt><dd>{g.powerPlay}</dd></div>}
              {g.ticket.sold != null && g.home && <div><dt>{ui("spAttendance")}</dt><dd>{g.ticket.sold.toLocaleString(locale === "en" ? "en-GB" : locale)}</dd></div>}
            </dl>
            {g.goalie && <p className="goalie"><span className="label">{ui("spGoalie")}</span> {g.goalie}</p>}
          </aside>
        </div>
      )}
      {g.photos.length > 0 && (
        <section className="portal-section">
          <div className="portal-section-head"><h2>{ui("spPhotos")}</h2></div>
          <div className="sp-photos">{g.photos.filter((a) => a.preview).map((a) => <span key={a.id} className="ph"><ChImage links={a.links} fallback={a.preview} slot="thumb" alt={a.title} /></span>)}</div>
        </section>
      )}
      {recap && (
        <section className="portal-section sp-recap">
          <div className="portal-section-head"><h2>{ui("spRecap")}</h2></div>
          <h3>{recap.title}</h3>
          {recap.lead && <p className="lead">{recap.lead}</p>}
          <RichTextServer html={recap.bodyHtml} />
          {recap.boxScoreHtml && <><h3>{ui("spBoxScore")}</h3><RichTextServer html={recap.boxScoreHtml} /></>}
        </section>
      )}
    </article>
  );
};
