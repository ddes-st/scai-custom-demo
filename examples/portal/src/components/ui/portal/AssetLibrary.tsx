"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { MediaItem } from "src/lib/ch/media";
import { Lightbox } from "./Lightbox";
import { useUi } from "src/lib/portal/ui-text-client";
import { ChImage } from "components/ui/portal/ChImage";

const PAGE = 24;
type Sort = "relevant" | "newest" | "used";

/** Brand-hub asset library. Published assets are Approved; status, rights and market have no feed yet. */
export function AssetLibrary({ items, brands, initial }: { items: MediaItem[]; brands: string[]; initial?: { q?: string; kind?: string } }) {
  const t = useUi();
  const [q, setQ] = useState(initial?.q ?? "");
  const [pickedBrands, setPickedBrands] = useState<string[]>([]);
  const [kind, setKind] = useState(initial?.kind ?? "");
  const [status, setStatus] = useState<string[]>(["approved"]);
  const [sort, setSort] = useState<Sort>("relevant");
  const [tile, setTile] = useState(180);
  const [list, setList] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [filterQ, setFilterQ] = useState("");

  const kinds = useMemo(() => {
    const count = new Map<string, number>();
    for (const i of items) count.set(i.kind, (count.get(i.kind) ?? 0) + 1);
    return ["image", "video", "document", "other"].filter((k) => count.has(k)).map((k) => ({ id: k, count: count.get(k)! }));
  }, [items]);
  const brandCounts = useMemo(() => {
    const count = new Map<string, number>();
    for (const i of items) for (const b of i.brands) count.set(b, (count.get(b) ?? 0) + 1);
    return brands.map((b) => ({ name: b, count: count.get(b) ?? 0 })).filter((b) => b.count > 0);
  }, [items, brands]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const words = needle.split(/\s+/).filter(Boolean);
    let rows = items.filter((i) =>
      (!pickedBrands.length || i.brands.some((b) => pickedBrands.includes(b))) &&
      (!kind || i.kind === kind) &&
      (!words.length || words.every((w) => `${i.title} ${i.fileName} ${i.brands.join(" ")}`.toLowerCase().includes(w))));
    if (!status.includes("approved") || status.some((s) => s !== "approved")) rows = [];
    if (sort === "newest") rows = [...rows].sort((a, b) => (b.modified ?? "").localeCompare(a.modified ?? ""));
    return rows;
  }, [items, q, pickedBrands, kind, status, sort]);

  const years = useMemo(() => {
    const set = new Set<number>();
    for (const i of items) { const y = Number((i.modified ?? "").slice(0, 4)); if (y > 1990) set.add(y); }
    return [...set].sort((a, b) => b - a).slice(0, 3);
  }, [items]);
  const suggestions = useMemo(() => {
    const chips: Array<{ label: string; apply: () => void }> = [];
    const images = items.filter((i) => i.kind === "image").length;
    if (images) chips.push({ label: `${t("images")} ${images.toLocaleString()}`, apply: () => setKind("image") });
    for (const b of brandCounts.slice(0, 3)) chips.push({ label: `${b.name} ${b.count.toLocaleString()}`, apply: () => setPickedBrands([b.name]) });
    return chips.slice(0, 4);
  }, [items, brandCounts, t]);

  const toggle = (list: string[], value: string, set: (v: string[]) => void) => set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  const visibleBrands = brandCounts.filter((b) => !filterQ || b.name.toLowerCase().includes(filterQ.trim().toLowerCase()));
  const count = (n: number) => n.toLocaleString();

  return (
    <div className="hub-assets" style={{ ["--hub-tile" as string]: `${tile}px` }}>
      <aside className="hub-asset-filters">
        <input type="search" value={filterQ} placeholder={t("hubFindFilter")} onChange={(e) => setFilterQ(e.target.value)} aria-label={t("hubFindFilter")} />
        <FilterGroup title={t("brand")}>
          {visibleBrands.map((b) => (
            <label key={b.name}><input type="checkbox" checked={pickedBrands.includes(b.name)} onChange={() => toggle(pickedBrands, b.name, setPickedBrands)} /> <span>{b.name}</span> <em>{count(b.count)}</em></label>
          ))}
        </FilterGroup>
        <FilterGroup title={t("type")}>
          {kinds.map((k) => (
            <label key={k.id}><input type="checkbox" checked={kind === k.id} onChange={() => setKind(kind === k.id ? "" : k.id)} /> <span>{t(k.id === "image" ? "images" : k.id === "video" ? "videos" : k.id === "document" ? "documents" : "files")}</span> <em>{count(k.count)}</em></label>
          ))}
        </FilterGroup>
        <FilterGroup title={t("hubStatus")}>
          <label><input type="checkbox" checked={status.includes("approved")} onChange={() => toggle(status, "approved", setStatus)} /> <span>{t("hubApproved")}</span> <em>{count(items.length)}</em></label>
          {(["review", "expires", "draft"] as const).map((id) => (
            <label key={id}><input type="checkbox" checked={status.includes(id)} onChange={() => { toggle(status, id, setStatus); setNote(t("hubNotOnFeed")); }} /> <span>{t(id === "review" ? "hubInReview" : id === "expires" ? "hubExpires" : "hubDraft")}</span> <em>0</em></label>
          ))}
        </FilterGroup>
        <FilterGroup title={t("hubWhoCanUse")}><p className="hub-gap">{t("hubNotOnFeed")}</p></FilterGroup>
        <FilterGroup title={t("hubMarket")}><p className="hub-gap">{t("hubNotOnFeed")}</p></FilterGroup>
      </aside>
      <div className="hub-asset-main">
        <p className="hub-kicker">{t("hubLibrary")}</p>
        <h1>{t("hubAssetCount", { count: count(items.length) })}</h1>
        <form className="hub-asset-search" onSubmit={(e) => e.preventDefault()}>
          <input type="search" value={q} placeholder={t("hubAssetSearch")} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} aria-label={t("search")} />
          <button type="button" onClick={() => setNote(t("hubNotOnFeed"))}>{t("hubFindSimilar")}</button>
        </form>
        {suggestions.length > 0 && (
          <p className="hub-suggest"><span>{t("hubNarrow")}</span>{suggestions.map((s) => <button key={s.label} type="button" onClick={s.apply}>{s.label}</button>)}</p>
        )}
        <div className="hub-asset-tools">
          <div className="hub-sort" role="group">
            {(["relevant", "newest", "used"] as const).map((id) => (
              <button key={id} type="button" className={sort === id ? "is-on" : undefined} onClick={() => { setSort(id); if (id === "used") setNote(t("hubNotOnFeed")); }}>{t(id === "relevant" ? "hubMostRelevant" : id === "newest" ? "hubNewest" : "hubMostUsed")}</button>
            ))}
          </div>
          <label className="hub-size">{t("hubSize")}<input type="range" min={140} max={280} value={tile} onChange={(e) => setTile(Number(e.target.value))} /></label>
          <div className="hub-view" role="group">
            <button type="button" className={!list ? "is-on" : undefined} aria-label={t("hubCards")} onClick={() => setList(false)}>▦</button>
            <button type="button" className={list ? "is-on" : undefined} aria-label={t("hubTable")} onClick={() => setList(true)}>☰</button>
          </div>
        </div>
        {note && <p className="hub-gap">{note}</p>}
        {shown.length === 0 ? <p className="portal-empty">{status.some((s) => s !== "approved") && !status.includes("approved") ? t("hubNotOnFeed") : t("nothingMatches")}</p> : (
          <div className={list ? "hub-asset-list" : "hub-asset-grid"}>
            {shown.slice(0, limit).map((a, i) => (
              <figure key={a.id}>
                <button type="button" className="thumb" onClick={() => setOpen(i)} aria-label={`${t("preview")} ${a.title}`}>
                  {a.preview ? <ChImage links={a.links} fallback={a.preview} slot="thumb" alt="" /> : <span className="ext">{(a.fileName.split(".").pop() || a.kind).toUpperCase()}</span>}
                  <span className="hub-badges"><span className="is-ok">{t("hubApproved")}</span>{a.brands[0] && <span>{a.brands[0]}</span>}</span>
                </button>
                {list && <figcaption>{a.title}</figcaption>}
              </figure>
            ))}
          </div>
        )}
        <footer className="hub-asset-foot">
          <span>{t("hubShowing", { shown: Math.min(limit, shown.length), total: shown.length.toLocaleString() })}</span>
          {years.length > 0 && (
            <span className="hub-years">{t("hubJumpTo")}{years.map((y) => <button key={y} type="button" onClick={() => { setSort("newest"); setQ(String(y)); }}>{y}</button>)}<button type="button" onClick={() => setQ("")}>{t("hubEarlier")}</button></span>
          )}
        </footer>
        {shown.length > limit && <p className="portal-more"><button type="button" className="link" onClick={() => setLimit((n) => n + PAGE)}>{t("showMore", { count: Math.min(PAGE, shown.length - limit) })}</button></p>}
        {open != null && shown[open] && <Lightbox items={shown} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
      </div>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return <fieldset><legend>{title}</legend>{children}</fieldset>;
}
