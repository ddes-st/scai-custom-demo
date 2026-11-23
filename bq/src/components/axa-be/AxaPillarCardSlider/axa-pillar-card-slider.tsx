import { AppPlaceholder, Text } from '@sitecore-content-sdk/nextjs';
import componentMap from '.sitecore/component-map';
import type { ComponentWithContextProps } from 'lib/component-props';
import type { TextField } from '@sitecore-content-sdk/nextjs';

interface Fields {
  Heading: TextField;
  Subtitle: TextField;
}

type PillarCardSliderProps = ComponentWithContextProps & { fields: Fields };

export const Default = (props: PillarCardSliderProps) => {
  const { fields } = props;
  const dynId = props.params?.DynamicPlaceholderId;
  const baseKey = 'pillar-cards';
  const placeholderName = dynId ? `${baseKey}-${dynId}` : baseKey;

  return (
    <section
      key={props.params?.RenderingIdentifier || props.rendering.uid} id={props.params?.RenderingIdentifier || props.params?.id || undefined}
      className="relative bg-white px-4 py-8 font-sans text-[#20212c] sm:px-5 sm:py-12 lg:py-16"
    >
      <div className="mx-auto w-full max-w-[1110px]">
        <div className="text-center">
          <Text
            field={fields.Heading}
            tag="h2"
            className="font-[Publico] text-[28px] font-light leading-[1.22] text-[#20212c] sm:text-4xl"
          />
          <Text
            field={fields.Subtitle}
            tag="p"
            className="mt-4 text-lg font-semibold leading-6 text-[#4a4c5a] sm:mt-6"
          />
        </div>

        <div className="relative mt-10 sm:mt-14 lg:px-0">
          <button
            type="button"
            disabled
            aria-label="Vorige pijler"
            className="absolute left-[-2px] top-1/2 z-10 hidden h-10 w-10 -translate-x-full -translate-y-1/2 items-center justify-center rounded-full border border-[#dcdde4] text-2xl leading-none text-[#c6c9d3] disabled:cursor-default md:flex lg:left-[-20px]"
          >
            <span aria-hidden="true">‹</span>
          </button>

          <div className="overflow-x-auto snap-x snap-mandatory scrollbar-none">
            <div className="flex items-stretch justify-start gap-4 px-0.5 py-1 sm:gap-5 lg:justify-center lg:gap-[30px]">
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
            disabled
            aria-label="Volgende pijler"
            className="absolute right-[-2px] top-1/2 z-10 hidden h-10 w-10 translate-x-full -translate-y-1/2 items-center justify-center rounded-full border border-[#dcdde4] text-2xl leading-none text-[#c6c9d3] disabled:cursor-default md:flex lg:right-[-20px]"
          >
            <span aria-hidden="true">›</span>
          </button>

          <div className="mt-8 flex justify-center gap-5 md:mt-11">
            <button
              type="button"
              disabled
              aria-label="Vorige pijler"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dcdde4] text-2xl leading-none text-[#c6c9d3] md:hidden"
            >
              <span aria-hidden="true">‹</span>
            </button>
            <button
              type="button"
              disabled
              aria-label="Volgende pijler"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dcdde4] text-2xl leading-none text-[#c6c9d3] md:hidden"
            >
              <span aria-hidden="true">›</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
