"use client";

import { useEffect, useMemo, useState } from "react";
import type { MediaCollection, MediaItem } from "src/lib/ch/media";
import { Lightbox } from "./Lightbox";
import { useUi } from "src/lib/portal/ui-text-client";
import { ChImage } from "components/ui/portal/ChImage";


/** The media library: search, brand / collection / type filters and the asset grid (rendered a page at a time). */
const PAGE = 60;
export function MediaBrowser({ items, collections, brands, trackViews }: { items: MediaItem[]; collections: MediaCollection[]; brands: string[]; trackViews?: boolean }) {
  const t = useUi();
  const KINDS: Array<{ id: string; label: string }> = [
    { id: "", label: t("allTypes") }, { id: "image", label: t("images") }, { id: "video", label: t("videos") }, { id: "document", label: t("documents") }, { id: "audio", label: t("audio") },
  ];
  const [open, setOpen] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");
  const [collection, setCollection] = useState("");
  const [kind, setKind] = useState("");
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => setLimit(PAGE), [q, brand, collection, kind]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((i) =>
      (!brand || i.brands.includes(brand)) &&
      (!collection || i.collections.includes(collection)) &&
      (!kind || i.kind === kind) &&
      (!needle || `${i.title} ${i.fileName} ${i.brands.join(" ")} ${i.collections.join(" ")}`.toLowerCase().includes(needle)));
  }, [items, q, brand, collection, kind]);

  return (
    <div className="portal-media">
      {collections.length > 0 && (
        <div className="portal-chips" role="group" aria-label={t("collections")}>
          <button className={!collection ? "active" : undefined} aria-pressed={!collection} onClick={() => setCollection("")}>{t("allCollections")}</button>
          {collections.map((c) => (
            <button key={c.id} className={collection === c.name ? "active" : undefined} aria-pressed={collection === c.name} onClick={() => setCollection(collection === c.name ? "" : c.name)} title={c.description || undefined}>
              {c.name}{c.count ? <span className="count">{c.count}</span> : null}
            </button>
          ))}
        </div>
      )}
      <div className="portal-filters">
        <input type="search" placeholder={t("searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("search")} />
        {brands.length > 1 && (
          <select value={brand} onChange={(e) => setBrand(e.target.value)} aria-label={t("brand")}>
            <option value="">{t("allBrands")}</option>
            {brands.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        )}
        <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label={t("type")}>
          {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
        <span className="portal-count">{t("countOf", { shown: shown.length, total: items.length })}</span>
      </div>
      <div className="portal-asset-grid">
        {shown.slice(0, limit).map((a, i) => (
          <figure key={a.id} className="portal-asset">
            <div className="thumb" role="button" tabIndex={0} aria-label={`${t("preview")} ${a.title}`} onClick={() => setOpen(i)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(i); } }}>
              {a.preview ? <ChImage links={a.links} fallback={a.preview} slot="thumb" alt={a.title} /> : <span className="ext">{(a.fileName.split(".").pop() || a.kind).toUpperCase()}</span>}
              {a.kind === "video" && <span className="badge">{t("video")}</span>}
            </div>
            <figcaption>
              <span className="title" title={a.title}>{a.title}</span>
              <span className="meta">{[a.brands[0], a.sizeMb ? `${a.sizeMb < 1 ? a.sizeMb.toFixed(2) : a.sizeMb.toFixed(1)} MB` : ""].filter(Boolean).join(" · ")}</span>
              {a.download && <a className="download" href={a.download} target="_blank" rel="noreferrer" download data-track={a.id} data-track-title={a.title}>{t("download")}</a>}
            </figcaption>
          </figure>
        ))}
      </div>
      {shown.length > limit && (
        <p className="portal-more"><button type="button" className="link" onClick={() => setLimit((n) => n + PAGE)}>{t("showMore", { count: Math.min(PAGE, shown.length - limit) })}</button></p>
      )}
      {shown.length === 0 && <p className="portal-empty">{t("nothingMatches")}</p>}
      {open != null && shown[open] && <Lightbox items={shown} index={open} onIndex={setOpen} onClose={() => setOpen(null)} track={trackViews} />}
    </div>
  );
}
