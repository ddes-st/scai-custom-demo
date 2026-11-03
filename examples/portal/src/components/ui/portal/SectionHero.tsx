import React from "react";

/** The section page's hero when a page has no PortalHero component (list components render it). */
export function SectionIntro({ eyebrow, title, lead, compact = true }: { eyebrow?: string; title?: string; lead?: string; compact?: boolean }) {
  if (!eyebrow && !title && !lead) return null;
  return (
    <div className={`site-index-hero${compact ? " compact" : ""}`}>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      {title && <h1>{title}</h1>}
      {lead && <p className="lead">{lead}</p>}
    </div>
  );
}
