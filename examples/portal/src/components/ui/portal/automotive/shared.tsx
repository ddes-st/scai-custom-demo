import "server-only";
import React from "react";
import { env } from "src/lib/ch/env";
import { automotiveModel, type AutomotiveRole } from "src/lib/ch/automotive";
import { EditorNotice } from "src/lib/portal/editor";

/** Live, an automotive component without its data renders nothing; in the Page builder it says why. */
export function automotiveMissing(role: AutomotiveRole, title: string, editing: boolean): React.ReactNode | false {
  if (!env.edgeToken) return editing ? <EditorNotice title={title}>This component reads Experience Edge for Content Hub, which isn&apos;t connected (EDGE_TOKEN).</EditorNotice> : null;
  if (!automotiveModel(role)) return editing ? <EditorNotice title={title}>This portal&apos;s industry model has no {role === "microsites" ? "Microsite" : "Market"} definition (PORTAL_MODEL — set by the Demo Builder&apos;s SitecoreAI deploy for an automotive demo).</EditorNotice> : null;
  return false;
}

/** The server's clock when the page renders (the countdown starts from it, so its first render matches the HTML). */
export const serverNow = () => Date.now();

/** "18 November 2026" in the page language. */
export function longDate(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const tag = !locale || locale === "en" ? "en-GB" : locale;
  try { return d.toLocaleDateString(tag, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }); } catch { return iso.slice(0, 10); }
}
