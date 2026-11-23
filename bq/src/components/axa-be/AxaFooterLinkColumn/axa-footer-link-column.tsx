import { Link, Text } from '@sitecore-content-sdk/nextjs';
import type { LinkField, TextField } from '@sitecore-content-sdk/nextjs';
import { ComponentProps, getDatasource, getFieldValue } from 'lib/component-props';
import Chrome from './axa-footer-link-column.client';

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

type FooterLinkColumnProps = ComponentProps & {
  fields?: LinkListDatasource | { data?: { datasource?: LinkListDatasource } };
};

export const Default = (props: FooterLinkColumnProps) => {
  const datasource = getDatasource<LinkListDatasource>(props.fields);
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const titleField = getFieldValue(datasource?.field?.title) ?? { value: '' };
  const results = (datasource?.children?.results ?? []).filter((child) =>
    Boolean(getFieldValue(child.link ?? child.field?.link)),
  );

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="w-full bg-[#0c0e45] text-white lg:flex-1 lg:px-[15px]"
    >
      <Chrome title={<Text field={titleField} />}>
        <ul className="m-0 list-none p-0">
          {results.map((child, index) => {
            const linkField = getFieldValue(child.link ?? child.field?.link);
            if (!linkField) return null;

            return (
              <li key={index} className="border-t border-white/20 first:border-t-0 lg:mb-4 lg:border-0 lg:leading-6">
                <Link
                  field={linkField}
                  className="block py-4 text-base leading-6 hover:underline lg:p-0"
                />
              </li>
            );
          })}
        </ul>
      </Chrome>
    </section>
  );
};
