"use client";
import React from "react";
import { useBook, useSectionLabel } from "./BookContext";
import { useUi } from "src/lib/portal/ui-text-client";
import { ContactLine, LayoutProps, metaCounts, renderPanel } from "./TabbedLayout";

/** Direction A — editorial scroll (secondary). Sections follow the configured order. */
export function EditorialLayout({ data }: LayoutProps) {
  const { sections } = useBook();
  const t = useUi();
  const labelOf = useSectionLabel();

  const scrollTo = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  return (
    <div className="bgd-frame">
      <div className="bgd-hero">
        <div>
          <span className="bgd-eyebrow">{t("bbMasterBrand", { brand: data.brandName })}</span>
          <h2 className="bgd-hero-title">
            {t("bbHeroTitleTop")}
            <br />
            <span className="italic">{t("bbHeroTitleBottom")}</span>
          </h2>
          <div className="bgd-hero-pills">
            {metaCounts(data, sections, t).map((m) => (
              <span key={m.label} className={"bgd-hero-pill" + (m.missing ? " missing" : "")}>
                {m.label}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="bgd-hero-lead">{t("bbHeroLead", { brand: data.brandName })}</p>
          <ContactLine className="bgd-contact-line inverse" />
        </div>
      </div>

      <nav className="bgd-rail" aria-label={t("bbSections")}>
        {sections.map((s, i) => (
          <a key={s.key} href={`#bgd-sec-${s.key}`} onClick={(e) => scrollTo(e, `bgd-sec-${s.key}`)}>
            {String(i + 1).padStart(2, "0")} {labelOf(s.key, s.label)}
          </a>
        ))}
      </nav>

      {sections.map((s) => (
        <section className="bgd-section" id={`bgd-sec-${s.key}`} key={s.key}>
          {/* Documents renders its own full-bleed inverse band — no inner wrapper */}
          {s.key === "documents" ? (
            renderPanel(s.key, "editorial", data)
          ) : (
            <div className="bgd-editorial-section">{renderPanel(s.key, "editorial", data)}</div>
          )}
        </section>
      ))}

      <footer className="bgd-footer">
        <span>{t("bbFooterSystem", { brand: data.brandName })}</span>
        <span>{t("bbFooterManaged")}</span>
      </footer>
    </div>
  );
}
