import { Image, Link, Text, type ImageField, type LinkField, type TextField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps } from "lib/component-props";

interface Fields {
  Title: TextField;
  Subtitle: TextField;
  Video: TextField;
  "Poster Image": ImageField;
  "Desktop CTA": LinkField;
  "Mobile CTA": LinkField;
}

type TechnologyHeroProps = ComponentProps & { fields: Fields };

export const Default = (props: TechnologyHeroProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const videoUrl = typeof fields.Video?.value === "string" ? fields.Video.value : undefined;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="relative z-0 mb-0 overflow-hidden bg-white font-[Source_Sans_Pro] text-black lg:mb-28"
    >
      <div className="relative overflow-hidden sm:min-h-[200px] lg:h-[700px] lg:min-h-0 lg:max-h-[700px]">
        <div className="relative leading-[0] lg:absolute lg:inset-0 lg:h-full">
          {videoUrl ? (
            <video
              className="block h-auto w-full object-cover object-center lg:h-full lg:max-h-full"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              poster={typeof fields["Poster Image"]?.value?.src === "string" ? fields["Poster Image"].value.src : undefined}
            >
              <source src={videoUrl} type="video/mp4" />
              <Image field={fields["Poster Image"]} className="block h-auto w-full object-cover lg:h-full" />
            </video>
          ) : (
            <Image
              field={fields["Poster Image"]}
              className="block h-auto w-full object-cover object-center lg:h-full"
            />
          )}
          <div className="pointer-events-none absolute bottom-[-1px] left-0 z-10 h-10 w-full bg-white [clip-path:polygon(0_100%,100%_100%,75%_15%,0_75%)] lg:h-16" />
        </div>

        <div className="relative z-20 mx-auto flex w-full items-center px-[15px] py-0 text-white lg:absolute lg:inset-0 lg:py-12">
          <div className="w-full text-left lg:max-w-[75%]">
            <h1 className="m-0 text-[1.56rem] font-light leading-[1.07] text-black lg:text-[3.9rem] lg:leading-[1.1] lg:text-white">
              <Text field={fields.Title} />
            </h1>
            <p className="mt-2 mb-4 text-[1.11rem] font-light leading-[1.22] text-gray-500 lg:text-[1.67rem] lg:leading-8 lg:text-white">
              <Text field={fields.Subtitle} />
            </p>
          </div>
        </div>

        <div className="relative z-30 hidden text-right lg:absolute lg:right-[15px] lg:bottom-0 lg:block">
          <Link
            field={fields["Desktop CTA"]}
            className="inline-block h-36 w-36 bg-[#d51130] px-5 pt-5 text-left text-[1.27rem] font-light leading-tight text-white no-underline hover:bg-[#a50d25]"
            showLinkTextWithChildrenPresent
          >
            <span aria-hidden="true" className="mt-8 block text-2xl leading-none">↓</span>
          </Link>
        </div>
      </div>

      <div className="relative z-30 block w-full bg-[#d51130] text-center lg:hidden">
        <Link
          field={fields["Mobile CTA"]}
          className="block w-full px-3 py-2 text-[0.83rem] font-normal leading-normal text-white no-underline"
          showLinkTextWithChildrenPresent
        >
          <span aria-hidden="true" className="ml-2 text-lg leading-none">↓</span>
        </Link>
      </div>

      <div className="hidden" aria-hidden="true">
        <Text field={fields.Video} />
      </div>
      <div className="hidden">
        <Image field={fields["Poster Image"]} />
      </div>
    </section>
  );
};
