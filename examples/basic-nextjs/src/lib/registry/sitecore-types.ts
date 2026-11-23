import type {
  ComponentParams,
  ComponentRendering,
  Page,
  TextField,
} from "components/lib/registry/sitecore";

/**
 * Shared component props
 */
export type ComponentProps = {
  rendering: ComponentRendering;
  /**
   * Optional editing-mode flag resolved at the rendering boundary.
   * Prefer passing this instead of calling useSitecore() in leaf components.
   */
  isEditing?: boolean;
  params: ComponentParams & {
    /**
     * The identifier for the rendering
     */
    RenderingIdentifier?: string;
    /**
     * The styles for the rendering
     * This value is calculated by the Placeholder component
     */
    styles?: string;
    /**
     * The enabled placeholders for the rendering
     */
    EnabledPlaceholders?: string;
  };
};

/**
 * Component props with context
 * You can access `page` by withSitecore/useSitecore
 * @example withSitecore()(ExampleComponent)
 * @example const { page } = useSitecore()
 */
export type ComponentWithContextProps = ComponentProps & {
  page: Page;
};

export interface IGQLTextField {
  jsonValue: TextField;
}

export interface IGQLField<T> {
  jsonValue: T;
}

export interface SitecoreItem<TFields> {
  id: string;
  displayName: string;
  name: string;
  url: string;
  fields: TFields;
}
