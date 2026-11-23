import React, { JSX } from 'react';
import { AppPlaceholder, Image, Link, RichText, Text } from '@sitecore-content-sdk/nextjs';
import type { ImageField, LinkField, Field, RichTextField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import componentMap from '.sitecore/component-map';
import Chrome from './crelan-cookie-consent-preferences.client';

interface Fields {
  Logo: ImageField;
  Heading: Field<string>;
  Intro: RichTextField;
  'Privacy Link': LinkField;
  'Categories Heading': Field<string>;
  'Refuse Button': Field<string>;
  'Manage Button': Field<string>;
  'Powered By Logo': ImageField;
  'Powered By Link': LinkField;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields, rendering, page } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const phKey = params.DynamicPlaceholderId;
  const categoryItemsBase = 'category-items';
  const categoryItemsName = phKey ? `${categoryItemsBase}-${phKey}` : categoryItemsBase;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  const categoryItems = (
    <AppPlaceholder
      name={categoryItemsName}
      rendering={rendering}
      page={page}
      componentMap={componentMap}
    />
  );

  return (
    <Chrome fields={fields} categoryItems={categoryItems}>
      {categoryItems}
    </Chrome>
  );
};

export default Default;
