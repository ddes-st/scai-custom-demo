import React, { JSX } from 'react';
import type { ImageField, LinkField, Field } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import Chrome from './sitecore-main-navigation.client';

export interface Fields {
  Logo: ImageField;
  'Home Link': LinkField;
  'Skip Link': LinkField;
  'Skip Label': Field<string>;
  Categories: Field<string>;
  'Search Link': LinkField;
  'Search Label': Field<string>;
  'Language Label': Field<string>;
  'Sites Label': Field<string>;
  'Demo Link': LinkField;
  'Demo Link Label': Field<string>;
  'Menu Icon': ImageField;
  'Close Icon': ImageField;
  'Search Icon': ImageField;
  'Language Icon': ImageField;
  'Sites Icon': ImageField;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  if (!props.fields) {
    return <div>Missing Component Datasource.</div>;
  }

  return <Chrome fields={props.fields} />;
};

export default Default;
