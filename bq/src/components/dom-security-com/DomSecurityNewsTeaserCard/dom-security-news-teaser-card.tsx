import { Image, Link, Text } from "@sitecore-content-sdk/nextjs";
import type { ImageField, LinkField, TextField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps } from "lib/component-props";

interface Fields {
  Image: ImageField;
  Date: TextField;
  Title: TextField;
  Link: LinkField;
}

type NewsTeaserCardProps = ComponentProps & { fields: Fields };

export const Default = (props: NewsTeaserCardProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <article
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="group relative flex min-h-[180px] flex-wrap bg-transparent pb-4 font-[Source_Sans_Pro] font-light text-black max-md:mb-4 max-md:min-h-[180px] max-md:pb-0"
    >
      <div className="w-full overflow-hidden max-md:w-1/3 max-md:shrink-0 max-md:pr-4">
        <Image
          field={fields.Image}
          className="block h-auto w-full transition-transform duration-300 ease-out group-hover:scale-100 lg:scale-110 max-md:h-[162px] max-md:object-cover"
        />
      </div>
      <div className="mt-4 w-full max-md:mt-0 max-md:w-2/3 max-md:shrink-0 max-md:pr-12 lg:mt-4">
        <Text
          field={fields.Date}
          tag="p"
          className="m-0 p-0 text-base font-normal leading-normal text-[#7e7c7c] max-md:text-[0.78rem]"
        />
        <Text
          field={fields.Title}
          tag="h3"
          className="m-0 mb-4 mt-0 text-[1.67rem] font-light leading-8 text-[#333333] max-md:mt-2 max-md:mb-0 max-md:text-[0.833rem] max-md:font-normal max-md:leading-normal"
        />
        <Link
          field={fields.Link}
          className="mt-0 block text-[#00a0de] no-underline max-md:absolute max-md:right-0 max-md:top-1/2 max-md:-translate-y-1/2 max-md:text-[0px]"
          showLinkTextWithChildrenPresent
        >
          <span aria-hidden="true" className="ml-5 inline-block text-base font-normal max-md:ml-0 max-md:text-[1.25rem]">
            →
          </span>
        </Link>
      </div>
    </article>
  );
};
