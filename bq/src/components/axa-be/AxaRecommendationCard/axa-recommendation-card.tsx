import { Image, Link, RichText, Text } from "@sitecore-content-sdk/nextjs";
import type { ImageField, LinkField, RichTextField, TextField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps } from "lib/component-props";

interface Fields {
  Category: TextField;
  Title: TextField;
  Content: RichTextField;
  Rating: TextField;
  "Rating Maximum": TextField;
  "Rating Summary": TextField;
  Image: ImageField;
  Link: LinkField;
}

type RecommendationCardProps = ComponentProps & { fields: Fields };

export const Default = (props: RecommendationCardProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const hasRating = typeof fields.Rating?.value === "string" && fields.Rating.value.trim().length > 0;
  const hasImage = Boolean(fields.Image?.value?.src);

  return (
    <article
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="flex w-full shrink-0 flex-col overflow-hidden rounded-lg bg-[#fafafb] text-[#343c3d] lg:w-[350px]"
    >
      <div className="relative flex h-[140px] shrink-0 items-center justify-center overflow-hidden rounded bg-[#e2efff] px-[35px] py-[15px] lg:h-[200px] lg:px-[65px] lg:py-[25px]">
        {hasRating ? (
          <div className="w-full text-center">
            <div className="relative inline-block font-[Publico] text-[46px] font-light leading-none lg:text-[40px]">
              <Text field={fields.Rating} />
              <span className="absolute bottom-2 left-[calc(100%+6px)] text-[20px] leading-5 lg:bottom-1">/</span>
              <span className="absolute bottom-2 left-[calc(100%+17px)] text-[20px] leading-5 lg:bottom-1">
                <Text field={fields["Rating Maximum"]} />
              </span>
            </div>
            <div className="my-[5px] text-[25px] leading-6 tracking-[3px] text-[#ffb511] lg:my-[10px]" aria-hidden="true">
              ★★★★★
            </div>
            <div className="mx-0 h-px bg-[#dcdde4]" />
            <div className="mt-2 text-sm lg:mt-3">
              <Text field={fields["Rating Summary"]} />
            </div>
          </div>
        ) : (
          <Image
            field={fields.Image}
            className="h-full w-full object-contain"
            width={144}
            height={200}
          />
        )}
      </div>

      <div className="flex flex-grow flex-col items-stretch p-4 lg:p-5">
        <p className="mb-2 text-sm font-semibold leading-4 text-[#64677a] lg:mb-2 lg:leading-6">
          <Text field={fields.Category} />
        </p>
        <h3 className="font-[Source_Sans_Pro] text-xl font-semibold leading-6 lg:text-2xl lg:leading-8">
          <Text field={fields.Title} />
        </h3>
        <div className="mt-4 break-words text-base leading-6">
          <RichText field={fields.Content} />
        </div>
        <div className="flex-grow" />
        <div className="mt-[30px] text-left">
          <Link
            field={fields.Link}
            className="text-sm font-semibold leading-6 text-[#00008f] underline decoration-[rgba(0,0,143,0.32)] underline-offset-[0.3em] lg:text-base"
            showLinkTextWithChildrenPresent
          >
            <span aria-hidden="true" className="ml-4 no-underline">→</span>
          </Link>
        </div>
      </div>
    </article>
  );
};
