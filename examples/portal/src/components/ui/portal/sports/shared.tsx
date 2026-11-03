import "server-only";
import React from "react";
import { env } from "src/lib/ch/env";
import { modelFor, type SportsRole } from "src/lib/ch/sports";
import { EditorNotice } from "src/lib/portal/editor";
import { requestContext } from "src/lib/portal/request-context";
import type { Game, Player } from "src/lib/ch/sports";
import type { ScheduleGame } from "./ScheduleBrowser";
import type { RosterPlayer } from "./RosterBrowser";

/**
 * Whether a sports component can render: the deployment's model (PORTAL_MODEL) has the role
 * and Experience Edge is connected. Live, a component without its data renders nothing; in the
 * Page builder it says why.
 */
export function sportsMissing(role: SportsRole, title: string, editing: boolean): React.ReactNode | false {
  if (!env.edgeToken) return editing ? <EditorNotice title={title}>This component reads Experience Edge for Content Hub, which isn&apos;t connected (EDGE_TOKEN).</EditorNotice> : null;
  if (!modelFor(role)) return editing ? <EditorNotice title={title}>This portal&apos;s industry model has no {role} (PORTAL_MODEL — set by the Demo Builder&apos;s SitecoreAI deploy for a sports demo).</EditorNotice> : null;
  return false;
}

/** The page language (for dates in client islands). */
export function pageLocale(): string {
  try { return requestContext().locale || "en"; } catch { return "en"; }
}

/** What the schedule island needs of a game (serializable, no feed internals). */
export const toScheduleGame = (g: Game): ScheduleGame => ({
  id: g.id, date: g.date, opponent: g.opponent, home: g.home, themeNight: g.themeNight, status: g.status, finalScore: g.finalScore, result: g.result, win: g.win,
  ticket: { status: g.ticket.status, url: g.ticket.url, soldOut: g.ticket.soldOut, completed: g.ticket.completed, sellThrough: g.ticket.sellThrough, sold: g.ticket.sold, capacity: g.ticket.capacity },
});

export const toRosterPlayer = (p: Player): RosterPlayer => ({
  id: p.id, name: p.name, number: p.number, position: p.position, group: p.group, status: p.status, active: p.active, farm: p.farm, stats: p.stats,
  headshot: p.headshot ? { preview: p.headshot.preview, links: p.headshot.links } : null,
});
