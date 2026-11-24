import { Image, RichText, Text } from "@sitecore-content-sdk/nextjs";
import type { ImageField, RichTextField, TextField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps } from "lib/component-props";

interface Fields {
  Title: TextField;
  Text: RichTextField;
  Image: ImageField;
}

type CompetenceSlideProps = ComponentProps & { fields: Fields };

/** Fallback when the slide is rendered on its own. The showcase reads these fields itself. */
export const Default = (props: CompetenceSlideProps) => {
  const { fields } = props;
  return (
    <article className="font-['Source_Sans_Pro',sans-serif] font-light text-white">
      <Text field={fields.Title} tag="h3" className="m-0 text-[1.8rem]" />
      <RichText field={fields.Text} className="mt-3 max-w-[36ch] text-[1rem] leading-relaxed" />
      <Image field={fields.Image} className="mt-4 hidden" />
    </article>
  );
};
