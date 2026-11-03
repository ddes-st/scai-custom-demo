"use client";
import React, { useState } from "react";
import { BookConfig, BrandGuidelineData, LayoutKind } from "src/lib/ch/types";
import { BookProvider } from "./BookContext";
import { TabbedLayout } from "./TabbedLayout";
import { EditorialLayout } from "./EditorialLayout";
import { useUi } from "src/lib/portal/ui-text-client";

interface BrandBookClientProps {
  data: BrandGuidelineData;
  initialLayout: LayoutKind;
  /** Palette CSS variables, computed server-side from the brand's visualization colour. */
  paletteVars: Record<string, string>;
  /** Admin-config slice (sections, downloads, contact, columns) resolved server-side. */
  book: BookConfig;
}

export function BrandBookClient({ data, initialLayout, paletteVars, book }: BrandBookClientProps) {
  const t = useUi();
  const [layout, setLayout] = useState<LayoutKind>(initialLayout);
  const Shell = layout === "editorial" ? EditorialLayout : TabbedLayout;

  // A scoped style tag (not an inline style attr) so portaled UI — the PDF overlay, modals and
  // the copy toast, which mount their own .bgl-root on document.body — inherits the palette too.
  const paletteCss = `.bgl-root { ${Object.entries(paletteVars)
    .map(([k, v]) => `${k}: ${v};`)
    .join(" ")} --bgd-dodont-cols: ${book.doDontColumns}; }`;

  return (
    <div className="bgl-root">
      <style dangerouslySetInnerHTML={{ __html: paletteCss }} />
      <BookProvider book={book}>
        <div className="site-layout-toggle" role="group" aria-label={t("bbLayoutToggle")} style={{ marginBottom: 14, justifyContent: "flex-end" }}>
          <button type="button" className={layout === "tabbed" ? "active" : ""} aria-pressed={layout === "tabbed"} onClick={() => setLayout("tabbed")}>
            {t("bbTabbed")}
          </button>
          <button type="button" className={layout === "editorial" ? "active" : ""} aria-pressed={layout === "editorial"} onClick={() => setLayout("editorial")}>
            {t("bbEditorial")}
          </button>
        </div>
        <Shell data={data} />
      </BookProvider>
    </div>
  );
}
