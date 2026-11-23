import React, { JSX } from 'react';
import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
import type { Field, LinkField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import componentMap from '.sitecore/component-map';
import Chrome from './sitecore-cookie-consent-banner.client';

interface Fields {
  Message: Field<string>;
  'Privacy Policy': LinkField;
  'Storage Preferences': Field<string>;
  Save: Field<string>;
  'Accept All': Field<string>;
  'Reject Non-Essential': Field<string>;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields, rendering, page } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const phKey = params.DynamicPlaceholderId;
  const cookieCategoriesBase = 'cookie-categories';
  const cookieCategoriesName = phKey ? `${cookieCategoriesBase}-${phKey}` : cookieCategoriesBase;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  return (
    <Chrome fields={fields}>
      <AppPlaceholder
        name={cookieCategoriesName}
        rendering={rendering}
        page={page}
        componentMap={componentMap}
      />
    </Chrome>
  );
};

export default Default;
