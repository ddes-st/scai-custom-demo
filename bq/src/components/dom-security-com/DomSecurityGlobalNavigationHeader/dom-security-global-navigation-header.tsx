import { Image, Link, RichText, Text } from '@sitecore-content-sdk/nextjs';
import type { ImageField, LinkField, RichTextField, TextField } from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';

interface Fields {
  Heading: TextField;
  Logo: ImageField;
  "Logo Link": LinkField;
  Navigation: RichTextField;
  "Product Menu": RichTextField;
  Languages: RichTextField;
  "Search Label": TextField;
  "Search Placeholder": TextField;
}

type DomSecurityGlobalNavigationHeaderProps = ComponentProps & { fields: Fields };

export const Default = (props: DomSecurityGlobalNavigationHeaderProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <header
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="relative z-[9999] bg-white font-[Source_Sans_Pro] font-light text-black max-lg:fixed max-lg:inset-x-0 max-lg:top-0 max-lg:shadow-[0_0_9px_rgba(0,0,0,0.45)]"
    >
      <div className="mx-auto w-full px-[15px] lg:max-w-[1170px]">
        <nav className="relative flex min-h-[50px] items-center lg:min-h-[96px] lg:pl-[100px]">
          <Link
            field={fields["Logo Link"]}
            className="absolute left-1/2 top-0 z-10 flex h-[50px] w-[50px] -translate-x-1/2 items-center justify-center lg:left-0 lg:h-[96px] lg:w-[75px] lg:translate-x-0"
            showLinkTextWithChildrenPresent={false}
          >
            <Image field={fields.Logo} className="h-full w-full object-contain" />
          </Link>

          <div className="absolute left-0 top-0 lg:hidden">
            <button type="button" className="p-[15px] text-[0px]" aria-label="Search">
              <span aria-hidden="true" className="inline-block h-4 w-4 rounded-full border-2 border-black after:absolute after:ml-[11px] after:mt-[11px] after:h-2 after:w-[2px] after:rotate-[-45deg] after:bg-black" />
            </button>
          </div>

          <details className="group ml-auto lg:static lg:w-full">
            <summary className="absolute right-0 top-0 z-20 flex h-[50px] w-[50px] cursor-pointer list-none items-center justify-center p-[15px] text-[0] lg:hidden [&::-webkit-details-marker]:hidden">
              <span aria-hidden="true" className="relative block h-[14px] w-[19px] border-y border-black after:absolute after:left-0 after:top-[6px] after:w-full after:border-t after:border-black" />
            </summary>
            <div className="absolute left-[-15px] right-[-15px] top-[50px] hidden border-b border-[#e3e3e3] bg-white px-[15px] pb-4 pt-3 group-open:block lg:static lg:block lg:border-0 lg:p-0">
              <RichText
                field={fields.Navigation}
                className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-center lg:gap-0 [&_ul]:m-0 [&_ul]:flex [&_ul]:list-none [&_ul]:flex-col [&_ul]:gap-3 [&_ul]:p-0 lg:[&_ul]:flex-row lg:[&_ul]:gap-0 [&_li]:m-0 [&_li]:p-0 [&_a]:block [&_a]:px-[15px] [&_a]:text-[1.1rem] [&_a]:leading-normal [&_a]:no-underline [&_a]:text-black [&_a:hover]:font-semibold lg:[&_a]:pt-[10px] lg:[&_a]:after:mx-auto lg:[&_a]:after:mt-[10px] lg:[&_a]:after:block lg:[&_a]:after:h-[2px] lg:[&_a]:after:w-0 lg:[&_a]:after:bg-[#d51130] lg:[&_a:hover]:after:w-4"
              />
              <details className="group/products lg:absolute lg:left-0 lg:right-0 lg:top-[96px] lg:z-30">
                <summary className="hidden cursor-pointer list-none lg:block lg:absolute lg:left-[47%] lg:top-[-52px] lg:w-[100px] lg:px-[15px] lg:pt-[10px] lg:text-[1.1rem] lg:[&::-webkit-details-marker]:hidden">Products</summary>
                <div className="border-t border-[#e3e3e3] bg-white lg:shadow-none">
                  <RichText
                    field={fields["Product Menu"]}
                    className="px-0 py-4 text-[0.9rem] lg:grid lg:grid-cols-3 lg:px-[15px] lg:py-5 lg:text-[1.1rem] [&_h3]:m-0 [&_h3]:mb-3 [&_h3]:font-light [&_h3]:text-[#d51130] [&_ul]:m-0 [&_ul]:list-none [&_ul]:border-b [&_ul]:border-[#e3e3e3] [&_ul]:p-0 [&_ul]:pb-4 lg:[&_ul]:border-b-0 lg:[&_ul]:border-r lg:[&_ul]:px-[18px] lg:[&_ul]:py-0 lg:[&_ul:last-child]:border-r-0 [&_li]:m-0 [&_li]:mb-2 [&_li]:list-none [&_a]:text-black [&_a]:no-underline"
                  />
                </div>
              </details>
            </div>
          </details>

          <div className="absolute right-0 top-0 hidden items-stretch lg:flex">
            <div className="bg-[#646363] px-3 py-1 text-white">
              <RichText field={fields.Languages} className="text-[0.8rem] uppercase [&_ul]:m-0 [&_ul]:flex [&_ul]:list-none [&_ul]:gap-3 [&_ul]:p-0 [&_a]:text-white [&_a]:no-underline" />
            </div>
            <button type="button" className="flex items-center gap-2 bg-black px-4 py-2 text-[0.9rem] text-white">
              <span aria-hidden="true" className="inline-block h-4 w-4 rounded-full border-2 border-white after:absolute after:ml-[11px] after:mt-[11px] after:h-2 after:w-[2px] after:rotate-[-45deg] after:bg-white" />
              <Text field={fields["Search Label"]} />
            </button>
          </div>
        </nav>
        <div className="sr-only">
          <Text field={fields.Heading} tag="h1" />
          <Text field={fields["Search Placeholder"]} />
        </div>
      </div>
    </header>
  );
};
