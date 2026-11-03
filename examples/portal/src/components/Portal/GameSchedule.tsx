import React from "react";
import { attempt } from "src/lib/ch/portalEdge";
import { loadGames } from "src/lib/ch/sports";
import { chrome, isEditing, param, type PortalComponentProps } from "src/lib/portal/component";
import { EditorNotice, LoadError } from "src/lib/portal/editor";
import { ui } from "src/lib/portal/ui-text";
import { ScheduleBrowser } from "components/ui/portal/sports/ScheduleBrowser";
import { pageLocale, sportsMissing, toScheduleGame } from "components/ui/portal/sports/shared";

/**
 * Schedule & results: every game by month with home/away, theme-night badges, the score of
 * played games and the ticket status of upcoming ones; filters all / upcoming / results / theme
 * nights. Rendering parameter Filter sets the filter it opens on.
 */
export const Default = async (props: PortalComponentProps) => {
  const editing = isEditing(props.page);
  const c = chrome(props);
  const missing = sportsMissing("games", "Schedule & results", editing);
  if (missing !== false) return missing;
  const res = await attempt(() => loadGames());
  if (res.error) return editing ? <EditorNotice title="Schedule & results">{res.error}</EditorNotice> : <LoadError message={res.error} />;
  const games = res.data ?? [];
  if (!games.length) return <p className="portal-empty">{ui("spNoGames")}</p>;
  const f = param(props, "Filter").toLowerCase();
  const initial = f === "upcoming" || f === "results" || f === "theme" ? f : "all";
  return (
    <div className={c.className || undefined} id={c.id}>
      <ScheduleBrowser games={games.map(toScheduleGame)} locale={pageLocale()} initial={initial} />
    </div>
  );
};
