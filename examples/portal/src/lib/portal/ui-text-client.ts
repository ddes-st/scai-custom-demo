"use client";
import { useMessages } from "next-intl";
import { flattenMessages, translator, type UiKey } from "./ui-keys";

/** UI strings for client components (same dictionary, delivered through NextIntlClientProvider). */
export function useUi(): (key: UiKey, vars?: Record<string, string | number>) => string {
  let messages: unknown = null;
  // always called (the try only catches a missing provider), so the hook order never changes
  // eslint-disable-next-line react-hooks/rules-of-hooks
  try { messages = useMessages(); } catch { messages = null; }
  return translator(flattenMessages(messages));
}
