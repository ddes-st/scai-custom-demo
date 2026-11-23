import { RichText, Text, type Field, type RichTextField, type TextField } from '@sitecore-content-sdk/nextjs';
import type { ComponentProps } from 'lib/component-props';

interface Fields {
  Title: TextField;
  Links: RichTextField;
  "Mobile Collapsible": Field<boolean>;
}

type FooterNavigationColumnProps = ComponentProps & { fields: Fields };

export const Default = (props: FooterNavigationColumnProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const key = renderingId || props.rendering?.uid;
  const isCollapsible = Boolean(fields["Mobile Collapsible"]?.value);

  return (
    <section
      key={key} id={renderingId || undefined}
      className="border-b border-white/20 bg-[#0d0f50] text-white lg:border-0"
      data-mobile-collapsible={isCollapsible}
    >
      <div className="mx-auto max-w-[1110px] lg:px-0">
        <button
          type="button"
          className="flex min-h-[57px] w-full items-center justify-between text-left lg:pointer-events-none lg:block lg:min-h-0"
          aria-expanded="false"
        >
          <Text
            field={fields.Title}
            tag="h3"
            className="font-sans text-[16px] font-bold leading-6 lg:mb-6"
          />
          <span
            aria-hidden="true"
            className="mr-2 block h-3 w-3 rotate-45 border-b-2 border-r-2 border-white lg:hidden"
          />
        </button>
        <div className="hidden pb-8 lg:block lg:pb-0">
          <RichText
            field={fields.Links}
            className="[&>ul]:m-0 [&>ul]:list-none [&>ul]:p-0 [&_a]:font-sans [&_a]:text-[16px] [&_a]:leading-5 [&_a]:text-white [&_a]:no-underline [&_li]:mb-5 [&_li:last-child]:mb-0"
          />
        </div>
      </div>
    </section>
  );
};
