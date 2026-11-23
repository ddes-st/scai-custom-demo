"use client";

import { useEffect } from "react";
import { getDirectionFromLocale } from "./locale-direction";

// The locale reaches us from the URL (`[locale]` route param), so treat
// it as untrusted before embedding it in an inline script. Real Sitecore
// locales are IETF-style tags ("en", "ar-AE", "zh-Hans-CN").
const SAFE_LOCALE_PATTERN = /^[a-zA-Z0-9-]{2,35}$/;

// Serialize for embedding inside a <script> body: JSON-escape, then
// escape `<` so a payload can never terminate the script element.
function toScriptLiteral(value: string): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

// Page-driven `<html lang dir>` synchronizer for the generated editing
// host. The root layout renders `<html>` before the catch-all page runs,
// so it can never know the active Sitecore locale (see locale-html.tsx).
// The catch-all page *does* know it — its `[locale]` route param — and
// renders this component with it.
//
// Two sync paths, both needed:
// - SSR/SSG first load: the inline `<script>` executes while the HTML
//   streams, flipping `lang`/`dir` before the page content below it is
//   painted — no LTR flash.
// - Client-side navigations (App Router locale switch without a full
//   document load): React does not execute script elements it inserts,
//   so the effect applies the attributes instead.
export function LocaleAttributes({ locale }: { locale: string }) {
  const validLocale = SAFE_LOCALE_PATTERN.test(locale) ? locale : null;
  const dir = validLocale ? getDirectionFromLocale(validLocale) : null;

  useEffect(() => {
    if (!validLocale || !dir) return;
    document.documentElement.lang = validLocale;
    document.documentElement.dir = dir;
  }, [validLocale, dir]);

  if (!validLocale || !dir) return null;

  const js = `document.documentElement.lang=${toScriptLiteral(
    validLocale,
  )};document.documentElement.dir=${toScriptLiteral(dir)};`;
  // biome-ignore lint/security/noDangerouslySetInnerHtml: locale is pattern-validated and JSON+`<`-escaped above; no user-authored markup can reach the script body
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
