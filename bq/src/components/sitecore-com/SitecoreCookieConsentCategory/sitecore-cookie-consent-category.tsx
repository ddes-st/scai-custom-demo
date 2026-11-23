import React, { JSX } from 'react';
import type { Field } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import Chrome from './sitecore-cookie-consent-category.client';

interface Fields {
  Title: Field<string>;
  Enabled: Field<boolean>;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields } = props;

  if (!fields) {
    return <li className="m-0" />;
  }

  return <Chrome fields={fields} />;
};

export default Default;
