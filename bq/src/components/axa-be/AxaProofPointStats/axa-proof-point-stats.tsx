import { AppPlaceholder, Text } from "@sitecore-content-sdk/nextjs";
import componentMap from ".sitecore/component-map";
import type { ComponentWithContextProps } from "lib/component-props";
import type { TextField } from "@sitecore-content-sdk/nextjs";

interface Fields {
  Heading: TextField;
  Subtitle: TextField;
}

type ProofPointStatsProps = ComponentWithContextProps & { fields: Fields };

export const Default = (props: ProofPointStatsProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const dynamicPlaceholderId = params.DynamicPlaceholderId;
  const placeholderBase = "proof-point-stats-items";
  const placeholderName = dynamicPlaceholderId
    ? `${placeholderBase}-${dynamicPlaceholderId}`
    : placeholderBase;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="relative bg-white px-5 py-8 font-[Source_Sans_Pro] text-[#20212c] md:py-16 lg:py-16 lg:pb-20"
    >
      <div className="mx-auto w-full max-w-[1110px] text-center">
        <Text
          field={fields.Heading}
          tag="h2"
          className="font-['Publico'] text-[28px] font-light leading-[1.22] text-[#00008f] lg:text-[36px]"
        />
        <Text
          field={fields.Subtitle}
          tag="p"
          className="mt-4 text-[18px] font-semibold leading-6 text-[#4a4c5a] md:mt-6"
        />
        <div className="mx-auto mt-10 flex w-full flex-col items-center justify-center text-center md:mt-14 md:flex-row md:flex-wrap md:items-start md:[&>*]:w-1/3 md:[&>*]:px-5 md:[&>*+*]:mt-0 md:[&>*+*]:border-l md:[&>*+*]:border-black/25 lg:mt-14 lg:[&>*]:px-[15px] lg:[&>*+*]:border-black/25">
          <AppPlaceholder
            name={placeholderName}
            rendering={props.rendering}
            page={props.page}
            componentMap={componentMap}
          />
        </div>
      </div>
    </section>
  );
};
