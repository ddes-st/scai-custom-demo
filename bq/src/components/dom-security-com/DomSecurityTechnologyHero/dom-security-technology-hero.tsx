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
      className="relative z-0 mb-0 bg-white font-['Source_Sans_Pro',sans-serif] font-light text-black lg:mb-[144px] lg:pb-[36px]"
    >
      <div className="relative sm:min-h-[200px] lg:h-[700px]">
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
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-0 z-10 h-[10%] w-full"
            viewBox="0 0 1000 50"
            preserveAspectRatio="none"
          >
            <polygon fill="#fff" points="0,50 1000,50 750,10" />
          </svg>
        </div>

        <div className="absolute inset-x-0 bottom-[-63px] z-30 hidden lg:block">
          <div className="mx-auto w-full max-w-[1170px] px-[15px] text-right">
            <Link
              field={fields["Desktop CTA"]}
              className="inline-flex h-[198px] w-[198px] flex-col justify-between bg-[#d51130] p-[18px] text-left align-middle text-[22.91px] font-light leading-normal text-white no-underline hover:bg-[#a50d25]"
              showLinkTextWithChildrenPresent
            >
              <span aria-hidden="true" className="block text-[18px] leading-none">↓</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="relative z-20 flex items-center px-[15px] py-6 lg:absolute lg:inset-0 lg:px-0 lg:py-[90px]">
        <div className="mx-auto w-full max-w-[1170px] lg:px-[15px]">
          <div className="w-full lg:w-[75%]">
            <h1 className="m-0 text-[1.56rem] font-light leading-[1.07] text-black lg:text-[70.2px] lg:leading-normal lg:text-white">
              <Text field={fields.Title} />
            </h1>
            <p className="mt-0 mb-[10px] text-[1.11rem] font-light leading-[1.22] text-[#646363] lg:text-[30.06px] lg:leading-[36px] lg:text-white">
              <Text field={fields.Subtitle} />
            </p>
          </div>
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
