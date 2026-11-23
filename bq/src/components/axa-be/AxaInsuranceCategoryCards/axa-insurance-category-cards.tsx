import { AppPlaceholder } from "@sitecore-content-sdk/nextjs";
import componentMap from ".sitecore/component-map";
import type { ComponentWithContextProps } from "lib/component-props";
import CarouselChrome from './axa-insurance-category-cards.client';

type Fields = Record<string, never>;

type InsuranceCategoryCardsProps = ComponentWithContextProps & { fields: Fields };

export const Default = (props: InsuranceCategoryCardsProps) => {
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const dynamicId = params.DynamicPlaceholderId;
  const placeholderBase = "insurance-categories";
  const placeholderName = dynamicId ? `${placeholderBase}-${dynamicId}` : placeholderBase;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="relative rounded-xl bg-white px-0 pb-20 pt-16 font-[Source_Sans_Pro]"
    >
      <div className="mx-auto w-full rounded-xl">
        <CarouselChrome>
          <AppPlaceholder
            name={placeholderName}
            rendering={props.rendering}
            page={props.page}
            componentMap={componentMap}
          />
        </CarouselChrome>
      </div>
    </section>
  );
};
