"use client";

import { useMemo, useState } from "react";
import { Link } from "src/i18n/navigation";
import type { MediaCollection, MediaItem } from "src/lib/ch/media";
import { SECTION_PATH } from "src/lib/portal/sections";
import { useUi } from "src/lib/portal/ui-text-client";
import { ChImage } from "components/ui/portal/ChImage";

type Share = "" | "official" | "shared" | "mine";

/** Published collections and their assets. Sharing, ownership and creating a collection are not on the feed. */
export function CollectionBoard({ collections, items }: { collections: MediaCollection[]; items: MediaItem[] }) {
  const t = useUi();
  const [share, setShare] = useState<Share>("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState(collections[0]?.id ?? "");
  const byName = useMemo(() => {
    const map = new Map<string, MediaItem[]>();
    for (const item of items) for (const c of item.collections) {
      const list = map.get(c) ?? [];
      list.push(item);
      map.set(c, list);
    }
    return map;
  }, [items]);
  const shown = share ? [] : collections;
  const current = collections.find((c) => c.id === selected) ?? shown[0];
  const members = current ? (byName.get(current.name) ?? []).slice(0, 8) : [];

  return (
    <div className="hub-collections">
      <div className="hub-collection-tools">
        <div className="hub-chip-line">
          <div>
            <button type="button" className={!share ? "is-on" : undefined} onClick={() => setShare("")}>{t("all")} {collections.length}</button>
            <button type="button" className={share === "official" ? "is-on" : undefined} onClick={() => setShare(share === "official" ? "" : "official")}>{t("hubOfficial")}</button>
            <button type="button" className={share === "shared" ? "is-on" : undefined} onClick={() => setShare(share === "shared" ? "" : "shared")}>{t("hubShared")}</button>
            <button type="button" className={share === "mine" ? "is-on" : undefined} onClick={() => setShare(share === "mine" ? "" : "mine")}>{t("hubMine")}</button>
          </div>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); setNote(t("hubNotOnFeed")); }}>
          <input value={name} placeholder={t("hubNameCollection")} onChange={(e) => setName(e.target.value)} aria-label={t("hubNameCollection")} />
          <button type="submit">{t("hubCreate")}</button>
        </form>
      </div>
      {note && <p className="hub-gap">{note}</p>}
      {share && <p className="hub-gap">{t("hubNotOnFeed")}</p>}
      <div className="hub-collection-layout">
        <div className="hub-collection-grid">
          {shown.map((c) => {
            const thumbs = (byName.get(c.name) ?? []).slice(0, 4);
            return (
              <button key={c.id} type="button" className={current?.id === c.id ? "is-on" : undefined} onClick={() => setSelected(c.id)}>
                <span className="mosaic">{thumbs.length ? thumbs.map((a) => <ChImage key={a.id} links={a.links} fallback={a.preview} slot="thumb" alt="" />) : <span className="hub-needed">{t("hubImageNeeded")}</span>}</span>
                <span className="name">{c.name}</span>
                <span className="meta">{t("hubAssetCount", { count: c.count })}</span>
              </button>
            );
          })}
        </div>
        {current && !share && (
          <aside className="hub-collection-detail">
            <h2>{current.name}</h2>
            <p>{t("hubAssetCount", { count: current.count })}</p>
            {current.description && <p>{current.description}</p>}
            <div className="hub-collection-actions">
              <Link href={`${SECTION_PATH.media}?collection=${encodeURIComponent(current.name)}`}>{t("open")}</Link>
              <button type="button" onClick={() => setNote(t("hubNotOnFeed"))}>{t("hubDownloadAll")}</button>
            </div>
            <p className="hub-kicker">{t("hubWhoCanSee")}</p>
            <p className="hub-gap">{t("hubNotOnFeed")}</p>
            <div className="hub-collection-thumbs">{members.map((a) => <ChImage key={a.id} links={a.links} fallback={a.preview} slot="thumb" alt={a.title} />)}</div>
          </aside>
        )}
      </div>
    </div>
  );
}
