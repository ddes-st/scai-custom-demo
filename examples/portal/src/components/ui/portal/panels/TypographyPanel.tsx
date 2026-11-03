"use client";
import React, { useEffect, useState } from "react";
import { FontAsset, LayoutKind } from "src/lib/ch/types";
import { fileExtension } from "src/lib/ch/format";
import { fontDisplayName, loadBrandFont, proxied } from "../fontLoader";
import { useBook, useSectionInfo } from "../BookContext";
import { PanelHead } from "./PanelHead";
import { useUi } from "src/lib/portal/ui-text-client";


interface TypographyPanelProps {
  variant: LayoutKind;
  fonts: FontAsset[];
}

export function TypographyPanel({ variant, fonts }: TypographyPanelProps) {
  const t = useUi();
  const DEFAULT_SAMPLE = t("bbSampleText");
  const [sample, setSample] = useState(DEFAULT_SAMPLE);
  const [loadedFamilies, setLoadedFamilies] = useState<Record<number, string>>({});
  const [fontErrors, setFontErrors] = useState<Record<number, string>>({});
  const sec = useSectionInfo("typography");
  const { downloads } = useBook();

  useEffect(() => {
    let cancelled = false;
    for (const f of fonts) {
      if (!f.url || loadedFamilies[f.assetId] || fontErrors[f.assetId]) continue;
      loadBrandFont(f.assetId, proxied(f.url))
        .then((family) => !cancelled && setLoadedFamilies((m) => ({ ...m, [f.assetId]: family })))
        .catch(() => !cancelled && setFontErrors((m) => ({ ...m, [f.assetId]: t("bbFontFailed") })));
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fonts]);

  const isBold = (f: FontAsset) => /bold/i.test(f.title) || /bold/i.test(f.fileName);
  const familyStyle = (f: FontAsset): React.CSSProperties => ({
    fontFamily: loadedFamilies[f.assetId] ? `"${loadedFamilies[f.assetId]}", sans-serif` : undefined,
    fontWeight: isBold(f) ? 700 : 400,
  });

  return (
    <>
      <PanelHead
        variant={variant}
        number={sec.number}
        title={sec.label}
        description={t("bbDescTypography")}
        actions={
          <input
            className="bgd-sample-input"
            value={sample}
            onChange={(e) => setSample(e.target.value)}
            placeholder={t("bbSamplePlaceholder")}
            aria-label={t("bbSampleLabel")}
          />
        }
      />
      {fonts.length === 0 ? (
        <div className="bgd-empty">
          <span className="bgd-mono-label">{sec.label}</span>
          <span className="headline">{t("bbEmptyTypography")}</span>
          <span className="bgd-caption">{t("bbEmptyTypographyHint")}</span>
        </div>
      ) : variant === "tabbed" ? (
        <div className="bgd-specimen-grid">
          {fonts.map((f) => (
            <div key={f.assetId} className="bgd-specimen">
              <div className="band" style={familyStyle(f)}>
                Aa
              </div>
              <div className="body">
                <span className="family">{fontDisplayName(f.fileName, f.title)}</span>
                <span className="weights">
                  {fileExtension(f.fileName)} · {isBold(f) ? t("bbBold") : t("bbRegular")}
                </span>
                <span className="sample" style={familyStyle(f)}>
                  {sample || DEFAULT_SAMPLE}
                </span>
                {fontErrors[f.assetId] && <span className="bgd-caption">{fontErrors[f.assetId]}</span>}
                <span className="rule">
                  <span>{t("bbLicensed")}</span>
                  {f.url && downloads && (
                    <a href={f.url} download data-track={f.assetId} data-track-title={f.title}>
                      {t("download")} ↓
                    </a>
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {fonts.map((f) => (
            <div key={f.assetId} className="bgd-typerow">
              <div className="aa" style={familyStyle(f)}>
                Aa
              </div>
              <div>
                <span style={{ fontSize: 17, fontWeight: 500 }}>
                  {fontDisplayName(f.fileName, f.title)}{" "}
                  <span className="bgd-mono-label" style={{ marginLeft: 8 }}>
                    {isBold(f) ? t("bbBold") : t("bbRegular")}
                  </span>
                </span>
                <div className="sample" style={{ ...familyStyle(f), fontSize: 20, lineHeight: 1.45, margin: "8px 0 6px" }}>
                  {sample || DEFAULT_SAMPLE}
                </div>
                {fontErrors[f.assetId] && <span className="bgd-caption">{fontErrors[f.assetId]}</span>}
              </div>
              <div className="metrics">
                {t("bbFormat")} {fileExtension(f.fileName)}
                <br />
                {t("bbWeight")} {isBold(f) ? "700" : "400"}
                <br />
                {f.url && downloads && (
                  <a href={f.url} download data-track={f.assetId} data-track-title={f.title}>
                    {t("bbDownloadFamily")} ↓
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
