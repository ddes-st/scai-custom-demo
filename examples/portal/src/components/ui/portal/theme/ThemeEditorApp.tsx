"use client";
/**
 * The "Portal theme" Marketplace app (SitecoreAI Page builder context panel). Presets, the
 * accent, every site token (colours, radius), the three Google fonts and the brand-book layout;
 * each change is broadcast to the editing host (ThemeLiveBridge) so the canvas restyles live,
 * and Save writes the Theme section of the Portal Settings item through the SitecoreAI
 * Authoring API (Marketplace SDK, XMC module) — optionally publishing it. Opened outside the
 * Page builder it still previews values and produces the CSS / JSON to paste.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import { FontSelect } from "./FontSelect";
import { marketplaceClient } from "src/lib/portal/marketplace-client";
import { broadcastTheme, isThemeMessage } from "src/lib/portal/theme-bus";
import { HEX_COLOR, THEME_PRESETS, THEME_TOKENS, TOKEN_DEFAULTS, isTokenValue, sanitizeVars, type ThemeToken } from "src/lib/portal/theme-tokens";
import { setToolsSite, siteNameOf, toolsFetch } from "src/lib/portal/tools-fetch";
import { HUB, resolveHeadFromHost } from "src/lib/portal/hub";
import { useAuthEpoch } from "components/ui/portal/auth/useAuthEpoch";

interface Draft { accent: string; fonts: { serif: string; sans: string; mono: string }; brandBookLayout: string; vars: Record<string, string> }
interface Resolved { language: string; theme: { accent: string; fonts: Draft["fonts"]; brandBookLayout: string; customVars: Record<string, string>; fallback: { accent: string; fonts: Draft["fonts"]; brandBookLayout: string } }; brandTheme?: { brand: string; accent: string; fontSerif: string; fontSans: string; vars: Record<string, string> } | null }
interface SettingsItem { itemId: string; path: string; language: string }
type Status = "idle" | "saving" | "saved" | "error";

const EMPTY: Draft = { accent: "", fonts: { serif: "", sans: "", mono: "" }, brandBookLayout: "", vars: {} };
const same = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b);
const draftFromFields = (f: Map<string, string>): Draft => {
  let vars: Record<string, string> = {};
  try { vars = sanitizeVars(JSON.parse(f.get("ThemeVars") || "{}")); } catch { vars = {}; }
  return { accent: (f.get("Accent") ?? "").trim(), fonts: { serif: (f.get("FontSerif") ?? "").trim(), sans: (f.get("FontSans") ?? "").trim(), mono: (f.get("FontMono") ?? "").trim() }, brandBookLayout: (f.get("BrandBookLayout") ?? "").trim().toLowerCase(), vars };
};
/** `/sitecore/content/<collection>/<site>/Home/...` → `/sitecore/content/<collection>/<site>`. */
const siteRootOf = (path: string) => { const m = /^(.*?)\/home(?:\/|$)/i.exec(path || ""); return m ? m[1] : ""; };

export function ThemeEditorApp() {
  const [client, setClient] = useState<ClientSDK | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [contextId, setContextId] = useState("");
  const [pagePath, setPagePath] = useState("");
  const [pageId, setPageId] = useState("");
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [item, setItem] = useState<SettingsItem | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saved, setSaved] = useState<Draft>(EMPTY);
  const [status, setStatus] = useState<Status>("idle");
  const [note, setNote] = useState("");
  const [apiNote, setApiNote] = useState("");
  const [publish, setPublish] = useState(true);
  const [canvasFrames, setCanvasFrames] = useState(0);
  const effectiveRef = useRef<{ vars: Record<string, string>; accent: string; fonts: Draft["fonts"] } | null>(null);

  // 1. Host connection (Marketplace SDK + XMC module), page context, and the resolved theme from the head.
  useEffect(() => {
    let cancelled = false;
    toolsFetch("/api/theme", { cache: "no-store" }).then((r) => r.json()).then((b) => { if (!cancelled && b?.ok) setResolved(b); }).catch(() => {});
    (async () => {
      if (typeof window === "undefined") return;
      if (window.parent === window) { setStandalone(true); return; }
      try {
        const c = await marketplaceClient();
        if (c && HUB) void resolveHeadFromHost(c);
        if (cancelled || !c) return;
        setClient(c);
        c.query("application.context").then((res) => {
          const access = (res.data as any)?.resourceAccess?.[0] ?? (res.data as any)?.resources?.[0];
          const id = access?.context?.preview || access?.context?.live || "";
          if (!cancelled) setContextId(id);
          if (!id && !cancelled) setApiNote("The app has no SitecoreAI API access (no context id): saving is disabled. Enable 'SitecoreAI APIs' in the app's configuration and update its installation.");
        }).catch((e: any) => { if (!cancelled) setApiNote(`application.context failed: ${e?.message ?? e}`); });
        c.query("pages.context", { subscribe: true, onSuccess: (ctx: any) => { if (!cancelled) { setPagePath(ctx?.pageInfo?.path ?? ""); setPageId(ctx?.pageInfo?.id ?? ""); } } }).catch(() => {});
      } catch (e: any) {
        if (!cancelled) { setStandalone(true); setNote(`Not inside the Page builder (${e?.message || "no host"}): preview only, copy the output into the Portal Settings item.`); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // the open page's site (one deployment can serve several: joint microsites): its resolved theme
  const siteName = siteNameOf(pagePath);
  useEffect(() => {
    if (!siteName) return;
    setToolsSite(siteName);
    let cancelled = false;
    toolsFetch("/api/theme", { cache: "no-store" }).then((r) => r.json()).then((b) => { if (!cancelled && b?.ok) setResolved(b); }).catch(() => {});
    return () => { cancelled = true; };
  }, [siteName]);

  // after a sign-in in the panel: the head's theme again (it was refused before)
  const signIns = useAuthEpoch();
  useEffect(() => {
    if (!signIns) return;
    let cancelled = false;
    toolsFetch("/api/theme", { cache: "no-store" }).then((r) => r.json()).then((b) => { if (!cancelled && b?.ok) setResolved(b); }).catch(() => {});
    return () => { cancelled = true; };
  }, [signIns]);

  const gql = useCallback(async <T,>(query: string, variables: Record<string, unknown>): Promise<T> => {
    if (!client || !contextId) throw new Error("No SitecoreAI API access.");
    const res: any = await client.mutate("xmc.authoring.graphql", { params: { query: { sitecoreContextId: contextId }, body: { query, variables } } } as any);
    const body = res?.data ?? res;
    if (body?.errors?.length) throw new Error(body.errors.map((e: any) => e.message).join("; "));
    return body?.data as T;
  }, [client, contextId]);

  // 2. The Portal Settings item of the site being edited (master database = what the canvas shows).
  useEffect(() => {
    if (!client || !contextId || (!pagePath && !pageId)) return;
    let cancelled = false;
    (async () => {
      try {
        let root = siteRootOf(pagePath);
        if (!root && pageId) {
          const d = await gql<{ item?: { path?: string } }>(`query($id:String!){ item(where:{itemId:$id}) { path } }`, { id: pageId });
          root = siteRootOf(d?.item?.path ?? "");
        }
        if (!root) throw new Error(`Cannot find the site root from the page path "${pagePath}".`);
        const language = resolved?.language || "en";
        const d = await gql<{ item?: { itemId: string; path: string; fields: { nodes: Array<{ name: string; value: string }> } } }>(
          `query($path:String!,$lang:String!){ item(where:{path:$path, language:$lang}) { itemId path fields(ownFields:true, excludeStandardFields:true) { nodes { name value } } } }`,
          { path: `${root}/Settings/Portal Settings`, lang: language });
        if (cancelled) return;
        if (!d?.item) throw new Error(`No Portal Settings item under ${root}/Settings.`);
        const fields = new Map((d.item.fields?.nodes ?? []).map((f) => [f.name, f.value ?? ""]));
        if (!fields.has("ThemeVars")) setApiNote("The Portal Settings template has no ThemeVars field yet: run tools/sitecoreai-setup.mjs, then colours and radius can be saved too.");
        const current = draftFromFields(fields);
        setItem({ itemId: d.item.itemId, path: d.item.path, language });
        setDraft(current); setSaved(current); setApiNote((n) => n);
      } catch (e: any) {
        if (!cancelled) setApiNote(`Could not load the Portal Settings item: ${e?.message ?? e}`);
      }
    })();
    return () => { cancelled = true; };
  }, [client, contextId, pagePath, pageId, resolved?.language, gql]);

  // Without the Authoring API (standalone, no access) start from the published values the head reports.
  useEffect(() => {
    if (item || !resolved) return;
    const t = resolved.theme;
    const fb = t.fallback ?? { accent: t.accent, fonts: t.fonts, brandBookLayout: t.brandBookLayout };
    const current: Draft = { accent: t.accent !== fb.accent ? t.accent : "", fonts: { serif: t.fonts.serif !== fb.fonts.serif ? t.fonts.serif : "", sans: t.fonts.sans !== fb.fonts.sans ? t.fonts.sans : "", mono: t.fonts.mono !== fb.fonts.mono ? t.fonts.mono : "" }, brandBookLayout: t.brandBookLayout !== fb.brandBookLayout ? t.brandBookLayout : "", vars: t.customVars ?? {} };
    setDraft(current); setSaved(current);
  }, [resolved, item]);

  // 3. Effective values (draft → inherited) and the live broadcast to the canvas.
  const fallback = resolved?.theme?.fallback ?? { accent: "#9528e6", fonts: { serif: "Instrument Serif", sans: "Instrument Sans", mono: "JetBrains Mono" }, brandBookLayout: "tabbed" };
  const effective = useMemo(() => ({
    vars: { ...TOKEN_DEFAULTS, ...sanitizeVars(draft.vars) },
    accent: HEX_COLOR.test(draft.accent) ? draft.accent : fallback.accent,
    fonts: { serif: draft.fonts.serif || fallback.fonts.serif, sans: draft.fonts.sans || fallback.fonts.sans, mono: draft.fonts.mono || fallback.fonts.mono },
  }), [draft, fallback.accent, fallback.fonts.serif, fallback.fonts.sans, fallback.fonts.mono]);
  effectiveRef.current = effective;
  useEffect(() => {
    // Broadcast whenever embedded (also without a Marketplace host, e.g. a local test harness).
    if (typeof window === "undefined" || window.parent === window) return;
    const t = setTimeout(() => setCanvasFrames(broadcastTheme({ type: "preview", ...effective })), 60);
    return () => clearTimeout(t);
  }, [effective]);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => { if (isThemeMessage(e.data) && e.data.type === "hello" && effectiveRef.current) broadcastTheme({ type: "preview", ...effectiveRef.current }); };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // 4. Editing helpers. The deployment's Content Hub brand theme (what the setup wrote) comes first.
  const presets = useMemo(() => {
    const b = resolved?.brandTheme;
    const brand = b ? [{ name: "Brand", title: `${b.brand || "The demo's brand"} — the theme from Content Hub the setup wrote`, accent: b.accent.toLowerCase(), fonts: { serif: b.fontSerif, sans: b.fontSans }, vars: sanitizeVars(b.vars) }] : [];
    return [...brand, ...THEME_PRESETS.map((p) => ({ ...p, title: p.name === "Default" ? "The portal's neutral look: no accent, fonts or colours of its own" : "" }))];
  }, [resolved?.brandTheme]);
  const setVar = (key: string, value: string) => setDraft((d) => { const vars = { ...d.vars }; if (value) vars[key] = value; else delete vars[key]; return { ...d, vars }; });
  const applyPreset = (name: string) => {
    const p = presets.find((x) => x.name === name); if (!p) return;
    setDraft((d) => ({ ...d, accent: p.accent ?? "", fonts: { serif: p.fonts?.serif ?? "", sans: p.fonts?.sans ?? "", mono: (p.fonts as { mono?: string } | undefined)?.mono ?? "" }, vars: { ...p.vars } }));
  };
  const activePreset = useMemo(() => presets.find((p) => JSON.stringify({ ...p.vars }) === JSON.stringify(draft.vars) && (p.accent ?? "").toLowerCase() === draft.accent.toLowerCase() && (p.fonts?.serif ?? "") === draft.fonts.serif && (p.fonts?.sans ?? "") === draft.fonts.sans && ((p.fonts as { mono?: string } | undefined)?.mono ?? "") === draft.fonts.mono)?.name ?? "Custom", [draft, presets]);
  const dirty = !same(draft, saved);

  const save = async () => {
    if (!item) return;
    setStatus("saving"); setNote("");
    try {
      const fields = [
        { name: "Accent", value: HEX_COLOR.test(draft.accent) ? draft.accent.toLowerCase() : "" },
        { name: "FontSerif", value: draft.fonts.serif }, { name: "FontSans", value: draft.fonts.sans }, { name: "FontMono", value: draft.fonts.mono },
        { name: "BrandBookLayout", value: draft.brandBookLayout },
        { name: "ThemeVars", value: Object.keys(draft.vars).length ? JSON.stringify(sanitizeVars(draft.vars)) : "" },
      ];
      await gql(`mutation($i:UpdateItemInput!){ updateItem(input:$i){ item { itemId } } }`, { i: { itemId: item.itemId, language: item.language, fields } });
      if (publish) {
        await gql(`mutation($i:PublishItemInput!){ publishItem(input:$i){ operationId } }`, { i: { rootItemPath: item.path, languages: [item.language], publishSubItems: false, publishRelatedItems: false, publishItemMode: "SMART", targetDatabases: ["experienceedge"] } });
      }
      setSaved(draft); setStatus("saved");
      setNote(publish ? "Saved and published. The live site picks it up within a minute (sooner with the revalidation hook)." : "Saved to the Portal Settings item (not published yet).");
    } catch (e: any) {
      setStatus("error"); setNote(`Save failed: ${e?.message ?? e}`);
    }
  };

  const cssOut = useMemo(() => {
    const lines = [`--portal-accent: ${effective.accent};`, ...THEME_TOKENS.map((t) => `${t.key}: ${effective.vars[t.key]};`)];
    for (const k of ["serif", "sans", "mono"] as const) if (draft.fonts[k]) lines.push(`--bgd-${k}: "${draft.fonts[k]}";`);
    return `:root {\n  ${lines.join("\n  ")}\n}`;
  }, [effective, draft.fonts]);

  const groups = useMemo(() => { const m = new Map<string, ThemeToken[]>(); for (const t of THEME_TOKENS) m.set(t.group, [...(m.get(t.group) ?? []), t]); return [...m.entries()]; }, []);
  const canSave = !!item && !!client && !!contextId;

  return (
    <div className="te">
      <header className="te-head">
        <h1>Portal theme</h1>
        <p>Pick a preset or change single values; the canvas updates as you go. Save writes the Theme section of the Portal Settings item{item ? "" : " (connecting…)"}.</p>
        {apiNote && <p className="te-warn">{apiNote}</p>}
        {note && <p className={status === "error" ? "te-warn" : "te-ok"}>{note}</p>}
      </header>

      <section className="te-section">
        <h2>Preset</h2>
        <div className="te-presets">
          {presets.map((p) => <button key={p.name} type="button" className={activePreset === p.name ? "on" : ""} title={p.title || undefined} onClick={() => applyPreset(p.name)}>{p.name}</button>)}
          <button type="button" className={activePreset === "Custom" ? "on" : ""} disabled>Custom</button>
        </div>
      </section>

      <section className="te-section">
        <h2>Accent</h2>
        <ColorRow label="Accent colour" hint="hub cards, carousel dots, brand-coloured details" value={draft.accent} inherited={fallback.accent} onChange={(v) => setDraft((d) => ({ ...d, accent: v }))} />
      </section>

      {groups.map(([group, tokens]) => (
        <section className="te-section" key={group}>
          <h2>{group}</h2>
          {tokens.map((t) => t.type === "color"
            ? <ColorRow key={t.key} label={t.label} hint={t.hint} value={draft.vars[t.key] ?? ""} inherited={t.default} onChange={(v) => setVar(t.key, v)} />
            : <LengthRow key={t.key} token={t} value={draft.vars[t.key] ?? ""} onChange={(v) => setVar(t.key, v)} />)}
        </section>
      ))}

      <section className="te-section">
        <h2>Fonts (Google Fonts)</h2>
        <FontSelect label="Headings (serif)" value={draft.fonts.serif} inherited={fallback.fonts.serif} defaultCategory="serif" onChange={(f) => setDraft((d) => ({ ...d, fonts: { ...d.fonts, serif: f } }))} />
        <FontSelect label="Body (sans-serif)" value={draft.fonts.sans} inherited={fallback.fonts.sans} defaultCategory="sans" onChange={(f) => setDraft((d) => ({ ...d, fonts: { ...d.fonts, sans: f } }))} />
        <FontSelect label="Labels (monospace)" value={draft.fonts.mono} inherited={fallback.fonts.mono} defaultCategory="mono" onChange={(f) => setDraft((d) => ({ ...d, fonts: { ...d.fonts, mono: f } }))} />
      </section>

      <section className="te-section">
        <h2>Brand books</h2>
        <div className="te-row">
          <label htmlFor="te-layout">Default layout</label>
          <select id="te-layout" value={draft.brandBookLayout} onChange={(e) => setDraft((d) => ({ ...d, brandBookLayout: e.target.value }))}>
            <option value="">— inherit ({fallback.brandBookLayout}) —</option>
            <option value="tabbed">tabbed</option>
            <option value="editorial">editorial</option>
          </select>
        </div>
      </section>

      <footer className="te-foot">
        {standalone ? (
          <>
            <p className="te-muted">Not connected to the Page builder. Paste into the Portal Settings item: Accent / fonts as shown, and this JSON into <code>ThemeVars</code>:</p>
            <textarea readOnly value={JSON.stringify(sanitizeVars(draft.vars))} rows={2} />
            <textarea readOnly value={cssOut} rows={6} />
          </>
        ) : (
          <>
            <label className="te-check"><input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} /> Publish after saving</label>
            <div className="te-actions">
              <button type="button" onClick={() => setDraft(saved)} disabled={!dirty || status === "saving"}>Discard</button>
              <button type="button" className="primary" onClick={save} disabled={!canSave || !dirty || status === "saving"}>{status === "saving" ? "Saving…" : publish ? "Save & publish" : "Save"}</button>
            </div>
            <p className="te-muted">{canvasFrames ? `Live preview on ${canvasFrames} frame${canvasFrames === 1 ? "" : "s"}.` : "Waiting for the canvas…"} {item ? `Item: ${item.path} (${item.language}).` : ""}</p>
          </>
        )}
      </footer>
    </div>
  );
}

function ColorRow({ label, hint, value, inherited, onChange }: { label: string; hint?: string; value: string; inherited: string; onChange: (v: string) => void }) {
  const shown = HEX_COLOR.test(value) ? value : inherited;
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = (v: string) => { const t = v.trim().toLowerCase(); if (!t) onChange(""); else if (HEX_COLOR.test(t)) onChange(t); };
  return (
    <div className="te-row">
      <label>{label}{hint && <small>{hint}</small>}</label>
      <div className="te-color">
        <input type="color" value={shown.length === 7 ? shown : "#000000"} onChange={(e) => onChange(e.target.value)} aria-label={`${label} picker`} />
        <input type="text" value={text} placeholder={inherited} onChange={(e) => setText(e.target.value)} onBlur={(e) => commit(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") commit((e.target as HTMLInputElement).value); }} aria-label={`${label} hex`} />
        {value ? <button type="button" className="link" onClick={() => onChange("")}>inherit</button> : <span className="te-inherit">inherited</span>}
      </div>
    </div>
  );
}

function LengthRow({ token, value, onChange }: { token: ThemeToken; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = (v: string) => { const t = v.trim(); if (!t) onChange(""); else if (isTokenValue("length", t)) onChange(t); };
  return (
    <div className="te-row">
      <label>{token.label}{token.hint && <small>{token.hint}</small>}</label>
      <div className="te-color">
        <input type="text" value={text} placeholder={token.default} onChange={(e) => setText(e.target.value)} onBlur={(e) => commit(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") commit((e.target as HTMLInputElement).value); }} aria-label={token.label} />
        {value ? <button type="button" className="link" onClick={() => onChange("")}>inherit</button> : <span className="te-inherit">inherited</span>}
      </div>
    </div>
  );
}
