"use client";
import { useEffect } from "react";

import { isRtl } from "src/lib/portal/rtl";

/**
 * Sets <html lang> and <html dir> to the page's language after hydration (the root layout
 * renders before the locale is known). The page's content already carries both from the
 * server (LangScope), so an Arabic page is laid out right to left from the first paint.
 */
export function HtmlLang({ lang }: { lang: string }) {
  useEffect(() => {
    if (!lang) return;
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr";
  }, [lang]);
  return null;
}
