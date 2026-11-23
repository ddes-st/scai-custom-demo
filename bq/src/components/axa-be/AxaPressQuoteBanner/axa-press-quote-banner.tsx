import { Link, RichText, Text } from '@sitecore-content-sdk/nextjs';
import type { LinkField, RichTextField, TextField } from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';

interface Fields {
  Heading: TextField;
  Subtitle: TextField;
  Quote: RichTextField;
  "Featured Press Release": LinkField;
  "All Press Releases": LinkField;
}

type PressQuoteBannerProps = ComponentProps & { fields: Fields };

export const Default = (props: PressQuoteBannerProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="relative rounded-[12px] bg-[#e2efff] px-5 py-8 font-['Source_Sans_Pro'] text-[#20212c] md:px-5 md:py-10 lg:px-5 lg:py-16"
    >
      <div className="relative mx-auto w-full max-w-[920px]">
        <Text
          field={fields.Heading}
          tag="h2"
          className="mb-4 text-center font-['Publico'] text-[28px] font-light leading-[1.22] md:mb-5 md:text-[30px] lg:mb-10 lg:text-[36px]"
        />
        <Text
          field={fields.Subtitle}
          tag="p"
          className="mb-10 text-center text-[18px] font-semibold leading-6 text-[#4a4c5a] md:mb-10 lg:mb-14"
        />
        <figure className="relative px-6 before:absolute before:left-0 before:top-[-32px] before:z-0 before:font-['Publico'] before:text-[112px] before:font-bold before:leading-[0.8] before:text-[#afc1d5] before:content-['“'] md:px-6 lg:px-6">
          <RichText
            field={fields.Quote}
            className="relative z-[1] text-[18px] font-semibold leading-[1.5] md:text-[18px] lg:text-[24px]"
          />
        </figure>
        <div className="mt-8 flex flex-col items-center justify-center gap-0 text-center md:mt-6 lg:mt-8 lg:flex-row lg:gap-8">
          <Link
            field={fields["Featured Press Release"]}
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full border border-[#00008f] bg-[#00008f] px-5 py-[11px] text-center text-base font-semibold leading-6 text-white transition-colors hover:bg-[#0000d2] md:w-full lg:w-auto"
          />
          <Link
            field={fields["All Press Releases"]}
            className="mt-8 inline-flex items-center text-[14px] font-semibold leading-6 text-[#00008f] underline decoration-[rgba(0,0,143,0.32)] underline-offset-[0.3em] lg:mt-0 lg:text-base"
            showLinkTextWithChildrenPresent
          >
            <span aria-hidden="true" className="ml-4 no-underline">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
};
