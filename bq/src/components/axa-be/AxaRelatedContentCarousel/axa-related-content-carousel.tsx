import { AppPlaceholder, Text } from '@sitecore-content-sdk/nextjs';
import { ComponentWithContextProps } from 'lib/component-props';
import componentMap from '.sitecore/component-map';
import RelatedContentCarouselChrome from './axa-related-content-carousel.client';
import type { TextField } from '@sitecore-content-sdk/nextjs';

interface Fields {
  Heading: TextField;
}

type RelatedContentCarouselProps = ComponentWithContextProps & { fields: Fields };

export const Default = (props: RelatedContentCarouselProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const dynamicId = params.DynamicPlaceholderId;
  const placeholderBase = 'related-content-cards';
  const placeholderName = dynamicId ? `${placeholderBase}-${dynamicId}` : placeholderBase;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="bg-white px-4 py-16 text-[#20212c] sm:px-5 sm:py-20"
    >
      <div className="mx-auto w-full max-w-[1110px]">
        <div className="text-center">
          <Text
            field={fields.Heading}
            tag="h2"
            className="font-['Publico'] text-[28px] font-light leading-[1.22] text-[#20212c] sm:text-4xl"
          />
        </div>
        <RelatedContentCarouselChrome>
          <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-[30px] sm:px-2.5 lg:mx-auto lg:max-w-[750px] lg:justify-center lg:overflow-visible">
            <AppPlaceholder
              name={placeholderName}
              rendering={props.rendering}
              page={props.page}
              componentMap={componentMap}
            />
          </div>
        </RelatedContentCarouselChrome>
      </div>
    </section>
  );
};
