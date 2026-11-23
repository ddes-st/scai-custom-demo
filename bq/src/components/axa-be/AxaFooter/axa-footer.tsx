import { AppPlaceholder, Link, Text } from "@sitecore-content-sdk/nextjs";
import componentMap from ".sitecore/component-map";
import type { ComponentWithContextProps } from "lib/component-props";
import type { LinkField, TextField } from "@sitecore-content-sdk/nextjs";

interface Fields {
  Copyright: TextField;
  "Site Map Link": LinkField;
}

type FooterProps = ComponentWithContextProps & { fields: Fields };

export const Default = (props: FooterProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const dynamicPlaceholderId = params.DynamicPlaceholderId;
  const placeholderBase = "footer-navigation";
  const placeholderName = dynamicPlaceholderId
    ? `${placeholderBase}-${dynamicPlaceholderId}`
    : placeholderBase;

  return (
    <footer
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="relative bg-[#0c0e45] font-[Source_Sans_Pro] text-[16px] leading-6 text-white"
    >
      <div className="mx-auto w-full max-w-[1110px] px-0 md:px-5 lg:px-5">
        <nav
          aria-label="footer navigatie"
          className="flex flex-col flex-wrap items-stretch pb-0 pt-0 lg:flex-row lg:items-start lg:px-[-15px] lg:pb-16 lg:pt-12"
        >
          <div className="flex flex-col lg:flex-row lg:flex-1">
            <AppPlaceholder
              name={placeholderName}
              rendering={props.rendering}
              page={props.page}
              componentMap={componentMap}
            />
          </div>
        </nav>
      </div>
      <div className="border-t border-white/20 text-[13px] leading-5">
        <div className="mx-auto flex w-full max-w-[1110px] flex-col items-stretch md:px-5 lg:flex-row lg:flex-wrap lg:items-center lg:px-5">
          <p className="order-2 border-t border-white/20 px-5 py-4 text-center lg:order-1 lg:border-t-0 lg:px-0 lg:py-4 lg:text-left">
            <Text field={fields.Copyright} />
          </p>
          <div className="hidden flex-1 lg:block" />
          <nav
            aria-label="globale footer navigatie"
            className="order-1 px-5 py-4 text-center lg:order-2 lg:px-0 lg:py-4 lg:text-right"
          >
            <Link field={fields["Site Map Link"]} />
          </nav>
        </div>
      </div>
    </footer>
  );
};
