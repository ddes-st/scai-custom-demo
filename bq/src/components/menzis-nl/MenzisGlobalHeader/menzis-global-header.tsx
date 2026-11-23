import React, { JSX } from 'react';
import { getDatasource } from 'lib/component-props';
import type { ComponentWithContextProps } from 'lib/component-props';
import type { Field, ImageField } from '@sitecore-content-sdk/nextjs';
import HeaderNavigationClient from './menzis-global-header.client';

interface Fields {
  Logo: ImageField;
  'Context Links': Field<string>;
  'Menu Groups': Field<string>;
  'Search Heading': Field<string>;
  'Search Description': Field<string>;
  'Search Placeholder': Field<string>;
  'Search Action': Field<string>;
  Login: Field<string>;
  'Login Url': Field<string>;
  'Language Image': ImageField;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const datasource = getDatasource<Fields>(props.fields);
  if (!datasource) return <div>Missing Component Datasource.</div>;
  return <HeaderNavigationClient fields={datasource} />;
};

export default Default;
