'use client';

import { Text, useSitecore } from '@sitecore-content-sdk/nextjs';
import type { TextField } from '@sitecore-content-sdk/nextjs';
import { useEffect, useMemo, useState } from 'react';
import { ComponentProps } from 'lib/component-props';
import { trackProductClick } from '../_demo/demo-cdp';
import {
  fetchWildcardChildren,
  fieldPrimaryImageSrc,
  fieldText,
  groupCatalogByFamily,
  useWildcardItem,
  useWildcardItemContext,
  type WildcardLinkedItem,
} from 'src/lib/wildcard';

interface Fields {
  'Fallback Title'?: TextField;
  'Source Root'?: TextField;
  'Products Root'?: TextField;
  'Categories Root'?: TextField;
  'Back Label'?: TextField;
  'Read More Label'?: TextField;
  'Read Less Label'?: TextField;
  'Sort Label'?: TextField;
  'Results Label'?: TextField;
  'Load More Label'?: TextField;
  'Related Label'?: TextField;
  'Page Size'?: TextField;
}

type Props = ComponentProps & { fields?: Fields };

type SortMode = 'alphabetically' | 'newest' | 'recommended';

const THEME_LABELS: Record<string, string> = {
  'access-control-solutions': 'Access Control Solutions',
  'door-hardware': 'Door Hardware',
  'industrial-locking-equipment': 'Industrial Locking Equipment',
};

function themeLabel(slug: string): string {
  return THEME_LABELS[slug] || slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function productTitle(item: WildcardLinkedItem): string {
  return fieldText(item.fields, 'Title') || item.displayName || item.name || '';
}

export const Default = (props: Props) => {
  const { fields } = props;
  const { page } = useSitecore();
  const language = page?.locale || 'en';
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  const sourceRoot = fields?.['Source Root']?.value?.toString() || '';
  const productsRoot = fields?.['Products Root']?.value?.toString() || '';
  const categoriesRoot =
    fields?.['Categories Root']?.value?.toString() ||
    '/sitecore/content/domsecurity/domsecurity-com/Data/Product Categories';
  const pageSize = Math.max(
    4,
    Number.parseInt(fields?.['Page Size']?.value?.toString() || '12', 10) || 12,
  );

  const ambient = useWildcardItemContext();
  const local = useWildcardItem({
    sourceRoot: ambient ? undefined : sourceRoot,
    language,
  });
  const wildcard = ambient ?? local;

  const [products, setProducts] = useState<WildcardLinkedItem[]>([]);
  const [categories, setCategories] = useState<WildcardLinkedItem[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('alphabetically');
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [query, setQuery] = useState('');

  const categorySlug =
    wildcard.status === 'resolved'
      ? fieldText(wildcard.fields, 'Category1 Slug') || wildcard.item?.name || ''
      : '';
  const themeSlug =
    wildcard.status === 'resolved' ? fieldText(wildcard.fields, 'Theme Slug') : '';

  useEffect(() => {
    if (!productsRoot || !categorySlug) return;
    let cancelled = false;
    (async () => {
      const [productItems, categoryItems] = await Promise.all([
        fetchWildcardChildren({ path: productsRoot, language }),
        categoriesRoot
          ? fetchWildcardChildren({ path: categoriesRoot, language })
          : Promise.resolve([]),
      ]);
      if (cancelled) return;
      const inCategory = productItems.filter(
        (item) => fieldText(item.fields, 'Category1 Slug') === categorySlug,
      );
      // Live filter UI shows one card per product family (e.g. DOM ELS Pro), not every variant SKU.
      setProducts(groupCatalogByFamily(inCategory));
      setCategories(categoryItems);
      setVisibleCount(pageSize);
    })();
    return () => {
      cancelled = true;
    };
  }, [productsRoot, categoriesRoot, categorySlug, language, pageSize]);

  const title = useMemo(() => {
    if (wildcard.status === 'resolved') {
      return fieldText(wildcard.fields, 'Title') || wildcard.item?.displayName || '';
    }
    return fields?.['Fallback Title']?.value?.toString() || 'Product category';
  }, [wildcard, fields]);

  const description =
    wildcard.status === 'resolved' ? fieldText(wildcard.fields, 'Description') : '';

  const sortedProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = products.filter((item) => {
      if (!q) return true;
      return productTitle(item).toLowerCase().includes(q);
    });
    if (sortMode === 'alphabetically' || sortMode === 'recommended') {
      list.sort((a, b) => productTitle(a).localeCompare(productTitle(b)));
    } else {
      list.reverse();
    }
    return list;
  }, [products, sortMode, query]);

  const visibleProducts = sortedProducts.slice(0, visibleCount);
  const hasMore = visibleCount < sortedProducts.length;

  const relatedCategories = useMemo(() => {
    if (!themeSlug) return [];
    return categories.filter((category) => {
      const slug = fieldText(category.fields, 'Category1 Slug') || category.name || '';
      const theme = fieldText(category.fields, 'Theme Slug');
      return theme === themeSlug && slug !== categorySlug;
    });
  }, [categories, themeSlug, categorySlug]);

  if (wildcard.status === 'loading' || wildcard.status === 'idle') {
    return (
      <section
        id={renderingId || undefined}
        className="w-full bg-white font-[Source_Sans_Pro] font-light text-black"
      >
        <div className="bg-[#646363] text-white">
          <div className="mx-auto w-full max-w-[1170px] px-[15px] pt-8 md:pt-12">
            <div className="border-b border-white/25 pb-6">
              <h1 className="m-0 text-[2.4rem] font-light leading-none text-white md:text-[3.5rem] lg:text-[3.9rem]">
                Products
              </h1>
            </div>
            <p className="m-0 py-4 text-[1.35rem] font-light md:text-[1.67rem]">
              I would like to see…
            </p>
          </div>
        </div>
        <div className="mx-auto w-full max-w-[1170px] px-[15px] py-8 text-[#646363] md:py-12">
          Loading category…
        </div>
      </section>
    );
  }

  const readMoreLabel = fields?.['Read More Label']?.value?.toString() || 'Read more';
  const readLessLabel = fields?.['Read Less Label']?.value?.toString() || 'Read less';
  const sortLabel = fields?.['Sort Label']?.value?.toString() || 'Sort by';
  const resultsLabel = fields?.['Results Label']?.value?.toString() || 'results';
  const loadMoreLabel = fields?.['Load More Label']?.value?.toString() || 'Load more';
  const relatedPrefix = fields?.['Related Label']?.value?.toString() || 'Other';
  const relatedTheme = themeSlug ? themeLabel(themeSlug) : 'solutions';
  const searchPlaceholder = 'Search product name';
  const helpHref = '/find-a-dom-dealer';

  return (
    <section
      id={renderingId || undefined}
      className="w-full bg-white font-[Source_Sans_Pro] font-light text-black"
    >
      {/* Same dark-grey products filter hero; category shown as removable chip */}
      <div className="bg-[#646363] text-white">
        <div className="mx-auto w-full max-w-[1170px] px-[15px] pt-8 md:pt-12">
          <div className="flex flex-col gap-4 border-b border-white/25 pb-6 md:flex-row md:items-end md:justify-between">
            <h1 className="m-0 text-[2.4rem] font-light leading-none text-white md:text-[3.5rem] lg:text-[3.9rem]">
              Products
            </h1>
            <label className="relative block w-full max-w-md md:w-[320px]">
              <span className="sr-only">{searchPlaceholder}</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="min-h-[2.8rem] w-full rounded-[3px] border border-[#c8c8c8] bg-white px-[1.1rem] py-2 text-base text-black outline-none placeholder:text-[#7b7b7b] focus:border-[#00a0de]"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
              <p className="m-0 text-[1.35rem] font-light md:text-[1.67rem]">
                I would like to see…
              </p>
              <a
                href="/products"
                className="inline-flex max-w-full items-center rounded-[5rem] border border-[#838383] bg-[#505050] px-[1.1rem] py-[0.3rem] text-[1rem] leading-[1.7rem] text-white no-underline transition-colors hover:bg-[#363636] md:text-[1.67rem]"
                aria-label={`Remove filter ${title}`}
              >
                <span className="truncate">{title}</span>
                <span aria-hidden="true" className="ml-2 text-[1rem] leading-none">
                  ×
                </span>
              </a>
            </div>
            <a
              href={helpHref}
              className="inline-flex items-center gap-2 text-sm text-white no-underline hover:underline"
            >
              Need help?
              <span
                aria-hidden="true"
                className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white text-[0.65rem] leading-none"
              >
                i
              </span>
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1170px] px-[15px] py-8 md:py-12">
        <h2 className="relative m-0 pl-4 text-[2rem] font-light leading-tight md:text-[3.2rem] md:leading-[1.1] before:absolute before:left-0 before:top-[0.2em] before:h-[0.85em] before:w-[0.2rem] before:bg-[#d51130]">
          {title}
        </h2>

        {description ? (
          <div className="mt-3 max-w-3xl">
            <div
              className={`text-base leading-[1.67rem] text-[#646363] md:text-lg [&_p]:m-0 ${
                descriptionOpen ? '' : 'line-clamp-2'
              }`}
              dangerouslySetInnerHTML={{ __html: description }}
            />
            <button
              type="button"
              onClick={() => setDescriptionOpen((open) => !open)}
              className="mt-2 border-0 bg-transparent p-0 text-sm text-[#00a0de] underline-offset-2 hover:underline"
            >
              {descriptionOpen ? readLessLabel : readMoreLabel}
            </button>
          </div>
        ) : (
          <Text field={fields?.['Fallback Title']} tag="p" className="sr-only" />
        )}

        <div className="mt-8 flex flex-col gap-3 border-b border-[#e6e6e6] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="m-0 text-sm text-[#7b7b7b]">
            <span className="font-normal text-black">{sortedProducts.length}</span> {resultsLabel}
          </p>
          <label className="flex items-center gap-2 text-[0.9rem] text-[#7b7b7b]">
            <span>{sortLabel}</span>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="min-h-[2.2rem] appearance-none border-0 bg-transparent pr-6 text-base font-normal text-black"
              aria-label={sortLabel}
            >
              <option value="alphabetically">Alphabetically</option>
              <option value="newest">Newest</option>
              <option value="recommended">Recommended</option>
            </select>
          </label>
        </div>

        <div className="mt-10 flex flex-wrap gap-x-[2%] gap-y-14">
          {visibleProducts.map((product) => {
            const name = productTitle(product);
            const tagline = fieldText(product.fields, 'Tagline');
            const image = fieldPrimaryImageSrc(product.fields);
            const categoryBadge =
              fieldText(product.fields, 'Category1 Slug')
                .replace(/-/g, ' ')
                .replace(/\b\w/g, (c) => c.toUpperCase()) || title;
            return (
              <a
                key={product.id || product.name}
                href={`/products/${product.name}`}
                onClick={() => trackProductClick(product.id || product.name || name, name)}
                className="group mt-10 flex w-full flex-col no-underline text-inherit sm:w-[49%] md:w-[32%] lg:w-[23.5%]"
              >
                <div className="relative flex h-full flex-1 flex-col bg-[#e6e6e6]">
                  <div className="absolute left-1/2 top-0 z-10 flex h-[8.7rem] w-[8.7rem] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-[0_0_20px_-9px_rgba(0,0,0,0.5)]">
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={image}
                        alt={name}
                        className="max-h-[70%] max-w-[70%] object-contain transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col px-4 pb-5 pt-[5.2rem] text-center">
                    <h3 className="m-0 text-[1.3rem] font-light leading-snug text-black">{name}</h3>
                    {categoryBadge ? (
                      <span className="mx-auto mt-3 inline-block rounded-[0.2rem] bg-[#d51130] px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-[0.05rem] text-white">
                        {categoryBadge}
                      </span>
                    ) : null}
                  </div>
                  {tagline ? (
                    <div className="bg-[#eeeeee] px-4 py-4 text-left">
                      <p className="m-0 text-[0.89rem] font-normal leading-[1.1rem] text-[#7b7b7b]">
                        {tagline}
                      </p>
                    </div>
                  ) : null}
                </div>
              </a>
            );
          })}
        </div>

        {hasMore ? (
          <div className="mt-10 flex justify-center">
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + pageSize)}
              className="rounded-[50px] bg-black px-6 py-2.5 text-base text-white"
            >
              {loadMoreLabel}
            </button>
          </div>
        ) : null}

        {relatedCategories.length > 0 ? (
          <div className="mt-14 border-t border-[#e6e6e6] pt-8">
            <p className="m-0 mb-4 text-base text-[#646363]">
              {relatedPrefix} {relatedTheme} solutions:
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {relatedCategories.map((category) => {
                const slug =
                  fieldText(category.fields, 'Category1 Slug') || category.name || '';
                const label =
                  fieldText(category.fields, 'Title') || category.displayName || slug;
                return (
                  <a
                    key={category.id || slug}
                    href={`/products/categories/${slug}`}
                    className="text-[#00a0de] no-underline hover:underline"
                  >
                    {label}
                  </a>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
};
