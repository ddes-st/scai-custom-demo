import type {
  ComponentParams,
  ComponentRendering,
  HTMLLink,
  ImageField,
  LayoutServiceData,
  LinkField,
  LinkFieldValue,
  Page,
  RichTextField,
  Field as SdkField,
  TextField as SdkTextField,
} from "@sitecore-content-sdk/nextjs";
import {
  CdpHelper,
  AppPlaceholder as SdkAppPlaceholder,
  DateField as SdkDateField,
  Placeholder as SdkPlaceholder,
  SitecoreProvider as SdkSitecoreProvider,
  useSitecore as sdkUseSitecore,
  withDatasourceCheck as sdkWithDatasourceCheck,
} from "@sitecore-content-sdk/nextjs";

export const Placeholder = SdkPlaceholder;
export const AppPlaceholder = SdkAppPlaceholder;
export const DateField = SdkDateField;
export const useSitecore = sdkUseSitecore;
export const withDatasourceCheck = sdkWithDatasourceCheck;
export const SitecoreProvider = SdkSitecoreProvider;
export { CdpHelper };

export type TextField = Omit<SdkTextField, "value"> & { value?: string };
export type Field<T> = SdkField<T> | TextField;

export type {
  ComponentParams,
  ComponentRendering,
  HTMLLink,
  ImageField,
  LayoutServiceData,
  LinkField,
  LinkFieldValue,
  Page,
  RichTextField,
};

/**
 * Forever props every CMS-registered component receives. The `withSitecore`
 * adapter populates each of these from the layout-service envelope:
 *
 *   isEditing   resolved at the rendering boundary; passed through always.
 *   id          `params.RenderingIdentifier` — the per-instance DOM id Sitecore
 *               uses for in-page anchor links and Pages-side targeting.
 *   styles      `params.styles` — the SXA-computed class string assembled by
 *               the Placeholder component (grid sizing, theme overrides, etc.).
 *               Apply via `cn(styles)` on the component's root element.
 *   rendering   opt-in; only threaded by maps for components that render
 *               nested `<Placeholder>` regions.
 *
 * Components extend this so the CMS-side concerns are declared once:
 *   `interface FooBlockProps extends CmsProps { … }`
 */
export interface CmsProps {
  /** True when the page is rendered in Experience Editor / Pages. */
  isEditing?: boolean;
  /**
   * DOM `id` for the rendering instance. Sourced from
   * `params.RenderingIdentifier` by `withSitecore`'s default map; custom
   * adapter maps must set it explicitly. Apply to the component's
   * outermost element.
   */
  id?: string;
  /**
   * SXA-computed class string for this rendering instance. Sourced from
   * `params.styles` by `withSitecore`'s default map. Apply via
   * `className={cn(..., styles?.trimEnd())}` so it composes with the
   * component's own classes without trailing whitespace artefacts.
   */
  styles?: string;
  /** Layout-service rendering for this component; only present when the
   * component's sibling map opts in (e.g. for `<Placeholder rendering=…/>`). */
  rendering?: ComponentRendering;
}
