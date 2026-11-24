import { AppPlaceholder, Image, Link, RichText, Text } from "@sitecore-content-sdk/nextjs";
import type { ImageField, LinkField, RichTextField, TextField } from "@sitecore-content-sdk/nextjs";
import componentMap from ".sitecore/component-map";
import type { ComponentWithContextProps } from "lib/component-props";

interface Fields {
  Title: TextField;
  Subtitle: TextField;
  Body: RichTextField;
  Image: ImageField;
  Link: LinkField;
}

type LandingBandProps = ComponentWithContextProps & { fields: Fields };

const bodyClassName = [
  "text-[1rem] font-light leading-[1.67rem] text-[#333]",
  "[&_p]:mb-4 [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-[1.35rem] [&_h3]:font-light [&_h3]:text-[#111]",
  "[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6",
  "[&_a]:text-[#00a0de] [&_a]:no-underline hover:[&_a]:underline",
  "[&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-[#e4e4e4] [&_th]:px-3 [&_th]:py-3 [&_th]:text-left",
  "[&_td]:border [&_td]:border-[#e4e4e4] [&_td]:px-3 [&_td]:py-3 [&_td]:text-center",
  "[&_thead_th]:bg-[#f7f7f7] [&_thead_th]:font-normal",
].join(" ");

function sectionId(props: LandingBandProps): string | undefined {
  const params = props.params ?? props.rendering?.params ?? {};
  return params.RenderingIdentifier || params.id || undefined;
}

function Cards(props: LandingBandProps) {
  const params = props.params ?? props.rendering?.params ?? {};
  const dynId = params.DynamicPlaceholderId;
  const placeholderName = dynId ? `landing-cards-${dynId}` : "landing-cards";
  return (
    <AppPlaceholder
      name={placeholderName}
      rendering={props.rendering}
      page={props.page}
      componentMap={componentMap}
    />
  );
}

export const Hero = (props: LandingBandProps) => {
  const { fields } = props;
  return (
    <section
      id={sectionId(props)}
      className="relative bg-[#111] font-[Source_Sans_Pro] font-light text-white"
    >
      <Image field={fields.Image} className="block h-[280px] w-full object-cover md:h-[460px]" />
      <div className="absolute inset-0 bg-black/40" />
      <div className="absolute inset-0 flex items-end">
        <div className="mx-auto w-full max-w-[1170px] px-[15px] pb-10 md:pb-16">
          <Text
            field={fields.Title}
            tag="h1"
            className="m-0 max-w-[18ch] text-[2rem] font-light leading-tight md:text-[3.4rem]"
          />
          <Text
            field={fields.Subtitle}
            tag="p"
            className="m-0 mt-3 max-w-[36ch] text-[1.15rem] leading-snug text-white/90 md:text-[1.5rem]"
          />
        </div>
      </div>
    </section>
  );
};

export const Default = (props: LandingBandProps) => {
  const { fields } = props;
  const imageSrc = fields.Image?.value?.src;
  const linkHref = fields.Link?.value?.href;
  return (
    <section id={sectionId(props)} className="bg-white py-10 font-[Source_Sans_Pro] md:py-16">
      {imageSrc ? (
        <div className="relative mb-8 min-h-[280px] overflow-hidden bg-[#111] text-white md:min-h-[460px]">
          <Image
            field={fields.Image}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-0 flex items-end">
            <div className="mx-auto w-full max-w-[1170px] px-[15px] pb-10 md:pb-16">
              <Text
                field={fields.Title}
                tag="h1"
                className="m-0 max-w-[18ch] text-[2rem] font-light leading-tight md:text-[3.4rem]"
              />
              <Text
                field={fields.Subtitle}
                tag="p"
                className="m-0 mt-3 max-w-[36ch] text-[1.15rem] leading-snug text-white/90 md:text-[1.5rem]"
              />
            </div>
          </div>
        </div>
      ) : null}
      <div className="mx-auto w-full max-w-[1170px] px-[15px]">
        {imageSrc ? null : (
          <Text
            field={fields.Title}
            tag="h2"
            className="m-0 mb-6 text-[1.8rem] font-light leading-snug text-[#111] md:text-[2.4rem]"
          />
        )}
        <Text
          field={fields.Subtitle}
          tag="p"
          className={imageSrc ? "hidden" : "m-0 mb-4 text-[1.15rem] text-[#646363]"}
        />
        <div className={bodyClassName}>
          <RichText field={fields.Body} />
        </div>
        <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          <Cards {...props} />
        </div>
        {linkHref ? (
          <Link
            field={fields.Link}
            className="mt-6 inline-block bg-[#d51130] px-6 py-3 text-[1rem] text-white no-underline hover:bg-[#a50d25]"
          />
        ) : null}
      </div>
    </section>
  );
};

export const CardGrid = (props: LandingBandProps) => {
  const { fields } = props;
  return (
    <section id={sectionId(props)} className="bg-[#f7f7f7] py-10 font-[Source_Sans_Pro] md:py-16">
      <div className="mx-auto w-full max-w-[1170px] px-[15px]">
        <Text
          field={fields.Title}
          tag="h2"
          className="m-0 mb-8 max-w-[24ch] text-[1.8rem] font-light leading-snug text-[#111] md:text-[2.4rem]"
        />
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          <Cards {...props} />
        </div>
      </div>
    </section>
  );
};

export const Steps = (props: LandingBandProps) => {
  const { fields } = props;
  return (
    <section id={sectionId(props)} className="bg-white py-10 font-[Source_Sans_Pro] md:py-16">
      <div className="mx-auto w-full max-w-[1170px] px-[15px]">
        <Text
          field={fields.Title}
          tag="h2"
          className="m-0 mb-4 text-[1.8rem] font-light leading-snug text-[#111] md:text-[2.4rem]"
        />
        <div className={`${bodyClassName} mb-8 max-w-[70ch]`}>
          <RichText field={fields.Body} />
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <Cards {...props} />
        </div>
      </div>
    </section>
  );
};

export const Cta = (props: LandingBandProps) => {
  const { fields } = props;
  return (
    <section id={sectionId(props)} className="bg-[#111] py-12 font-[Source_Sans_Pro] text-white md:py-16">
      <div className="mx-auto w-full max-w-[1170px] px-[15px]">
        <Text
          field={fields.Title}
          tag="h2"
          className="m-0 mb-4 max-w-[22ch] text-[1.8rem] font-light leading-snug md:text-[2.4rem]"
        />
        <div className="max-w-[62ch] text-[1rem] leading-[1.67rem] text-white/90 [&_p]:mb-4">
          <RichText field={fields.Body} />
        </div>
        <Link
          field={fields.Link}
          className="mt-4 inline-block bg-[#d51130] px-6 py-3 text-[1rem] text-white no-underline hover:bg-[#a50d25]"
        />
      </div>
    </section>
  );
};
