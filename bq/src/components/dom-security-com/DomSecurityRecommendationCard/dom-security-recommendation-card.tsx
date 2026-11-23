import { Image, Text } from '@sitecore-content-sdk/nextjs';
import type { ImageField, TextField } from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';

interface Fields {
  Image: ImageField;
  Label: TextField;
  Title: TextField;
}

type RecommendationCardProps = ComponentProps & { fields: Fields };

export const Default = (props: RecommendationCardProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <article
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="group card relative min-h-0 pb-2 font-[Source_Sans_Pro] font-light text-black lg:min-h-[466px]"
    >
      <div className="relative h-[512px] overflow-hidden lg:h-[466px]">
        <Image
          field={fields.Image}
          className="h-full w-full object-cover md:transition-transform md:duration-[350ms] md:ease-out md:group-hover:scale-[1.1]"
        />
        <div className="absolute bottom-0 left-3 right-3 bg-white px-3 py-3 shadow-[7px_7px_65px_-16px_rgba(0,0,0,0.75)] lg:left-[15px] lg:right-[15px] lg:px-[30px] lg:py-4">
          <Text
            field={fields.Label}
            tag="h3"
            className="mb-1 text-[0.78rem] font-medium leading-[0.89rem] text-[#d51130] lg:text-[1.1rem] lg:leading-[1.4rem]"
          />
          <Text
            field={fields.Title}
            tag="h3"
            className="pr-8 text-[0.78rem] font-normal leading-[0.89rem] text-black lg:text-[1.35rem] lg:leading-normal"
          />
          <span
            aria-hidden="true"
            className="absolute bottom-3 right-3 text-[0.7rem] leading-none text-[#00a0de] lg:bottom-4 lg:right-5 lg:text-base"
          >
            →
          </span>
        </div>
      </div>
    </article>
  );
};
