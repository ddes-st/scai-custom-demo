"use client";

import { useEffect, useState } from "react";
import { sanitizeHtml } from "./sanitize";

/** The text of the HTML, for the server render (no DOMParser there): link previews, no-JS
 *  readers and the first paint get the words; the browser then swaps in the sanitized HTML. */
function plainText(html: string): string {
  return html
    .replace(/<(script|style|svg|math|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|blockquote)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .split(/\n+/).map((l) => l.trim()).filter(Boolean).join("\n\n");
}

/**
 * Content Hub rich text, sanitized in the browser (the sanitizer needs DOMParser) — the same
 * place the brand book panels clean theirs. Plain text renders as paragraphs.
 */
export function RichText({ html, className }: { html: string; className?: string }) {
  const isHtml = /<[a-z][\s\S]*>/i.test(html);
  const [clean, setClean] = useState<string | null>(null);
  useEffect(() => {
    setClean(isHtml ? sanitizeHtml(html) : "");
  }, [html, isHtml]);
  const cls = `bgd-richtext ${className ?? ""}`;
  if (clean) return <div className={cls} dangerouslySetInnerHTML={{ __html: clean }} />;
  // server render, first paint and plain text: escaped text paragraphs (React escapes)
  const text = isHtml ? plainText(html) : html;
  return (
    <div className={cls}>
      {text.split(/\n{2,}/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
    </div>
  );
}
