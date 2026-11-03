import React from "react";
import { attempt } from "src/lib/ch/portalEdge";
import { loadPlayers } from "src/lib/ch/sports";
import { chrome, isEditing, param, type PortalComponentProps } from "src/lib/portal/component";
import { EditorNotice, LoadError } from "src/lib/portal/editor";
import { ui } from "src/lib/portal/ui-text";
import { RosterBrowser } from "components/ui/portal/sports/RosterBrowser";
import { sportsMissing, toRosterPlayer } from "components/ui/portal/sports/shared";

/**
 * The roster: player cards (headshot, number, position, G/A/P or W/SV%/GAA) grouped by
 * position, filtered Active / All / farm team. Rendering parameter Filter sets the start filter.
 */
export const Default = async (props: PortalComponentProps) => {
  const editing = isEditing(props.page);
  const c = chrome(props);
  const missing = sportsMissing("players", "Roster", editing);
  if (missing !== false) return missing;
  const res = await attempt(() => loadPlayers());
  if (res.error) return editing ? <EditorNotice title="Roster">{res.error}</EditorNotice> : <LoadError message={res.error} />;
  const players = res.data ?? [];
  if (!players.length) return <p className="portal-empty">{ui("spNoPlayers")}</p>;
  const f = param(props, "Filter").toLowerCase();
  return (
    <div className={c.className || undefined} id={c.id}>
      <RosterBrowser players={players.map(toRosterPlayer)} initial={f === "all" || f === "farm" ? f : "active"} />
    </div>
  );
};
