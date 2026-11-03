"use client";
import React from "react";
import { LayoutKind, TemplateAsset } from "src/lib/ch/types";
import { formatBytes } from "src/lib/ch/format";
import { fileTypeMeta } from "src/lib/ch/fileTypes";
import { useBook, useSectionInfo } from "../BookContext";
import { PanelHead } from "./PanelHead";
import { useUi } from "src/lib/portal/ui-text-client";

interface TemplatesPanelProps {
  variant: LayoutKind;
  templates: TemplateAsset[];
}

function FileGlyph({ ext }: { ext: string }) {
  return (
    <span className="glyph">
      <svg viewBox="0 0 40 50" aria-hidden="true">
        <path
          d="M4 1.5h20.5L38.5 15v33a2.5 2.5 0 0 1-2.5 2.5H4A2.5 2.5 0 0 1 1.5 48V4A2.5 2.5 0 0 1 4 1.5z"
          fill="currentColor"
          fillOpacity="0.14"
          stroke="currentColor"
          strokeOpacity="0.5"
          strokeWidth="1.5"
        />
        <path d="M24.5 1.5L38.5 15H27a2.5 2.5 0 0 1-2.5-2.5V1.5z" fill="currentColor" fillOpacity="0.4" />
      </svg>
      <span className="ext">{ext}</span>
    </span>
  );
}

export function TemplatesPanel({ variant, templates }: TemplatesPanelProps) {
  const t = useUi();
  const sec = useSectionInfo("templates");
  const { downloads } = useBook();
  return (
    <>
      <PanelHead
        variant={variant}
        number={sec.number}
        title={sec.label}
        description={t("bbDescTemplates")}
      />
      {templates.length === 0 ? (
        <div className="bgd-empty">
          <span className="bgd-mono-label">{sec.label}</span>
          <span className="headline">{t("bbEmptyTemplates")}</span>
          <span className="bgd-caption">{t("bbEmptyTemplatesHint")}</span>
        </div>
      ) : (
        <div className="bgd-file-grid">
          {templates.map((tpl) => {
            const meta = fileTypeMeta(tpl.fileName);
            const size = formatBytes(tpl.sizeBytes);
            const canDownload = !!tpl.url && downloads;
            const body = (
              <>
                <FileGlyph ext={meta.ext} />
                <span className="info">
                  <span className="name">{tpl.title}</span>
                  <span className="sub">{meta.label}</span>
                  <span className="foot">
                    {size && <span className="size">{size}</span>}
                    <span className="action">
                      {canDownload ? `${t("download")} ↓` : downloads ? t("bbNoLink") : t("bbDownloadsOff")}
                    </span>
                  </span>
                </span>
              </>
            );
            return canDownload ? (
              <a
                key={tpl.assetId}
                className="bgd-file-card"
                data-kind={meta.kind}
                href={tpl.url}
                data-track={tpl.assetId}
                data-track-title={tpl.title}
                download
                title={t("bbDownloadFile", { name: tpl.fileName })}
              >
                {body}
              </a>
            ) : (
              <span key={tpl.assetId} className="bgd-file-card" data-kind={meta.kind} aria-disabled="true">
                {body}
              </span>
            );
          })}
        </div>
      )}
    </>
  );
}
