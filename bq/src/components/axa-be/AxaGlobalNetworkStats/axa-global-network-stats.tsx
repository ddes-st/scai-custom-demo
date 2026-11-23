import { AppPlaceholder, Text } from "@sitecore-content-sdk/nextjs";
import type { TextField } from "@sitecore-content-sdk/nextjs";
import componentMap from ".sitecore/component-map";
import type { ComponentWithContextProps } from "lib/component-props";

interface Fields {
  Heading: TextField;
  Subtitle: TextField;
}

type GlobalNetworkStatsProps = ComponentWithContextProps & { fields: Fields };

export const Default = (props: GlobalNetworkStatsProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const placeholderBase = "global-network-stats";
  const dynamicId = params.DynamicPlaceholderId;
  const placeholderName = dynamicId ? `${placeholderBase}-${dynamicId}` : placeholderBase;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="relative rounded-[12px] bg-white px-5 pt-8 pb-12 font-[Source_Sans_Pro] text-[#20212c] md:px-5 md:pt-16 md:pb-20 lg:pt-16 lg:pb-20"
    >
      <div className="relative mx-auto w-full max-w-[1110px] text-center">
        <Text
          field={fields.Heading}
          tag="h2"
          className="font-['Publico'] text-[28px] font-light leading-[1.22] text-[#20212c] md:text-[36px] lg:text-[36px]"
        />
      </div>

      <div className="mx-auto mt-4 w-full max-w-[1110px] text-center text-[18px] font-semibold leading-6 text-[#4a4c5a] md:mt-6 lg:mt-6">
        <Text field={fields.Subtitle} tag="p" />
      </div>

      <div className="mx-auto mt-10 flex w-full max-w-[1110px] flex-col items-center justify-center text-center md:mt-14 md:flex-row md:flex-wrap md:items-start lg:mt-14 lg:flex-row lg:flex-wrap lg:items-start lg:[&>*+*]:border-l lg:[&>*+*]:border-black/25">
        <AppPlaceholder
          name={placeholderName}
          rendering={props.rendering}
          page={props.page}
          componentMap={componentMap}
        />
      </div>
    </section>
  );
};
