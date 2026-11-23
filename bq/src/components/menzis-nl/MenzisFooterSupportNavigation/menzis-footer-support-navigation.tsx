import React, { JSX } from 'react';
import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import componentMap from '.sitecore/component-map';

interface Fields {}
type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const placeholderBase = 'footer-help-and-links-content';
  const dynId = props.params?.DynamicPlaceholderId ?? props.rendering?.params?.DynamicPlaceholderId;
  const phName = dynId ? `${placeholderBase}-${dynId}` : placeholderBase;

  return (
    <footer className="relative w-full max-w-[100vw] overflow-hidden bg-gradient-to-b from-white to-[#f2f2f2] text-[#043572]">
      <div className="relative px-4 py-6 md:px-8 lg:px-8 lg:py-20">
        <div className="mx-auto grid w-full max-w-[1180px] grid-cols-12 gap-x-3.5 md:gap-x-6 lg:gap-x-8">
          <AppPlaceholder
            name={phName}
            rendering={props.rendering}
            page={props.page}
            componentMap={componentMap}
          />
        </div>
      </div>
    </footer>
  );
};

export default Default;
