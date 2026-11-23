import { Link, Text } from "@sitecore-content-sdk/nextjs";
import type { LinkField, TextField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps, getDatasource, getFieldValue } from "lib/component-props";
import ColumnChrome from "./dom-security-product-menu-column.client";

type LinkListChild = {
  link?: LinkField | { jsonValue?: LinkField };
  field?: {
    link?: LinkField | { jsonValue?: LinkField };
  };
};

type ProductMenuDatasource = {
  field?: {
    title?: TextField | { jsonValue?: TextField };
  };
  children?: {
    results?: LinkListChild[];
  };
};

type ProductMenuProps = ComponentProps & {
  fields?: ProductMenuDatasource | { data?: { datasource?: ProductMenuDatasource } };
};

export const Default = (props: ProductMenuProps) => {
  const datasource = getDatasource<ProductMenuDatasource>(props.fields);
  const titleField = getFieldValue(datasource?.field?.title);
  const results = datasource?.children?.results ?? [];
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <article
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="min-w-0 flex-1 border-b border-[#e3e3e3] px-[15px] py-4 text-left lg:border-b-0 lg:border-r lg:px-[15px] lg:py-4 last:lg:border-r-0"
    >
      <ColumnChrome
        title={
          <Text
            field={titleField}
            tag="h3"
            className="font-[Source_Sans_Pro] text-[1.28rem] font-light leading-normal text-black lg:mb-6 lg:text-[1.67rem] lg:leading-[2rem] lg:text-[#d51130]"
          />
        }
      >
        <ul className="m-0 list-none space-y-0 p-0 text-[0.9rem] leading-[1.3rem] lg:text-[1.05rem] lg:leading-[1.5rem]">
          {results.map((child, index) => {
            const linkField = getFieldValue(child.link ?? child.field?.link);
            if (!linkField) return null;
            return (
              <li key={index} className="m-0 list-none py-1.5 first:pt-0 last:pb-0 lg:py-2">
                <Link field={linkField} className="text-black no-underline hover:font-semibold hover:text-black hover:no-underline" />
              </li>
            );
          })}
        </ul>
      </ColumnChrome>
    </article>
  );
};
