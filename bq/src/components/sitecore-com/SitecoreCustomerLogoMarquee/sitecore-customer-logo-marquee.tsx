import React, { JSX } from 'react';
import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import componentMap from '.sitecore/component-map';
import Chrome from './sitecore-customer-logo-marquee.client';

interface Fields {}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { rendering, page } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const phKey = params.DynamicPlaceholderId;
  const logoItemsBase = 'logo-items';
  const phName = phKey ? `${logoItemsBase}-${phKey}` : logoItemsBase;

  return (
    <Chrome>
      <AppPlaceholder name={phName} rendering={rendering} page={page} componentMap={componentMap} />
    </Chrome>
  );
};
