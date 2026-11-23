import { AppPlaceholder, Text } from "@sitecore-content-sdk/nextjs";
import componentMap from ".sitecore/component-map";
import type { ComponentWithContextProps } from "lib/component-props";
import RecommendationGridChrome from './dom-security-recommendation-grid.client';
import type { TextField } from "@sitecore-content-sdk/nextjs";

interface Fields {
  Heading: TextField;
}

type RecommendationGridProps = ComponentWithContextProps & { fields: Fields };

export const Default = (props: RecommendationGridProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const dynId = params.DynamicPlaceholderId;
  const placeholderBase = "recommendation-cards";
  const placeholderName = dynId ? `${placeholderBase}-${dynId}` : placeholderBase;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="w-full bg-white font-[Source_Sans_Pro] text-black"
    >
      <div className="mx-auto w-full px-[15px] lg:max-w-[1170px]">
        <Text
          field={fields.Heading}
          tag="h2"
          className="accent mb-4 ml-[0.95rem] text-[1.278rem] font-light leading-[1.39rem] before:mr-[0.8rem] before:ml-[-0.95rem] before:inline-block before:h-[1rem] before:w-[0.2rem] before:bg-[#d51130] lg:mb-20 lg:text-[2.55rem] lg:leading-[2.78rem] lg:before:h-[1.6rem]"
        />
        <div className="relative">
          <RecommendationGridChrome>
            <AppPlaceholder
              name={placeholderName}
              rendering={props.rendering}
              page={props.page}
              componentMap={componentMap}
            />
          </RecommendationGridChrome>
        </div>
      </div>
    </section>
  );
};
