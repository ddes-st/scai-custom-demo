import React, { JSX } from 'react';
import type { Field } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import Chrome from './crelan-cookie-preference-category.client';

interface Fields {
  Title: Field<string>;
  Description: Field<string>;
  Required: Field<boolean>;
  'Initial Enabled': Field<boolean>;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  if (!props.fields) {
    return <div>Missing Component Datasource.</div>;
  }
  return <Chrome fields={props.fields} />;
};

export default Default;
