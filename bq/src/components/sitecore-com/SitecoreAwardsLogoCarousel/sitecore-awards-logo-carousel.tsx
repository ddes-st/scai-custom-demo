import React, { JSX } from 'react';
import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import componentMap from '.sitecore/component-map';
import Chrome from './sitecore-awards-logo-carousel.client';

type Props = ComponentWithContextProps;

export const Default = (props: Props): JSX.Element => {
  const { rendering, page } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const phKey = params.DynamicPlaceholderId;
  const badgeItemsBase = 'badge-items';
  const badgeItemsName = phKey ? `${badgeItemsBase}-${phKey}` : badgeItemsBase;

  return (
    <Chrome>
      <AppPlaceholder
        name={badgeItemsName}
        rendering={rendering}
        page={page}
        componentMap={componentMap}
      />
    </Chrome>
  );
};

export default Default;
