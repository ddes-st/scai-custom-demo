import { AppPlaceholder, Link, Text } from "@sitecore-content-sdk/nextjs";
import componentMap from ".sitecore/component-map";
import type { ComponentWithContextProps } from "lib/component-props";
import type { LinkField, TextField } from "@sitecore-content-sdk/nextjs";

interface Fields {
  Copyright: TextField;
  "Site Map Link": LinkField;
}

type FooterNavigationProps = ComponentWithContextProps & { fields: Fields };

export const Default = (props: FooterNavigationProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const placeholderBase = "footer-navigation";
  const dynamicId = params.DynamicPlaceholderId;
  const placeholderName = dynamicId ? `${placeholderBase}-${dynamicId}` : placeholderBase;

  return (
    <footer
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="bg-[#0c0e45] font-[Source_Sans_Pro] text-[16px] leading-6 text-white"
    >
      <div className="mx-auto w-full max-w-[1110px] px-5 max-[768px]:px-0">
        <nav
          aria-label="footer navigatie"
          className="-mx-[15px] flex flex-wrap items-start gap-y-0 py-12 pb-16 max-[768px]:mx-0 max-[768px]:block max-[768px]:p-0"
        >
          <AppPlaceholder
            name={placeholderName}
            rendering={props.rendering}
            page={props.page}
            componentMap={componentMap}
          />
        </nav>
      </div>
      <div className="border-t border-white/20 py-4 text-[13px] max-[768px]:p-0">
        <div className="mx-auto flex w-full max-w-[1110px] flex-wrap items-center justify-between px-5 max-[768px]:flex-col max-[768px]:items-stretch max-[768px]:px-0">
          <div className="order-2 max-[768px]:border-t max-[768px]:border-white/20 max-[768px]:px-5 max-[768px]:py-4 max-[768px]:text-center">
            <Text field={fields.Copyright} />
          </div>
          <div className="order-1 max-[768px]:px-5 max-[768px]:py-4 max-[768px]:text-center">
            <Link field={fields["Site Map Link"]} />
          </div>
        </div>
      </div>
    </footer>
  );
};
