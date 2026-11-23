import { Link, Text } from '@sitecore-content-sdk/nextjs';
import type { LinkField, TextField } from '@sitecore-content-sdk/nextjs';
import { ComponentProps, getDatasource, getFieldValue } from 'lib/component-props';

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

type DomSecurityMegaMenuColumnProps = ComponentProps & {
  fields?: LinkListDatasource | { data?: { datasource?: LinkListDatasource } };
};

export const Default = (props: DomSecurityMegaMenuColumnProps) => {
  const datasource = getDatasource<LinkListDatasource>(props.fields);
  const titleField = getFieldValue(datasource?.field?.title);
  const results = datasource?.children?.results ?? [];
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <div
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="min-w-0 border-[#e3e3e3] px-[15px] py-4 font-[Source_Sans_Pro] font-light lg:flex-1 lg:border-r lg:py-5 lg:last:border-r-0"
    >
      <Text
        field={titleField}
        tag="h3"
        className="mb-3 text-[1.28rem] leading-normal text-black lg:mb-6 lg:text-[1.67rem] lg:leading-8 lg:text-[#d51130]"
      />
      <ul className="m-0 list-none p-0 text-[0.9rem] leading-[1.3rem] lg:text-[1.1rem] lg:leading-7">
        {results.map((child, index) => {
          const linkField = getFieldValue(child.link ?? child.field?.link);
          if (!linkField) return null;
          return (
            <li key={index} className="m-0 list-none py-1 lg:py-[0.3rem]">
              <Link field={linkField} className="text-black no-underline hover:font-semibold hover:text-black hover:no-underline" />
            </li>
          );
        })}
      </ul>
    </div>
  );
};
