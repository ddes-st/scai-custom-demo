import React from "react";
import { Link } from "src/i18n/navigation";
import { attempt } from "src/lib/ch/portalEdge";
import { cardsFor } from "src/lib/ch/entities";
import { loadPlayer, loadPlayers } from "src/lib/ch/sports";
import { chrome, isEditing, type PortalComponentProps } from "src/lib/portal/component";
import { EditorNotice, LoadError } from "src/lib/portal/editor";
import { requestContext } from "src/lib/portal/request-context";
import { SECTION_PATH } from "src/lib/portal/sections";
import { n, plainDate, positionLabel, savePct, signed, twoDecimals } from "src/lib/portal/sports-format";
import { ui } from "src/lib/portal/ui-text";
import { ChImage } from "components/ui/portal/ChImage";
import { EntityItems } from "components/ui/portal/EntityItems";
import { pageLocale, sportsMissing } from "components/ui/portal/sports/shared";

/**
 * One player (/team/<id>, a wildcard page): headshot, number, position and bio facts, season
 * stats and the last game, the gallery — only while the image rights run (imageRightsExpiry in
 * the future or unset) — and the player's jerseys as product cards. In the Page builder (no id
 * in the URL) the first player is shown as a sample.
 */
export const Default = async (props: PortalComponentProps) => {
  const editing = isEditing(props.page);
  const c = chrome(props);
  const missing = sportsMissing("players", "Player", editing);
  if (missing !== false) return missing;
  let id = requestContext().slug;
  // the Page builder's sample: an active player with points, else the first one
  if (!id && editing) id = (await attempt(async () => { const all = await loadPlayers(); return (all.find((p) => p.active && !p.farm && (p.stats.points ?? p.stats.wins ?? 0) > 0) ?? all[0])?.id ?? ""; })).data ?? "";
  if (!id) return editing ? <EditorNotice title="Player">No published player yet — the live page renders the player from the URL (/team/&lt;id&gt;).</EditorNotice> : <LoadError message="No player in the URL." missing />;
  const res = await attempt(() => loadPlayer(id));
  if (res.error) return editing ? <EditorNotice title="Player">{res.error}</EditorNotice> : <LoadError message={res.error} />;
  const p = res.data;
  if (!p) return editing ? <EditorNotice title="Player">No published player with id “{id}”.</EditorNotice> : <LoadError message="This player isn't published." missing />;
  const locale = pageLocale();
  const jerseys = p.productIds.length ? (await attempt(() => cardsFor("M_PCM_Product", p.productIds))).data?.cards ?? [] : [];
  const s = p.stats;
  const facts: Array<[string, string]> = ([
    [ui("spNumber"), p.number != null ? `#${p.number}` : ""],
    [ui("spPosition"), positionLabel(p.position, ui)],
    [p.group === "G" ? ui("spCatches") : ui("spShoots"), p.shoots],
    [ui("spNationality"), p.nationality],
    [ui("spStatus"), p.status],
  ] as Array<[string, string]>).filter(([, v]) => v);
  const stats: Array<[string, string]> = p.group === "G"
    ? [[ui("spGP"), n(s.gamesPlayed)], [ui("spW"), n(s.wins)], [ui("spL"), n(s.losses)], [ui("spSvPct"), savePct(s.savePct)], [ui("spGAA"), twoDecimals(s.gaa)]]
    : [[ui("spGP"), n(s.gamesPlayed)], [ui("spG"), n(s.goals)], [ui("spA"), n(s.assists)], [ui("spP"), n(s.points)], [ui("spPlusMinus"), signed(s.plusMinus)], [ui("spPIM"), n(s.penaltyMinutes)]];
  const gallery = p.rightsValid ? p.gallery.filter((a) => a.id !== p.headshot?.id && a.preview) : [];
  return (
    <article className={`portal-detail sp-player-page ${c.className}`.trim()} id={c.id}>
      <p className="portal-note"><Link href={SECTION_PATH.team}>{ui("spRosterBack")}</Link></p>
      <div className="portal-detail-head">
        {p.headshot && <span className="media"><ChImage links={p.headshot.links} fallback={p.headshot.preview} slot="lead" alt={p.name} loading="eager" /></span>}
        <div className="text">
          <span className="eyebrow">{positionLabel(p.position, ui)}{p.number != null ? ` · #${p.number}` : ""}</span>
          <h1>{p.name}</h1>
          <dl className="portal-facts">{facts.map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>)}</dl>
        </div>
      </div>
      <section className="portal-section">
        <div className="portal-section-head"><h2>{ui("spSeasonStats")}</h2></div>
        <dl className="sp-statline">{stats.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        {p.lastGame && <p className="sp-lastgame"><span className="label">{ui("spLastGame")}</span> {p.lastGame}</p>}
      </section>
      {gallery.length > 0 && (
        <section className="portal-section">
          <div className="portal-section-head"><h2>{ui("spGallery")}</h2>{p.rightsExpiry && <p>{plainDate(p.rightsExpiry, locale)}</p>}</div>
          <div className="sp-photos">{gallery.map((a) => <span key={a.id} className="ph"><ChImage links={a.links} fallback={a.preview} slot="thumb" alt={a.title} /></span>)}</div>
        </section>
      )}
      {jerseys.length > 0 && (
        <section className="portal-section">
          <div className="portal-section-head"><h2>{ui("spJerseys")}</h2></div>
          <EntityItems variant="cards" cards={jerseys} />
        </section>
      )}
    </article>
  );
};
