"use client";
/**
 * Distributes the admin config's book slice (section order/labels, downloads, contact) to the
 * layouts and panels without prop-drilling. Panels fall back to DEFAULT_BOOK when rendered
 * outside a provider, so they keep working standalone.
 */
import React, { createContext, useContext } from "react";
import { BookConfig, DEFAULT_BOOK, DEFAULT_SECTION_LABELS, SectionKey } from "src/lib/ch/types";
import { useUi } from "src/lib/portal/ui-text-client";
import type { UiKey } from "src/lib/portal/ui-keys";

const SECTION_KEYS: Record<SectionKey, UiKey> = {
  colour: "bbSecColour", logo: "bbSecLogo", typography: "bbSecTypography", documents: "bbSecDocuments",
  templates: "bbSecTemplates", dodont: "bbSecDodont", personas: "bbSecPersonas", characteristics: "bbSecCharacteristics",
};

/** A section's label in the page language — unless Content Hub's brand-book config renamed it. */
export function useSectionLabel(): (key: SectionKey, label: string) => string {
  const t = useUi();
  return (key, label) => (!label || label === DEFAULT_SECTION_LABELS[key] ? t(SECTION_KEYS[key]) : label);
}

const BookContext = createContext<BookConfig>(DEFAULT_BOOK);

export function BookProvider({ book, children }: { book: BookConfig; children: React.ReactNode }) {
  return <BookContext.Provider value={book}>{children}</BookContext.Provider>;
}

export function useBook(): BookConfig {
  return useContext(BookContext);
}

/** Section number ("01"…) and display label for a panel; enabled=false when hidden by config. */
export function useSectionInfo(key: SectionKey): { number: string; label: string; enabled: boolean } {
  const { sections } = useBook();
  const labelOf = useSectionLabel();
  const index = sections.findIndex((s) => s.key === key);
  if (index < 0) return { number: "—", label: labelOf(key, DEFAULT_BOOK.sections.find((s) => s.key === key)!.label), enabled: false };
  return { number: String(index + 1).padStart(2, "0"), label: labelOf(key, sections[index].label), enabled: true };
}
