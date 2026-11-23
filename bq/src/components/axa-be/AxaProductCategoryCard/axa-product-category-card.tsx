import { Image, Link, Text } from '@sitecore-content-sdk/nextjs';
import type { Field, ImageField, LinkField, TextField } from '@sitecore-content-sdk/nextjs';
import type { ComponentProps } from 'lib/component-props';

interface Fields {
  Title: TextField;
  Image: ImageField;
  Link: LinkField;
  "Promotion Label": TextField;
  "Show Promotion": Field<boolean>;
}

type ProductCategoryCardProps = ComponentProps & { fields: Fields };

export const Default = (props: ProductCategoryCardProps) => {
  const { fields } = props;
  const showPromotion = Boolean(fields["Show Promotion"]?.value);

  return (
    <li
      key={props.params.RenderingIdentifier || props.rendering.uid} id={props.params?.RenderingIdentifier || props.params?.id || undefined}
      className="relative h-[218px] min-w-[255px] snap-start sm:min-w-0"
    >
      <Link
        field={fields.Link}
        className="group flex h-full w-full flex-col items-center justify-center border border-[#aaaaf0] bg-white px-4 pb-7 pt-5 text-center no-underline transition-colors hover:bg-[#f6f6ff]"
      >
        <Image
          field={fields.Image}
          className="mb-7 h-[100px] w-[100px] object-contain"
        />
        <Text
          field={fields.Title}
          tag="span"
          className="font-sans text-[22px] font-semibold leading-[1.25] text-black"
        />
      </Link>
      <span
        data-show-promotion={showPromotion}
        className={`absolute left-[-9px] top-[-13px] z-10 flex min-h-[29px] items-center gap-2 bg-[#ed0000] px-2 text-[14px] font-bold leading-none text-white ${showPromotion ? '' : 'hidden'}`}
      >
        <Text field={fields["Promotion Label"]} tag="span" />
        <span aria-hidden="true" className="text-[20px] leading-none">→</span>
      </span>
    </li>
  );
};
