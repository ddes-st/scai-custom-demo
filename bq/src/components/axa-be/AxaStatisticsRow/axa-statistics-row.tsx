import { RichText, Text } from '@sitecore-content-sdk/nextjs';
import type { RichTextField, TextField } from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';

interface Fields {
  Value: TextField;
  Label: TextField;
  Description: RichTextField;
}

type StatisticsRowProps = ComponentProps & { fields: Fields };

export const Default = (props: StatisticsRowProps) => {
  const { fields } = props;

  return (
    <article
      key={props.params.RenderingIdentifier || props.rendering.uid} id={props.params?.RenderingIdentifier || props.params?.id || undefined}
      className="w-full px-[15px] text-center lg:w-1/3 lg:border-l lg:border-black/25 lg:first:border-l-0 lg:px-5 lg:py-0"
    >
      <div className="text-center">
        <div className="mb-[10px]" aria-hidden="true" />
        <div className="richtext text-center">
          <p className="mb-0 font-[Publico] text-[52px] font-light leading-none text-[#20212c] lg:text-[72px]">
            <Text field={fields.Value} />
          </p>
          <Text
            field={fields.Label}
            tag="h5"
            className="mt-4 text-[20px] font-semibold leading-6 text-[#00008f] lg:text-[24px] lg:leading-8"
          />
          <RichText field={fields.Description} className="mt-4 text-center leading-6 text-[#20212c]" />
        </div>
      </div>
    </article>
  );
};
