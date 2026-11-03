"use client";
import React, { useState } from "react";
import { DoDontItem, LayoutKind } from "src/lib/ch/types";
import { sanitizeHtml } from "../sanitize";
import { useSectionInfo } from "../BookContext";
import { PanelHead } from "./PanelHead";
import { RetryImage } from "../RetryImage";
import { useUi } from "src/lib/portal/ui-text-client";

interface DoDontPanelProps {
  variant: LayoutKind;
  items: DoDontItem[];
}

function DoDontRow({ item }: { item: DoDontItem }) {
  const t = useUi();
  const [expanded, setExpanded] = useState(false);
  const hasDetail = !!item.html || !!item.imageUrl;
  const regionId = `bgd-dodont-detail-${item.contentId}`;

  return (
    <div className={"bgd-dodont-row" + (item.isDont ? " dont" : "") + (expanded ? " expanded" : "")}>
      <button type="button" className="head" aria-expanded={expanded} aria-controls={regionId} disabled={!hasDetail} onClick={() => hasDetail && setExpanded((e) => !e)}>
        <span className="bgd-dodont-badge">{item.isDont ? t("bbDont") : t("bbDo")}</span>
        <span className="summary">{item.summary}</span>
        {hasDetail && (
          <span className="chev" aria-hidden="true">
            ⌄
          </span>
        )}
      </button>
      {hasDetail && (
        <div className="reveal" id={regionId} role="region" aria-label={item.summary}>
          <div className="reveal-inner">
            <div className="detail">
              {item.imageUrl && (
                <span className="shot">
                  <RetryImage src={item.imageUrl} alt={`${item.isDont ? t("bbDont") : t("bbDo")}: ${item.name}`} loading="lazy" />
                </span>
              )}
              <div className="copy">
                <div className="bgd-richtext" dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.html) }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function DoDontPanel({ variant, items }: DoDontPanelProps) {
  const t = useUi();
  const sec = useSectionInfo("dodont");
  return (
    <>
      <PanelHead
        variant={variant}
        number={sec.number}
        title={sec.label}
        description={t("bbDescDodont")}
      />
      {items.length === 0 ? (
        <div className="bgd-empty">
          <span className="bgd-mono-label">{sec.label}</span>
          <span className="headline">{t("bbEmptyDodont")}</span>
          <span className="bgd-caption">{t("bbEmptyDodontHint")}</span>
        </div>
      ) : (
        <div className="bgd-dodont-list">
          {items.map((d) => (
            <DoDontRow key={d.contentId} item={d} />
          ))}
        </div>
      )}
    </>
  );
}
