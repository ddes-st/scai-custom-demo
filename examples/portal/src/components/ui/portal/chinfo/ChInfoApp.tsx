"use client";
/**
 * The "Content Hub info" Marketplace app (SitecoreAI Page builder context panel). For the page
 * open in the Page builder it reads the layout (shared + final renderings), the rendering names
 * and the Picks of the datasources from the Authoring API (master = what the canvas shows,
 * including unpublished changes), then asks this deployment (/api/ch-info) which Content Hub
 * items those components show: on Edge or not, lifecycle status, localized variants and a link
 * into Content Hub. "Refresh now" drops the portal's Content Hub caches and reloads the canvas.
 */
import { useAuthEpoch } from "components/ui/portal/auth/useAuthEpoch";
import React, { useCallback, useEffect, useState } from "react";
import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import { marketplaceClient } from "src/lib/portal/marketplace-client";
import { toolsFetch, setToolsSite, siteNameOf } from "src/lib/portal/tools-fetch";
import { HUB, resolveHeadFromHost } from "src/lib/portal/hub";
import { errorText } from "src/lib/portal/error-text";

interface Item { id: string; title: string; href: string; onEdge: boolean; status: string; chUrl: string; variants: Record<string, boolean> | null }
interface Group { component: string; label: string; definition: string; total: number | null; items: Item[]; note: string }
interface Info { language: string; culture: string; cultures: string[]; chHost: string; groups: Group[] }
interface PageRef { id: string; path: string; language: string }
interface Component { name: string; params: Record<string, string>; picks?: string }

const unwrap = (res: any) => (res && typeof res === "object" && "data" in res ? res.data : res);
const GOOD = /^(approved|final|published|active)$/i;
/** A sample for `npm run dev` outside SitecoreAI, so the panel can be looked at locally. */
const DEV_SAMPLE: Component[] = [{ name: "BrandGrid", params: {} }, { name: "ProductCatalog", params: {} }, { name: "PressList", params: {} }];

/** Renderings of a layout field: uid → { id, par, ds } (final-layout deltas override by uid). */
function parseLayout(xml: string, into: Map<string, { id: string; par: string; ds: string }>) {
  if (!xml.trim()) return;
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  for (const r of Array.from(doc.getElementsByTagName("r"))) {
    const uid = r.getAttribute("uid");
    if (!uid) continue;
    const prev = into.get(uid) ?? { id: "", par: "", ds: "" };
    into.set(uid, { id: r.getAttribute("s:id") ?? prev.id, par: r.getAttribute("s:par") ?? prev.par, ds: r.getAttribute("s:ds") ?? prev.ds });
  }
}
const paramsOf = (par: string) => { const out: Record<string, string> = {}; new URLSearchParams(par).forEach((v, k) => { out[k] = v; }); return out; };
const isGuid = (v: string) => /^\{?[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}\}?$/i.test(v);

export function ChInfoApp() {
  const [client, setClient] = useState<ClientSDK | null>(null);
  const [connection, setConnection] = useState<"pending" | "host" | "standalone">("pending");
  const [contextId, setContextId] = useState("");
  const [page, setPage] = useState<PageRef | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshNote, setRefreshNote] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [definitions, setDefinitions] = useState<string[]>([]);

  // 1. host connection and the open page
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (window.parent === window) { setConnection("standalone"); return; }
      try {
        const c = await marketplaceClient();
        if (c && HUB) void resolveHeadFromHost(c);
        if (cancelled) return;
        if (!c) { setConnection("standalone"); return; }
        setClient(c); setConnection("host");
        const ctx: any = unwrap(await c.query("application.context"));
        const access = ctx?.resourceAccess?.[0] ?? ctx?.resources?.[0];
        setContextId(String(access?.context?.preview || access?.context?.live || ""));
        c.query("pages.context", {
          subscribe: true,
          onSuccess: (p: any) => {
            if (cancelled) return;
            const id = String(p?.pageInfo?.id ?? ""), path = String(p?.pageInfo?.path ?? "");
            const language = String(p?.pageInfo?.language ?? p?.language ?? p?.siteInfo?.language ?? "en");
            // the page's site: one deployment can serve several (joint microsites)
            setToolsSite(siteNameOf(path));
            setPage((old) => (old && old.id === id && old.path === path && old.language === language ? old : { id, path, language }));
          },
        } as any).catch(() => {});
      } catch { if (!cancelled) setConnection("standalone"); }
    })();
    return () => { cancelled = true; };
  }, []);

  const gql = useCallback(async (query: string, variables: Record<string, unknown> = {}) => {
    if (!client || !contextId) throw new Error("The app has no SitecoreAI API access — enable 'SitecoreAI APIs' in its configuration.");
    const body = unwrap(await client.mutate("xmc.authoring.graphql" as any, { params: { query: { sitecoreContextId: contextId }, body: { query, variables } } } as any));
    if (body?.errors?.length) throw new Error(body.errors.map((e: any) => e.message).join("; "));
    return body?.data;
  }, [client, contextId]);

  const ask = useCallback(async (language: string, pageRef: { detailKind?: string; definition?: string }, components: Component[]) => {
    const r = await toolsFetch("/api/ch-info", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language, page: pageRef, components }), cache: "no-store" });
    const b = await r.json();
    if (!r.ok) throw new Error(errorText(b, `HTTP ${r.status}`));
    setInfo(b);
    setDefinitions([...new Set((b.groups as Group[]).map((g) => g.definition).filter(Boolean))]);
  }, []);

  // 2. the page's components → Content Hub items
  const load = useCallback(async () => {
    if (connection === "standalone") {
      if (process.env.NODE_ENV !== "development") return;
      setLoading(true); setError("");
      try { await ask("en", {}, DEV_SAMPLE); } catch (e: any) { setError(e?.message ?? String(e)); } finally { setLoading(false); }
      return;
    }
    if (!page?.id || !client || !contextId) return;
    setLoading(true); setError("");
    try {
      const d = await gql(`query($id:ID!,$l:String!){ item(where:{itemId:$id, language:$l}){ path fields(ownFields:false, excludeStandardFields:false, first:500){ nodes { name value } } } }`, { id: page.id, l: page.language });
      if (!d?.item) throw new Error(`The page ${page.path || page.id} was not found in ${page.language}.`);
      // no version in this language: the Authoring API answers fields: null
      if (!d.item.fields) throw new Error(`The page has no ${page.language} version yet — add one in the Page builder (or run Portal setup with ${page.language}).`);
      const fields = new Map<string, string>(d.item.fields.nodes.map((f: any) => [f.name, f.value ?? ""]));
      const layout = new Map<string, { id: string; par: string; ds: string }>();
      parseLayout(fields.get("__Renderings") ?? "", layout);
      parseLayout(fields.get("__Final Renderings") ?? "", layout);
      const entries = [...layout.values()].filter((e) => e.id);
      // rendering names and datasource fields in one aliased query
      const renderingIds = [...new Set(entries.map((e) => e.id))];
      const dsRefs = [...new Set(entries.map((e) => e.ds).filter(Boolean))];
      const dsWhere = (ds: string) => (isGuid(ds) ? `itemId:"${ds}"` : ds.startsWith("local:") ? `path:${JSON.stringify(`${d.item.path}${ds.slice(6)}`)}` : `path:${JSON.stringify(ds)}`);
      const q = [
        ...renderingIds.map((id, i) => `r${i}: item(where:{itemId:"${id}"}){ name }`),
        ...dsRefs.map((ds, i) => `d${i}: item(where:{${dsWhere(ds)}, language:${JSON.stringify(page.language)}}){ fields(ownFields:true, excludeStandardFields:true, first:100){ nodes { name value } } }`),
      ];
      const names = q.length ? await gql(`{ ${q.join(" ")} }`) : {};
      const nameOf = new Map(renderingIds.map((id, i) => [id, String(names?.[`r${i}`]?.name ?? "")]));
      const picksOf = new Map(dsRefs.map((ds, i) => [ds, String((names?.[`d${i}`]?.fields?.nodes ?? []).find((f: any) => f.name === "Picks")?.value ?? "")]));
      const components: Component[] = entries.map((e) => ({ name: nameOf.get(e.id) ?? "", params: paramsOf(e.par), ...(e.ds && picksOf.get(e.ds) ? { picks: picksOf.get(e.ds) } : {}) })).filter((c) => c.name);
      await ask(page.language, { detailKind: fields.get("DetailKind") ?? "", definition: fields.get("Definition") ?? "" }, components);
    } catch (e: any) { setError(e?.message ?? String(e)); } finally { setLoading(false); }
  }, [connection, page, client, contextId, gql, ask]);

  // (again after a sign-in in the panel: what it asked for before was refused)
  const signIns = useAuthEpoch();
  useEffect(() => { load(); }, [load, signIns]);

  const refresh = async () => {
    setRefreshing(true); setRefreshNote("");
    try {
      const r = await toolsFetch("/api/ch-info/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ definitions }) });
      const b = await r.json();
      if (!r.ok) throw new Error(errorText(b, `HTTP ${r.status}`));
      const remote = (b.remote ?? []).map((x: any) => (x.ok ? `${x.host} ✓` : `${x.host}: ${x.error}`));
      setRefreshNote(`Content Hub caches dropped on ${[b.here, ...remote].join(", ")}.`);
      if (client) await client.mutate("pages.reloadCanvas" as any).catch(() => {});
      await load();
    } catch (e: any) { setRefreshNote(`Refresh failed: ${e?.message ?? e}`); } finally { setRefreshing(false); }
  };

  return (
    <div className="ci">
      <header className="ci-head">
        <h1>Content Hub info</h1>
        <p>What this page shows from Content Hub — live from Experience Edge, with approval and language status.</p>
        <div className="ci-actions">
          <button type="button" onClick={load} disabled={loading || connection === "pending"}>{loading ? "Reading…" : "Reload"}</button>
          <button type="button" className="primary" onClick={refresh} disabled={refreshing || connection === "pending"} title="Drops the portal's Content Hub caches here and on the other deployment, then reloads the canvas">{refreshing ? "Refreshing…" : "Refresh now"}</button>
        </div>
        {refreshNote && <p className={/failed/i.test(refreshNote) ? "ci-warn" : "ci-ok"}>{refreshNote}</p>}
      </header>

      {connection === "standalone" && process.env.NODE_ENV !== "development" && (
        <p className="ci-muted">Open this panel in the SitecoreAI Page builder: register <code>/ch-info</code> as a <em>Page context panel</em> extension point of the portal’s Marketplace app (API access <em>SitecoreAI APIs</em>).</p>
      )}
      {connection === "standalone" && process.env.NODE_ENV === "development" && <p className="ci-muted">Local preview with sample components (BrandGrid, ProductCatalog, PressList).</p>}
      {page && <p className="ci-muted ci-page">{page.path.replace(/^\/sitecore\/content\//, "")} · {page.language}{info?.chHost ? ` · ${info.chHost}` : ""}</p>}
      {error && <p className="ci-warn">{error}</p>}
      {info && !info.groups.length && !loading && <p className="ci-muted">No Content Hub components on this page.</p>}

      {info?.groups.map((g, gi) => (
        <section className="ci-group" key={`${g.component}-${gi}`}>
          <div className="ci-group-head">
            <h2>{g.component}</h2>
            <span className="ci-count">{g.label}{g.total != null ? ` · ${g.total}` : ""}</span>
          </div>
          {g.note && <p className="ci-note">{g.note}</p>}
          {!!g.items.length && (
            <ul className="ci-items">
              {g.items.map((i) => (
                <li key={i.id} className={i.onEdge ? "" : "off"}>
                  <span className="ci-title" title={i.id}>{i.title}</span>
                  <span className="ci-badges">
                    {!i.onEdge ? <span className="ci-badge bad">not on Edge</span> : i.status ? <span className={`ci-badge ${GOOD.test(i.status) ? "good" : "meh"}`}>{i.status}</span> : null}
                    {i.variants && Object.entries(i.variants).map(([c, has]) => <span key={c} className={`ci-badge ${has ? "good" : "none"}`} title={has ? `Has a ${c} variant` : `No ${c} variant: the ${c} page shows the master's values`}>{c} {has ? "✓" : "–"}</span>)}
                    {i.chUrl && <a className="ci-link" href={i.chUrl} target="_blank" rel="noreferrer">Content Hub ↗</a>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {g.total != null && g.total > g.items.length && <p className="ci-muted">… and {g.total - g.items.length} more.</p>}
        </section>
      ))}
    </div>
  );
}
