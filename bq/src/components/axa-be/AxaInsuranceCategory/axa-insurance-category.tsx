import { Link, Text } from '@sitecore-content-sdk/nextjs';
import type { LinkField, TextField } from '@sitecore-content-sdk/nextjs';
import { ComponentProps, getDatasource, getFieldValue } from 'lib/component-props';
import AccordionChrome from './axa-insurance-category.client';

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

type InsuranceCategoryProps = ComponentProps & {
  fields?: LinkListDatasource | { data?: { datasource?: LinkListDatasource } };
};

export const Default = (props: InsuranceCategoryProps) => {
  const { fields } = props;
  const datasource = getDatasource<LinkListDatasource>(fields);
  const titleField = getFieldValue(datasource?.field?.title);
  const results = (datasource?.children?.results ?? [])
    .map((child) => getFieldValue(child?.link ?? child?.field?.link))
    .filter((linkField): linkField is LinkField => Boolean(linkField));
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <article
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="w-full font-[Source_Sans_Pro] text-[16px] leading-6 text-[#20212c]"
    >
      <AccordionChrome title={<Text field={titleField} tag="span" />}>
        <ul className="m-0 list-none p-0">
          {results.map((linkField, index) => (
            <li key={index} className="m-0 mt-1 list-none first:mt-0 max-lg:mt-0">
              <Link
                field={linkField}
                className="link--primary block font-semibold text-[#00008f] underline decoration-[rgba(0,0,143,0.32)] underline-offset-[0.3em] max-lg:px-5 max-lg:py-3 max-lg:text-[14px] lg:py-2"
              />
            </li>
          ))}
        </ul>
      </AccordionChrome>
    </article>
  );
};
