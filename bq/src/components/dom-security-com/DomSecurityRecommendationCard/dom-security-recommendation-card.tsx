import { Image, Text } from '@sitecore-content-sdk/nextjs';
import type { ImageField, TextField } from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';

interface Fields {
  Image: ImageField;
  Label: TextField;
  Title: TextField;
}

type RecommendationCardProps = ComponentProps & { fields: Fields };

export const Default = (props: RecommendationCardProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <article
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="font-['Source_Sans_Pro',sans-serif] font-light text-[#333]"
    >
      <div className="dom-rec-media overflow-hidden">
        <Image
          field={fields.Image}
          className="block h-auto w-full object-cover lg:h-[434px]"
        />
      </div>
      <div className="dom-rec-copy pt-4 lg:pt-0">
        <Text
          field={fields.Label}
          tag="h3"
          className="m-0 mt-5 mb-[10px] text-[30.06px] font-light leading-9 text-[#333]"
        />
        <Text
          field={fields.Title}
          tag="p"
          className="m-0 text-[21.96px] font-light leading-[39.96px] text-[#333]"
        />
      </div>
    </article>
  );
};
