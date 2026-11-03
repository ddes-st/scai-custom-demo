import React from "react";
import { LayoutKind } from "src/lib/ch/types";

interface PanelHeadProps {
  variant: LayoutKind;
  /** Section number in the editorial shell, e.g. "01". */
  number: string;
  title: string;
  description: string;
  /** Action buttons (theme-bound .bgl-btn etc.) shown in the header row. */
  actions?: React.ReactNode;
}

/**
 * One header, two shells: the tabbed panel header row (serif title left, description +
 * actions right) or the editorial numbered section header with an actions row beneath.
 */
export function PanelHead({ variant, number, title, description, actions }: PanelHeadProps) {
  if (variant === "tabbed") {
    return (
      <div className="bgd-panel-head">
        <h3 className="bgd-panel-title">{title}</h3>
        <div className="bgd-panel-side">
          <span className="bgd-body-small">{description}</span>
          {actions}
        </div>
      </div>
    );
  }
  return (
    <div className="bgd-section-head">
      <div>
        <span className="bgd-section-no">{number}</span>
        <h3 className="bgd-section-title">{title}</h3>
      </div>
      <div>
        <p className="bgd-section-desc">{description}</p>
        {actions && <div className="bgd-section-actions">{actions}</div>}
      </div>
    </div>
  );
}
