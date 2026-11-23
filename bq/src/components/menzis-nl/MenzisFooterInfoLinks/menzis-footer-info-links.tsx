import React, { JSX } from 'react';
import { Image, Link, AppPlaceholder } from '@sitecore-content-sdk/nextjs';
import type { ImageField, LinkField, Field } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import { getDatasource } from 'lib/component-props';
import componentMap from '.sitecore/component-map';
import FooterLegalLinksChrome from './menzis-footer-info-links.client';

interface Fields {
  Heading: Field<string>;
  Logo: ImageField;
  'Logo Link': LinkField;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const datasource = getDatasource(props.fields);
  const params = props.params ?? props.rendering?.params ?? {};
  const placeholderBase = 'footer-legal-links';
  const dynId = props.params?.DynamicPlaceholderId ?? props.rendering?.params?.DynamicPlaceholderId;
  const phName = dynId ? `${placeholderBase}-${dynId}` : placeholderBase;

  return (
    <FooterLegalLinksChrome fields={datasource ?? props.fields}>
      <AppPlaceholder
        name={phName}
        rendering={props.rendering}
        page={props.page}
        componentMap={componentMap}
      />
    </FooterLegalLinksChrome>
  );
};

export default Default;
