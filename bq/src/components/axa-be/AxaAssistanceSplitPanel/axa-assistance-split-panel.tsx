import { Image, Link, RichText, Text } from '@sitecore-content-sdk/nextjs';
import type { ImageField, LinkField, RichTextField, TextField } from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';

interface Fields {
  Title: TextField;
  Description: RichTextField;
  Image: ImageField;
  CTA: LinkField;
}

type AssistanceSplitPanelProps = ComponentProps & { fields: Fields };

export const Default = (props: AssistanceSplitPanelProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="rounded-xl bg-[#e2efff] p-2 font-['Source_Sans_Pro'] text-[#20212c]"
    >
      <div className="flex flex-col items-stretch lg:flex-row">
        <div className="relative flex h-[122px] w-full items-center justify-center overflow-hidden rounded-lg bg-white lg:h-[334px] lg:w-1/2">
          <Image
            field={fields.Image}
            className="relative z-10 max-h-full w-auto max-w-[calc(100%-40px)] object-contain lg:max-w-[330px]"
          />
        </div>
        <div className="flex w-full items-center rounded-lg lg:h-[334px] lg:w-1/2">
          <div className="w-full px-5 py-8 lg:px-16 lg:py-16">
            <Text
              field={fields.Title}
              tag="h2"
              className="font-[Publico] text-[28px] font-light leading-[1.22] lg:text-[36px]"
            />
            <RichText
              field={fields.Description}
              className="mt-5 text-base leading-6 [&_p]:m-0"
            />
            <Link
              field={fields.CTA}
              className="mt-8 inline-flex min-h-[48px] w-full items-center justify-center rounded-full border border-[#ec000a] bg-[#ec000a] px-5 py-[11px] text-center font-['Source_Sans_Pro'] text-base font-semibold leading-6 text-white transition-colors hover:border-[#bd0006] hover:bg-[#bd0006] lg:mt-8 lg:w-auto"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
