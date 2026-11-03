"use client";
/**
 * The Page builder context panel of the portal's Marketplace app: a Marketplace app has one
 * route per extension point, so the panel route (/theme-editor) hosts both panel apps as tabs —
 * Theme (live theme editing) and Content Hub (the page's Content Hub items). A tab stays mounted
 * once opened, so switching keeps unsaved theme edits; the last tab is remembered per browser.
 */
import { SitecoreAuthBar } from "components/ui/portal/auth/SitecoreAuthBar";
import React, { useEffect, useState } from "react";
import { ThemeEditorApp } from "./theme/ThemeEditorApp";
import { ChInfoApp } from "./chinfo/ChInfoApp";

const TABS = [{ id: "theme", label: "Theme" }, { id: "content-hub", label: "Content Hub" }] as const;
type TabId = (typeof TABS)[number]["id"];
const KEY = "portal-panel-tab";

export function PagePanel() {
  const [tab, setTab] = useState<TabId>("theme");
  const [opened, setOpened] = useState<Set<TabId>>(() => new Set<TabId>(["theme"]));

  useEffect(() => {
    let saved: string | null = null;
    try { saved = window.localStorage.getItem(KEY); } catch { saved = null; }
    if (saved === "content-hub") { setTab("content-hub"); setOpened((o) => new Set(o).add("content-hub")); }
  }, []);

  const open = (id: TabId) => {
    setTab(id);
    setOpened((o) => new Set(o).add(id));
    try { window.localStorage.setItem(KEY, id); } catch { /* per-browser convenience only */ }
  };

  return (
    <div className="pp">
      <SitecoreAuthBar />
      <div className="pp-tabs" role="tablist" aria-label="Portal panel">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" id={`pp-tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`pp-panel-${t.id}`} className={tab === t.id ? "on" : ""} onClick={() => open(t.id)}>{t.label}</button>
        ))}
      </div>
      {TABS.map((t) => opened.has(t.id) && (
        <div key={t.id} role="tabpanel" id={`pp-panel-${t.id}`} aria-labelledby={`pp-tab-${t.id}`} hidden={tab !== t.id}>
          {t.id === "theme" ? <ThemeEditorApp /> : <ChInfoApp />}
        </div>
      ))}
    </div>
  );
}
