import { AppPlaceholder, Text } from '@sitecore-content-sdk/nextjs';
import type { TextField } from '@sitecore-content-sdk/nextjs';
import componentMap from '.sitecore/component-map';
import type { ComponentWithContextProps } from 'lib/component-props';

interface Fields {
  Heading: TextField;
}

type InsuranceCategoryCatalogProps = ComponentWithContextProps & { fields: Fields };

export const Default = (props: InsuranceCategoryCatalogProps) => {
  const { fields } = props;
  const dynamicPlaceholderId = props.params?.DynamicPlaceholderId;
  const placeholderBase = 'insurance-category-catalog';
  const placeholderName = dynamicPlaceholderId
    ? `${placeholderBase}-${dynamicPlaceholderId}`
    : placeholderBase;

  return (
    <section
      key={props.params?.RenderingIdentifier || props.rendering.uid} id={props.params?.RenderingIdentifier || props.params?.id || undefined}
      className="relative bg-white px-5 py-16 md:py-16 lg:py-20"
    >
      <div className="mx-auto w-full max-w-[1110px]">
        <div className="text-center">
          <Text
            field={fields.Heading}
            tag="h2"
            className="font-serif text-[28px] font-light leading-[1.22] text-[#20212c] md:text-[28px] lg:text-4xl"
          />
        </div>
        <div className="mt-10 overflow-hidden rounded-xl bg-[#f2f2f6] md:mt-10 lg:mt-14 lg:px-8 lg:pb-8">
          <div className="grid items-start md:grid-cols-1 lg:grid-cols-3 lg:gap-x-[104px] lg:gap-y-4">
            <AppPlaceholder
              name={placeholderName}
              rendering={props.rendering}
              page={props.page}
              componentMap={componentMap}
            />
          </div>
        </div>
      </div>
    </section>
  );
};
