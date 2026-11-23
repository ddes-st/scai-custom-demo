import type { LinkField, TextField } from "@sitecore-content-sdk/nextjs";
import { getFieldValue } from "lib/component-props";

/** Normalize authored or capture icon ids to Font Awesome brands kebab names. */
export function normalizeSocialFaIconName(raw: string | undefined | null): string {
  let value = (raw ?? "").trim().toLowerCase();
  if (!value) return "";
  if (value.startsWith("icon-")) value = value.slice(5);
  if (value === "x" || value === "twitter") return "x-twitter";
  if (value === "youtu" || value === "youtube-play") return "youtube";
  return value;
}

/**
 * Resolve Font Awesome brands icon name from Icon Link List GraphQL,
 * with label/href fallback for legacy content.
 */
export function resolveSocialFaIconName(options: {
  iconField?: unknown;
  linkField?: unknown;
}): string {
  const iconField = getFieldValue<TextField>(
    options.iconField as TextField | { jsonValue?: TextField } | null | undefined,
  );
  const authored =
    typeof iconField?.value === "string" ? iconField.value.trim() : "";
  const fromField = normalizeSocialFaIconName(authored);
  if (fromField) return fromField;

  const linkField =
    getFieldValue<LinkField>(
      options.linkField as LinkField | { jsonValue?: LinkField } | null | undefined,
    ) ?? (options.linkField as LinkField | null | undefined);

  const haystack =
    `${linkField?.value?.text ?? ""} ${linkField?.value?.href ?? ""}`.toLowerCase();
  if (haystack.includes("facebook")) return "facebook";
  if (haystack.includes("instagram")) return "instagram";
  if (haystack.includes("tiktok")) return "tiktok";
  if (haystack.includes("youtube") || haystack.includes("youtu")) return "youtube";
  if (haystack.includes("linkedin")) return "linkedin";
  if (haystack.includes("twitter") || /(?:^|[^\w])x(?:[^\w]|$)/.test(haystack))
    return "x-twitter";
  return "";
}
