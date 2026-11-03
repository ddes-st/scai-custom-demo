import React from "react";
import { sanitizeHtmlServer } from "src/lib/ch/sanitize.server";

/**
 * Content Hub rich text sanitized on the server (allowlist in ui/portal/sanitize.ts run
 * through linkedom), so the first HTML byte is clean. Plain text renders as paragraphs.
 */
export function RichTextServer({ html, className }: { html: string; className?: string }) {
  const cls = `bgd-richtext ${className ?? ""}`;
  if (!html) return null;
  if (/<[a-z][\s\S]*>/i.test(html)) {
    return <div className={cls} dangerouslySetInnerHTML={{ __html: sanitizeHtmlServer(html) }} />;
  }
  return (
    <div className={cls}>
      {html.split(/\n{2,}/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
    </div>
  );
}
