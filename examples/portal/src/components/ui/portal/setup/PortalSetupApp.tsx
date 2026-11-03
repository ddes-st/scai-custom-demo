"use client";
/**
 * The Portal setup wizard. Runs inside SitecoreAI as a Marketplace app: connects through the
 * Marketplace SDK (client + XMC module), reads this deployment's health and Content Hub data
 * (/api/portal-setup/discovery), lets the author pick or create the site, then runs the shared
 * setup (src/lib/portal/setup/core.mjs — the same code as tools/sitecoreai-setup.mjs) against the
 * Authoring API with the author's own rights. The app's own id becomes the Source of the Picks
 * field, so the Content Hub picker works without copying ids.
 */
import { useAuthEpoch } from "components/ui/portal/auth/useAuthEpoch";
import { SitecoreAuthBar } from "components/ui/portal/auth/SitecoreAuthBar";
import { startSitecoreAuth } from "src/lib/portal/sitecore-auth";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import { checkSite, fixSite, LANGUAGE_CODE, registerRenderingHost, runPortalSetup } from "src/lib/portal/setup/core.mjs";
import { toolsFetch, setToolsSite } from "src/lib/portal/tools-fetch";
import { getHead, headForSite, HUB, normalizeHead, setHead } from "src/lib/portal/hub";
import { MARKETPLACE_REQUEST_TIMEOUT } from "src/lib/portal/marketplace-timeout";
import { errorText } from "src/lib/portal/error-text";

type Status = "ok" | "warn" | "fail";
interface Check { id: string; label: string; status: Status; detail: string; fix?: string }
interface SiteCheck { id: string; label: string; status: Status; detail: string; fix?: { id: string; label: string }; languages?: string[]; host?: string }
interface Discovery { checks: Check[]; discovery: { cropNames: string[]; partnerKits: Array<{ id: string; name: string; user: string }>; siteKind?: string; joint?: boolean }; brands: Array<{ identifier: string; name: string }>; suggested: { publicHost: string; siteMode: string; editingUrl?: string; languages?: string[]; siteName?: string; jointMicrosites?: Array<{ site: string; host: string }> } }
interface Tenant { contextId: string; name: string }
interface SiteRow { id: string; name: string; collection: string }

const unwrap = (res: any) => (res && typeof res === "object" && "data" in res ? res.data : res);
/**
 * Marketplace results nest: a query resolves to { data: <request result> } and a request result
 * to { data, error } — so a Sites API list sits at res.data.data. Walks down `data` until `want`
 * matches; throws the API's error when there is one instead.
 */
function dig<T>(res: any, want: (v: any) => boolean): T | undefined {
  let v = res;
  for (let i = 0; i < 4 && v != null; i++) {
    if (want(v)) return v as T;
    if (v && typeof v === "object" && v.error && !v.data) {
      const e = v.error;
      throw new Error(typeof e === "string" ? e : e?.detail || e?.title || e?.message || JSON.stringify(e).slice(0, 200));
    }
    if (v && typeof v === "object" && "data" in v) v = v.data; else break;
  }
  return undefined;
}
const asList = (res: any): any[] => dig<any[]>(res, Array.isArray) ?? [];
const NAME = /^[A-Za-z][\w-]{0,49}$/;

export function PortalSetupApp() {
  const [client, setClient] = useState<ClientSDK | null>(null);
  const [standalone, setStandalone] = useState(false);
  // "pending" until we know whether a SitecoreAI host is around (avoids rendering the form server-side)
  const [connection, setConnection] = useState<"pending" | "host" | "standalone">("pending");
  const [origin, setOrigin] = useState("");
  // hub mode: the chosen site's portal deployment (its head); the checks and discovery come from it
  const [headInput, setHeadInput] = useState("");
  const [headTouched, setHeadTouched] = useState(false);
  // a joint campaign microsite's address isn't a deployment: the portals' checks list their
  // microsites (host → the portal's deployment), so an entered alias becomes its portal's head
  const jointHosts = useRef(new Map<string, string>());
  const [headNote, setHeadNote] = useState("");
  const [head, setHeadState] = useState("");
  const [appId, setAppId] = useState("");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [contextId, setContextId] = useState("");
  const [health, setHealth] = useState<Discovery | null>(null);
  const [healthError, setHealthError] = useState("");
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [collections, setCollections] = useState<Array<{ id: string; name: string }>>([]);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([]);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [siteKey, setSiteKey] = useState("");
  const [siteTouched, setSiteTouched] = useState(false);
  const [newCollection, setNewCollection] = useState("");
  const [newSite, setNewSite] = useState("portal");
  const [templateId, setTemplateId] = useState("");
  // pre-filled with the languages this deployment serves (NEXT_PUBLIC_EXTRA_LOCALES, from the health check)
  const [languages, setLanguages] = useState("");
  // brand scope and tracking: an existing site's current values (read below); written back only
  // when changed here, so a routine re-run never resets them
  const [scope, setScope] = useState<string[]>([]);
  const [scopeTouched, setScopeTouched] = useState(false);
  const [trackUsage, setTrackUsage] = useState(true);
  const [trackTouched, setTrackTouched] = useState(false);
  const [publicHost, setPublicHost] = useState("");
  const [registerHost, setRegisterHost] = useState(false);
  // the rendering host item to create or update: the site's current host, else "<site>-editing"
  // (a fixed default would repoint another site's host when two sites share an environment)
  const [hostName, setHostName] = useState("");
  const [hostTouched, setHostTouched] = useState(false);
  // the deployment that runs with the PREVIEW context id — usually not the one this app is served from
  const [editingUrl, setEditingUrl] = useState("");
  const [useHostForSite, setUseHostForSite] = useState(false);
  const [publish, setPublish] = useState(true);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<"" | "done" | "failed">("");
  const [siteChecks, setSiteChecks] = useState<SiteCheck[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");
  const [fixing, setFixing] = useState("");
  const [fixNote, setFixNote] = useState("");
  const logRef = useRef<HTMLPreElement>(null);

  const say = useCallback((line: string) => setLog((l) => [...l, line]), []);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [log]);

  const healthSeq = useRef(0);
  // the site the last checks answered for: when it changes (a joint microsite instead of the
  // portal), its suggestions replace the previous site's instead of filling only empty fields
  const healthSite = useRef("");
  const loadHealth = useCallback(async () => {
    const seq = ++healthSeq.current;
    setHealthError("");
    try {
      const r = await toolsFetch("/api/portal-setup/discovery", { cache: "no-store" });
      const body = await r.json().catch(() => null);
      // an older answer (e.g. the refused one from before a sign-in) never overwrites a newer one
      if (seq !== healthSeq.current) return;
      // a refusal ({ error }, e.g. 401 before the Sitecore sign-in) is a message, not the checks
      if (!r.ok || !Array.isArray(body?.checks)) {
        setHealth(null);
        const error = errorText(body, `HTTP ${r.status}`);
        setHealthError(/unknown portal deployment/i.test(error) ? `${error} A campaign microsite's own address isn't a deployment: on a joint deployment enter the portal's (the microsite's address goes in Public host).` : error);
        return;
      }
      for (const m of Array.isArray(body?.suggested?.jointMicrosites) ? body.suggested.jointMicrosites : []) if (m?.host && HUB && getHead()) jointHosts.current.set(String(m.host).toLowerCase(), getHead());
      setHealth(body);
      const served = String(body?.suggested?.siteName ?? "");
      const switched = !!healthSite.current && served !== healthSite.current;
      healthSite.current = served;
      if (body?.suggested?.publicHost) setPublicHost((h) => (switched ? body.suggested.publicHost : h || body.suggested.publicHost));
      if (Array.isArray(body?.suggested?.languages)) setLanguages((l) => (switched ? body.suggested.languages.join(", ") : l || body.suggested.languages.join(", ")));
      if (body?.suggested?.editingUrl) { setEditingUrl((u) => (switched ? body.suggested.editingUrl : u || body.suggested.editingUrl)); setRegisterHost(true); setUseHostForSite(true); }
      if (body?.checks?.some((c: Check) => c.id === "usage" && c.status !== "ok")) setTrackUsage(false);
    } catch (e: any) { if (seq === healthSeq.current) setHealthError(e?.message ?? String(e)); }
  }, []);
  // after a sign-in in the app: the portal's checks again (they were refused before)
  const signIns = useAuthEpoch();
  useEffect(() => { if (signIns) void loadHealth(); }, [signIns, loadHealth]);

  // 1. connect to SitecoreAI and read this deployment's health
  useEffect(() => {
    let cancelled = false;
    if (!HUB) loadHealth();
    setOrigin(window.location.origin);
    (async () => {
      if (window.parent === window) { setStandalone(true); setConnection("standalone"); void startSitecoreAuth(null); return; }
      try {
        const [{ ClientSDK }, { XMC }] = await Promise.all([import("@sitecore-marketplace-sdk/client"), import("@sitecore-marketplace-sdk/xmc")]);
        // the setup's writes can take SitecoreAI a while (the retry in core.mjs covers one more slow answer)
        const c = await ClientSDK.init({ target: window.parent, modules: [XMC], timeout: MARKETPLACE_REQUEST_TIMEOUT });
        if (cancelled) return;
        setClient(c);
        setConnection("host");
        void startSitecoreAuth(c);
        const ctx: any = unwrap(await c.query("application.context"));
        setAppId(String(ctx?.id ?? ""));
        const list: Tenant[] = (ctx?.resourceAccess ?? ctx?.resources ?? [])
          .map((r: any) => ({ contextId: String(r?.context?.preview || r?.context?.live || ""), name: String(r?.tenantDisplayName || r?.tenantName || r?.tenantId || "environment") }))
          .filter((t: Tenant) => t.contextId);
        setTenants(list);
        if (list.length) setContextId(list[0].contextId);
      } catch { if (!cancelled) { setStandalone(true); setConnection("standalone"); } }
    })();
    return () => { cancelled = true; };
  }, [loadHealth]);

  // 2. the environment's collections, sites and site templates
  const sitesApi = useCallback(async (key: string, params: Record<string, unknown> = {}) => {
    if (!client) throw new Error("Not connected to SitecoreAI.");
    return client.query(key as any, { params: { query: { sitecoreContextId: contextId }, ...params } } as any);
  }, [client, contextId]);
  const [sitesError, setSitesError] = useState("");

  useEffect(() => {
    if (!client || !contextId) return;
    let cancelled = false;
    (async () => {
      try {
        setSitesError("");
        const [colsRes, listRes, tplsRes] = await Promise.all([sitesApi("xmc.sites.listCollections"), sitesApi("xmc.sites.listSites"), sitesApi("xmc.sites.listSiteTemplates").catch(() => null)]);
        if (cancelled) return;
        const cols = asList(colsRes), list = asList(listRes);
        let tpls: any[] = [];
        try { tpls = asList(tplsRes); } catch { tpls = []; }
        const colRows = (Array.isArray(cols) ? cols : []).map((c: any) => ({ id: String(c.id ?? ""), name: String(c.name ?? "") })).filter((c: any) => c.name);
        const byId = new Map(colRows.map((c: any) => [c.id, c.name]));
        let siteRows: SiteRow[] = (Array.isArray(list) ? list : []).map((s: any) => ({ id: String(s.id ?? ""), name: String(s.name ?? ""), collection: String(byId.get(String(s.collectionId ?? "")) ?? "") })).filter((s: SiteRow) => s.name);
        // a site whose collection isn't in the list: read it from the site item's path (/sitecore/content/<collection>/<site>)
        siteRows = await Promise.all(siteRows.map(async (row) => {
          if (row.collection || !row.id) return row;
          try {
            const d: any = unwrap(await client.mutate("xmc.authoring.graphql" as any, { params: { query: { sitecoreContextId: contextId }, body: { query: `query($id:ID!){ item(where:{itemId:$id}){ path } }`, variables: { id: row.id } } } } as any));
            const m = /^\/sitecore\/content\/([^/]+)\/([^/]+)$/i.exec(String(d?.data?.item?.path ?? ""));
            return m ? { ...row, collection: m[1], name: m[2] } : row;
          } catch { return row; }
        }));
        siteRows = siteRows.filter((r) => r.collection);
        const tplRows = (Array.isArray(tpls) ? tpls : []).filter((t: any) => t?.enabled !== false).map((t: any) => ({ id: String(t.id ?? ""), name: String(t.name ?? "") })).filter((t: any) => t.id);
        setCollections(colRows); setSites(siteRows); setTemplates(tplRows);
        setMode(siteRows.length ? "existing" : "new");
        if (siteRows.length) setSiteKey(`${siteRows[0].collection}/${siteRows[0].name}`);
        setNewCollection((v) => v || colRows[0]?.name || "portal-demos");
        const empty = tplRows.find((t: any) => /empty|blank|basic/i.test(t.name)) ?? tplRows[0];
        if (empty) setTemplateId(empty.id);
      } catch (e: any) { if (!cancelled) setSitesError(`Could not list the sites: ${e?.message ?? e}`); }
    })();
    return () => { cancelled = true; };
  }, [client, contextId, sitesApi, say]);

  const gql = useCallback(async (query: string, variables: Record<string, unknown> = {}) => {
    if (!client) throw new Error("Not connected to SitecoreAI.");
    const res: any = await client.mutate("xmc.authoring.graphql" as any, { params: { query: { sitecoreContextId: contextId }, body: { query, variables } } } as any);
    const body = unwrap(res);
    if (body?.errors?.length) throw new Error(body.errors.map((e: any) => e.message).join("; "));
    return body?.data;
  }, [client, contextId]);


  const target = useMemo(() => {
    if (mode === "existing") { const [collection, site] = siteKey.split("/"); return { collection, site }; }
    return { collection: newCollection.trim(), site: newSite.trim() };
  }, [mode, siteKey, newCollection, newSite]);
  // the chosen site: one deployment can serve several (the portal and its joint microsites), so the
  // checks answer for the site being set up
  useEffect(() => {
    const name = (target.site || "").trim();
    if (!name || !/^[\w][\w -]{0,99}$/.test(name)) return;
    const t = window.setTimeout(() => { setToolsSite(name); if (!HUB || getHead()) void loadHealth(); }, 600);
    return () => window.clearTimeout(t);
  }, [target.site, loadHealth]);
  // hub mode, a new site: the deployment of a site already in its collection (a joint microsite is
  // served by its portal's deployment; the portal's checks then name its address)
  useEffect(() => {
    if (!HUB || headTouched || mode !== "new" || !client || !contextId || !target.collection) return;
    let cancelled = false;
    (async () => {
      const d: { item?: { children?: { nodes?: Array<{ name: string }> } } } | null = await gql(`query($p:String!){ item(where:{path:$p, language:"en"}){ children(first:100){ nodes { name } } } }`, { p: `/sitecore/content/${target.collection}` }).catch(() => null);
      for (const s of d?.item?.children?.nodes ?? []) {
        if (cancelled || s.name.toLowerCase() === (target.site || "").toLowerCase()) continue;
        const found = await headForSite(gql, `/sitecore/content/${target.collection}/${s.name}`).catch(() => "");
        if (found) { if (!cancelled) setHeadInput(found); return; }
      }
    })();
    return () => { cancelled = true; };
  }, [headTouched, mode, client, contextId, target.collection, target.site, gql]);
  // hub mode: the chosen site's head from its Portal Settings (PortalHead, else TargetHostName)
  useEffect(() => {
    if (!HUB || headTouched || mode !== "existing" || !client || !contextId || !target.collection || !target.site) return;
    let cancelled = false;
    headForSite(gql, `/sitecore/content/${target.collection}/${target.site}`).then((found) => { if (!cancelled) setHeadInput(found); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [headTouched, mode, client, contextId, target.collection, target.site, gql]);
  // …applied (and the checks reloaded from it) once it is a usable https origin
  useEffect(() => {
    if (!HUB) return;
    const next = normalizeHead(headInput);
    if (!next || next === head) return;
    // a joint microsite's address: its portal's deployment instead
    let host = "";
    try { host = new URL(next).host.toLowerCase(); } catch { host = ""; }
    const portal = jointHosts.current.get(host);
    if (portal && portal !== next) {
      setHeadNote(`${host} is a campaign microsite on ${portal.replace(/^https:\/\//, "")}'s deployment — using that deployment; the microsite's address is its public host.`);
      setHeadInput(portal);
      return;
    }
    const t = window.setTimeout(() => {
      if (!setHead(next)) return;
      // another portal: the suggestions filled from the previous one (public host, languages,
      // editing host) are dropped, so the new portal's discovery fills them
      setHeadState(next); setHealth(null);
      setPublicHost(""); setLanguages(""); setEditingUrl(""); setRegisterHost(false); setUseHostForSite(false); setHostTouched(false);
      loadHealth();
    }, 500);
    return () => window.clearTimeout(t);
  }, [headInput, head, loadHealth]);

  // 2b. the selected site: what is missing or has drifted, each with a fix
  const siteOpts = useCallback(() => ({
    collection: target.collection, site: target.site, appId,
    publicHost: publicHost.trim(),
    // the languages asked for here plus the ones the head serves (NEXT_PUBLIC_EXTRA_LOCALES)
    languages: [...new Set(["en", ...languages.split(/[\s,]+/).filter(Boolean), ...(health?.suggested?.languages ?? [])])],
    partnerKits: health?.discovery?.partnerKits ?? [],
    editingUrl: (health?.suggested?.editingUrl || "").trim(),
  }), [target, appId, publicHost, languages, health]);
  // the newest check wins: typing a site name fires one check per keystroke
  const checkSeq = useRef(0);
  const checkSiteNow = useCallback(async () => {
    const seq = ++checkSeq.current;
    if (!client || !contextId || mode !== "existing" || !target.collection || !target.site || !health) { setSiteChecks(null); return; }
    setChecking(true); setCheckError("");
    try {
      const list = (await checkSite({ gql }, siteOpts())) as SiteCheck[];
      if (seq !== checkSeq.current) return;
      if (list.find((c) => c.id === "setup")?.status !== "fail") {
        const r = await toolsFetch(`/api/portal-setup/published?path=${encodeURIComponent(`/sitecore/content/${target.collection}/${target.site}/Settings/Portal Settings`)}`, { cache: "no-store" }).then((x) => x.json()).catch(() => null);
        if (r?.published != null) list.push({ id: "published", label: "Published", status: r.published ? "ok" : "warn", detail: r.published ? "the site's settings are on Experience Edge (this deployment's context)" : "this deployment's Experience Edge doesn't serve the site yet", fix: r.published ? undefined : { id: "publish", label: "Publish the site" } });
      }
      if (seq !== checkSeq.current) return;
      setSiteChecks(list);
    } catch (e: any) { if (seq === checkSeq.current) { setCheckError(e?.message ?? String(e)); setSiteChecks(null); } } finally { if (seq === checkSeq.current) setChecking(false); }
  }, [client, contextId, mode, target, health, gql, siteOpts]);
  useEffect(() => { checkSiteNow(); }, [checkSiteNow]);

  useEffect(() => {
    if (!client || mode !== "existing" || !target.collection || !target.site) return;
    let cancelled = false;
    gql(`query($p:String!){ item(where:{path:$p, language:"en"}){ fields(ownFields:false, first:500){ nodes { name value } } } }`, { p: `/sitecore/content/${target.collection}/${target.site}/Settings/Portal Settings` })
      .then((d: any) => {
        const f = new Map<string, string>((d?.item?.fields?.nodes ?? []).map((n: any) => [String(n.name), String(n.value ?? "")]));
        if (cancelled || !d?.item) return;
        if (!scopeTouched) setScope((f.get("BrandScope") ?? "").split(/[\s,]+/).filter(Boolean));
        if (!trackTouched) setTrackUsage(f.get("TrackUsage") === "1");
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [client, mode, target.collection, target.site, gql, scopeTouched, trackTouched]);

  useEffect(() => {
    if (hostTouched) return;
    const current = mode === "existing" ? siteChecks?.find((c) => c.id === "rendering-host")?.host ?? "" : "";
    setHostName(current && current !== "Default" ? current : `${target.site || "portal"}-editing`);
  }, [hostTouched, mode, siteChecks, target.site]);

  // This deployment renders one site (NEXT_PUBLIC_DEFAULT_SITE_NAME). Another site belongs to another
  // portal deployment with its own Content Hub tenant and its own Marketplace app: setting it up
  // from here would connect it to this deployment's tenant.
  const servedSite = (health?.suggested?.siteName || "").trim();
  const foreign = !!servedSite && !!target.site && target.site.toLowerCase() !== servedSite.toLowerCase();
  const badLanguages = languages.split(/[\s,]+/).filter((l) => l && !LANGUAGE_CODE.test(l));
  // pre-select the site this deployment serves (existing), or use its name for a new one
  useEffect(() => {
    if (siteTouched || !servedSite) return;
    const row = sites.find((r) => r.name.toLowerCase() === servedSite.toLowerCase());
    if (row) { setSiteKey(`${row.collection}/${row.name}`); setMode("existing"); }
    setNewSite(servedSite);
  }, [siteTouched, servedSite, sites]);

  const blocking = (health?.checks ?? []).filter((c) => c.status === "fail");
  const valid = !!client && !!contextId && (!HUB || (!!head && !!health)) && !foreign && !badLanguages.length && NAME.test(target.collection || "") && NAME.test(target.site || "") && (mode === "existing" || !!templateId) && (!registerHost || /^https:\/\//i.test(editingUrl.trim()));

  // 3. run: create the site when asked, then the setup, then the rendering host
  // a site in the collection: created (Sites API through the SDK) when it doesn't exist yet
  const ensureSite = async (collection: string, site: string, template: string) => {
    const sitePath = `/sitecore/content/${collection}/${site}`;
    const exists = (await gql(`query($p:String!){ item(where:{path:$p, language:"en"}){ itemId } }`, { p: sitePath }))?.item;
    if (exists) { say(`= site ${collection}/${site} exists already`); return; }
    say(`+ creating site ${collection}/${site} …`);
    const col = collections.find((c) => c.name === collection);
    const job: any = dig(await client!.mutate("xmc.sites.createSite" as any, { params: { query: { sitecoreContextId: contextId }, body: { siteName: site, templateId: template, language: "en", ...(col ? { collectionId: col.id } : { collectionName: collection }) } } } as any), (v) => v && typeof v === "object" && "handle" in v);
    const handle = String(job?.handle ?? "");
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      if (handle) {
        const st: any = await sitesApi("xmc.sites.retrieveJob", { path: { jobHandle: handle } }).then((r) => dig(r, (v) => v && typeof v === "object" && ("status" in v || "done" in v))).catch(() => null);
        if (st?.status === "Failed") throw new Error(`Site creation failed (job ${handle}).`);
      }
      const ok = (await gql(`query($p:String!){ item(where:{path:$p, language:"en"}){ itemId } }`, { p: `${sitePath}/Settings/Site Grouping/${site}` }).catch(() => null))?.item;
      if (ok) { say(`  site created`); return; }
      if (i === 59) throw new Error("The site did not appear within 5 minutes — check Channels and run again.");
      if (i % 3 === 2) say(`  … still creating (${(i + 1) * 5}s)`);
    }
  };

  // "Set up all sites": after the portal, the campaign microsites its deployment serves (joint mode)
  const jointList: Array<{ site: string; host: string }> = Array.isArray(health?.suggested?.jointMicrosites) ? health!.suggested!.jointMicrosites! : [];
  const isPortalSite = !!health && health.discovery?.siteKind !== "microsite" && (health.suggested?.siteName || "").toLowerCase() === (target.site || "").toLowerCase();
  const [alsoMicrosites, setAlsoMicrosites] = useState(true);
  const runMicrosites = async (langs: string[]) => {
    let failed = 0;
    for (const m of jointList) {
      say(`\n=== campaign microsite ${target.collection}/${m.site} (${m.host}) ===`);
      try {
        await ensureSite(target.collection, m.site, templateId || templates[0]?.id || "");
        setToolsSite(m.site);
        const r = await toolsFetch("/api/portal-setup/discovery", { cache: "no-store" });
        const body = await r.json().catch(() => null);
        if (!r.ok || !body?.discovery) throw new Error(errorText(body, `its checks didn't answer (HTTP ${r.status})`));
        const sum = await runPortalSetup({
          gql, log: say, discovery: body.discovery,
          options: { collection: target.collection, site: m.site, languages: langs, publish, marketplaceAppId: appId || undefined, headUrl: HUB ? getHead() : origin, publicHost: m.host },
        });
        if (registerHost) {
          await registerRenderingHost({ gql, log: say }, { name: hostName.trim(), url: editingUrl.trim(), collection: sum.collection, site: sum.site, useForSite: true });
          if (publish) await gql(`mutation($i:PublishItemInput!){ publishItem(input:$i){ operationId } }`, { i: { rootItemPath: `${sum.sitePath}/Settings`, languages: sum.languages ?? ["en"], publishSubItems: true, publishRelatedItems: false, publishItemMode: "SMART", targetDatabases: ["experienceedge"] } });
        }
      } catch (e: any) {
        failed++;
        say(`  FAILED for ${m.site}: ${e?.message ?? e} — run the wizard on that site to retry`);
      }
    }
    setToolsSite(target.site);
    return failed;
  };

  const run = async (extraLanguages: string[] = []) => {
    setRunning(true); setResult(""); setLog([]);
    const langs = [...new Set([...languages.split(/[\s,]+/).filter(Boolean), ...extraLanguages])];
    if (extraLanguages.length) setLanguages(langs.join(", "));
    try {
      if (mode === "new") await ensureSite(target.collection, target.site, templateId);
      const summary = await runPortalSetup({
        gql,
        log: say,
        discovery: health?.discovery ?? {},
        options: {
          collection: target.collection, site: target.site,
          languages: langs,
          publish, marketplaceAppId: appId || undefined,
          // the site's portal deployment, kept in its Portal Settings (the hub app finds it there)
          headUrl: HUB ? getHead() : origin,
          publicHost: publicHost.trim() || undefined,
          // only what was changed here (always for a new site): a re-run keeps the authored values
          ...(mode === "new" || trackTouched ? { trackUsage } : {}),
          ...(mode === "new" || scopeTouched ? { brandScope: scope } : {}),
        },
      });
      if (registerHost) {
        say("\n[9] rendering host");
        await registerRenderingHost({ gql, log: say }, { name: hostName.trim(), url: editingUrl.trim(), collection: summary.collection, site: summary.site, useForSite: useHostForSite });
        if (publish) await gql(`mutation($i:PublishItemInput!){ publishItem(input:$i){ operationId } }`, { i: { rootItemPath: `${summary.sitePath}/Settings`, languages: summary.languages ?? ["en"], publishSubItems: true, publishRelatedItems: false, publishItemMode: "SMART", targetDatabases: ["experienceedge"] } });
      }
      // the portal's campaign microsites, one after another (each with its own checks)
      const failedMicrosites = isPortalSite && alsoMicrosites && jointList.length ? await runMicrosites(langs) : 0;
      if (registerHost || failedMicrosites) say(failedMicrosites ? `\nDone — ${failedMicrosites} microsite(s) need another run.` : "\nDone.");
      setResult(failedMicrosites ? "failed" : "done");
      checkSiteNow();
    } catch (e: any) {
      say(`\nFAILED: ${e?.message ?? e}`);
      setResult("failed");
    } finally { setRunning(false); }
  };

  const fix = async (c: SiteCheck) => {
    if (!c.fix) return;
    if (c.fix.id === "run") { await run(c.languages ?? []); return; }
    setFixing(c.id); setFixNote("");
    const lines: string[] = [];
    try {
      await fixSite({ gql, log: (l: string) => lines.push(l.trim()) }, c.fix.id, siteOpts());
      setFixNote(`${c.label}: ${lines.filter(Boolean).join(" · ") || "done"}`);
    } catch (e: any) { setFixNote(`${c.label}: failed — ${e?.message ?? e}`); }
    finally { setFixing(""); checkSiteNow(); }
  };

  const icon = (s: Status) => (s === "ok" ? "✓" : s === "warn" ? "!" : "✕");
  // the deployment's (in hub mode: the chosen site's portal's) checks — after the site is chosen
  const deploymentChecks = (
      <section className="ps-section">
        <div className="ps-row-head"><h2>{HUB ? `The site's portal${head ? ` — ${head.replace(/^https:\/\//, "")}` : ""}` : "This deployment"}</h2><button type="button" onClick={loadHealth} disabled={running || (HUB && !head)}>Check again</button></div>
        {HUB && !head && <p className="ps-muted">Choose the site above — its portal deployment is read from the site, or enter it for a new site.</p>}
        {healthError && <p className="ps-warn">Health check failed: {healthError}</p>}
        {!health && !healthError && (!HUB || head) && <p className="ps-muted">Checking the deployment and Content Hub…</p>}
        {health && (
          <ul className="ps-checks">
            {(health.checks ?? []).map((c) => (
              <li key={c.id} className={`ps-check ${c.status}`}>
                <span className="ps-icon" aria-label={c.status}>{icon(c.status)}</span>
                <span className="ps-label">{c.label}</span>
                <span className="ps-detail">{c.detail}</span>
                {c.status !== "ok" && c.fix && <span className="ps-fix">{c.fix}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
  );

  return (
    <div className="ps">
      <SitecoreAuthBar />
      <header className="ps-head">
        <h1>Portal setup</h1>
        <p>Creates the Content Hub brand portal in a SitecoreAI site — templates, components, pages, settings, partners and languages — with your own SitecoreAI rights. Safe to run again: it adds what is missing and keeps components and layouts up to date; texts, section order and audiences are only set when an item is created, and Page builder changes are never touched.</p>
      </header>


      {connection === "pending" ? (
        <>{deploymentChecks}<section className="ps-section"><p className="ps-muted">Connecting to SitecoreAI…</p></section></>
      ) : standalone ? (
        <>{deploymentChecks}
        <section className="ps-section">
          <h2>Run the setup</h2>
          <p className="ps-muted">Open this page from SitecoreAI to run the setup: register it as a Marketplace app (extension point <em>Full screen</em> or <em>Standalone</em>, route <code>/portal-setup</code>, API access <em>SitecoreAI APIs</em>) and install it into the environment. Without SitecoreAI the page only shows the check above. The command-line alternative is <code>node tools/sitecoreai-setup.mjs</code>.</p>
        </section></>
      ) : (
        <>
          <section className="ps-section">
            <h2>Site</h2>
            {tenants.length > 1 && (
              <label className="ps-field">Environment
                <select value={contextId} onChange={(e) => setContextId(e.target.value)} disabled={running}>{tenants.map((t) => <option key={t.contextId} value={t.contextId}>{t.name}</option>)}</select>
              </label>
            )}
            {tenants.length === 1 && <p className="ps-muted">Environment: {tenants[0].name}</p>}
            {!client && <p className="ps-muted">Connecting to SitecoreAI…</p>}
            {sitesError && <p className="ps-warn">{sitesError}</p>}
            {client && !contextId && <p className="ps-warn">The app has no SitecoreAI API access. Enable <em>SitecoreAI APIs</em> in its configuration and update the installation.</p>}
            <div className="ps-radio">
              <label><input type="radio" checked={mode === "existing"} onChange={() => setMode("existing")} disabled={running || !sites.length} /> Use an existing site</label>
              <label><input type="radio" checked={mode === "new"} onChange={() => setMode("new")} disabled={running} /> Create a new site</label>
            </div>
            {mode === "existing" ? (
              <label className="ps-field">Site
                <select value={siteKey} onChange={(e) => { setSiteKey(e.target.value); setSiteTouched(true); }} disabled={running}>{sites.map((s) => <option key={s.id} value={`${s.collection}/${s.name}`}>{s.collection} / {s.name}</option>)}</select>
              </label>
            ) : (
              <div className="ps-grid">
                <label className="ps-field">Site collection
                  <input list="ps-collections" value={newCollection} onChange={(e) => setNewCollection(e.target.value)} disabled={running} />
                  <datalist id="ps-collections">{collections.map((c) => <option key={c.id} value={c.name} />)}</datalist>
                </label>
                <label className="ps-field">Site name<input value={newSite} onChange={(e) => { setNewSite(e.target.value); setSiteTouched(true); }} disabled={running} /></label>
                <label className="ps-field">Site template
                  <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} disabled={running}>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                </label>
              </div>
            )}
            {HUB && (
              <label className="ps-field">Portal deployment (the site&apos;s head)
                <input value={headInput} onChange={(e) => { setHeadInput(e.target.value); setHeadTouched(true); setHeadNote(""); }} placeholder="https://<portal>.vercel.app" disabled={running} />
                {headNote && <p className="ps-muted">{headNote}</p>}
                <small>{mode === "existing" ? "Read from the site's Portal Settings; change it only when the site moved to another deployment." : "The deployment that serves this new site (its live URL)."} The portal checks below and the Content Hub data come from it.</small>
              </label>
            )}
            {(!NAME.test(target.collection || "") || !NAME.test(target.site || "")) && <p className="ps-muted">Names: letters, digits, dashes; starting with a letter.</p>}
            {foreign && mode === "existing" && <p className="ps-warn">This deployment serves the site “{servedSite}”. “{target.site}” belongs to another portal deployment with its own Content Hub tenant: open the Portal setup app registered for that portal instead. Running or fixing it from here would connect it to this deployment’s tenant.</p>}
            {mode === "new" && foreign && <p className="ps-warn">This deployment renders the site “{servedSite}” (NEXT_PUBLIC_DEFAULT_SITE_NAME); a site with another name needs its own deployment — name the new site “{servedSite}”.</p>}
          </section>

          {deploymentChecks}

          {mode === "existing" && (
            <section className="ps-section">
              <div className="ps-row-head"><h2>Site check</h2><button type="button" onClick={checkSiteNow} disabled={checking || running || !!fixing}>{checking ? "Checking…" : "Check again"}</button></div>
              {checkError && <p className="ps-warn">Site check failed: {checkError}</p>}
              {!siteChecks && !checkError && <p className="ps-muted">{checking ? `Checking ${target.collection}/${target.site}…` : "Waiting for the connection…"}</p>}
              {siteChecks && (
                <ul className="ps-checks">
                  {siteChecks.map((c) => (
                    <li key={c.id} className={`ps-check ${c.status}`}>
                      <span className="ps-icon" aria-label={c.status}>{icon(c.status)}</span>
                      <span className="ps-label">{c.label}</span>
                      <span className="ps-detail">{c.detail}</span>
                      {c.status !== "ok" && c.fix && <span className="ps-fix-row"><button type="button" onClick={() => fix(c)} disabled={running || !!fixing || checking || foreign}>{fixing === c.id ? "Fixing…" : c.fix.label}</button></span>}
                    </li>
                  ))}
                </ul>
              )}
              {fixNote && <p className={/failed/.test(fixNote) ? "ps-warn" : "ps-ok"}>{fixNote}</p>}
            </section>
          )}

          <section className="ps-section">
            <h2>Options</h2>
            <div className="ps-grid">
              <label className="ps-field">Extra languages<input value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="de-DE, fr-FR" disabled={running} />{badLanguages.length > 0 && <small className="ps-warn">Not a language code: {badLanguages.join(", ")} — use e.g. de-DE, fr-FR, ar-SA.</small>}<small>Pre-filled with the languages this deployment serves. Built-in texts for German, French, Spanish, Italian, Dutch, Portuguese, Swedish, Norwegian, Danish, Finnish, Polish and Arabic; other languages start as English copies. Re-running replaces untouched English copies with the built-in texts.</small></label>
              <label className="ps-field">Public host<input value={publicHost} onChange={(e) => setPublicHost(e.target.value)} placeholder="portal.example.com" disabled={running} /><small>The live domain, for SitecoreAI’s sitemap and links.</small></label>
            </div>
            {!!health?.brands?.length && (
              <fieldset className="ps-brands" disabled={running}>
                <legend>Brands shown (none ticked = all)</legend>
                {health.brands.map((b) => (
                  <label key={b.identifier}><input type="checkbox" checked={scope.includes(b.identifier)} onChange={(e) => { setScopeTouched(true); setScope((s) => (e.target.checked ? [...s, b.identifier] : s.filter((x) => x !== b.identifier))); }} /> {b.name}</label>
                ))}
              </fieldset>
            )}
            <label className="ps-check-row"><input type="checkbox" checked={trackUsage} onChange={(e) => { setTrackTouched(true); setTrackUsage(e.target.checked); }} disabled={running} /> Track downloads and views in Content Hub (BrandSite.PortalEvent)</label>
            <label className="ps-check-row"><input type="checkbox" checked={registerHost} onChange={(e) => setRegisterHost(e.target.checked)} disabled={running} /> Register an editing host for the Page builder — a deployment of this portal that runs with the environment’s <em>preview</em> context id</label>
            {registerHost && (
              <div className="ps-grid ps-indent">
                <label className="ps-field">Editing host URL<input value={editingUrl} onChange={(e) => setEditingUrl(e.target.value)} placeholder="https://<portal>-editing.vercel.app" disabled={running} /><small>The deployment that runs with the <em>preview</em> context id — not the live site{origin ? ` (${origin.replace(/^https?:\/\//, "")})` : ""}. Required, https.</small></label>
                <label className="ps-field">Rendering host name<input value={hostName} onChange={(e) => { setHostName(e.target.value); setHostTouched(true); }} disabled={running} /><small>The site’s current host, else &lt;site&gt;-editing.</small></label>
                <label className="ps-check-row"><input type="checkbox" checked={useHostForSite} onChange={(e) => setUseHostForSite(e.target.checked)} disabled={running} /> Use it for this site</label>
              </div>
            )}
            <label className="ps-check-row"><input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} disabled={running} /> Publish when done</label>
            <p className="ps-muted">{appId ? <>The Content Hub picker uses this app (<code>{appId}</code>) — register the <em>Custom field</em> extension point <code>/ch-picker</code> on it.</> : "The app id appears once connected."}</p>
          </section>

          <section className="ps-section">
            <div className="ps-row-head">
              <h2>Run</h2>
              <button type="button" className="primary" onClick={() => run()} disabled={!valid || running || !!fixing || blocking.length > 0}>{running ? "Running…" : isPortalSite && alsoMicrosites && jointList.length ? `Set up ${target.site || "…"} and ${jointList.length} microsite${jointList.length === 1 ? "" : "s"}` : `Set up ${target.collection || "…"}/${target.site || "…"}`}</button>
            </div>
            {isPortalSite && jointList.length > 0 && (
              <label className="ps-check-row">
                <input type="checkbox" checked={alsoMicrosites} onChange={(e) => setAlsoMicrosites(e.target.checked)} disabled={running} />
                {" "}Then set up its {jointList.length} campaign microsite{jointList.length === 1 ? "" : "s"} too ({jointList.map((m) => m.site).join(", ")}) — sites missing in {target.collection || "the collection"} are created, each gets its own address as public host and the same editing host. A microsite run is quick once the portal has brought the collection up to date.
              </label>
            )}
            {blocking.length > 0 && <p className="ps-warn">Fix the failed checks above first: {blocking.map((c) => c.label).join(", ")}.</p>}
            {result === "done" && <p className="ps-ok">The portal is set up. Open the site in the Page builder; the public pages follow on the next publish of their content. Re-run any time after updating the portal code.</p>}
            {result === "failed" && <p className="ps-warn">The setup stopped — the log shows where. Running it again continues safely.</p>}
            {log.length > 0 && <pre className="ps-log" ref={logRef}>{log.join("\n")}</pre>}
          </section>
        </>
      )}
    </div>
  );
}
