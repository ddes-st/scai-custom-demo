import { AppPlaceholder, Image, Link } from '@sitecore-content-sdk/nextjs';
import componentMap from '.sitecore/component-map';
import type { ImageField, LinkField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';

interface Fields {
  "Brand Endorsement": ImageField;
  "Country Selector": LinkField;
}

type DomSecurityFooterProps = ComponentWithContextProps & { fields: Fields };

export const Default = (props: DomSecurityFooterProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const dynId = params.DynamicPlaceholderId;
  const contentPh = dynId ? `footer-content-${dynId}` : 'footer-content';
  const legalPh = dynId ? `footer-legal-${dynId}` : 'footer-legal';
  const socialPh = dynId ? `footer-social-${dynId}` : 'footer-social';

  return (
    <footer
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="bg-[#646363] font-[Source_Sans_Pro] text-[18px] font-light leading-[1.43] text-[#cac9c9]"
    >
      <div className="mx-auto max-w-[1170px] px-[15px]">
        <div className="relative flex flex-col gap-8 py-6 md:gap-9 md:py-6 lg:grid lg:grid-cols-[160px_minmax(0,1fr)_minmax(0,1fr)_170px] lg:gap-0 lg:py-6">
          <div className="w-[160px] shrink-0 lg:mr-6">
            <Image
              field={fields["Brand Endorsement"]}
              className="block max-h-[97px] max-w-[160px] object-contain object-left"
            />
          </div>

          <div className="absolute right-0 top-0 md:right-[15px] lg:static lg:col-span-3 lg:row-span-2 lg:flex lg:items-end lg:justify-end">
            <Link
              field={fields["Country Selector"]}
              className="relative block min-w-[9rem] rounded-[3px] bg-black px-2 py-1.5 pr-12 text-left font-normal leading-6 text-white no-underline hover:text-white focus:text-white md:mt-[-1px] lg:mb-0 lg:mr-2"
              showLinkTextWithChildrenPresent
            >
              <span aria-hidden="true" className="mr-2 inline-block h-4 w-4 align-[-2px] bg-[linear-gradient(to_bottom,#000_0_33%,#ffd800_33%_66%,#ed2939_66%)]" />
              <span aria-hidden="true" className="absolute right-0 top-0 flex h-full w-9 items-center justify-center border-l border-[#4a4a4a] text-xl font-light">→</span>
            </Link>
          </div>

          <div className="min-w-0 lg:col-span-2 lg:row-start-1 lg:pl-0 lg:pr-8">
            <div className="flex flex-col md:flex-row md:flex-wrap lg:flex-row">
              <AppPlaceholder
                name={contentPh}
                rendering={props.rendering}
                page={props.page}
                componentMap={componentMap}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-[#696868] py-3 lg:mt-0 lg:flex lg:min-h-[125px] lg:items-center lg:justify-between lg:gap-8 lg:py-4">
          <div className="min-w-0 flex-1">
            <AppPlaceholder
              name={legalPh}
              rendering={props.rendering}
              page={props.page}
              componentMap={componentMap}
            />
          </div>
          <div className="flex shrink-0 items-center">
            <AppPlaceholder
              name={socialPh}
              rendering={props.rendering}
              page={props.page}
              componentMap={componentMap}
            />
          </div>
        </div>
      </div>
    </footer>
  );
};
