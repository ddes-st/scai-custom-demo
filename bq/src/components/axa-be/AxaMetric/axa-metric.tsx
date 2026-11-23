import { Text } from '@sitecore-content-sdk/nextjs';
import type { TextField } from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';

interface Fields {
  Value: TextField;
  Label: TextField;
}

type MetricProps = ComponentProps & { fields: Fields };

export const Default = (props: MetricProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <article
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="flex min-w-0 flex-col items-center px-[15px] text-center"
    >
      <Text
        field={fields.Value}
        tag="p"
        className="font-[Publico] text-[52px] font-light leading-none text-[#20212c] md:text-[72px]"
      />
      <Text
        field={fields.Label}
        tag="p"
        className="mt-3 font-['Source_Sans_Pro'] text-[20px] font-semibold leading-6 text-[#20212c] md:text-[24px] md:leading-8"
      />
    </article>
  );
};
