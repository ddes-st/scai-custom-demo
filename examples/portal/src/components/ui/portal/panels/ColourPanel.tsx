"use client";
import React from "react";
import { BrandColorAsset, LayoutKind } from "src/lib/ch/types";
import { contrastColor, hexToRgb } from "src/lib/ch/colorService";
import { CopyToast, useCopyToClipboard } from "../CopyToast";
import { useSectionInfo } from "../BookContext";
import { PanelHead } from "./PanelHead";
import { useUi } from "src/lib/portal/ui-text-client";

interface ColourPanelProps {
  variant: LayoutKind;
  colors: BrandColorAsset[];
}

export function ColourPanel({ variant, colors }: ColourPanelProps) {
  const t = useUi();
  const { copied, copy } = useCopyToClipboard();
  const sec = useSectionInfo("colour");
  const loaded = colors.filter((c) => c.color);

  return (
    <>
      <PanelHead
        variant={variant}
        number={sec.number}
        title={sec.label}
        description={t("bbDescColour")}
      />
      {loaded.length === 0 ? (
        <div className="bgd-empty">
          <span className="bgd-mono-label">{sec.label}</span>
          <span className="headline">{t("bbEmptyColour")}</span>
          <span className="bgd-caption">{t("bbEmptyColourHint")}</span>
        </div>
      ) : variant === "tabbed" ? (
        <div className="bgd-swatch-grid">
          {loaded.map((c, i) => {
            const col = c.color!;
            const rgb = col.rgbValue || hexToRgb(col.hexValue)!;
            const fg = contrastColor(rgb);
            const isLight = (rgb.red + rgb.green + rgb.blue) / 3 > 225;
            return (
              <div
                key={c.assetId}
                className="bgd-swatch"
                style={{
                  background: col.hexValue,
                  color: fg,
                  border: isLight ? "1px solid var(--bgd-border)" : "none",
                }}
              >
                <button className="copy" onClick={() => copy(col.hexValue)} aria-label={t("bbCopyColour", { name: col.name, hex: col.hexValue })}>
                  <span className="cat">{String(i + 1).padStart(2, "0")}</span>
                  <span>
                    <span className="name" style={{ display: "block" }}>
                      {col.name}
                    </span>
                    <span className="hex" style={{ display: "block" }}>
                      {col.hexValue}
                      {col.pantone ? ` · PMS ${col.pantone}` : ""}
                    </span>
                    {col.colorDescription && col.colorDescription !== col.name && (
                      <span className="note" style={{ display: "block" }}>
                        {col.colorDescription}
                      </span>
                    )}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bgd-swatch-grid">
          {loaded.map((c) => {
            const col = c.color!;
            const rgb = col.rgbValue || hexToRgb(col.hexValue)!;
            return (
              <div key={c.assetId} className="bgd-colorcard">
                <button className="copy" onClick={() => copy(col.hexValue)} aria-label={t("bbCopyColour", { name: col.name, hex: col.hexValue })}>
                  <span className="block" style={{ background: col.hexValue }} />
                  <span className="info">
                    <span className="toprow">
                      <span className="name">{col.name}</span>
                      <span className="hex">{col.hexValue}</span>
                    </span>
                    {col.colorDescription && col.colorDescription !== col.name && (
                      <span className="usage">{col.colorDescription}</span>
                    )}
                    <span className="values">
                      R{rgb.red} G{rgb.green} B{rgb.blue}
                      {col.pantone ? ` · PMS ${col.pantone}` : ""}
                    </span>
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}
      <CopyToast copied={copied} />
    </>
  );
}
