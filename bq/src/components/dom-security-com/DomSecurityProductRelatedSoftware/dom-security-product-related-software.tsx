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
  'Software Root'?: TextField;
  'Source Root'?: TextField;
}

type Props = ComponentProps & { fields?: Fields };

function fieldLinkHref(fields: Record<string, unknown> | undefined, name: string): string {
  const value = fields?.[name];
  if (!value || typeof value !== 'object') return '';
  const href = (value as { value?: { href?: string; url?: string } }).value;
  return href?.href || href?.url || '';
}

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
  const softwareRoot = fields?.['Software Root']?.value?.toString() || '';

  const [items, setItems] = useState<WildcardLinkedItem[]>([]);

  useEffect(() => {
    if (state.status !== 'resolved' || !softwareRoot) {
      setItems([]);
      return;
    }
    const keys = fieldText(state.fields, 'Related Software Keys')
      .split(/\r?\n|,/)
      .map((key) => key.trim())
      .filter(Boolean);
    if (!keys.length) {
      setItems([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const all = await fetchWildcardChildren({ path: softwareRoot, language });
      if (cancelled) return;
      const byName = new Map(all.map((item) => [item.name || '', item]));
      setItems(keys.map((key) => byName.get(key)).filter(Boolean) as WildcardLinkedItem[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [state, softwareRoot, language]);

  if (!items.length) return null;

  return (
    <section
      id={renderingId || undefined}
      className="w-full bg-[#f8f8f8] py-10 font-[Source_Sans_Pro] font-light text-black md:py-14"
    >
      <div className="mx-auto w-full max-w-[1170px] px-[15px]">
        <Text
          field={fields?.Heading}
          tag="h2"
          className="m-0 mb-8 text-[1.67rem] font-light md:text-[2.55rem]"
        />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {items.map((item) => {
            const title = fieldText(item.fields, 'Title') || item.displayName || item.name || '';
            const summary = fieldText(item.fields, 'Summary');
            const image = fieldPrimaryImageSrc(item.fields);
            const href = fieldLinkHref(item.fields, 'Link') || '/products/categories/apps-software';
            return (
              <a
                key={item.id || item.name}
                href={href}
                className="flex gap-5 border border-[#e6e6e6] bg-white p-5 no-underline text-inherit transition-shadow hover:shadow-[0_0_20px_-9px_rgba(0,0,0,0.35)]"
              >
                <div className="flex h-[120px] w-[120px] shrink-0 items-center justify-center">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image}
                      alt={title}
                      className="h-[8.7rem] w-[8.7rem] rounded-full bg-[#eeeeee] object-contain p-3 shadow-[0_0_20px_-9px_rgba(0,0,0,0.5)]"
                    />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <h3 className="m-0 text-xl font-light text-black">{title}</h3>
                  {summary ? <p className="mt-2 m-0 text-sm leading-relaxed text-[#646363]">{summary}</p> : null}
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
};
