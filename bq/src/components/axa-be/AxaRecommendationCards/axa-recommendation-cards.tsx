import { AppPlaceholder, Text } from "@sitecore-content-sdk/nextjs";
import componentMap from ".sitecore/component-map";
import type { ComponentWithContextProps } from "lib/component-props";
import RecommendationCardsChrome from './axa-recommendation-cards.client';
import type { TextField } from "@sitecore-content-sdk/nextjs";

interface Fields {
  Heading: TextField;
}

type RecommendationCardsProps = ComponentWithContextProps & { fields: Fields };

export const Default = (props: RecommendationCardsProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const dynamicId = params.DynamicPlaceholderId;
  const placeholderBase = "recommendation-cards";
  const placeholderName = dynamicId ? `${placeholderBase}-${dynamicId}` : placeholderBase;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="relative bg-white px-4 pb-12 pt-8 font-[Source_Sans_Pro] text-[#20212c] md:px-5 md:pb-20 md:pt-10 lg:pb-20 lg:pt-16"
    >
      <div className="mx-auto w-full max-w-[1110px]">
        <Text
          field={fields.Heading}
          tag="h2"
          className="text-center font-['Publico'] text-[28px] font-light leading-[1.22] text-[#20212c] md:text-[36px]"
        />
        <div className="mt-10 md:mt-14">
          <RecommendationCardsChrome>
            <AppPlaceholder
              name={placeholderName}
              rendering={props.rendering}
              page={props.page}
              componentMap={componentMap}
            />
          </RecommendationCardsChrome>
        </div>
      </div>
    </section>
  );
};
