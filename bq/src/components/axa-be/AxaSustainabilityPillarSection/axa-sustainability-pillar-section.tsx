import { AppPlaceholder, Text } from '@sitecore-content-sdk/nextjs';
import componentMap from '.sitecore/component-map';
import type { TextField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';

interface Fields {
  Heading: TextField;
  Subtitle: TextField;
}

type SustainabilityPillarSectionProps = ComponentWithContextProps & { fields: Fields };

export const Default = (props: SustainabilityPillarSectionProps) => {
  const placeholderKey = 'sustainability-pillar-cards';
  const dynamicId = props.params?.DynamicPlaceholderId;
  const placeholderName = dynamicId ? `${placeholderKey}-${dynamicId}` : placeholderKey;

  return (
    <section
      key={props.params?.RenderingIdentifier || props.rendering.uid} id={props.params?.RenderingIdentifier || props.params?.id || undefined}
      className="bg-white px-4 pb-12 pt-10 text-[#00008f] sm:px-6 sm:pb-14 sm:pt-9 lg:px-8 lg:pb-20 lg:pt-16"
    >
      <div className="mx-auto max-w-[1110px]">
        <div className="mx-auto max-w-[900px] text-center">
          <Text
            field={props.fields.Heading}
            tag="h2"
            className="font-serif text-[30px] font-light leading-[1.15] text-[#111b35] sm:text-[30px] lg:text-[36px]"
          />
          <Text
            field={props.fields.Subtitle}
            tag="p"
            className="mt-5 font-sans text-[16px] font-semibold leading-6 text-[#18345f] sm:mt-4"
          />
        </div>

        <div className="relative mt-12 flex items-center gap-4 sm:mt-11 lg:mt-14 lg:gap-5">
          <button
            type="button"
            aria-label="Vorige"
            disabled
            className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#dce1eb] text-2xl font-light leading-none text-[#cbd1dc] lg:flex"
          >
            ‹
          </button>

          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-5 lg:grid lg:grid-cols-3 lg:gap-8 lg:overflow-visible">
              <AppPlaceholder
                name={placeholderName}
                rendering={props.rendering}
                page={props.page}
                componentMap={componentMap}
              />
            </div>
          </div>

          <button
            type="button"
            aria-label="Volgende"
            disabled
            className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#dce1eb] text-2xl font-light leading-none text-[#cbd1dc] lg:flex"
          >
            ›
          </button>
        </div>

        <div className="mt-10 flex justify-center gap-4 lg:hidden">
          <button
            type="button"
            aria-label="Vorige"
            disabled
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dce1eb] text-2xl font-light leading-none text-[#cbd1dc]"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Volgende"
            disabled
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dce1eb] text-2xl font-light leading-none text-[#cbd1dc]"
          >
            ›
          </button>
        </div>
      </div>
    </section>
  );
};
