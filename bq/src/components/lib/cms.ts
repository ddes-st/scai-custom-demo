import type { ComponentParams, ComponentRendering } from "@sitecore-content-sdk/nextjs";

/**
 * Optional CMS / Storybook bridge props.
 * Prefer injecting `isEditing` so Storybook never needs Sitecore context.
 */
export type CmsProps = {
  isEditing?: boolean;
  rendering?: ComponentRendering;
  params?: ComponentParams;
  styles?: string;
  id?: string;
};

export function isEnabled(value: string | boolean | undefined): boolean {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

const BUTTON_VARIANTS = new Set([
  "default",
  "outline",
  "secondary",
  "ghost",
  "destructive",
  "link",
]);

export function parseButtonVariant(
  value: string | undefined,
): "default" | "outline" | "secondary" | "ghost" | "destructive" | "link" {
  const normalized = value?.trim().toLowerCase() ?? "default";
  if (BUTTON_VARIANTS.has(normalized)) {
    return normalized as
      | "default"
      | "outline"
      | "secondary"
      | "ghost"
      | "destructive"
      | "link";
  }
  return "default";
}
