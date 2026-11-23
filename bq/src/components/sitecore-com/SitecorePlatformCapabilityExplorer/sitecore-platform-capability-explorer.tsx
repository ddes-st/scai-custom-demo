import React, { type JSX } from 'react';
import {
  AppPlaceholder,
  Image,
  RichText,
  Text,
  type Field,
  type ImageField,
  type RichTextField,
} from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import componentMap from '.sitecore/component-map';
import Chrome from './sitecore-platform-capability-explorer.client';

interface Fields {
  Heading: Field<string>;
  Highlight: Field<string>;
  Description: RichTextField;
  'Watermark Image': ImageField;
}

type Props = ComponentWithContextProps & { fields: Fields };

const capabilityPanelsBase = 'capability-panels';

export const Default = (props: Props): JSX.Element => {
  const { fields, rendering, page } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const phKey = params.DynamicPlaceholderId;
  const capabilityPanelsName = phKey ? `${capabilityPanelsBase}-${phKey}` : capabilityPanelsBase;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  const panelMarkup = (
    <AppPlaceholder
      name={capabilityPanelsName}
      rendering={rendering}
      page={page}
      componentMap={componentMap}
    />
  );

  return (
    <section className="relative overflow-visible border-b border-x border-[#e4e2e8] bg-white px-4 py-6 text-[#1e1c22] sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="pointer-events-none absolute -bottom-16 -left-8 w-72 -scale-x-100 opacity-[0.03] lg:w-[37.5rem]">
        <Image field={fields['Watermark Image']} className="block h-auto w-full" />
      </div>
      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 text-center">
          <h2 className="text-[26px] font-normal leading-tight tracking-[-0.2px] sm:text-4xl lg:text-5xl">
            <Text field={fields.Heading} />
            <span className="block bg-gradient-to-r from-[#ff1f38] to-[#8629ff] bg-clip-text font-semibold text-transparent">
              <Text field={fields.Highlight} />
            </span>
          </h2>
          <RichText field={fields.Description} />
        </div>
        <Chrome>{panelMarkup}</Chrome>
      </div>
    </section>
  );
};

export default Default;
