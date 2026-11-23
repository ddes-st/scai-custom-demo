import { Image, Link, Text } from "@sitecore-content-sdk/nextjs";
import type { ImageField, LinkField, TextField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps } from "lib/component-props";

interface Fields {
  Logo: ImageField;
  "Logo Link": LinkField;
  "Segment Retail": LinkField;
  "Segment Business": LinkField;
  "Segment Enterprise": LinkField;
  "Segment Public": LinkField;
  "Urgent Assistance": LinkField;
  "Help And Contact": LinkField;
  Language: LinkField;
  Insurances: TextField;
  Claims: TextField;
  Search: TextField;
  "Sign In": LinkField;
  Mobility: TextField;
  Property: TextField;
  Family: TextField;
  Health: TextField;
  Pension: TextField;
  Investments: TextField;
  "All Insurances": LinkField;
}

type NavigationProps = ComponentProps & { fields: Fields };

export const Default = (props: NavigationProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <header
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="relative z-20 bg-[linear-gradient(#e2efff,transparent)] font-[Source_Sans_Pro] text-[#20212c]"
    >
      <div className="mx-auto max-w-[1960px] px-0 lg:px-5">
        <div className="hidden items-center justify-between text-[12px] text-[#4a4c5a] lg:flex">
          <nav aria-label="Doelgroep">
            <ul className="flex items-end gap-4">
              <li><Link field={fields["Segment Retail"]} className="inline-block border-b-2 border-[#00008f] px-1 py-2 font-semibold text-[#00008f]" /></li>
              <li><Link field={fields["Segment Business"]} className="inline-block px-1 py-2" /></li>
              <li><Link field={fields["Segment Enterprise"]} className="inline-block px-1 py-2" /></li>
              <li><Link field={fields["Segment Public"]} className="inline-block px-1 py-2" /></li>
            </ul>
          </nav>
          <nav aria-label="Hulplinks">
            <ul className="flex items-end gap-4">
              <li><Link field={fields["Urgent Assistance"]} className="inline-flex items-center gap-1 px-1 py-2 font-semibold text-[#d50b3e]" /></li>
              <li><Link field={fields["Help And Contact"]} className="inline-block px-1 py-2" /></li>
              <li><Link field={fields.Language} className="inline-block px-1 py-2" /></li>
            </ul>
          </nav>
        </div>

        <section className="rounded-none bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] lg:mt-2 lg:rounded-[12px]">
          <div className="flex min-h-[56px] items-center gap-3 px-5 lg:min-h-[56px] lg:px-4">
            <Link field={fields["Logo Link"]} className="inline-block max-w-[36px] shrink-0 text-[0] lg:mr-3 lg:max-w-[40px]">
              <Image field={fields.Logo} className="block h-9 w-9 lg:h-12 lg:w-12" />
            </Link>

            <nav aria-label="Hoofdnavigatie" className="hidden lg:block">
              <ul className="flex gap-5">
                <li><button type="button" className="relative inline-flex items-center gap-2 px-1 py-[18px] text-sm font-semibold text-[#00008f] after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-[#00008f]"><Text field={fields.Insurances} /></button></li>
                <li><button type="button" className="inline-flex items-center gap-2 px-1 py-[18px] text-sm font-semibold text-[#00008f]"><Text field={fields.Claims} /></button></li>
              </ul>
            </nav>

            <div className="flex-1" />
            <span className="sr-only"><Text field={fields.Search} /></span>
            <button type="button" aria-label="Zoekopdracht openen" className="hidden h-10 w-10 items-center justify-center text-xl text-[#00008f] lg:inline-flex">⌕</button>
            <Link field={fields["Sign In"]} className="inline-flex items-center justify-center rounded-full bg-[#00008f] px-5 py-2.5 text-sm font-semibold text-white" />
            <button type="button" aria-label="Menu" className="inline-flex h-10 w-10 items-center justify-center text-xl text-[#00008f] lg:hidden">☰</button>
          </div>

          <nav aria-label="Verzekeringscategorieën" className="hidden border-t border-[#dcdde4] px-4 lg:block">
            <ul className="flex items-center justify-between">
              <li><button type="button" className="flex items-center gap-2 px-4 py-4 text-sm font-semibold text-[#00008f]"><Text field={fields.Mobility} /><span aria-hidden="true">⌄</span></button></li>
              <li><button type="button" className="flex items-center gap-2 px-4 py-4 text-sm font-semibold text-[#00008f]"><Text field={fields.Property} /><span aria-hidden="true">⌄</span></button></li>
              <li><button type="button" className="flex items-center gap-2 px-4 py-4 text-sm font-semibold text-[#00008f]"><Text field={fields.Family} /><span aria-hidden="true">⌄</span></button></li>
              <li><button type="button" className="flex items-center gap-2 px-4 py-4 text-sm font-semibold text-[#00008f]"><Text field={fields.Health} /><span aria-hidden="true">⌄</span></button></li>
              <li><button type="button" className="flex items-center gap-2 px-4 py-4 text-sm font-semibold text-[#00008f]"><Text field={fields.Pension} /><span aria-hidden="true">⌄</span></button></li>
              <li><button type="button" className="flex items-center gap-2 px-4 py-4 text-sm font-semibold text-[#00008f]"><Text field={fields.Investments} /><span aria-hidden="true">⌄</span></button></li>
              <li><Link field={fields["All Insurances"]} className="inline-flex items-center gap-3 px-4 py-4 text-sm font-semibold text-[#00008f] underline underline-offset-4"><span aria-hidden="true">→</span></Link></li>
            </ul>
          </nav>
        </section>
      </div>
    </header>
  );
};
