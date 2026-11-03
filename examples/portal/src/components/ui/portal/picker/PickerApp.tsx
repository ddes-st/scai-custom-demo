"use client";
/**
 * The "Content Hub items" Marketplace app (SitecoreAI Page builder custom field). Opened in a
 * modal from a `Picks` field (type Marketplace Types/Plugin, source = the app id): reads the
 * field's current JSON through the Marketplace SDK, lets the author choose a Content Hub
 * definition (products, brands, images, any custom type Edge publishes), search its published
 * entities — narrowed by the definition's relations and taxonomies (brand, product family,
 * content type, asset type…; /api/picker/facets) — order the selection, and writes it back. Opened outside the Page builder (no host
 * window) it still works as a JSON builder whose output can be pasted into the field.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import { MAX_PICKS, parsePicks, serializePicks, type Pick } from "src/lib/portal/picks";
import { currentToolsKey, setToolsKey, setToolsSite, siteNameOf, toolsFetch } from "src/lib/portal/tools-fetch";
import { getHead, headAsset, HUB, resolveHeadFromHost, setHead } from "src/lib/portal/hub";
import { acceptHandedOverTokens, bearer, startSitecoreAuth } from "src/lib/portal/sitecore-auth";
import { useAuthEpoch } from "components/ui/portal/auth/useAuthEpoch";
import { initFromOpener, isPickerPopup, openPickerPopup, saveToOpener, tokenFromOpener } from "src/lib/portal/picker-popup";
import { SitecoreAuthBar } from "components/ui/portal/auth/SitecoreAuthBar";
import { errorText } from "src/lib/portal/error-text";

interface Definition { definition: string; label: string; labelPlural: string; detailPath: string; source: string }
interface Hit { id: string; name: string; sub: string; image: string; large?: string }
interface FacetValue { id: string; label: string; count: number }
interface Facet { key: string; label: string; source: string; values: FacetValue[] }
type Status = "idle" | "saving" | "saved" | "error";
type View = "list" | "grid";
type Sort = "name" | "name-desc" | "updated" | "updated-asc";
const SORT_LABELS: Array<[Sort, string]> = [["name", "Name A–Z"], ["name-desc", "Name Z–A"], ["updated", "Recently updated"], ["updated-asc", "Least recently updated"]];

const DEFAULT_DEFINITION = "M_PCM_Product";
// the author's list / grid choice for images and for other items, kept for the browser session
const VIEW_STORE = "portal-picker-view";

const RETRY_MS = [1500, 4000, 9000];
/**
 * A tile's image. Many tiles at once can find Content Hub busy (the portal's /api/asset answers
 * 503 then): a failed image is asked for again after a pause, with its own cache-busting
 * parameter (`r` is the rendition), and shows the initial after the last attempt.
 */
function Thumb({ src, fallback }: { src: string; fallback: string }) {
  const [state, setState] = useState({ src, attempt: 0, failed: false });
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  // a new src starts over (state derived from props, no effect)
  const cur = state.src === src ? state : { src, attempt: 0, failed: false };
  if (cur.failed) return <span className="glyph">{fallback}</span>;
  const url = cur.attempt ? `${src}${src.includes("?") ? "&" : "?"}rt=${cur.attempt}` : src;
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => {
        if (cur.attempt >= RETRY_MS.length) { setState({ ...cur, failed: true }); return; }
        timer.current = window.setTimeout(() => setState({ ...cur, attempt: cur.attempt + 1 }), RETRY_MS[cur.attempt]);
      }}
    />
  );
}

export function PickerApp() {
  const [client, setClient] = useState<ClientSDK | null>(null);
  const [standalone, setStandalone] = useState(false);
  // the larger window (picker-popup.ts): "popup" in that window; in the modal, the open window
  const [popup, setPopup] = useState(false);
  const [large, setLarge] = useState<{ focus: () => void; close: () => void } | null>(null);
  const [booted, setBooted] = useState(false);
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [definition, setDefinition] = useState(DEFAULT_DEFINITION);
  const [selected, setSelected] = useState<Pick[]>([]);
  // max 1 = a "Content Hub image" field (banner, page hero): images only, one pick
  const [max, setMax] = useState<number | undefined>(undefined);
  const single = max === 1;
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [note, setNote] = useState("");
  const [moreTypes, setMoreTypes] = useState(false);
  const [typesLoading, setTypesLoading] = useState(true);
  const searchSeq = useRef(0);
  // the Content Hub tenant this portal reads, and the item shown large
  const [chHost, setChHost] = useState("");
  const [preview, setPreview] = useState<Hit | null>(null);
  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPreview(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);
  // filters: Edge relations first (fast), Content Hub taxonomies after (REST, slower first time)
  const [facets, setFacets] = useState<Facet[]>([]);
  const [facetsLoading, setFacetsLoading] = useState(false);
  const [restLoaded, setRestLoaded] = useState(false);
  const [filter, setFilter] = useState<Record<string, string>>({});
  const [counts, setCounts] = useState<Record<string, Record<string, number>>>({});
  // a sign-in inside the app loads the types, filters and results again
  const signIns = useAuthEpoch();
  // list or grid: images (and a one-image field) open as a grid, other items as a list
  const [viewChoice, setViewChoice] = useState<Partial<Record<"images" | "items", View>>>({});
  useEffect(() => {
    try { const v = JSON.parse(sessionStorage.getItem(VIEW_STORE) || "{}"); if (v && typeof v === "object") setViewChoice(v); } catch { /* storage blocked in the frame */ }
  }, []);
  const viewKind = single || definition === "M_Asset" ? "images" : "items";
  const view: View = viewChoice[viewKind] ?? (viewKind === "images" ? "grid" : "list");
  const setView = (v: View) => setViewChoice((cur) => {
    const next = { ...cur, [viewKind]: v };
    try { sessionStorage.setItem(VIEW_STORE, JSON.stringify(next)); } catch { /* storage blocked */ }
    return next;
  });

  // 1. Connect to the Page builder (the host), read the field's current value, load the definitions.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined") return;
      // The type list can take a few seconds on a cold server (one schema lookup per type): it
      // loads in the background while the host connection and the first search proceed.
      const loadDefinitions = () => toolsFetch("/api/picker/definitions", { cache: "no-store" }).then((r) => r.json()).then((b) => { if (!cancelled && b?.chHost) setChHost(String(b.chHost)); return (b.definitions ?? []) as Definition[]; }).catch(() => [] as Definition[])
        .then((list) => { if (!cancelled) { setDefinitions(list); setTypesLoading(false); } });
      if (isPickerPopup()) {
        // the larger window: the field's draft, portal, key and sign-in come from the modal
        setPopup(true);
        const init = await initFromOpener();
        if (cancelled) return;
        if (!init) { setStandalone(true); setNote("The field's dialog in the Page builder is closed — open the field again; picks made here can only be copied as JSON."); }
        else {
          if (init.key) setToolsKey(init.key);
          acceptHandedOverTokens(init.token, tokenFromOpener);
          if (HUB && init.head) setHead(init.head);
          const current = parsePicks(init.value);
          if (current) { setDefinition(current.max === 1 ? "M_Asset" : current.definition); setSelected(current.items); setMax(current.max); }
        }
        void loadDefinitions();
        setBooted(true);
        return;
      }
      void loadDefinitions();
      if (window.parent === window) { setStandalone(true); void startSitecoreAuth(null); }
      else {
        try {
          const { ClientSDK } = await import("@sitecore-marketplace-sdk/client");
          // hub mode needs the SitecoreAI module (the site's portal is read from its Portal Settings)
          const modules = HUB ? [(await import("@sitecore-marketplace-sdk/xmc")).XMC] : [];
          const c = await ClientSDK.init({ target: window.parent, timeout: 8000, ...(modules.length ? { modules } : {}) } as any);
          if (cancelled) return;
          setClient(c);
          void startSitecoreAuth(c);
          // the page's site (one deployment can serve several: joint microsites) for the searches
          const page: any = await Promise.race([c.query("pages.context"), new Promise((r) => setTimeout(() => r(null), 3000))]).catch(() => null);
          setToolsSite(siteNameOf(String((page?.data ?? page)?.pageInfo?.path ?? "")));
          const raw = await c.getValue();
          if (HUB) {
            // the page's site → its portal; else the portal this field's value was picked from ("src")
            let src = "";
            try { src = String(JSON.parse(String(raw ?? "{}"))?.src ?? ""); } catch { src = ""; }
            const head = await resolveHeadFromHost(c, src);
            if (!head && !cancelled) setNote("This site's portal deployment isn't registered yet — run the Portal setup on the site first.");
          }
          const current = parsePicks(raw);
          if (current) { setDefinition(current.max === 1 ? "M_Asset" : current.definition); setSelected(current.items); setMax(current.max); }
        } catch (e: any) {
          if (!cancelled) { setStandalone(true); setNote(`Not inside the Page builder (${e?.message || "no host"}); building JSON to paste instead.`); }
        }
      }
      if (!cancelled) setBooted(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // after a sign-in in the app: the type list again (it was refused before)
  useEffect(() => {
    if (!signIns) return;
    let cancelled = false;
    toolsFetch("/api/picker/definitions", { cache: "no-store" }).then((r) => r.json()).then((b) => {
      if (cancelled) return;
      if (b?.chHost) setChHost(String(b.chHost));
      setDefinitions((b?.definitions ?? []) as Definition[]); setTypesLoading(false);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [signIns]);

  // 2. The definition's filters (reset on every definition change; stale answers dropped).
  useEffect(() => {
    if (!booted) return;
    let cancelled = false;
    setFacets([]); setFilter({}); setCounts({}); setRestLoaded(false); setFacetsLoading(true);
    const load = (source: "edge" | "rest") => toolsFetch(`/api/picker/facets?definition=${encodeURIComponent(definition)}&source=${source}`, { cache: "no-store" }).then((r) => r.json()).then((b) => (b.facets ?? []) as Facet[]).catch(() => [] as Facet[]);
    (async () => {
      const edge = await load("edge");
      if (cancelled) return;
      setFacets(edge);
      const rest = await load("rest");
      if (cancelled) return;
      setFacets((cur) => [...cur, ...rest.filter((f) => !cur.some((c) => c.key === f.key))]);
      setRestLoaded(true); setFacetsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [booted, definition, signIns]);

  // 3. Search Content Hub through the site's own API (debounced; stale responses dropped), 60
  // at a time in the chosen order; "Load more" appends the next 60.
  const [sort, setSort] = useState<Sort>("name");
  const [loadingMore, setLoadingMore] = useState(false);
  const searchUrl = useMemo(() => {
    const f = Object.fromEntries(Object.entries(filter).filter(([, v]) => v).map(([k, v]) => [k, [v]]));
    return `/api/picker/search?definition=${encodeURIComponent(definition)}&q=${encodeURIComponent(query)}${Object.keys(f).length ? `&f=${encodeURIComponent(JSON.stringify(f))}` : ""}${restLoaded ? "&rest=1" : ""}&sort=${sort}`;
  }, [definition, query, filter, restLoaded, sort]);
  useEffect(() => {
    if (!booted) return;
    const seq = ++searchSeq.current;
    setSearching(true); setLoadingMore(false);
    const t = setTimeout(async () => {
      try {
        const r = await toolsFetch(searchUrl, { cache: "no-store" });
        const body = await r.json();
        if (seq !== searchSeq.current) return;
        if (!r.ok) { setSearchError(errorText(body, `Search failed (${r.status})`)); setHits([]); setTotal(0); }
        else { setSearchError(""); setHits(body.items ?? []); setTotal(body.total ?? 0); setCounts(body.counts ?? {}); }
      } catch (e: any) {
        if (seq === searchSeq.current) { setSearchError(e?.message || "Search failed"); setHits([]); }
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, query ? 250 : 0);
    return () => clearTimeout(t);
  }, [booted, searchUrl, query, signIns]);
  const loadMore = async () => {
    const seq = searchSeq.current;
    setLoadingMore(true);
    try {
      const r = await toolsFetch(`${searchUrl}&offset=${hits.length}`, { cache: "no-store" });
      const body = await r.json();
      if (seq !== searchSeq.current) return;
      if (!r.ok) { setSearchError(errorText(body, `Search failed (${r.status})`)); return; }
      setHits((cur) => [...cur, ...((body.items ?? []) as Hit[]).filter((x) => !cur.some((c) => c.id === x.id))]);
      setTotal(body.total ?? total);
    } catch (e: any) {
      if (seq === searchSeq.current) setSearchError(e?.message || "Search failed");
    } finally {
      if (seq === searchSeq.current) setLoadingMore(false);
    }
  };
  const activeFilters = Object.values(filter).filter(Boolean).length;
  // many filters take the results' room in the modal: the first three (and any set) show, the rest on request
  const [allFilters, setAllFilters] = useState(false);
  const FEW = 3;
  const shownFacets = allFilters || facets.length <= FEW + 1 ? facets : facets.filter((f, i) => i < FEW || filter[f.key]);
  const hiddenFacets = facets.length - shownFacets.length;

  const current = useMemo<Definition>(() => definitions.find((d) => d.definition === definition) ?? { definition, label: "item", labelPlural: "items", detailPath: "", source: "auto" }, [definitions, definition]);
  const primary = useMemo(() => definitions.filter((d) => d.source !== "auto"), [definitions]);
  const others = useMemo(() => definitions.filter((d) => d.source === "auto"), [definitions]);
  const selectedIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected]);
  // hub mode: the value also remembers the site's portal ("src"), the picker's fallback when the
  // Page builder gives no page context
  const json = useMemo(() => {
    const base = serializePicks({ definition, items: selected, ...(max ? { max } : {}) });
    if (!HUB || !getHead()) return base;
    try { return JSON.stringify({ ...JSON.parse(base), src: getHead() }); } catch { return base; }
  }, [definition, selected, max]);

  const toggle = useCallback((h: Hit) => {
    setSelected((cur) => {
      if (cur.some((s) => s.id === h.id)) return cur.filter((s) => s.id !== h.id);
      if (single) return [{ id: h.id, name: h.name }];
      if (cur.length >= (max ?? MAX_PICKS)) { setNote(`At most ${max ?? MAX_PICKS} picks.`); return cur; }
      return [...cur, { id: h.id, name: h.name }];
    });
    setStatus("idle");
  }, [single, max]);
  const move = (i: number, d: -1 | 1) => setSelected((cur) => {
    const j = i + d;
    if (j < 0 || j >= cur.length) return cur;
    const next = cur.slice();
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  // Switching type clears the selection: asked inside the picker, since the Page builder's app
  // modal is a sandboxed frame where the browser's confirm() is blocked (it answers "no" at once).
  const [pendingSwitch, setPendingSwitch] = useState<Definition | null>(null);
  const applySwitch = (d: Definition) => {
    setPendingSwitch(null);
    setDefinition(d.definition); setSelected([]); setQuery(""); setHits([]); setTotal(0); setFilter({}); setStatus("idle");
  };
  const switchDefinition = (d: Definition) => {
    if (d.definition === definition) { setPendingSwitch(null); return; }
    if (selected.length) { setPendingSwitch(d); return; }
    applySwitch(d);
  };
  const save = async () => {
    if (popup) {
      setStatus("saving");
      const r = await saveToOpener(json);
      if (r.ok) { setStatus("saved"); window.close(); }
      else { setStatus("error"); setNote(r.error || "Could not save the picks."); }
      return;
    }
    if (!client) return;
    setStatus("saving");
    try {
      await client.setValue(json, true);
      setStatus("saved");
      await client.closeApp();
    } catch (e: any) {
      setStatus("error");
      setNote(e?.message || "Could not save the picks.");
    }
  };
  // "Open larger": the same picker in a window of ~90% of the screen; the modal keeps writing the field
  const jsonRef = useRef(json);
  useEffect(() => { jsonRef.current = json; }, [json]);
  const openLarge = () => {
    const h = openPickerPopup({
      init: async () => ({ value: jsonRef.current, head: HUB ? getHead() : "", key: currentToolsKey(), token: (await bearer()) ?? "" }),
      token: async () => (await bearer()) ?? "",
      save: async (j) => { if (!client) throw new Error("The field's dialog lost its Page builder connection."); await client.setValue(j, true); },
      afterSave: () => { setLarge(null); void client?.closeApp(); },
      closed: () => setLarge(null),
    });
    if (!h) setNote("The browser blocked the larger window — the app needs the “Open pop-ups” permission in App Studio.");
    setLarge(h);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(json); setNote("JSON copied — paste it into the Picks field."); } catch { setNote("Copy failed; select the JSON below and copy it."); }
  };

  return (
    <div className="picker">
      <SitecoreAuthBar />
      <header className="picker-head">
        <div>
          <h1>{single ? "Content Hub image" : "Content Hub items"}</h1>
          <p>{single ? "Choose one image from this portal’s Content Hub. It is served from its best-fitting public link; only its id is stored on the page." : "Choose what this component shows, in order. Content stays in Content Hub; only the ids are stored on the page."}</p>
        </div>
        {client && !popup && (
          <button type="button" className="picker-large" onClick={openLarge} title="Open this picker in a larger window">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M9.5 2.5h4v4M13.5 2.5 8.5 7.5M6.5 13.5h-4v-4M2.5 13.5l5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Open larger
          </button>
        )}
        {chHost && (
          <a className="picker-source" href={chHost} target="_blank" rel="noreferrer" title="The Content Hub this portal reads">
            <span>Content Hub</span>
            <strong>{chHost.replace(/^https?:\/\//, "")}</strong>
          </a>
        )}
      </header>

      {single ? (
        <div className="picker-types"><span className="picker-meta">Images and files · one image</span></div>
      ) : (
      <div className="picker-types" role="tablist" aria-label="Type">
        {primary.map((d) => (
          <button key={d.definition} type="button" role="tab" aria-selected={d.definition === definition} className={d.definition === definition ? "active" : ""} onClick={() => switchDefinition(d)}>{d.labelPlural}</button>
        ))}
        {others.length > 0 && (
          <select
            aria-label="Other types"
            className={others.some((d) => d.definition === definition) ? "active" : ""}
            value={others.some((d) => d.definition === definition) ? definition : ""}
            onChange={(e) => { const d = others.find((x) => x.definition === e.target.value); if (d) switchDefinition(d); }}
            onFocus={() => setMoreTypes(true)}
          >
            <option value="">{moreTypes ? "Other types…" : `Other types (${others.length})…`}</option>
            {others.map((d) => <option key={d.definition} value={d.definition}>{d.labelPlural}</option>)}
          </select>
        )}
        {typesLoading && <span className="picker-meta">Loading types…</span>}
        {!typesLoading && !definitions.length && <span className="picker-meta">No definitions published to Experience Edge.</span>}
      </div>
      )}

      {pendingSwitch && (
        <div className="picker-confirm" role="alertdialog" aria-label="Switch type">
          <span>Switching to {pendingSwitch.labelPlural.toLowerCase()} clears the {selected.length} selected {current.labelPlural.toLowerCase()}.</span>
          <button type="button" className="primary" onClick={() => applySwitch(pendingSwitch)}>Switch and clear</button>
          <button type="button" onClick={() => setPendingSwitch(null)}>Keep {current.labelPlural.toLowerCase()}</button>
        </div>
      )}

      <div className="picker-body">
        <section className="picker-results" aria-label="Search results">
          <input
            type="search"
            className="picker-search"
            placeholder={`Search ${current.labelPlural.toLowerCase()}…`}
            aria-label={`Search ${current.labelPlural.toLowerCase()}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {(facets.length > 0 || facetsLoading) && (
            <div className="picker-filters" role="group" aria-label="Filters">
              {shownFacets.map((f) => {
                const c = counts[f.key];
                return (
                  <label key={f.key} className={filter[f.key] ? "picker-filter on" : "picker-filter"}>
                    <span className="sr-only">{f.label}</span>
                    <select value={filter[f.key] ?? ""} onChange={(e) => setFilter((cur) => ({ ...cur, [f.key]: e.target.value }))} aria-label={f.label}>
                      <option value="">{f.label}: all</option>
                      {f.values.map((v) => {
                        const n = c ? c[v.id] ?? 0 : v.count;
                        return <option key={v.id} value={v.id} disabled={n === 0 && filter[f.key] !== v.id}>{v.label} ({n})</option>;
                      })}
                    </select>
                  </label>
                );
              })}
              {hiddenFacets > 0 && <button type="button" className="picker-clear" onClick={() => setAllFilters(true)} aria-expanded={false}>+{hiddenFacets} filters</button>}
              {allFilters && facets.length > FEW + 1 && <button type="button" className="picker-clear" onClick={() => setAllFilters(false)} aria-expanded={true}>Fewer filters</button>}
              {facetsLoading && <span className="picker-meta">{facets.length ? "More filters…" : "Loading filters…"}</span>}
              {activeFilters > 0 && <button type="button" className="picker-clear" onClick={() => setFilter({})}>Clear filters</button>}
            </div>
          )}
          <div className="picker-meta picker-bar">
            <span>{searchError ? <span className="err">{searchError}</span> : searching ? "Searching…" : `${total} ${total === 1 ? "match" : "matches"}${total > hits.length ? `, showing ${hits.length}` : ""}`}</span>
            <span className="picker-tools">
            <label className="picker-sort">
              <span className="sr-only">Sort</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
                {SORT_LABELS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </label>
            <span className="picker-view" role="group" aria-label="View">
              <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")} title="List">
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2 3.5h12M2 8h12M2 12.5h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                <span className="sr-only">List</span>
              </button>
              <button type="button" aria-pressed={view === "grid"} onClick={() => setView("grid")} title="Grid">
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="2" y="2" width="5" height="5" rx="1" fill="currentColor" /><rect x="9" y="2" width="5" height="5" rx="1" fill="currentColor" /><rect x="2" y="9" width="5" height="5" rx="1" fill="currentColor" /><rect x="9" y="9" width="5" height="5" rx="1" fill="currentColor" /></svg>
                <span className="sr-only">Grid</span>
              </button>
            </span>
            </span>
          </div>
          <ul className={view === "grid" ? "picker-list grid" : "picker-list"}>
            {hits.map((h) => {
              const on = selectedIds.has(h.id);
              return (
                <li key={h.id} className={on ? "on" : undefined}>
                  <button type="button" className={on ? "hit on" : "hit"} onClick={() => toggle(h)} aria-pressed={on} title={view === "grid" ? h.name : undefined}>
                    <span className="thumb">{h.image ? <Thumb src={headAsset(h.image)} fallback={h.name.charAt(0)} /> : <span className="glyph">{h.name.charAt(0)}</span>}</span>
                    <span className="text"><span className="name">{h.name}</span>{h.sub && <span className="sub">{h.sub}</span>}</span>
                    <span className="mark" aria-hidden="true">{on ? "✓" : "+"}</span>
                  </button>
                  {h.image && (
                    <button type="button" className="peek" onClick={() => setPreview(h)} aria-label={`Preview ${h.name}`} title="Preview">
                      <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M12.6 12.6 17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                    </button>
                  )}
                </li>
              );
            })}
            {booted && !searching && !searchError && hits.length < total && (
              <li className="more">
                <button type="button" onClick={loadMore} disabled={loadingMore}>{loadingMore ? "Loading…" : `Load ${Math.min(60, total - hits.length)} more`}</button>
              </li>
            )}
            {!booted && <li className="empty">Loading…</li>}
            {booted && !searching && !searchError && hits.length === 0 && <li className="empty">Nothing matches.</li>}
          </ul>
        </section>

        <section className="picker-selected" aria-label="Selected">
          <h2>{single ? "Selected image" : <>Selected {current.labelPlural.toLowerCase()}</>} <span>{selected.length}</span></h2>
          {selected.length === 0 ? (
            <p className="empty">Nothing selected yet — click items on the left.</p>
          ) : (
            <ol>
              {selected.map((s, i) => (
                <li key={s.id}>
                  <span className="name">{s.name || s.id}</span>
                  <span className="tools">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === selected.length - 1} aria-label="Move down">↓</button>
                    <button type="button" onClick={() => setSelected((cur) => cur.filter((x) => x.id !== s.id))} aria-label="Remove">✕</button>
                  </span>
                </li>
              ))}
            </ol>
          )}
          {standalone && (
            <details className="picker-json" open>
              <summary>JSON for the Picks field</summary>
              <textarea readOnly value={json} rows={6} onFocus={(e) => e.currentTarget.select()} />
            </details>
          )}
        </section>
      </div>

      {large && (
        <div className="picker-away" role="dialog" aria-modal="true" aria-label="Picking in the larger window">
          <div>
            <p>The picker is open in a larger window. Save there — the picks come back to this field.</p>
            <button type="button" className="primary" onClick={() => large.focus()} autoFocus>Show the window</button>
            <button type="button" onClick={() => { large.close(); setLarge(null); }}>Close it and pick here</button>
          </div>
        </div>
      )}

      {preview && (
        <div className="picker-preview" role="dialog" aria-modal="true" aria-label={preview.name} onClick={() => setPreview(null)}>
          <figure onClick={(e) => e.stopPropagation()}>
            <img src={headAsset(preview.large || preview.image)} alt={preview.name} />
            <figcaption>
              <strong>{preview.name}</strong>
              {preview.sub && <span>{preview.sub}</span>}
            </figcaption>
            <div className="picker-preview-actions">
              <button type="button" onClick={() => { toggle(preview); setPreview(null); }}>{selectedIds.has(preview.id) ? "Remove from selection" : "Add to selection"}</button>
              <button type="button" className="primary" onClick={() => setPreview(null)} autoFocus>Close</button>
            </div>
          </figure>
        </div>
      )}

      <footer className="picker-foot">
        <span className="note" aria-live="polite">{note}</span>
        {standalone ? (
          <button type="button" className="primary" onClick={copy}>Copy JSON</button>
        ) : (
          <>
            <button type="button" onClick={() => (popup ? window.close() : client?.closeApp())}>Cancel</button>
            <button type="button" className="primary" onClick={save} disabled={(!client && !popup) || status === "saving"}>
              {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Retry save" : "Save picks"}
            </button>
          </>
        )}
      </footer>
    </div>
  );
}
