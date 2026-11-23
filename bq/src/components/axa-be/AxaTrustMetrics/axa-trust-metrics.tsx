import { AppPlaceholder, Text } from '@sitecore-content-sdk/nextjs';
import type { TextField } from '@sitecore-content-sdk/nextjs';
import componentMap from '.sitecore/component-map';
import type { ComponentWithContextProps } from 'lib/component-props';

interface Fields {
  Heading: TextField;
  Subtitle: TextField;
}

type TrustMetricsProps = ComponentWithContextProps & { fields: Fields };

const placeholderBase = 'trust-metrics';

export const Default = (props: TrustMetricsProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const dynamicId = params.DynamicPlaceholderId;
  const placeholderName = dynamicId ? `${placeholderBase}-${dynamicId}` : placeholderBase;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="relative rounded-[12px] bg-white px-5 pb-12 pt-8 font-['Source_Sans_Pro'] text-[#20212c] md:pb-20 md:pt-10 lg:px-5 lg:pb-20 lg:pt-16"
    >
      <div className="mx-auto w-full max-w-[1110px]">
        <Text
          field={fields.Heading}
          tag="h2"
          className="text-center font-['Publico'] text-[28px] font-light leading-[1.22] text-[#20212c] md:text-[36px]"
        />
        <Text
          field={fields.Subtitle}
          tag="p"
          className="mt-4 text-center text-[18px] font-semibold leading-6 text-[#4a4c5a] md:mt-6"
        />
        <div className="mx-auto mt-10 flex w-full flex-col items-stretch justify-center text-center md:mt-16 md:flex-row md:flex-wrap lg:mt-20 lg:max-w-[1110px] lg:[&>*+*]:border-l lg:[&>*+*]:border-black/25 lg:[&>*+*]:border-opacity-25">
                    <div className="flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:justify-center lg:gap-[30px] [&>*]:w-[min(90%,350px)] [&>*]:shrink-0 [&>*]:snap-center">
            <AppPlaceholder
            name={placeholderName}
            rendering={props.rendering}
            page={props.page}
            componentMap={componentMap}
            />
          </div>
        </div>
      </div>
    </section>
  );
};
