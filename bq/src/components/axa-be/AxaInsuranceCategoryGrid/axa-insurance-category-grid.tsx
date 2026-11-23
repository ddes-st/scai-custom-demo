import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
import componentMap from '.sitecore/component-map';
import type { ComponentWithContextProps } from 'lib/component-props';
import CarouselChrome from './axa-insurance-category-grid.client';

interface Fields {}

type InsuranceCategoryGridProps = ComponentWithContextProps & { fields: Fields };

const placeholderBase = 'insurance-category-grid';

export const Default = (props: InsuranceCategoryGridProps) => {
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const dynamicId = params.DynamicPlaceholderId;
  const placeholderName = dynamicId ? `${placeholderBase}-${dynamicId}` : placeholderBase;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="relative bg-white px-5 py-16 md:px-8 lg:px-0 lg:py-16"
    >
      <div className="mx-auto w-full max-w-[1110px]">
        <CarouselChrome>
                    <div className="flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:justify-center lg:gap-[30px] [&>*]:w-[min(90%,350px)] [&>*]:shrink-0 [&>*]:snap-center">
            <AppPlaceholder
            name={placeholderName}
            rendering={props.rendering}
            page={props.page}
            componentMap={componentMap}
            />
          </div>
        </CarouselChrome>
      </div>
    </section>
  );
};
