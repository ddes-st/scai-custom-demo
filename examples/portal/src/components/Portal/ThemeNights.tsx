import React from "react";
import { Link } from "src/i18n/navigation";
import { attempt } from "src/lib/ch/portalEdge";
import { listEntities } from "src/lib/ch/entities";
import { loadGames } from "src/lib/ch/sports";
import { chrome, isEditing, type PortalComponentProps } from "src/lib/portal/component";
import { EditorNotice, LoadError } from "src/lib/portal/editor";
import { gameHref } from "src/lib/portal/sections";
import { canBuy, gameDate, ticketBadge, resultLabel } from "src/lib/portal/sports-format";
import { ui } from "src/lib/portal/ui-text";
import { ChImage } from "components/ui/portal/ChImage";
import { pageLocale, sportsMissing } from "components/ui/portal/sports/shared";

const words = (s: string) => s.toLowerCase().replace(/\b(19|20)\d{2}\b/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * Theme nights: the games with a theme, upcoming first — date, theme, ticket CTA and the
 * campaign of the same name (e.g. theme "Heritage Night" ↔ campaign "Heritage Night 2026")
 * when Content Hub publishes campaigns.
 */
export const Default = async (props: PortalComponentProps) => {
  const editing = isEditing(props.page);
  const c = chrome(props);
  const missing = sportsMissing("games", "Theme nights", editing);
  if (missing !== false) return missing;
  const res = await attempt(() => loadGames());
  if (res.error) return editing ? <EditorNotice title="Theme nights">{res.error}</EditorNotice> : <LoadError message={res.error} />;
  const themed = (res.data ?? []).filter((g) => g.themeNight);
  if (!themed.length) return editing ? <EditorNotice title="Theme nights">{ui("spNoThemeNights")}</EditorNotice> : null;
  const ordered = [...themed.filter((g) => g.status !== "closed"), ...themed.filter((g) => g.status === "closed").reverse()];
  const campaigns = (await attempt(() => listEntities("M_CMP_Campaign"))).data ?? [];
  const campaignOf = (theme: string) => {
    const w = words(theme);
    return w ? campaigns.find((k) => { const t = words(k.title); return !!t && (t === w || t.includes(w) || w.includes(t)); }) ?? null : null;
  };
  const locale = pageLocale();
  return (
    <section className={`sp-themes ${c.className}`.trim()} id={c.id}>
      {ordered.map((g) => {
        const campaign = campaignOf(g.themeNight);
        const badge = g.status === "closed" ? "" : ticketBadge(g.ticket, ui);
        return (
          <article key={g.id} className={`sp-theme-card${g.status === "closed" ? " past" : ""}`}>
            {g.image && <span className="media"><ChImage links={g.image.links} fallback={g.image.preview} slot="card" alt="" /></span>}
            <div className="body">
              <span className="eyebrow">{ui("spThemeNight")} · {gameDate(g.date, locale)}</span>
              <h3>{g.themeNight}</h3>
              <p><Link href={gameHref(g.id)}>{g.home ? ui("spVs", { team: g.opponent }) : ui("spAt", { team: g.opponent })}</Link>{g.status === "closed" && g.finalScore ? ` · ${g.finalScore} ${resultLabel(g.result, ui)}` : ""}</p>
              {campaign && <p className="sub">{ui("spCampaign")}: {campaign.href ? <Link href={campaign.href}>{campaign.title}</Link> : campaign.title}</p>}
              <div className="actions">
                {canBuy(g) && <a className="sp-buy" href={g.ticket.url} target="_blank" rel="noopener noreferrer">{ui("spBuyTickets")}</a>}
                {badge && <span className={`sp-badge${g.ticket.soldOut ? " sold-out" : ""}`}>{badge}</span>}
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
};
