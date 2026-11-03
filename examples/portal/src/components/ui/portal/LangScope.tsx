import React from "react";
import { isRtl } from "src/lib/portal/rtl";

/**
 * The page's language and writing direction on the server-rendered markup: a wrapper that
 * takes no box (display: contents) but gives everything inside lang and dir — CSS logical
 * properties, [dir="rtl"] rules and screen readers follow it before any script runs.
 */
export function LangScope({ lang, children }: { lang: string; children: React.ReactNode }) {
  return (
    <div lang={lang || undefined} dir={isRtl(lang) ? "rtl" : "ltr"} style={{ display: "contents" }}>
      {children}
    </div>
  );
}
