import { AppPlaceholder, Text } from '@sitecore-content-sdk/nextjs';
import componentMap from '.sitecore/component-map';
import type { TextField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import CarouselChrome from './axa-sustainability-pillar-container.client';

interface Fields {
  Heading: TextField;
  Subtitle: TextField;
}

type SustainabilityPillarContainerProps = ComponentWithContextProps & { fields: Fields };

export const Default = (props: SustainabilityPillarContainerProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const dynamicId = params.DynamicPlaceholderId;
  const placeholderBase = 'sustainability-pillars';
  const placeholderName = dynamicId ? `${placeholderBase}-${dynamicId}` : placeholderBase;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="relative bg-white px-4 pb-12 pt-8 font-[Source_Sans_Pro] text-[#20212c] md:px-5 md:pb-20 md:pt-8 lg:px-5 lg:pb-20 lg:pt-16"
    >
      <div className="mx-auto w-full max-w-[1110px]">
        <div className="text-center">
          <Text
            field={fields.Heading}
            tag="h2"
            className="font-['Publico'] text-[28px] font-light leading-[1.22] text-[#20212c] md:text-[36px]"
          />
          <Text
            field={fields.Subtitle}
            tag="p"
            className="mt-4 text-[18px] font-semibold leading-6 text-[#20212c] md:mt-6"
          />
        </div>
        <div className="mt-10 md:mt-12 lg:mt-14">
          <CarouselChrome>
            <AppPlaceholder
              name={placeholderName}
              rendering={props.rendering}
              page={props.page}
              componentMap={componentMap}
            />
          </CarouselChrome>
        </div>
      </div>
    </section>
  );
};
