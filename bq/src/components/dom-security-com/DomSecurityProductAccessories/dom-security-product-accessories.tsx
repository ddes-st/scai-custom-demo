'use client';

import { Text, useSitecore } from '@sitecore-content-sdk/nextjs';
import type { TextField } from '@sitecore-content-sdk/nextjs';
import { useEffect, useState } from 'react';
import { ComponentProps } from 'lib/component-props';
import {
  fetchWildcardChildren,
  fieldPrimaryImageSrc,
  fieldText,
  useWildcardItem,
  useWildcardItemContext,
  type WildcardLinkedItem,
} from 'src/lib/wildcard';

interface Fields {
  Heading?: TextField;
  'Accessories Root'?: TextField;
  'Source Root'?: TextField;
}

type Props = ComponentProps & { fields?: Fields };

export const Default = (props: Props) => {
  const { fields } = props;
  const { page } = useSitecore();
  const language = page?.locale || 'en';
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  const ambient = useWildcardItemContext();
  const sourceRoot = fields?.['Source Root']?.value?.toString() || '';
  const local = useWildcardItem({
    sourceRoot: ambient ? undefined : sourceRoot,
    language,
  });
  const state = ambient ?? local;
  const accessoriesRoot = fields?.['Accessories Root']?.value?.toString() || '';

  const [items, setItems] = useState<WildcardLinkedItem[]>([]);

  useEffect(() => {
    if (state.status !== 'resolved' || !accessoriesRoot) {
      setItems([]);
      return;
    }
    const keys = fieldText(state.fields, 'Accessory Keys')
      .split(/\r?\n|,/)
      .map((key) => key.trim())
      .filter(Boolean);
    if (!keys.length) {
      setItems([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const all = await fetchWildcardChildren({ path: accessoriesRoot, language });
      if (cancelled) return;
      const byName = new Map(all.map((item) => [item.name || '', item]));
      setItems(keys.map((key) => byName.get(key)).filter(Boolean) as WildcardLinkedItem[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [state, accessoriesRoot, language]);

  if (!items.length) return null;

  return (
    <section
      id={renderingId || undefined}
      className="w-full bg-white py-10 font-[Source_Sans_Pro] font-light text-black md:py-14"
    >
      <div className="mx-auto w-full max-w-[1170px] px-[15px]">
        <Text
          field={fields?.Heading}
          tag="h2"
          className="m-0 mb-8 text-[1.67rem] font-light md:text-[2.55rem]"
        />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => {
            const title = fieldText(item.fields, 'Title') || item.displayName || item.name || '';
            const description = fieldText(item.fields, 'Description');
            const sku = fieldText(item.fields, 'SKU');
            const image = fieldPrimaryImageSrc(item.fields);
            return (
              <article key={item.id || item.name} className="overflow-hidden bg-[#eeeeee]">
                <div className="flex h-[10rem] items-center justify-center bg-[#e6e6e6]">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image}
                      alt={title}
                      className="h-[8.7rem] w-[8.7rem] rounded-full bg-white object-contain p-3 shadow-[0_0_20px_-9px_rgba(0,0,0,0.5)]"
                    />
                  ) : null}
                </div>
                <div className="px-4 py-4">
                  <h3 className="m-0 text-[1.1rem] font-light leading-snug">{title}</h3>
                  {sku ? (
                    <p className="mt-2 m-0 inline-block bg-[#d51130] px-2 py-0.5 text-xs text-white">
                      {sku}
                    </p>
                  ) : null}
                  {description ? (
                    <p className="mt-3 m-0 text-sm leading-relaxed text-[#646363]">{description}</p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};
