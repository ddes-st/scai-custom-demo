import { RichText, Text } from "@sitecore-content-sdk/nextjs";
import type { RichTextField, TextField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps } from "lib/component-props";

interface Fields {
  Title: TextField;
  Body: RichTextField;
  "Video Id": TextField;
  "Video Title": TextField;
}

type AboutStoryProps = ComponentProps & { fields: Fields };

export const Default = (props: AboutStoryProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const videoId = typeof fields["Video Id"]?.value === "string" ? fields["Video Id"].value.trim() : "";
  const videoTitle =
    typeof fields["Video Title"]?.value === "string" && fields["Video Title"].value
      ? fields["Video Title"].value
      : "DOM corporate film";

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || "about-story"}
      className="mb-10 bg-white font-['Source_Sans_Pro',sans-serif] font-light text-[#333] md:mb-[90px]"
    >
      <div className="mx-auto w-full max-w-[1170px] px-[15px]">
        <Text field={fields.Title} tag="h2" className="dom-accent !mb-4 md:!mb-[54px]" />
        <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-2 md:gap-x-[30px]">
          <RichText
            field={fields.Body}
            className="text-[16px] leading-[1.3] text-[#333] md:text-[18px] md:leading-[25.7px] [&_p]:mb-[10px] [&_strong]:font-bold"
          />
          {videoId ? (
            <div className="relative aspect-video w-full overflow-hidden bg-black">
              <iframe
                className="absolute inset-0 h-full w-full"
                src={`https://www.youtube-nocookie.com/embed/${videoId}`}
                title={videoTitle}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
};
