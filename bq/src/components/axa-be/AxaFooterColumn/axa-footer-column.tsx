import { Link, Text } from "@sitecore-content-sdk/nextjs";
import type { LinkField, TextField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps, getDatasource, getFieldValue } from "lib/component-props";
import FooterColumnChrome from './axa-footer-column.client';

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

interface Fields extends LinkListDatasource {}

type FooterColumnProps = ComponentProps & {
  fields?: Fields | { data?: { datasource?: LinkListDatasource } };
};

export const Default = (props: FooterColumnProps) => {
  const datasource = getDatasource<LinkListDatasource>(props.fields);
  const titleField = getFieldValue(datasource?.field?.title);
  const results = datasource?.children?.results ?? [];
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  const title = <Text field={titleField} />;
  const links = (
    <ul className="list-none p-0 m-0 max-lg:border-t max-lg:border-white/20">
      {results.map((child, index) => {
        const linkField = getFieldValue(child.link ?? child.field?.link);
        if (!linkField) return null;
        return (
          <li key={index} className="mb-4 leading-6 max-lg:mb-0 max-lg:border-t max-lg:border-white/20">
            <Link
              field={linkField}
              className="block text-white hover:underline max-lg:px-5 max-lg:py-4"
            />
          </li>
        );
      })}
    </ul>
  );

  return (
    <div
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="flex-1 px-[15px] text-white max-lg:px-0"
    >
      <FooterColumnChrome
        title={
          <>
            <span className="max-lg:hidden font-semibold">{title}</span>
            <span className="lg:hidden">{title}</span>
          </>
        }
      >
        {links}
      </FooterColumnChrome>
    </div>
  );
};
