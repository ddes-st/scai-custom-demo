import { Image, Link, RichText, Text } from '@sitecore-content-sdk/nextjs';
import type { ImageField, LinkField, RichTextField, TextField, Field } from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';
import HeaderChrome from './dom-security-main-menu.client';

interface Fields {
  Logo: ImageField;
  "Logo Link": LinkField;
  Navigation: RichTextField;
  "Products Menu": RichTextField;
  "Product Help": LinkField;
  "Highlight Homeowners Products": TextField;
  "Highlight Homeowners Products Enabled": Field<boolean>;
}

type DomSecurityMainMenuProps = ComponentProps & { fields: Fields };

export const Default = (props: DomSecurityMainMenuProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <HeaderChrome>
      <nav
        key={renderingId || props.rendering?.uid}
        id={renderingId || undefined}
        className="relative z-20 min-h-[50px] bg-white font-[Source_Sans_Pro] font-light text-black shadow-[0_0_9px_0_rgba(0,0,0,0.45)] lg:shadow-none"
      >
        <div className="relative flex h-[50px] items-center lg:min-h-[96px] lg:h-auto lg:pl-[100px]">
          <Link
            field={fields["Logo Link"]}
            className="absolute left-1/2 top-0 z-10 h-[50px] w-[50px] -translate-x-1/2 p-0 lg:left-0 lg:h-[96px] lg:w-[87px] lg:translate-x-0"
          >
            <Image field={fields.Logo} className="h-full w-full object-contain" />
          </Link>
          <button
            type="button"
            data-menu-toggle="true"
            aria-label="Toggle navigation"
            className="absolute right-[15px] top-[10px] block h-[30px] w-[24px] border-0 bg-transparent p-0 lg:hidden"
          >
            <span aria-hidden="true" className="block border-t border-black pt-[6px] after:block after:border-t after:border-black after:pt-[6px] after:content-[''] before:block before:border-t before:border-black before:pb-[6px] before:content-['']" />
          </button>
          <div className="navbar-navigation hidden w-full lg:block">
            <RichText
              field={fields.Navigation}
              className="px-[15px] py-[15px] text-[1.1rem] leading-normal [&_a]:relative [&_a]:inline-block [&_a]:px-[15px] [&_a]:pt-[10px] [&_a]:text-black [&_a]:no-underline [&_a]:lg:mr-[10px] [&_a[data-active='true']]:font-semibold [&_a[data-active='true']]:after:absolute [&_a[data-active='true']]:after:bottom-[-6px] [&_a[data-active='true']]:after:left-1/2 [&_a[data-active='true']]:after:h-[2px] [&_a[data-active='true']]:after:w-4 [&_a[data-active='true']]:after:-translate-x-1/2 [&_a[data-active='true']]:after:bg-[#d51130] [&_a[data-products-trigger='true']]:font-medium [&_ul]:m-0 [&_ul]:list-none [&_ul]:p-0 [&_li]:m-0 [&_li]:inline-block [&_li]:list-none max-lg:text-[1.28rem] max-lg:[&_li]:block max-lg:[&_a]:w-full max-lg:[&_a]:py-[10px]"
            />
          </div>
          <button type="button" aria-label="Search" className="absolute right-0 top-0 hidden h-[50px] w-[105px] bg-black text-white lg:block">
            <span aria-hidden="true" className="mr-2 inline-block text-[22px]">⌕</span>Search
          </button>
        </div>
        <div className="products-menu hidden border-t border-[#e3e3e3] bg-white lg:absolute lg:left-0 lg:top-full lg:block lg:w-full lg:opacity-0 lg:pointer-events-none">
          <RichText
            field={fields["Products Menu"]}
            className="grid grid-cols-1 lg:grid-cols-3 [&_section]:border-b [&_section]:border-[#e3e3e3] [&_section]:px-[15px] [&_section]:py-4 lg:[&_section]:min-h-[308px] lg:[&_section]:border-r lg:[&_section]:px-[34px] lg:[&_section]:py-5 lg:[&_section:last-child]:border-r-0 [&_h3]:m-0 [&_h3]:mb-5 [&_h3]:font-light [&_h3]:leading-tight [&_h3]:text-[#d51130] [&_h3]:text-[1.67rem] [&_a]:text-black [&_a]:no-underline [&_a]:hover:font-semibold [&_li]:mb-3 [&_li]:list-none [&_ul]:m-0 [&_ul]:list-none [&_ul]:p-0"
          />
          <div className="flex flex-col justify-between gap-3 px-[15px] py-3 text-[0.8rem] text-[#b0b0b0] lg:flex-row lg:items-center">
            <Link field={fields["Product Help"]} className="text-black no-underline" />
            <label className="flex items-center gap-3 text-[0.8rem] text-[#b0b0b0]">
              <span><Text field={fields["Highlight Homeowners Products"]} /></span>
              <input type="checkbox" defaultChecked={Boolean(fields["Highlight Homeowners Products Enabled"]?.value)} className="h-5 w-10 appearance-none rounded-full bg-[#4a4a4a] checked:bg-[#5ac50b]" />
            </label>
          </div>
        </div>
      </nav>
    </HeaderChrome>
  );
};
