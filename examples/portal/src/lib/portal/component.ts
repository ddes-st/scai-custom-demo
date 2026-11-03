import type { ComponentRendering, Page } from "@sitecore-content-sdk/nextjs";
import type { ComponentProps } from "lib/component-props";

/** Props every Portal rendering receives from AppPlaceholder (fields of the datasource or page). */
export type PortalComponentProps = ComponentProps & {
  rendering: ComponentRendering;
  fields?: Record<string, unknown>;
};

/** The datasource (or context item) fields of a rendering. */
export function fieldsOf(props: PortalComponentProps): Record<string, any> {
  return (props.fields ?? props.rendering?.fields ?? {}) as Record<string, any>;
}

/** The page item's fields (Portal page templates: Eyebrow, Title, Lead, Blurb, NavLabel, DetailKind). */
export function routeFields(page: Page): Record<string, any> {
  return (page.layout.sitecore.route?.fields ?? {}) as Record<string, any>;
}

export const isEditing = (page: Page) => page.mode.isEditing || page.mode.isDesignLibrary;

/** A rendering parameter as a string. */
export function param(props: PortalComponentProps, name: string): string {
  const v = (props.params as Record<string, unknown> | undefined)?.[name];
  return typeof v === "string" ? v.trim() : "";
}

/** The SXA styles / grid classes authors set in the Page builder, plus the rendering id. */
export function chrome(props: PortalComponentProps): { className: string; id?: string } {
  const styles = param(props, "styles");
  const id = param(props, "RenderingIdentifier");
  return { className: styles, ...(id ? { id } : {}) };
}
