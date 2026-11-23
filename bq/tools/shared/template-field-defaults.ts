import type { DataFieldDef } from "../definitions/types";
import { encodeGeneralLink, type GeneralLinkInput } from "./naming";

/**
 * Thin std-value / default encoder kept for simple string/bool/number cases and
 * tests. Rendering, parameters, and data std values go through
 * {@link resolveSiteContentFieldValue} via `collectStandardValueFields`.
 */
export function encodeTemplateFieldDefault(
  field: DataFieldDef,
): string | undefined {
  if (field.default === undefined || field.default === null) return undefined;
  if (typeof field.default === "boolean") {
    return field.default ? "1" : "";
  }
  if (typeof field.default === "number") {
    return String(field.default);
  }
  if (field.type === "General Link") {
    if (
      typeof field.default === "string" ||
      (typeof field.default === "object" &&
        field.default !== null &&
        "url" in field.default)
    ) {
      return encodeGeneralLink(field.default as string | GeneralLinkInput);
    }
  }
  if (typeof field.default === "string") {
    return field.default;
  }
  return undefined;
}

export type MultilineFieldValueOptions = {
  /** Sitecore field type string (e.g. `Rich Text`, `Multilist`). */
  fieldType?: string;
  /**
   * When true, also treat types containing `multi` or `rich` as multiline
   * (data / site-content heuristic). Rendering/parameters leave this false.
   */
  richTypeHeuristic?: boolean;
};

/**
 * Whether a field value should be emitted as a YAML `|` block.
 * Thin mode (default): newlines or XML-ish values starting with `<`.
 * Rich mode: also multilist / rich text field types.
 */
export function isMultilineFieldValue(
  value: string,
  options?: MultilineFieldValueOptions,
): boolean {
  if (value.includes("\n") || value.startsWith("<")) return true;
  if (options?.richTypeHeuristic && options.fieldType) {
    const type = options.fieldType.toLowerCase();
    return type.includes("multi") || type.includes("rich");
  }
  return false;
}
