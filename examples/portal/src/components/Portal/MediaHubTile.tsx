import React from "react";
import { Link } from "src/i18n/navigation";
import { env } from "src/lib/ch/env";
import { attempt } from "src/lib/ch/portalEdge";
import { loadGames, loadRecaps } from "src/lib/ch/sports";
import { getViewer } from "src/lib/ch/viewer";
import { chrome, isEditing, type PortalComponentProps } from "src/lib/portal/component";
import { EditorNotice } from "src/lib/portal/editor";
import { gameHref, SECTION_PATH } from "src/lib/portal/sections";
import { gameDate } from "src/lib/portal/sports-format";
import { ui } from "src/lib/portal/ui-text";
import { ChImage } from "components/ui/portal/ChImage";
import { pageLocale, sportsMissing } from "components/ui/portal/sports/shared";

/**
 * The media hub tile for signed-in staff and partners (hybrid or gated portals; nothing for
 * anonymous visitors): the latest game recaps and the latest played game's photos, with links
 * to the game page and the media library.
 */
export const Default = async (props: PortalComponentProps) => {
  const editing = isEditing(props.page);
  const c = chrome(props);
  const missing = sportsMissing("games", "Media hub", editing);
  if (missing !== false) return missing;
  if (!editing) {
    if (env.siteMode === "public") return null;
    const viewer = await getViewer();
    if (viewer.kind !== "staff" && viewer.kind !== "partner") return null;
  }
  const [games, recaps] = await Promise.all([attempt(() => loadGames()), attempt(() => loadRecaps())]);
  const last = [...(games.data ?? [])].reverse().find((g) => g.status === "closed" && g.photos.length) ?? null;
  const latest = (recaps.data ?? []).slice(0, 3);
  if (!last && !latest.length) return editing ? <EditorNotice title="Media hub">{ui("spNoRecaps")}</EditorNotice> : null;
  const locale = pageLocale();
  return (
    <section className={`portal-section sp-mediahub ${c.className}`.trim()} id={c.id}>
      <div className="portal-section-head"><h2>{ui("spMediaHub")}</h2><Link href={SECTION_PATH.media}>{ui("spMediaLibraryLink")}</Link></div>
      <div className="sp-mediahub-grid">
        <div>
          <h3>{ui("spLatestRecaps")}</h3>
          {latest.length ? (
            <ul className="sp-recaps">{latest.map((r) => <li key={r.id}><b>{r.title}</b>{r.lead && <span className="sub">{r.lead}</span>}</li>)}</ul>
          ) : <p className="portal-empty">{ui("spNoRecaps")}</p>}
        </div>
        {last && (
          <div>
            <h3>{ui("spLatestPhotos")}</h3>
            <p className="sub"><Link href={gameHref(last.id)}>{last.home ? ui("spVs", { team: last.opponent }) : ui("spAt", { team: last.opponent })}</Link> · {gameDate(last.date, locale, false)}</p>
            <div className="sp-photos">{last.photos.slice(0, 6).filter((a) => a.preview).map((a) => <span key={a.id} className="ph"><ChImage links={a.links} fallback={a.preview} slot="thumb" alt={a.title} /></span>)}</div>
          </div>
        )}
      </div>
    </section>
  );
};
