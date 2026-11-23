import { AppPlaceholder, Image, Link, Text } from '@sitecore-content-sdk/nextjs';
import type { ImageField, LinkField, TextField } from '@sitecore-content-sdk/nextjs';
import { ComponentWithContextProps } from 'lib/component-props';
import componentMap from '.sitecore/component-map';

interface Fields {
  Heading: TextField;
  CTA: LinkField;
  "Partner Logo": ImageField;
  "Desktop Image": ImageField;
  "Mobile Image": ImageField;
}

type AdvisorSupportSplitProps = ComponentWithContextProps & { fields: Fields };

export const Default = (props: AdvisorSupportSplitProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const dynamicId = params.DynamicPlaceholderId;
  const placeholderBase = 'advisor-benefits';
  const placeholderName = dynamicId ? `${placeholderBase}-${dynamicId}` : placeholderBase;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="w-full rounded-[12px] bg-[#e2efff] p-2 text-[#20212c]"
    >
      <div className="grid items-stretch lg:grid-cols-2">
        <div className="order-2 flex min-w-0 flex-col rounded-[8px] px-5 py-8 md:px-5 md:py-8 lg:order-1 lg:px-[7.3vw] lg:py-16">
          <Text
            field={fields.Heading}
            tag="h3"
            className="font-['Publico'] text-[26px] font-light leading-[1.2] text-[#20212c] lg:text-[32px]"
          />
          <div className="mt-4 flex flex-col gap-3.5 text-[16px] leading-6 lg:mt-7">
            <AppPlaceholder
              name={placeholderName}
              rendering={props.rendering}
              page={props.page}
              componentMap={componentMap}
            />
          </div>
          <Link
            field={fields.CTA}
            className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center rounded-full border border-[#00008f]/30 px-5 py-2.5 text-center font-['Source_Sans_Pro'] text-[16px] font-semibold leading-6 text-[#00008f] lg:mt-8 lg:w-fit"
            showLinkTextWithChildrenPresent
          >
            <span />
          </Link>
          <Image
            field={fields["Partner Logo"]}
            className="mt-8 h-auto w-[314px] max-w-full object-contain object-left lg:mt-8"
          />
        </div>
        <div className="order-1 min-w-0 overflow-hidden rounded-[8px] lg:order-2">
          <Image
            field={fields["Desktop Image"]}
            className="hidden h-full min-h-[520px] w-full object-cover object-center lg:block"
          />
          <Image
            field={fields["Mobile Image"]}
            className="block aspect-[718/468] h-auto w-full object-cover object-center lg:hidden"
          />
        </div>
      </div>
    </section>
  );
};
