import { Image, Link, Text } from '@sitecore-content-sdk/nextjs';
import type { ImageField, LinkField, TextField } from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';
import { FaIcon } from 'components/icons/fa-icon';

interface Fields {
  "Brand Logo": ImageField;
  "Brand Link": LinkField;
  "Homeowners Link": LinkField;
  "Professionals Link": LinkField;
  "Manufacturers Link": LinkField;
  "Products Link": LinkField;
  "Careers Link": LinkField;
  "Service Support Link": LinkField;
  "About Us Link": LinkField;
  "Contact Us Link": LinkField;
  "Imprint Link": LinkField;
  "Terms Link": LinkField;
  "Data Protection Link": LinkField;
  "Facebook Link": LinkField;
  "Facebook Icon": TextField;
  "Linkedin Link": LinkField;
  "Linkedin Icon": TextField;
  "Youtube Link": LinkField;
  "Youtube Icon": TextField;
  "Country Link": LinkField;
}

type DomSecurityGlobalFooterProps = ComponentProps & { fields: Fields };

type FooterLinkProps = {
  field: LinkField;
  className?: string;
  arrow?: boolean;
};

const FooterLink = ({ field, className = "", arrow = false }: FooterLinkProps) => (
  <Link
    field={field}
    className={`group inline-block text-[#cac9c9] transition-colors hover:text-white focus:text-white ${className}`}
    {...(arrow ? { showLinkTextWithChildrenPresent: true } : {})}
  >
    {arrow ? <span aria-hidden="true" className="ml-4">→</span> : null}
  </Link>
);

export const Default = (props: DomSecurityGlobalFooterProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <footer
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="bg-[#646363] font-[Source_Sans_Pro] text-[18px] font-light leading-[1.43] text-[#cac9c9]"
    >
      <div className="mx-auto w-full max-w-[1170px] px-[15px] py-6 md:max-w-none lg:py-8">
        <div className="flex flex-col lg:flex-row lg:items-start">
          <div className="mb-7 shrink-0 lg:mb-0 lg:w-[170px] lg:pr-[15px]">
            <Link field={fields["Brand Link"]} className="inline-block" aria-label="Brand">
              <Image
                field={fields["Brand Logo"]}
                className="h-auto w-[160px] max-w-full object-contain"
              />
            </Link>
          </div>

          <nav aria-label="Footer navigation" className="grid grid-cols-1 gap-1 md:grid-cols-2 lg:flex-1 lg:gap-0">
            <div className="border-transparent md:pr-8 lg:border-r lg:border-[#696868] lg:pr-12">
              <div className="flex flex-col gap-1 md:gap-2">
                <FooterLink field={fields["Homeowners Link"]} arrow className="py-1 text-[0.9rem] md:text-base" />
                <FooterLink field={fields["Professionals Link"]} arrow className="py-1 text-[0.9rem] md:text-base" />
                <FooterLink field={fields["Manufacturers Link"]} arrow className="py-1 text-[0.9rem] md:text-base" />
                <FooterLink field={fields["Products Link"]} arrow className="py-1 text-[0.9rem] md:text-base" />
              </div>
            </div>
            <div className="md:pl-8 lg:pl-12">
              <div className="flex flex-col gap-1 md:gap-2">
                <FooterLink field={fields["Careers Link"]} arrow className="py-1 text-[0.9rem] md:text-base" />
                <FooterLink field={fields["Service Support Link"]} arrow className="py-1 text-[0.9rem] md:text-base" />
                <FooterLink field={fields["About Us Link"]} arrow className="py-1 text-[0.9rem] md:text-base" />
                <FooterLink field={fields["Contact Us Link"]} arrow className="py-1 text-[0.9rem] md:text-base" />
              </div>
            </div>
          </nav>
        </div>

        <div className="mt-7 border-t border-[#696868] pt-3 lg:mt-8 lg:pt-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-wrap gap-x-7 gap-y-1 lg:items-center">
              <FooterLink field={fields["Imprint Link"]} className="text-[0.78rem] md:text-base" />
              <FooterLink field={fields["Terms Link"]} className="text-[0.78rem] md:text-base" />
              <FooterLink field={fields["Data Protection Link"]} className="text-[0.78rem] md:text-base" />
            </div>

            <div className="flex flex-col gap-2 lg:items-start">
              <div className="flex items-center gap-7 text-[#b0b0b0]">
                <Link field={fields["Facebook Link"]} className="text-[#b0b0b0] hover:text-white" aria-label="Facebook">
                  <FaIcon name="facebook" faStyle="brands" className="inline-block h-7 w-7" />
                </Link>
                <Link field={fields["Linkedin Link"]} className="text-[#b0b0b0] hover:text-white" aria-label="Linkedin">
                  <FaIcon name="linkedin" faStyle="brands" className="inline-block h-7 w-7" />
                </Link>
                <Link field={fields["Youtube Link"]} className="text-[#b0b0b0] hover:text-white" aria-label="Youtube">
                  <FaIcon name="youtube" faStyle="brands" className="inline-block h-7 w-7" />
                </Link>
              </div>
              <Link
                field={fields["Country Link"]}
                className="relative inline-flex min-w-[9rem] items-center justify-between rounded-[3px] bg-black px-2 py-1 text-[0.9rem] font-normal text-white no-underline hover:text-white"
              >
                <span className="mr-2 inline-block h-5 w-5 bg-[url('https://www.dom-security.com/design/img/flags/4x3/be.svg')] bg-contain bg-center bg-no-repeat" aria-hidden="true" />
                <span aria-hidden="true" className="mr-auto">BE</span>
                <span aria-hidden="true" className="border-l border-[#4a4a4a] pl-2 text-xl leading-none">→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
