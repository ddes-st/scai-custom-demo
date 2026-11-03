"use client";
import React from "react";
import ReactDOM from "react-dom";
import { useDialog } from "./useDialog";
import { useUi } from "src/lib/portal/ui-text-client";

interface ModalProps {
  title: string;
  wide?: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Modal({ title, wide, onClose, children, footer }: ModalProps) {
  const t = useUi();
  const ref = useDialog(onClose);
  return ReactDOM.createPortal(
    <div className="bgl-root">
      <div className="bgl-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div ref={ref} className={"bgl-modal" + (wide ? " wide" : "")} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
          <div className="bgl-modal-head">
            <h3 className="bgl-modal-title">{title}</h3>
            <button type="button" className="bgl-modal-close" onClick={onClose} aria-label={t("close")}>
              ×
            </button>
          </div>
          <div className="bgl-modal-body">{children}</div>
          {footer && <div className="bgl-modal-foot">{footer}</div>}
        </div>
      </div>
    </div>,
    document.body
  );
}
