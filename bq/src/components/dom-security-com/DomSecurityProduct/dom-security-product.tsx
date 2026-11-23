import { Image, Text } from '@sitecore-content-sdk/nextjs';
import type { ImageField, TextField } from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';

interface Fields {
  Title?: TextField;
  Tagline?: TextField;
  Image?: ImageField;
  'Category1 Slug'?: TextField;
}

type Props = ComponentProps & { fields?: Fields };

/** Compact product card — used when Product is placed as a listing child. */
export const Default = (props: Props) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const slug =
    typeof fields?.['Category1 Slug']?.value === 'string'
      ? fields['Category1 Slug'].value
      : '';
  const name = props.rendering?.dataSource?.split('/').pop() || '';

  return (
    <article
      id={renderingId || undefined}
      className="group flex h-full flex-col bg-white font-[Source_Sans_Pro] font-light text-black"
    >
      <a href={name ? `/products/${name}` : undefined} className="flex h-full flex-col no-underline">
        <div className="relative flex h-[200px] items-center justify-center overflow-hidden bg-[#f5f5f5]">
          <Image
            field={fields?.Image}
            className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
          />
        </div>
        <div className="flex flex-1 flex-col px-1 pt-3">
          {slug ? (
            <p className="m-0 mb-1 text-xs uppercase tracking-wide text-[#7e7c7c]">{slug.replace(/-/g, ' ')}</p>
          ) : null}
          <Text field={fields?.Title} tag="h3" className="m-0 text-xl font-light leading-snug" />
          <Text field={fields?.Tagline} tag="p" className="mt-1 text-sm text-[#646363]" />
        </div>
      </a>
    </article>
  );
};
