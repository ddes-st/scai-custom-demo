import { Text, Image, Link } from '@sitecore-content-sdk/nextjs';
import type { ImageField, LinkField, TextField } from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';

interface Fields {
  Title?: TextField;
  Date?: TextField;
  Image?: ImageField;
  Link?: LinkField;
}

type Props = ComponentProps & { fields?: Fields };

export const Default = (props: Props) => {
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const hasDate = Boolean(props.fields?.Date?.value);

  return (
    <article
      key={renderingId || props.rendering?.uid || 'DomSecurityNewsTeaser'}
      id={renderingId || undefined}
      className="group relative mb-4 font-['Source_Sans_Pro',sans-serif] font-light text-[#333] md:mb-0 md:pb-12"
      data-component="DomSecurityNewsTeaser"
    >
      <div className="max-md:flex max-md:items-center">
        {props.fields?.Image ? (
          <div className="overflow-hidden max-md:w-1/3 max-md:shrink-0 max-md:pr-4">
            <Image
              field={props.fields.Image}
              className="block aspect-[4/3] h-auto w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04] max-md:aspect-auto max-md:h-[162px]"
            />
          </div>
        ) : null}
        <div className="mt-[18px] max-md:relative max-md:mt-0 max-md:w-2/3 max-md:pr-12">
          {hasDate ? (
            <Text
              field={props.fields?.Date}
              tag="p"
              className="m-0 p-0 text-[18px] font-normal leading-8 text-[#7e7c7c] max-md:text-[14px] max-md:leading-normal"
            />
          ) : null}
          <Text
            field={props.fields?.Title}
            tag="h3"
            className="m-0 mb-[18px] text-[30.06px] font-light leading-9 text-[#333] max-md:mb-0 max-md:mt-2 max-md:text-[15px] max-md:font-normal max-md:leading-normal"
          />
          {props.fields?.Link ? (
            <Link
              field={props.fields.Link}
              className="inline-flex items-center text-[18px] font-normal leading-[26px] text-[#00a0de] no-underline hover:text-[#00a0de] max-md:absolute max-md:top-1/2 max-md:right-0 max-md:-translate-y-1/2 max-md:text-[0px]"
              showLinkTextWithChildrenPresent
            >
              <span aria-hidden="true" className="ml-5 inline-block text-[18px] leading-none max-md:ml-0 max-md:text-[20px]">
                →
              </span>
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
};
