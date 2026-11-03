"use client";
import React, { useCallback, useRef, useState } from "react";
import { BookSection, BrandGuidelineData, SectionKey } from "src/lib/ch/types";
import { useBook, useSectionLabel } from "./BookContext";
import { useUi } from "src/lib/portal/ui-text-client";
import type { UiKey } from "src/lib/portal/ui-keys";
import { ColourPanel } from "./panels/ColourPanel";
import { LogoPanel } from "./panels/LogoPanel";
import { TypographyPanel } from "./panels/TypographyPanel";
import { DocumentsPanel } from "./panels/DocumentsPanel";
import { TemplatesPanel } from "./panels/TemplatesPanel";
import { DoDontPanel } from "./panels/DoDontPanel";
import { PersonasPanel } from "./panels/PersonasPanel";
import { CharacteristicsPanel } from "./panels/CharacteristicsPanel";
import { RetryImage } from "./RetryImage";

export interface LayoutProps {
  data: BrandGuidelineData;
}

type Ui = (key: UiKey, vars?: Record<string, string | number>) => string;

/** One meta pill per ENABLED section, in configured order, in the page language. */
export function metaCounts(data: BrandGuidelineData, sections: BookSection[], t: Ui): { label: string; missing: boolean }[] {
  const n = (count: number, kind: "Colour" | "Logo" | "Font" | "Document" | "Template" | "Dodont" | "Persona" | "Characteristic") =>
    count > 0
      ? { label: count === 1 ? t(`bbCount${kind}One` as UiKey) : t(`bbCount${kind}` as UiKey, { count }), missing: false }
      : { label: t(`bbCount${kind}None` as UiKey), missing: true };
  const byKey: Record<SectionKey, { label: string; missing: boolean }> = {
    colour: n(data.colors.length, "Colour"),
    logo: n(data.logos.length, "Logo"),
    typography: n(data.fonts.length, "Font"),
    documents: n(data.guidelines.length, "Document"),
    templates: n(data.templates.length, "Template"),
    dodont: n(data.doDonts.length, "Dodont"),
    personas: n(data.personas.length, "Persona"),
    characteristics: n(data.characteristics.length, "Characteristic"),
  };
  return sections.map((s) => byKey[s.key]);
}

/** The arrow keys' meaning follows the writing direction: in RTL, ArrowLeft moves forward. */
export function arrowStep(e: { key: string; currentTarget?: unknown }, el?: Element | null): -1 | 0 | 1 {
  const rtl = !!el && getComputedStyle(el).direction === "rtl";
  if (e.key === "ArrowRight") return rtl ? -1 : 1;
  if (e.key === "ArrowLeft") return rtl ? 1 : -1;
  return 0;
}

export function renderPanel(key: SectionKey, variant: "tabbed" | "editorial", data: BrandGuidelineData) {
  switch (key) {
    case "colour":
      return <ColourPanel variant={variant} colors={data.colors} />;
    case "logo":
      return <LogoPanel variant={variant} logos={data.logos} />;
    case "typography":
      return <TypographyPanel variant={variant} fonts={data.fonts} />;
    case "documents":
      return <DocumentsPanel variant={variant} guidelines={data.guidelines} />;
    case "templates":
      return <TemplatesPanel variant={variant} templates={data.templates} />;
    case "dodont":
      return <DoDontPanel variant={variant} items={data.doDonts} />;
    case "personas":
      return <PersonasPanel variant={variant} personas={data.personas} />;
    case "characteristics":
      return <CharacteristicsPanel variant={variant} characteristics={data.characteristics} />;
  }
}

/** Contact line rendered when the config carries a brand contact. */
export function ContactLine({ className }: { className?: string }) {
  const { contact } = useBook();
  const t = useUi();
  if (!contact.name && !contact.email) return null;
  return (
    <div className={className || "bgd-contact-line"}>
      <span className="bgd-mono-label">{t("contact")}</span>{" "}
      <span>{contact.name}</span>
      {contact.email && (
        <>
          {contact.name && <span> · </span>}
          <a href={`mailto:${contact.email}`}>{contact.email}</a>
        </>
      )}
    </div>
  );
}

/** Direction B — tabbed workbench (primary). */
export function TabbedLayout({ data }: LayoutProps) {
  const { sections } = useBook();
  const t = useUi();
  const labelOf = useSectionLabel();
  const [tab, setTab] = useState<SectionKey>(sections[0]?.key || "colour");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const activeTab = sections.some((s) => s.key === tab) ? tab : sections[0]?.key;

  const onTabKey = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      let next = -1;
      const step = arrowStep(e, e.currentTarget as Element);
      if (step) next = (index + step + sections.length) % sections.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = sections.length - 1;
      if (next >= 0) {
        e.preventDefault();
        setTab(sections[next].key);
        tabRefs.current[next]?.focus();
      }
    },
    [sections]
  );

  const heroLogo = data.logos.find((l) => l.url);

  return (
    <div className="bgd-frame">
      <header className="bgd-masthead">
        <div className="bgd-masthead-top">
          <div className="bgd-identity">
            <div className="bgd-logo-tile">
              {heroLogo ? (
                <RetryImage src={heroLogo.url} alt={t("bbLogoAlt", { brand: data.brandName })} />
              ) : (
                <span className="glyph" aria-hidden="true">
                  {(data.brandName || "?").charAt(0)}
                </span>
              )}
            </div>
            <div>
              <span className="bgd-eyebrow">{t("bbGuidelines")}</span>
              <h2 className="bgd-brand-name">{data.brandName}</h2>
              <div className="bgd-meta-row">
                {metaCounts(data, sections, t).map((m, i) => (
                  <React.Fragment key={m.label}>
                    {i > 0 && <span> · </span>}
                    <span className={m.missing ? "missing" : ""}>{m.label}</span>
                  </React.Fragment>
                ))}
              </div>
              <ContactLine />
            </div>
          </div>
        </div>
        <nav className="bgd-tabbar" role="tablist" aria-label={t("bbSectionsNav")}>
          {sections.map((s, i) => (
            <button
              key={s.key}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              role="tab"
              id={`bgd-tab-${s.key}`}
              aria-selected={activeTab === s.key}
              aria-controls={activeTab === s.key ? "bgd-panel" : undefined}
              tabIndex={activeTab === s.key ? 0 : -1}
              className={"bgd-tab" + (activeTab === s.key ? " active" : "")}
              onClick={() => setTab(s.key)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              {labelOf(s.key, s.label)}
            </button>
          ))}
        </nav>
      </header>

      <div className="bgd-panel" role="tabpanel" id="bgd-panel" aria-labelledby={`bgd-tab-${activeTab}`} tabIndex={0}>
        {activeTab && renderPanel(activeTab, "tabbed", data)}
      </div>

      <footer className="bgd-footer">
        <span>{t("bbFooterSystem", { brand: data.brandName })}</span>
        <span>{t("bbFooterManaged")}</span>
      </footer>
    </div>
  );
}
