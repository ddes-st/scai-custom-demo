"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useUi } from "src/lib/portal/ui-text-client";
import { useDialog } from "./useDialog";
import { arrowStep } from "./TabbedLayout";

// pdf.js v5 breaks when webpack processes it (dev and prod alike), so the library and its
// worker are served from /public (copied by scripts/copy-pdf-worker.mjs, in lockstep with the
// installed version) and imported NATIVELY in the browser — the bundler never sees them.
let pdfjsPromise: Promise<any> | null = null;
function getPdfjs(): Promise<any> {
  if (!pdfjsPromise) {
    pdfjsPromise = import(/* webpackIgnore: true */ "/pdf.min.mjs" as any).then((m: any) => {
      if (!m.GlobalWorkerOptions.workerSrc) m.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return m;
    });
  }
  return pdfjsPromise;
}

interface PdfPresentationProps {
  title: string;
  /** Same-origin (proxied) URL for PDF.js to fetch. */
  pdfUrl: string;
  /** Direct public link for the download button. */
  downloadUrl: string;
  onClose: () => void;
  /** Called when pdf.js cannot load/render the document — parent falls back to the iframe viewer. */
  onFallback: () => void;
}

interface PageCache {
  [page: number]: string;
}

export function PdfPresentation({ title, pdfUrl, downloadUrl, onClose, onFallback }: PdfPresentationProps) {
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [pageUrl, setPageUrl] = useState("");
  const t = useUi();
  // thumbnails render as their filmstrip slot scrolls into view (a 150-page book doesn't render 150 up front)
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const thumbQueue = useRef<number[]>([]);
  const thumbBusy = useRef(false);
  const thumbDone = useRef<Set<number>>(new Set());
  const filmRef = useRef<HTMLDivElement>(null);
  const dialogRef = useDialog(onClose);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<any>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const cacheRef = useRef<PageCache>({});
  const renderingRef = useRef<Set<number>>(new Set());
  const docRef = useRef<any>(null);
  const pageRef = useRef(1);
  pageRef.current = page;

  useEffect(() => {
    let cancelled = false;
    let task: any = null;
    void getPdfjs()
      .then((pdfjs) => {
        if (cancelled) return;
        // no eval of PDF-supplied code (font programs): defence in depth against malicious PDFs
        task = pdfjs.getDocument({ url: pdfUrl, isEvalSupported: false });
        task.onProgress = (p: any) => {
          if (p?.total) setProgress(Math.min(99, Math.round((p.loaded / p.total) * 100)));
        };
        return task.promise.then((d: any) => {
          if (cancelled) return void d.destroy();
          docRef.current = d;
          setDoc(d);
          setNumPages(d.numPages);
          setLoading(false);
        });
      })
      .catch(() => !cancelled && onFallback());
    return () => {
      cancelled = true;
      void task?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfUrl]);

  const renderPage = useCallback(async (pageNo: number): Promise<string | null> => {
    const d = docRef.current;
    const stage = stageRef.current;
    if (!d || !stage || pageNo < 1 || pageNo > d.numPages) return null;
    if (cacheRef.current[pageNo]) return cacheRef.current[pageNo];
    if (renderingRef.current.has(pageNo)) return null;
    renderingRef.current.add(pageNo);
    try {
      const p = await d.getPage(pageNo);
      const base = p.getViewport({ scale: 1 });
      const maxW = stage.clientWidth - 48;
      const maxH = stage.clientHeight - 24;
      const fit = Math.min(maxW / base.width, maxH / base.height);
      const scale = fit * Math.min(window.devicePixelRatio || 1, 2);
      const viewport = p.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await p.render({ canvasContext: canvas.getContext("2d")!, viewport, canvas }).promise;
      const url = canvas.toDataURL("image/jpeg", 0.92);
      cacheRef.current[pageNo] = url;
      return url;
    } catch {
      return null;
    } finally {
      renderingRef.current.delete(pageNo);
    }
  }, []);

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    void renderPage(page).then((url) => {
      if (!cancelled && url && pageRef.current === page) setPageUrl(url);
      void renderPage(page + 1);
      void renderPage(page - 1);
    });
    return () => {
      cancelled = true;
    };
  }, [doc, page, renderPage]);

  const pumpThumbs = useCallback(async () => {
    if (thumbBusy.current) return;
    thumbBusy.current = true;
    try {
      while (thumbQueue.current.length) {
        const i = thumbQueue.current.shift()!;
        const d = docRef.current;
        if (!d || thumbDone.current.has(i)) continue;
        thumbDone.current.add(i);
        try {
          const p = await d.getPage(i);
          const base = p.getViewport({ scale: 1 });
          const viewport = p.getViewport({ scale: 72 / base.height });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          await p.render({ canvasContext: canvas.getContext("2d")!, viewport, canvas }).promise;
          const url = canvas.toDataURL("image/jpeg", 0.8);
          setThumbs((m) => ({ ...m, [i]: url }));
        } catch {
          /* the slot keeps its page number */
        }
      }
    } finally {
      thumbBusy.current = false;
    }
  }, []);

  useEffect(() => {
    const strip = filmRef.current;
    if (!doc || !strip) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const n = Number((e.target as HTMLElement).dataset.page);
          if (e.isIntersecting && n && !thumbDone.current.has(n) && !thumbQueue.current.includes(n)) thumbQueue.current.push(n);
        }
        void pumpThumbs();
      },
      { root: strip, rootMargin: "0px 240px" },
    );
    strip.querySelectorAll("[data-page]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [doc, numPages, pumpThumbs]);

  const goTo = useCallback((n: number) => setPage(() => Math.max(1, Math.min(numPages || 1, n))), [numPages]);
  const next = useCallback(() => setPage((c) => Math.min(numPages || 1, c + 1)), [numPages]);
  const prev = useCallback(() => setPage((c) => Math.max(1, c - 1)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // in right-to-left pages ArrowLeft turns forward (Esc is the dialog's)
      const step = arrowStep(e, stageRef.current);
      if (step === 1 || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        next();
      } else if (step === -1 || e.key === "PageUp") {
        e.preventDefault();
        prev();
      } else if (e.key === "Home") {
        goTo(1);
      } else if (e.key === "End") {
        goTo(numPages);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, goTo, numPages]);

  return ReactDOM.createPortal(
    <div className="bgl-root">
      <div className="bgl-present-overlay" ref={dialogRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <div className="bgl-present-topbar">
          <div className="bgl-present-title">{title}</div>
          <div className="bgl-present-counter">{numPages > 0 ? `${page} / ${numPages}` : ""}</div>
          <div className="bgl-present-actions">
            {downloadUrl && (
              <a className="bgl-present-btn" href={downloadUrl} download title={t("bbPdfDownload")} aria-label={t("bbPdfDownload")}>
                ↓
              </a>
            )}
            <button type="button" className="bgl-present-btn" onClick={onClose} title={t("bbPdfClose")} aria-label={t("close")}>
              ✕
            </button>
          </div>
        </div>

        <div className="bgl-present-stage" ref={stageRef} onClick={next}>
          {loading && (
            <div className="bgl-present-loading" role="status">{t("bbPdfLoading")} {progress > 0 ? `${progress}%` : ""}</div>
          )}
          {pageUrl && <img key={page} src={pageUrl} className="bgl-present-page" alt={t("bbPdfPage", { page })} />}
          {page > 1 && (
            <button
              type="button"
              className="bgl-present-arrow left"
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
              title={t("bbPdfPrev")}
              aria-label={t("bbPdfPrev")}
            >
              ‹
            </button>
          )}
          {page < numPages && (
            <button
              type="button"
              className="bgl-present-arrow right"
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              title={t("bbPdfNext")}
              aria-label={t("bbPdfNext")}
            >
              ›
            </button>
          )}
        </div>

        {numPages > 1 && (
          <div className="bgl-present-filmstrip" ref={filmRef}>
            {Array.from({ length: numPages }, (_, i) => (
              <button
                key={i}
                type="button"
                data-page={i + 1}
                className={"bgl-present-thumb" + (page === i + 1 ? " active" : "")}
                onClick={() => goTo(i + 1)}
                title={t("bbPdfPage", { page: i + 1 })}
                aria-label={t("bbPdfPage", { page: i + 1 })}
                aria-current={page === i + 1 ? "page" : undefined}
              >
                {thumbs[i + 1] ? <img src={thumbs[i + 1]} alt="" /> : <span className="ph">{i + 1}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
