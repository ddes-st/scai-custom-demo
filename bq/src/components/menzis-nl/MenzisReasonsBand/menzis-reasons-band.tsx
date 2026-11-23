import { JSX } from 'react';
import type { Field, RichTextField, ImageField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import { getDatasource, getFieldValue } from 'lib/component-props';
import ReasonsClient from './menzis-reasons-band.client';

type GqlField<T> = T | { jsonValue?: T };

type ReasonChild = {
  title?: GqlField<Field<string>>;
  body?: GqlField<RichTextField>;
  icon?: GqlField<ImageField>;
  fields?: {
    Title?: Field<string>;
    Body?: RichTextField;
    Icon?: ImageField;
  };
};

type Datasource = {
  heading?: GqlField<Field<string>>;
  Heading?: Field<string>;
  children?: { results?: ReasonChild[] };
};

type Props = ComponentWithContextProps & {
  fields?: Datasource | { data?: { datasource?: Datasource } };
};

export const Default = (props: Props): JSX.Element => {
  const datasource = getDatasource<Datasource>(props.fields);
  const heading =
    getFieldValue(datasource?.heading) ?? datasource?.Heading;
  const reasons = (datasource?.children?.results ?? []).map((child) => ({
    fields: {
      Title: getFieldValue(child.title) ?? child.fields?.Title,
      Body: getFieldValue(child.body) ?? child.fields?.Body,
      Icon: getFieldValue(child.icon) ?? child.fields?.Icon,
    },
  }));

  return (
    <ReasonsClient
      fields={{
        Heading: heading,
        children: { results: reasons },
      }}
    />
  );
};
