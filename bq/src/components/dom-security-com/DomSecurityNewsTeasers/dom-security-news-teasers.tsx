import { AppPlaceholder, Link, Text } from '@sitecore-content-sdk/nextjs';
import componentMap from '.sitecore/component-map';
import type { LinkField, TextField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';

interface Fields {
  Heading: TextField;
  "More Link": LinkField;
}

type NewsTeasersProps = ComponentWithContextProps & { fields: Fields };

export const Default = (props: NewsTeasersProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const dynId = params.DynamicPlaceholderId;
  const placeholderBase = 'news-teasers';
  const placeholderName = dynId ? `${placeholderBase}-${dynId}` : placeholderBase;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="bg-white px-[15px] pt-8 pb-12 font-[Source_Sans_Pro] text-[18px] font-light text-[#333] lg:pt-20 lg:pb-20"
    >
      <div className="mx-auto w-full max-w-[1170px]">
        <div className="mb-4 flex items-start justify-between lg:mb-[2.78rem]">
          <Text
            field={fields.Heading}
            tag="h2"
            className="m-0 border-l-[3px] border-[#d51130] pl-4 text-[1.278rem] font-light leading-[1.09] text-[#111] lg:pl-4 lg:text-[2.55rem] lg:leading-[2.78rem]"
          />
          <Link
            field={fields["More Link"]}
            className="mt-1 shrink-0 text-[0.78rem] font-normal leading-[1.35] text-[#00a0de] no-underline lg:mt-4 lg:text-[1rem] lg:leading-normal"
            showLinkTextWithChildrenPresent
          >
            <span aria-hidden="true" className="ml-3 text-[1.15rem] leading-none lg:ml-5">
              →
            </span>
          </Link>
        </div>
        {/* Capture: `.row.eh-grid` + three `.col-sm-4` — equal-width columns, stretch cards */}
        <div
          className={[
            "grid grid-cols-1 gap-9",
            "md:grid-cols-3 md:gap-x-[30px] md:gap-y-0",
            "md:[&>*]:min-w-0 md:[&>*]:h-full",
          ].join(" ")}
        >
          <AppPlaceholder
            name={placeholderName}
            rendering={props.rendering}
            page={props.page}
            componentMap={componentMap}
          />
        </div>
      </div>
    </section>
  );
};
