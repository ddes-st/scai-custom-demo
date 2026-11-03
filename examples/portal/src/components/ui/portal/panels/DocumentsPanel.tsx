"use client";
import React, { useState } from "react";
import { GuidelineAsset, LayoutKind } from "src/lib/ch/types";
import { fileExtension, formatBytes, formatDate } from "src/lib/ch/format";
import { proxied } from "../fontLoader";
import { Modal } from "../Modal";
import { PdfPresentation } from "../PdfPresentation";
import { useBook, useSectionInfo } from "../BookContext";
import { PanelHead } from "./PanelHead";
import { useLocale } from "next-intl";
import { useUi } from "src/lib/portal/ui-text-client";

interface DocumentsPanelProps {
  variant: LayoutKind;
  guidelines: GuidelineAsset[];
}

export function DocumentsPanel({ variant, guidelines }: DocumentsPanelProps) {
  const t = useUi();
  const locale = useLocale();
  const [viewing, setViewing] = useState<GuidelineAsset | null>(null);
  const [fallback, setFallback] = useState(false);
  const sec = useSectionInfo("documents");
  const { downloads } = useBook();

  const open = (g: GuidelineAsset) => {
    if (!g.url) return;
    setFallback(false);
    setViewing(g);
  };

  const meta = (g: GuidelineAsset) => [formatBytes(g.sizeBytes), formatDate(g.updatedAt, locale)].filter(Boolean).join(" · ");

  const empty = (
    <div className={"bgd-empty" + (variant === "editorial" ? " inverse" : "")}>
      <span className="bgd-mono-label">{sec.label}</span>
      <span className="headline">{t("bbEmptyDocuments")}</span>
      <span className="bgd-caption">{t("bbEmptyDocumentsHint")}</span>
    </div>
  );

  const viewer = viewing && (
    <>
      {!fallback && (
        <PdfPresentation
          title={viewing.title}
          pdfUrl={proxied(viewing.url)}
          downloadUrl={viewing.url}
          onClose={() => setViewing(null)}
          onFallback={() => setFallback(true)}
        />
      )}
      {fallback && (
        <Modal title={viewing.title} wide onClose={() => setViewing(null)}>
          <iframe src={proxied(viewing.url)} title={viewing.title} />
        </Modal>
      )}
    </>
  );

  if (variant === "editorial") {
    return (
      <div className="bgd-docs-band" id="bgd-docs">
        <div className="bgd-section-head">
          <div>
            <span className="bgd-section-no">{sec.number}</span>
            <h3 className="bgd-section-title">{sec.label}</h3>
          </div>
          <p className="bgd-section-desc">{downloads ? t("bbDescDocumentsDownload") : t("bbDescDocuments")}</p>
        </div>
        {guidelines.length === 0 ? (
          empty
        ) : (
          <div>
            {guidelines.map((g) => (
              <div key={g.assetId} className="bgd-doc-row" onClick={() => open(g)}>
                <span className="bgd-badge badge">{fileExtension(g.fileName)}</span>
                <span>
                  <span className="title" style={{ display: "block" }}>
                    {g.title}
                  </span>
                  <span className="sub">{g.fileName}</span>
                </span>
                <span className="m hide-narrow">{formatDate(g.updatedAt, locale)}</span>
                <span className="m hide-narrow">{formatBytes(g.sizeBytes)}</span>
                <span className="act">
                  {g.url ? (
                    <button type="button" onClick={(e) => (e.stopPropagation(), open(g))} aria-label={`${t("bbOpenDoc")}: ${g.title}`}>
                      {t("bbOpenDoc")} ↗
                    </button>
                  ) : t("bbNoLink")}
                </span>
              </div>
            ))}
          </div>
        )}
        {viewer}
      </div>
    );
  }

  return (
    <>
      <PanelHead
        variant={variant}
        number={sec.number}
        title={sec.label}
        description={downloads ? t("bbDescDocumentsDownload") : t("bbDescDocuments")}
      />
      {guidelines.length === 0 ? (
        empty
      ) : (
        <div className="bgd-doc-grid">
          {guidelines.map((g) => (
            <div key={g.assetId} className="bgd-doc-card" onClick={() => open(g)}>
              <div className="bgd-doc-top">
                <span className="bgd-badge">{fileExtension(g.fileName)}</span>
              </div>
              <div className="bgd-doc-titleblock">
                <h4 className="bgd-doc-title">{g.title}</h4>
                <div className="bgd-caption">{g.fileName}</div>
              </div>
              <div className="bgd-doc-foot">
                <span className="bgd-doc-meta">{meta(g)}</span>
                <span className="bgd-doc-actions">
                  {g.url ? (
                    <>
                      <button type="button" onClick={(e) => (e.stopPropagation(), open(g))} aria-label={`${t("bbOpenDoc")}: ${g.title}`}>{t("bbOpenDoc")} ↗</button>
                      {downloads && (
                        <a href={g.url} download data-track={g.assetId} data-track-title={g.title} onClick={(e) => e.stopPropagation()}>
                          {t("download")} ↓
                        </a>
                      )}
                    </>
                  ) : (
                    <span className="bgd-doc-meta">{t("bbNoPublicLinkYet")}</span>
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      {viewer}
    </>
  );
}
