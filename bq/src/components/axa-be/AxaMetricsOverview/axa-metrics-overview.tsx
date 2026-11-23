import { AppPlaceholder, Text } from '@sitecore-content-sdk/nextjs';
import type { TextField } from '@sitecore-content-sdk/nextjs';
import componentMap from '.sitecore/component-map';
import type { ComponentWithContextProps } from 'lib/component-props';

interface Fields {
  Heading: TextField;
  Subtitle: TextField;
}

type MetricsOverviewProps = ComponentWithContextProps & { fields: Fields };

const placeholderBase = 'metrics';

export const Default = (props: MetricsOverviewProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const dynamicId = params.DynamicPlaceholderId;
  const placeholderName = dynamicId ? `${placeholderBase}-${dynamicId}` : placeholderBase;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="relative rounded-[12px] bg-white px-5 py-8 md:py-16 lg:py-16"
    >
      <div className="mx-auto w-full max-w-[1110px]">
        <div className="text-center">
          <Text
            field={fields.Heading}
            tag="h2"
            className="font-['Publico'] text-[28px] font-light leading-[1.22] text-[#20212c] lg:text-[36px]"
          />
          <Text
            field={fields.Subtitle}
            tag="p"
            className="mt-4 text-[18px] font-semibold leading-6 text-[#4a4c5a] md:mt-6"
          />
        </div>

        <div className="mt-10 grid grid-cols-1 text-center md:mt-14 md:grid-cols-3 lg:mt-14 lg:[&>*+*]:border-l lg:[&>*+*]:border-black/25">
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
