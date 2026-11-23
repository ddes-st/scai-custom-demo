import { Image, Link, RichText, Text } from '@sitecore-content-sdk/nextjs';
import type { ImageField, LinkField, RichTextField, TextField } from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';

interface Fields {
  Image: ImageField;
  Title: TextField;
  Content: RichTextField;
  Link: LinkField;
}

type PillarCardProps = ComponentProps & { fields: Fields };

export const Default = (props: PillarCardProps) => {
  const { fields } = props;

  return (
    <article
      key={props.params.RenderingIdentifier || props.rendering.uid} id={props.params?.RenderingIdentifier || props.params?.id || undefined}
      className="flex w-[min(90%,350px)] shrink-0 snap-center flex-col rounded-lg bg-[#fafafb] p-1 text-[#343c3d]"
    >
      <div className="h-[140px] shrink-0 overflow-hidden rounded-[4px] px-[31px] py-[15px] md:h-[200px] md:px-[65px] md:py-[25px]">
        <Image
          field={fields.Image}
          className="h-full w-full object-contain"
          width={350}
          height={200}
        />
      </div>
      <div className="flex min-h-[266px] flex-1 flex-col p-4">
        <Text
          field={fields.Title}
          tag="h3"
          className="text-[20px] font-semibold leading-6 md:text-[24px] md:leading-8"
        />
        <RichText
          field={fields.Content}
          className="mt-4 text-base leading-6"
        />
        <div className="mt-auto pt-6">
          <Link
            field={fields.Link}
            showLinkTextWithChildrenPresent
            className="inline-flex items-center text-sm font-semibold leading-6 text-[#00008f] underline decoration-[rgba(0,0,143,0.32)] underline-offset-[0.3em] md:text-base"
          >
            <span className="ml-4 no-underline" aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </article>
  );
};
