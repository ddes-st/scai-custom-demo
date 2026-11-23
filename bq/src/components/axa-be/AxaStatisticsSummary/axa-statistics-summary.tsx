import { Text } from '@sitecore-content-sdk/nextjs';
import type { TextField } from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';

interface Fields {
  Value: TextField;
  Label: TextField;
  Description: TextField;
}

type StatisticsSummaryProps = ComponentProps & { fields: Fields };

export const Default = (props: StatisticsSummaryProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <article
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="w-full px-[15px] text-center font-['Source_Sans_Pro'] text-[#20212c] lg:basis-1/3 lg:max-w-[33.3333%] lg:px-[15px]"
    >
      <div className="relative text-center lg:min-h-[180px] lg:border-l lg:border-black/25 lg:first:border-l-0">
        <div className="text-center">
          <Text
            field={fields.Value}
            tag="p"
            className="font-['Publico'] text-[52px] font-light leading-none tracking-[-0.02em] lg:text-[72px]"
          />
          <Text
            field={fields.Label}
            tag="p"
            className="mt-4 text-[20px] font-semibold leading-6 lg:mt-3 lg:text-[24px] lg:leading-8"
          />
          <Text
            field={fields.Description}
            tag="p"
            className="mx-auto mt-5 max-w-[290px] text-[16px] leading-6 lg:mt-4"
          />
        </div>
      </div>
    </article>
  );
};
