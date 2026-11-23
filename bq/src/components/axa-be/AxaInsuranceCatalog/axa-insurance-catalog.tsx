import { AppPlaceholder, Text } from "@sitecore-content-sdk/nextjs";
import componentMap from ".sitecore/component-map";
import type { TextField } from "@sitecore-content-sdk/nextjs";
import type { ComponentWithContextProps } from "lib/component-props";

interface Fields {
  Heading: TextField;
}

type InsuranceCatalogProps = ComponentWithContextProps & { fields: Fields };

export const Default = (props: InsuranceCatalogProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const dynamicPlaceholderId = params.DynamicPlaceholderId;
  const placeholderBase = "insurance-categories";
  const placeholderName = dynamicPlaceholderId
    ? `${placeholderBase}-${dynamicPlaceholderId}`
    : placeholderBase;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="relative bg-white px-5 pb-12 pt-8 md:px-5 md:pb-12 md:pt-8 lg:pb-20 lg:pt-16"
    >
      <div className="mx-auto w-full max-w-[1110px]">
        <Text
          field={fields.Heading}
          tag="h2"
          className="text-center font-[Publico] text-[28px] font-light leading-[1.22] text-[#20212c] lg:text-4xl"
        />

        <div className="mt-10 rounded-[12px] bg-[#f2f2f6] px-5 py-0 md:mt-10 md:px-5 lg:mt-14 lg:px-8 lg:pb-8">
          <div className="flex flex-col lg:grid lg:grid-cols-3 lg:gap-x-[104px] lg:gap-y-4">
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
