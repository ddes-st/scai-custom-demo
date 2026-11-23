import React, { JSX } from 'react';
import type { ComponentWithContextProps } from 'lib/component-props';
import { getDatasource } from 'lib/component-props';
import CookiePreferenceModalClient from './menzis-cookie-preference-modal.client';
import type { Field } from '@sitecore-content-sdk/nextjs';

interface CookieOptionFields {
  Label: Field<string>;
  Value: Field<string>;
  Help: Field<string>;
}

interface CookieOptionItem {
  id?: string;
  name?: string;
  fields: CookieOptionFields;
}

interface Fields {
  Heading: Field<string>;
  Description: Field<string>;
  'Settings Label': Field<string>;
  'Decline Label': Field<string>;
  'Accept Label': Field<string>;
  'Save Label': Field<string>;
  children?: { results?: CookieOptionItem[] };
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const datasource = getDatasource<Fields>(props.fields);

  if (!datasource) {
    return <div>Missing Component Datasource.</div>;
  }

  return <CookiePreferenceModalClient fields={datasource} />;
};

export default Default;
