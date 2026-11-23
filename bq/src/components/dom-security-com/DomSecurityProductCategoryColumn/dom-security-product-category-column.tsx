import { Link, Text } from "@sitecore-content-sdk/nextjs";
import type { LinkField, TextField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps, getDatasource, getFieldValue } from "lib/component-props";
import Chrome from "./dom-security-product-category-column.client";

type LinkListChild = {
  link?: LinkField | { jsonValue?: LinkField };
  field?: {
    link?: LinkField | { jsonValue?: LinkField };
  };
};

type LinkListDatasource = {
  field?: {
    title?: TextField | { jsonValue?: TextField };
  };
  children?: {
    results?: LinkListChild[];
  };
};

type ProductCategoryColumnProps = ComponentProps & {
  fields?: LinkListDatasource | { data?: { datasource?: LinkListDatasource } };
};

export const Default = (props: ProductCategoryColumnProps) => {
  const datasource = getDatasource<LinkListDatasource>(props.fields);
  const titleField = getFieldValue(datasource?.field?.title);
  const results = (datasource?.children?.results ?? []).filter((child) =>
    Boolean(getFieldValue(child.link ?? child.field?.link)),
  );
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  const title = <Text field={titleField} tag="h3" />;
  const links = (
    <ul className="m-0 list-none space-y-1 p-0 text-[0.9rem] leading-[1.3rem] lg:space-y-0">
      {results.map((child, index) => {
        const linkField = getFieldValue(child.link ?? child.field?.link);
        if (!linkField) return null;
        return (
          <li key={index} className="m-0 list-none">
            <Link
              field={linkField}
              className="mt-1 inline-block text-black no-underline hover:font-semibold hover:no-underline lg:my-[0.4rem]"
            />
          </li>
        );
      })}
    </ul>
  );

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="menu-lvl-container m-0 p-4 font-[Source_Sans_Pro] font-normal lg:flex-1 lg:border-r lg:border-[#e3e3e3] lg:last:border-r-0 max-lg:px-0 max-lg:py-2"
    >
      <Chrome title={title} links={links} />
    </section>
  );
};
