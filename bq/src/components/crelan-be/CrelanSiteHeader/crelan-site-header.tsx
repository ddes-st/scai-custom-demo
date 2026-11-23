import React, { JSX } from 'react';
import type { ComponentWithContextProps } from 'lib/component-props';
import Chrome from './crelan-site-header.client';
import type { Fields } from './crelan-site-header.client';

export const Default = (props: ComponentWithContextProps & { fields: Fields }): JSX.Element => {
  if (!props.fields) {
    return <div>Missing Component Datasource.</div>;
  }

  return <Chrome fields={props.fields} />;
};
