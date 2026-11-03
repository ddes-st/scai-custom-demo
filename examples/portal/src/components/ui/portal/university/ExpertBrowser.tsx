"use client";
import { useMemo, useState } from "react";
import { useUi } from "src/lib/portal/ui-text-client";
import { ChImage } from "components/ui/portal/ChImage";
import type { ImageLink } from "src/lib/ch/image-links";

export interface ExpertCard { id: string; name: string; title: string; topics: string[]; languages: string[]; mediaTrained: boolean; portrait: { preview: string; links?: ImageLink[] } | null }

/** The media room's expert finder: search by topic, filter by language and media training. */
export function ExpertBrowser({ experts }: { experts: ExpertCard[] }) {
  const t = useUi();
  const [q, setQ] = useState("");
  const [lang, setLang] = useState("");
  const [trained, setTrained] = useState(false);
  const languages = useMemo(() => [...new Set(experts.flatMap((e) => e.languages))].sort(), [experts]);
  const shown = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return experts.filter((e) => (!lang || e.languages.includes(lang)) && (!trained || e.mediaTrained) && words.every((w) => `${e.name} ${e.title} ${e.topics.join(" ")}`.toLowerCase().includes(w)));
  }, [experts, q, lang, trained]);
  return (
    <div className="un-experts">
      <div className="portal-filters">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("unSearchTopics")} aria-label={t("unSearchTopics")} />
        {languages.length > 1 && <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label={t("language")}><option value="">{t("unAllLanguages")}</option>{languages.map((l) => <option key={l}>{l}</option>)}</select>}
        <label className="ps-check"><input type="checkbox" checked={trained} onChange={(e) => setTrained(e.target.checked)} /> {t("unMediaTrained")}</label>
      </div>
      {shown.length === 0 && <p className="portal-empty">{t("unNoExperts")}</p>}
      <div className="un-expert-grid">
        {shown.map((e) => (
          <article key={e.id} className="un-expert">
            <span className="photo">{e.portrait ? <ChImage links={e.portrait.links} fallback={e.portrait.preview} slot="tile" alt={e.name} /> : <span className="glyph">{e.name.split(/\s+/).map((w) => w.charAt(0)).slice(0, 2).join("")}</span>}</span>
            <div className="body">
              <h3>{e.name}</h3>
              {e.title && <p className="sub">{e.title}</p>}
              {e.topics.length > 0 && <p className="topics">{e.topics.map((x) => <span key={x} className="un-tag">{x}</span>)}</p>}
              <p className="meta">{e.languages.length > 0 && t("unLanguages", { list: e.languages.join(", ") })}{e.mediaTrained && <span className="un-badge">{t("unMediaTrained")}</span>}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
