import React from "react";
import { Link } from "src/i18n/navigation";
import { attempt } from "src/lib/ch/portalEdge";
import { loadGames, nextAndLast } from "src/lib/ch/sports";
import { chrome, isEditing, type PortalComponentProps } from "src/lib/portal/component";
import { EditorNotice, LoadError } from "src/lib/portal/editor";
import { gameHref } from "src/lib/portal/sections";
import { canBuy, gameDate, ticketBadge, resultLabel } from "src/lib/portal/sports-format";
import { ui } from "src/lib/portal/ui-text";
import { ChImage } from "components/ui/portal/ChImage";
import { Countdown } from "components/ui/portal/sports/Countdown";
import { pageLocale, sportsMissing } from "components/ui/portal/sports/shared";

/**
 * The game center band: the next game (date, opponent, home or away, countdown, theme night,
 * ticket status and the Buy tickets link for home games on sale) next to the last result
 * (final score, result, three stars, goaltending). Data: the industry model's games with the
 * stats and ticketing feeds (src/lib/ch/sports.ts).
 */
export const Default = async (props: PortalComponentProps) => {
  const editing = isEditing(props.page);
  const c = chrome(props);
  const missing = sportsMissing("games", "Game center", editing);
  if (missing !== false) return missing;
  const res = await attempt(() => loadGames());
  if (res.error) return editing ? <EditorNotice title="Game center">{res.error}</EditorNotice> : <LoadError message={res.error} />;
  const { next, last } = nextAndLast(res.data ?? []);
  if (!next && !last) return editing ? <EditorNotice title="Game center">No games are published yet.</EditorNotice> : null;
  const locale = pageLocale();
  const badge = next ? ticketBadge(next.ticket, ui) : "";
  return (
    <section className={`sp-center ${c.className}`.trim()} id={c.id}>
      {next && (
        <div className="sp-next">
          {next.image && <span className="bg" aria-hidden="true"><ChImage links={next.image.links} fallback={next.image.preview} slot="wide" alt="" loading="eager" /></span>}
          <div className="body">
            <span className="eyebrow">{ui("spNextGame")}{next.themeNight ? ` · ${next.themeNight}` : ""}</span>
            <h2><Link href={gameHref(next.id)}>{next.home ? ui("spVs", { team: next.opponent }) : ui("spAt", { team: next.opponent })}</Link></h2>
            <p className="when">{gameDate(next.date, locale)} · {next.home ? ui("spHome") : ui("spAway")}{next.gameType ? ` · ${next.gameType}` : ""}</p>
            <Countdown start={next.date} />
            <div className="actions">
              {canBuy(next) && <a className="sp-buy" href={next.ticket.url} target="_blank" rel="noopener noreferrer">{ui("spBuyTickets")}</a>}
              {badge && <span className={`sp-badge${next.ticket.soldOut ? " sold-out" : ""}`}>{badge}</span>}
              {!next.home && next.ticket.status && <span className="sub">{next.ticket.status}</span>}
            </div>
          </div>
        </div>
      )}
      {last && (
        <div className={`sp-last${last.win === true ? " win" : last.win === false ? " loss" : ""}`}>
          <span className="eyebrow">{ui("spLastResult")} · {gameDate(last.date, locale, false)}</span>
          <h3>{last.home ? ui("spVs", { team: last.opponent }) : ui("spAt", { team: last.opponent })}</h3>
          <p className="score"><b>{last.finalScore}</b> <span className="result">{resultLabel(last.result, ui)}</span></p>
          {last.threeStars.length > 0 && (
            <div className="stars">
              <span className="label">{ui("spThreeStars")}</span>
              <ol>{last.threeStars.map((s) => <li key={s}>{s}</li>)}</ol>
            </div>
          )}
          {last.goalie && <p className="goalie"><span className="label">{ui("spGoalie")}</span> {last.goalie}</p>}
          <Link className="more" href={gameHref(last.id)}>{ui("spGameDetails")}</Link>
        </div>
      )}
    </section>
  );
};
