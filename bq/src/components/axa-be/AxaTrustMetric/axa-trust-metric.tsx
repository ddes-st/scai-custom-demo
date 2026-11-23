import { Text } from '@sitecore-content-sdk/nextjs';
import type { TextField } from '@sitecore-content-sdk/nextjs';
import type { ComponentProps } from 'lib/component-props';

interface Fields {
  Value: TextField;
  Label: TextField;
}

type TrustMetricProps = ComponentProps & { fields: Fields };

export const Default = (props: TrustMetricProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <article
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="w-full shrink-0 px-[15px] text-center font-['Source_Sans_Pro']"
    >
      <Text
        field={fields.Value}
        tag="p"
        className="font-[Publico] text-[52px] font-light leading-none text-[#20212c] md:text-[72px]"
      />
      <Text
        field={fields.Label}
        tag="p"
        className="mt-4 text-[20px] font-semibold leading-6 text-[#20212c] md:text-[24px] md:leading-8"
      />
    </article>
  );
};
