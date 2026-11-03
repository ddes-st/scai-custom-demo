"use client";
import React from "react";
import { CharacteristicItem, LayoutKind } from "src/lib/ch/types";
import { sanitizeHtml } from "../sanitize";
import { useSectionInfo } from "../BookContext";
import { PanelHead } from "./PanelHead";
import { useUi } from "src/lib/portal/ui-text-client";

interface CharacteristicsPanelProps {
  variant: LayoutKind;
  characteristics: CharacteristicItem[];
}

export function CharacteristicsPanel({ variant, characteristics }: CharacteristicsPanelProps) {
  const t = useUi();
  const sec = useSectionInfo("characteristics");
  return (
    <>
      <PanelHead
        variant={variant}
        number={sec.number}
        title={sec.label}
        description={t("bbDescCharacteristics")}
      />
      {characteristics.length === 0 ? (
        <div className="bgd-empty">
          <span className="bgd-mono-label">{sec.label}</span>
          <span className="headline">{t("bbEmptyCharacteristics")}</span>
          <span className="bgd-caption">{t("bbEmptyCharacteristicsHint")}</span>
        </div>
      ) : (
        <ol className="bgd-char-list">
          {characteristics.map((c, i) => (
            <li key={c.contentId} className="bgd-char-row">
              <span className="num" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h4 className="trait">{c.name}</h4>
              <div className="bgd-richtext desc" dangerouslySetInnerHTML={{ __html: sanitizeHtml(c.html) }} />
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
