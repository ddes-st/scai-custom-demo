"use client";
/**
 * The partner area's uploads: drag files here (or pick them) — each goes to Content Hub in 4 MB
 * parts (/api/partner-upload/*), becomes an asset under review and a review job for the partner's
 * Partner Manager — and the list of the partner's uploads with each file's status. Staff see a
 * partner's list read-only. Ported from the Demo Builder's Vercel portal.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useUi } from "src/lib/portal/ui-text-client";

interface Upload { assetId: number; title: string; fileName: string; uploadedOn: string; status: "review" | "changes" | "approved" }
interface Sending { key: string; name: string; done: number; total: number; error?: string }

export function PartnerUploads({ maxMb, canUpload, partner }: { maxMb: number; canUpload: boolean; partner?: string }) {
  const t = useUi();
  const [uploads, setUploads] = useState<Upload[] | null>(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState<Sending[]>([]);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  // files go one after another (each finish merges into the partner's upload list)
  const queue = useRef<Promise<void>>(Promise.resolve());
  const STATUS: Record<Upload["status"], string> = { review: t("statusReview"), changes: t("statusChanges"), approved: t("statusApproved") };

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/partner-upload/list${partner ? `?partner=${encodeURIComponent(partner)}` : ""}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error ?? `HTTP ${r.status}`);
      setUploads(d.uploads ?? []);
      setError("");
    } catch (e: any) { setError(String(e?.message ?? e)); }
  }, [partner]);
  useEffect(() => { void load(); }, [load]);
  // files in review are looked at again now and then (the manager may approve meanwhile)
  useEffect(() => {
    if (!uploads?.some((u) => u.status !== "approved")) return;
    const id = setInterval(() => void load(), 30000);
    return () => clearInterval(id);
  }, [uploads, load]);

  const patch = (key: string, p: Partial<Sending>) => setSending((s) => s.map((x) => (x.key === key ? { ...x, ...p } : x)));

  async function send(file: File, key: string) {
    try {
      if (file.size > maxMb * 1024 * 1024) throw new Error(`> ${maxMb} MB`);
      const start = await post("/api/partner-upload/start", { name: file.name, size: file.size });
      for (let i = 0; i < start.chunks; i++) {
        const part = file.slice(i * start.chunkSize, (i + 1) * start.chunkSize);
        const r = await fetch(`/api/partner-upload/chunk?i=${i}`, { method: "POST", headers: { "X-Upload-Token": start.token, "Content-Type": "application/octet-stream" }, body: part });
        if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? `part ${i + 1}: HTTP ${r.status}`);
        patch(key, { done: Math.min(file.size, (i + 1) * start.chunkSize) });
      }
      await post("/api/partner-upload/finish", { token: start.token, title: file.name.replace(/\.[^.]+$/, "") });
      setSending((s) => s.filter((x) => x.key !== key));
      await load();
    } catch (e: any) { patch(key, { error: String(e?.message ?? e) }); }
  }
  const pick = (files: FileList | null) => {
    for (const [i, f] of Array.from(files ?? []).entries()) {
      const key = `${f.name}-${f.size}-${Date.now()}-${i}`;
      setSending((s) => [...s, { key, name: f.name, done: 0, total: f.size }]);
      queue.current = queue.current.then(() => send(f, key));
    }
  };

  return (
    <section className="portal-section" id="uploads">
      <div className="portal-section-head">
        <h2>{partner ? t("uploads") : t("myUploads")}</h2>
        <p>{canUpload ? t("uploadsLead", { mb: maxMb }) : t("uploadsStaffLead")}</p>
      </div>
      {canUpload && (
        <div className={`portal-dropzone${over ? " over" : ""}`} role="button" tabIndex={0}
          onClick={() => input.current?.click()} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.current?.click(); } }}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files); }}>
          <strong>{t("dropFiles")}</strong>
          <span>{t("dropHint")}</span>
          <input ref={input} type="file" multiple hidden onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
        </div>
      )}
      {sending.map((s) => (
        <div key={s.key} className="portal-upload-row">
          <span className="name">{s.name}</span>
          {s.error
            ? <span className="status changes">{t("uploadFailed", { reason: s.error })} <button type="button" onClick={() => setSending((x) => x.filter((y) => y.key !== s.key))}>{t("dismiss")}</button></span>
            : <span className="status"><progress max={s.total} value={s.done} /> {Math.round((s.done / Math.max(1, s.total)) * 100)}%</span>}
        </div>
      ))}
      {error && <p className="portal-empty">{error}</p>}
      {uploads && uploads.length === 0 && !sending.length && <p className="portal-empty">{canUpload ? t("nothingUploaded") : t("partnerNothingUploaded")}</p>}
      {uploads?.map((u) => (
        <div key={u.assetId} className="portal-upload-row">
          <span className="name">{u.title}{u.fileName && u.fileName !== u.title ? <small> · {u.fileName}</small> : null}</span>
          <span className="date">{u.uploadedOn ? formatDay(u.uploadedOn) : ""}</span>
          <span className={`status ${u.status}`}>{STATUS[u.status]}</span>
        </div>
      ))}
    </section>
  );
}

/** The upload day in the page's language (the html lang), not the browser's. */
function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const lang = typeof document !== "undefined" ? document.documentElement.lang : "";
  try { return d.toLocaleDateString(lang || undefined); } catch { return d.toLocaleDateString(); }
}

async function post(url: string, body: unknown): Promise<any> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(d?.error ?? `HTTP ${r.status}`);
  return d;
}
