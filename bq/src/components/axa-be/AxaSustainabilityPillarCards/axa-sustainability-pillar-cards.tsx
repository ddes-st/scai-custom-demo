import { AppPlaceholder, Text } from '@sitecore-content-sdk/nextjs';
import type { TextField } from '@sitecore-content-sdk/nextjs';
import { ComponentWithContextProps } from 'lib/component-props';
import componentMap from '.sitecore/component-map';
import CarouselChrome from './axa-sustainability-pillar-cards.client';

interface Fields {
  Heading: TextField;
  Subtitle: TextField;
}

type SustainabilityPillarCardsProps = ComponentWithContextProps & { fields: Fields };

export const Default = (props: SustainabilityPillarCardsProps) => {
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
      className="relative bg-white px-4 py-8 font-['Source_Sans_Pro'] text-[#20212c] md:px-5 md:py-10 lg:py-16"
    >
      <div className="mx-auto w-full max-w-[1110px]">
        <div className="text-center">
          <Text
            field={fields.Heading}
            tag="h2"
            className="font-['Publico'] text-[28px] font-light leading-[1.22] text-[#20212c] md:text-[32px] lg:text-[36px]"
          />
          <Text
            field={fields.Subtitle}
            tag="p"
            className="mt-4 text-[18px] font-semibold leading-6 text-[#4a4c5a] md:mt-5"
          />
        </div>
        <CarouselChrome>
                    <div className="flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:justify-center lg:gap-[30px] [&>*]:w-[min(90%,350px)] [&>*]:shrink-0 [&>*]:snap-center">
            <AppPlaceholder
            name={placeholderName}
            rendering={props.rendering}
            page={props.page}
            componentMap={componentMap}
            />
          </div>
        </CarouselChrome>
      </div>
    </section>
  );
};
