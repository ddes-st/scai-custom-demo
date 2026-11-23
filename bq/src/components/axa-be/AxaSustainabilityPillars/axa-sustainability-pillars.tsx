import { AppPlaceholder, Text } from "@sitecore-content-sdk/nextjs";
import type { TextField } from "@sitecore-content-sdk/nextjs";
import componentMap from ".sitecore/component-map";
import type { ComponentWithContextProps } from "lib/component-props";
import Chrome from './axa-sustainability-pillars.client';

interface Fields {
  Heading: TextField;
  Subtitle: TextField;
}

type SustainabilityPillarsProps = ComponentWithContextProps & { fields: Fields };

export const Default = (props: SustainabilityPillarsProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const dynamicId = params.DynamicPlaceholderId;
  const placeholderBase = "sustainability-pillars";
  const placeholderName = dynamicId ? `${placeholderBase}-${dynamicId}` : placeholderBase;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="section relative px-4 pb-[48px] pt-[32px] font-[Source_Sans_Pro] text-[#20212c] md:px-5 md:pb-[80px] md:pt-[64px]"
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
        <div className="mt-10 w-full md:mt-14">
          <Chrome>
            <AppPlaceholder
              name={placeholderName}
              rendering={props.rendering}
              page={props.page}
              componentMap={componentMap}
            />
          </Chrome>
        </div>
      </div>
    </section>
  );
};
