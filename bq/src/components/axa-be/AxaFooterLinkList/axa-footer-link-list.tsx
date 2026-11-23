import { Link, Text } from '@sitecore-content-sdk/nextjs';
import type { LinkField, TextField } from '@sitecore-content-sdk/nextjs';
import { ComponentProps, getDatasource, getFieldValue } from 'lib/component-props';
import FooterLinkListChrome from './axa-footer-link-list.client';

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

type FooterLinkListProps = ComponentProps & {
  fields?: LinkListDatasource | { data?: { datasource?: LinkListDatasource } };
};

export const Default = (props: FooterLinkListProps) => {
  const datasource = getDatasource<LinkListDatasource>(props.fields);
  const titleField = getFieldValue(datasource?.field?.title);
  const results = datasource?.children?.results ?? [];
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  const title = (
    <Text
      field={titleField}
      tag="span"
      className="font-[Source_Sans_Pro] text-[16px] font-semibold leading-6"
    />
  );

  const links = (
    <ul className="m-0 list-none p-0" aria-label={typeof titleField?.value === 'string' ? titleField.value : undefined}>
      {results.map((child, index) => {
        const linkField = getFieldValue(child.link ?? child.field?.link);
        if (!linkField) return null;
        return (
          <li key={index} className="mb-4 leading-6 last:mb-0 max-lg:border-t max-lg:border-white/20 max-lg:mb-0">
            <Link
              field={linkField}
              className="block text-[16px] text-white hover:underline max-lg:px-5 max-lg:py-4"
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
      className="flex-1 px-[15px] text-white max-lg:border-t max-lg:border-white/20 max-lg:px-0"
    >
      <FooterLinkListChrome title={title}>{links}</FooterLinkListChrome>
    </div>
  );
};
