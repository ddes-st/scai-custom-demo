"use client";
import React, { useState } from "react";
import { LayoutKind, LogoAsset } from "src/lib/ch/types";
import { fileExtension } from "src/lib/ch/format";
import { useBook, useSectionInfo } from "../BookContext";
import { PanelHead } from "./PanelHead";
import { RetryImage } from "../RetryImage";
import { useUi } from "src/lib/portal/ui-text-client";

interface LogoPanelProps {
  variant: LayoutKind;
  logos: LogoAsset[];
}

export function LogoPanel({ variant, logos }: LogoPanelProps) {
  const t = useUi();
  const [dark, setDark] = useState(false);
  const sec = useSectionInfo("logo");
  const { downloads } = useBook();

  return (
    <>
      <PanelHead
        variant={variant}
        number={sec.number}
        title={sec.label}
        description={t("bbDescLogo")}
        actions={
          logos.length > 0 ? (
            <button type="button" className="bgd-pill" aria-pressed={dark} onClick={() => setDark((d) => !d)}>
              {dark ? t("bbPreviewLight") : t("bbPreviewDark")}
            </button>
          ) : undefined
        }
      />
      {logos.length === 0 ? (
        <div className="bgd-empty">
          <span className="bgd-mono-label">{sec.label}</span>
          <span className="headline">{t("bbEmptyLogo")}</span>
          <span className="bgd-caption">{t("bbEmptyLogoHint")}</span>
        </div>
      ) : (
        <div className="bgd-logo-grid">
          {logos.map((l) => (
            <div key={l.assetId} className="bgd-lockup">
              <div className={"preview" + (dark ? " dark" : "")}>
                {l.url ? (
                  <RetryImage src={l.url} alt={l.title} loading="lazy" />
                ) : (
                  <span className="bgd-caption">{t("bbNoPublicLinkYet")}</span>
                )}
              </div>
              <div className="strip">
                <span className="name" title={l.title}>
                  {l.title}
                </span>
                <span className="formats">
                  <span>{fileExtension(l.fileName)}</span>
                  {l.url && downloads && (
                    <a href={l.url} download data-track={l.assetId} data-track-title={l.title}>
                      {t("download")} ↓
                    </a>
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
