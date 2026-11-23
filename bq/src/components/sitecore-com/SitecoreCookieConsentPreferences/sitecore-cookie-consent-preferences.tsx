import React, { JSX } from 'react';
import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import componentMap from '.sitecore/component-map';
import CookiePreferencesBannerChrome from './sitecore-cookie-consent-preferences.client';

import type { Field, LinkField } from '@sitecore-content-sdk/nextjs';

interface Fields {
  Message: Field<string>;
  'Privacy Link': LinkField;
  'Storage Preferences Label': Field<string>;
  'Close Label': Field<string>;
  'Dialog Label': Field<string>;
  'Save Label': Field<string>;
  'Accept All Label': Field<string>;
  'Reject Non-Essential Label': Field<string>;
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

  const categoryContent = (
    <AppPlaceholder
      name={cookieCategoriesName}
      rendering={rendering}
      page={page}
      componentMap={componentMap}
    />
  );

  return (
    <CookiePreferencesBannerChrome fields={fields}>{categoryContent}</CookiePreferencesBannerChrome>
  );
};

export default Default;
