"use client";
import React, { useState } from "react";
import { LayoutKind, PersonaItem } from "src/lib/ch/types";
import { sanitizeHtml } from "../sanitize";
import { useSectionInfo } from "../BookContext";
import { PanelHead } from "./PanelHead";
import { RetryImage } from "../RetryImage";
import { useUi } from "src/lib/portal/ui-text-client";

interface PersonasPanelProps {
  variant: LayoutKind;
  personas: PersonaItem[];
}

function PersonaCard({ persona }: { persona: PersonaItem }) {
  const t = useUi();
  const [expanded, setExpanded] = useState(false);
  const hasDetails = !!persona.detailsHtml;
  const regionId = `bgd-persona-details-${persona.contentId}`;

  return (
    <div className={"bgd-persona-card" + (expanded ? " expanded" : "")}>
      <div className="portrait">
        {persona.imageUrl ? (
          <RetryImage src={persona.imageUrl} alt={persona.name} />
        ) : (
          <span className="bgd-caption">{t("bbNoImageYet")}</span>
        )}
      </div>
      <div className="body">
        <button type="button" className="head" aria-expanded={expanded} aria-controls={regionId} disabled={!hasDetails} onClick={() => hasDetails && setExpanded((e) => !e)}>
          <span className="text">
            <span className="persona-name">{persona.name}</span>
            {persona.tagLine && <span className="tagline">{persona.tagLine}</span>}
          </span>
          {hasDetails && (
            <span className="chev" aria-hidden="true">
              ⌄
            </span>
          )}
        </button>
        {hasDetails && (
          <div className="reveal" id={regionId} role="region" aria-label={t("bbPersonaDetails", { name: persona.name })}>
            <div className="reveal-inner">
              <div
                className="bgd-richtext details"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(persona.detailsHtml) }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function PersonasPanel({ variant, personas }: PersonasPanelProps) {
  const t = useUi();
  const sec = useSectionInfo("personas");
  return (
    <>
      <PanelHead
        variant={variant}
        number={sec.number}
        title={sec.label}
        description={t("bbDescPersonas")}
      />
      {personas.length === 0 ? (
        <div className="bgd-empty">
          <span className="bgd-mono-label">{sec.label}</span>
          <span className="headline">{t("bbEmptyPersonas")}</span>
          <span className="bgd-caption">{t("bbEmptyPersonasHint")}</span>
        </div>
      ) : (
        <div className="bgd-persona-grid">
          {personas.map((p) => (
            <PersonaCard key={p.contentId} persona={p} />
          ))}
        </div>
      )}
    </>
  );
}
