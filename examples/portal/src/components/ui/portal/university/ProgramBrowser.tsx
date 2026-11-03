"use client";
import { useMemo, useState } from "react";
import { Link } from "src/i18n/navigation";
import { useUi } from "src/lib/portal/ui-text-client";
import { programHref } from "src/lib/portal/sections";
import { ChImage } from "components/ui/portal/ChImage";
import type { ImageLink } from "src/lib/ch/image-links";
import { shortDate } from "./format";

export interface ProgramCard {
  id: string; name: string; summary: string; image: string; imageLinks?: ImageLink[];
  college: { id: string; name: string } | null; level: string; delivery: string; deadline: string; applicationsVsLastYear: number | null;
}

/** Program cards with level / college / format filters and a free-text interest search. */
export function ProgramBrowser({ programs, locale, initialCollege = "" }: { programs: ProgramCard[]; locale: string; initialCollege?: string }) {
  const t = useUi();
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("");
  const [college, setCollege] = useState(initialCollege);
  const [delivery, setDelivery] = useState("");
  const levels = useMemo(() => [...new Set(programs.map((p) => p.level).filter(Boolean))].sort(), [programs]);
  const colleges = useMemo(() => [...new Map(programs.filter((p) => p.college).map((p) => [p.college!.id, p.college!.name])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [programs]);
  const deliveries = useMemo(() => [...new Set(programs.map((p) => p.delivery).filter(Boolean))].sort(), [programs]);
  const shown = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return programs.filter((p) => (!level || p.level === level) && (!college || p.college?.id === college) && (!delivery || p.delivery === delivery) &&
      words.every((w) => `${p.name} ${p.summary} ${p.college?.name ?? ""}`.toLowerCase().includes(w)));
  }, [programs, q, level, college, delivery]);
  return (
    <div className="un-programs">
      <div className="portal-filters">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("unSearchInterests")} aria-label={t("unSearchInterests")} />
        {levels.length > 1 && <select value={level} onChange={(e) => setLevel(e.target.value)} aria-label={t("unLevel")}><option value="">{t("unAllLevels")}</option>{levels.map((l) => <option key={l}>{l}</option>)}</select>}
        {colleges.length > 1 && <select value={college} onChange={(e) => setCollege(e.target.value)} aria-label={t("unCollege")}><option value="">{t("unAllColleges")}</option>{colleges.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>}
        {deliveries.length > 1 && <select value={delivery} onChange={(e) => setDelivery(e.target.value)} aria-label={t("unDelivery")}><option value="">{t("unAllDelivery")}</option>{deliveries.map((d) => <option key={d}>{d}</option>)}</select>}
        <span className="portal-count">{t("unProgramsCount", { shown: shown.length, total: programs.length })}</span>
      </div>
      {shown.length === 0 && <p className="portal-empty">{t("unNoPrograms")}</p>}
      <div className="un-program-grid">
        {shown.map((p) => (
          <Link key={p.id} href={programHref(p.id)} className="un-program">
            <span className="media">{p.image ? <ChImage links={p.imageLinks} fallback={p.image} slot="card" alt="" /> : <span className="glyph">{p.name.charAt(0)}</span>}
              {p.applicationsVsLastYear != null && p.applicationsVsLastYear > 5 && <span className="un-badge hot">{t("unAppsUp", { pct: Math.round(p.applicationsVsLastYear) })}</span>}
            </span>
            <span className="body">
              {p.college && <span className="eyebrow">{p.college.name}</span>}
              <span className="name">{p.name}</span>
              <span className="tags">{[p.level, p.delivery].filter(Boolean).map((x) => <span key={x} className="un-tag">{x}</span>)}</span>
              {p.deadline && <span className="sub">{t("unDeadline", { date: shortDate(p.deadline, locale) })}</span>}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
