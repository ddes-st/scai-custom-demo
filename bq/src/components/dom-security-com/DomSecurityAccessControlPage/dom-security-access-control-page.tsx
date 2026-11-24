import { AppPlaceholder } from "@sitecore-content-sdk/nextjs";
import componentMap from ".sitecore/component-map";
import type { ComponentWithContextProps } from "lib/component-props";

const SECTIONS = [
  "access-hero",
  "access-intro",
  "access-icons",
  "access-benefits",
  "access-logos",
  "access-manage",
  "access-compare",
  "access-chooser",
  "access-integrate",
  "access-products",
  "access-brochure",
  "access-contact",
] as const;

export const Default = (props: ComponentWithContextProps) => {
  const params = props.params ?? props.rendering?.params ?? {};
  const dynId = params.DynamicPlaceholderId;

  return (
    <>
      {SECTIONS.map((key) => (
        <AppPlaceholder
          key={key}
          name={dynId ? `${key}-${dynId}` : key}
          rendering={props.rendering}
          page={props.page}
          componentMap={componentMap}
        />
      ))}
    </>
  );
};
