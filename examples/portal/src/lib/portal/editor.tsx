import React from "react";
import { ui } from "./ui-text";

/**
 * What an author sees in the Page builder when a Content Hub component has nothing to render
 * yet: a detail page opened on its wildcard item (no id in the URL), Content Hub unreachable,
 * or an empty tenant. Never shown on the live site.
 */
export function EditorNotice({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="portal-editor-notice" role="note">
      <strong>{title}</strong>
      {children && <div>{children}</div>}
    </div>
  );
}

/**
 * The live site's state when a section can't show its content: visitors get a short message in
 * the page language — "couldn't be loaded" (Content Hub or Edge failed), or "isn't available"
 * (`missing`: nothing at this URL) — and the technical reason goes to the server log only.
 */
export function LoadError({ message, missing = false }: { message: string; missing?: boolean }) {
  if (message && !missing) console.warn(`portal section: ${message}`);
  return (
    <div className="portal-empty" role={missing ? "status" : "alert"}>
      {missing ? ui("notAvailable") : ui("loadFailed")}
    </div>
  );
}
