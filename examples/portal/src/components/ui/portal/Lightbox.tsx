"use client";

/**
 * The media lightbox: a large preview of one asset with previous / next through the list it
 * was opened from (arrow buttons, ← / → keys, swipe), Esc or the backdrop to close.
 * Images show the preview at once and swap to the original when that has loaded (web formats
 * only); videos play; other files show their preview (first page) with the download.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { imageFromOrigin } from "src/lib/ch/fileUrl";
import ReactDOM from "react-dom";
import type { MediaItem } from "src/lib/ch/media";
import { trackPreview } from "./UsageTracker";
import { useUi } from "src/lib/portal/ui-text-client";
import { useDialog } from "./useDialog";
import { arrowStep } from "./TabbedLayout";

const WEB_IMAGE = /\.(jpe?g|png|gif|webp|avif)$/i;

function sizeLabel(mb?: number) {
  if (!mb) return "";
  return `${mb < 1 ? mb.toFixed(2) : mb.toFixed(1)} MB`;
}

export function Lightbox({ items, index, onIndex, onClose, track }: {
  items: MediaItem[]; index: number; onIndex: (i: number) => void; onClose: () => void; track?: boolean;
}) {
  const t = useUi();
  const item = items[index];
  const count = items.length;
  const [sharp, setSharp] = useState<string>("");
  const touch = useRef<{ x: number; y: number } | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const go = useCallback((d: number) => { if (count > 1) onIndex((index + d + count) % count); }, [index, count, onIndex]);
  // focus, Tab, Esc, scroll lock and focus return: once per opening (not on every next/previous)
  const dialogRef = useDialog(onClose, closeRef);
  const goRef = useRef(go);
  useEffect(() => { goRef.current = go; }, [go]);

  // ← / → (mirrored in right-to-left pages)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const step = arrowStep(e, dialogRef.current);
      if (step) goRef.current(step);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dialogRef]);

  // the original once it has loaded (images in a web format), the neighbours' previews ahead
  useEffect(() => {
    setSharp("");
    if (!item) return;
    if (track) trackPreview(item.id, item.title);
    let alive = true;
    if (item.kind === "image" && item.download && WEB_IMAGE.test(item.fileName) && item.download !== item.preview) {
      const img = new Image();
      img.onload = () => { if (alive) setSharp(item.download); };
      img.src = item.download;
    }
    for (const d of [1, -1]) {
      const n = items[(index + d + count) % count];
      if (n?.preview) { const p = new Image(); p.src = n.preview; }
    }
    return () => { alive = false; };
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return null;
  const ext = (item.fileName.split(".").pop() || item.kind).toUpperCase();
  // the preview from the live portal on an editing host (fileUrl.imageOrigin); the sharp original stays here
  const src = sharp || imageFromOrigin(item.preview);

  return ReactDOM.createPortal(
    <div
      ref={dialogRef}
      className="portal-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchEnd={(e) => {
        const t = touch.current; touch.current = null;
        if (!t) return;
        const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y;
        // a swipe toward the start of the line goes forward (left in LTR, right in RTL)
        const rtl = !!dialogRef.current && getComputedStyle(dialogRef.current).direction === "rtl";
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go((dx < 0) !== rtl ? 1 : -1);
      }}
    >
      <div className="bar">
        <div className="info">
          <span className="name">{item.title}</span>
          <span className="sub">{[item.brands[0], item.collections[0], ext, sizeLabel(item.sizeMb)].filter(Boolean).join(" · ")}</span>
        </div>
        <span className="count">{index + 1} / {count}</span>
        {item.download && (
          <a className="dl" href={item.download} target="_blank" rel="noreferrer" download data-track={item.id} data-track-title={item.title}>{t("download")}</a>
        )}
        <button ref={closeRef} type="button" className="x" onClick={onClose} aria-label={t("close")}>×</button>
      </div>

      <div className="stage" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        {item.kind === "video" && item.download ? (
          <video key={item.id} src={item.download} poster={item.preview || undefined} controls playsInline preload="metadata" />
        ) : src ? (
          <img key={item.id} src={src} alt={item.title} className={sharp ? "sharp" : undefined} />
        ) : (
          <div className="file"><span className="ext">{ext}</span><span>{t("noPreview")}</span></div>
        )}
      </div>

      {count > 1 && (
        <>
          <button type="button" className="nav prev" onClick={() => go(-1)} aria-label={t("previous")}>‹</button>
          <button type="button" className="nav next" onClick={() => go(1)} aria-label={t("next")}>›</button>
        </>
      )}
    </div>,
    document.body,
  );
}
