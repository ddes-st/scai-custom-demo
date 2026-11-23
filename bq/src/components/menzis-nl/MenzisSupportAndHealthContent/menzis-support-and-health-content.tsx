import { JSX } from 'react';
import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import componentMap from '.sitecore/component-map';

type Props = ComponentWithContextProps;

export const Default = (props: Props): JSX.Element => {
  const placeholderBase = 'support-health-content';
  const dynId = props.params?.DynamicPlaceholderId ?? props.rendering?.params?.DynamicPlaceholderId;
  const phName = dynId ? `${placeholderBase}-${dynId}` : placeholderBase;
  return (
    <main className="bg-white font-['Geologica',Arial,sans-serif] text-[#043572] items-stretch [&>*]:h-full">
      <AppPlaceholder
        name={phName}
        rendering={props.rendering}
        page={props.page}
        componentMap={componentMap}
      />
    </main>
  );
};
