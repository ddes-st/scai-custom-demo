'use client';

import { Text, useSitecore } from '@sitecore-content-sdk/nextjs';
import type { TextField } from '@sitecore-content-sdk/nextjs';
import { useEffect, useMemo, useState } from 'react';
import { ComponentProps } from 'lib/component-props';
import DealerFinderSearch from '../DomSecurityDealerFinder/dom-security-dealer-finder.search';
import {
  fetchWildcardChildren,
  fieldPrimaryImageSrc,
  fieldText,
  groupCatalogByFamily,
  type WildcardLinkedItem,
} from 'src/lib/wildcard';

interface Fields {
  Title: TextField;
  Subtitle: TextField;
  'Products Root': TextField;
  'Categories Root': TextField;
  'Intro Label': TextField;
  'Search Placeholder': TextField;
  'Help Label': TextField;
  'Help Href': TextField;
  'Dealer Title': TextField;
  'Dealer Body': TextField;
  'Dealer Cta Label': TextField;
  'Dealer Href': TextField;
  'Empty Message': TextField;
}

type Props = ComponentProps & { fields: Fields };

type ThemeGroup = {
  theme: string;
  label: string;
  categories: WildcardLinkedItem[];
};

const THEME_ORDER = [
  'access-control-solutions',
  'door-hardware',
  'industrial-locking-equipment',
] as const;

const THEME_LABELS: Record<string, string> = {
  'access-control-solutions': 'Access Control Solutions',
  'door-hardware': 'Door Hardware',
  'industrial-locking-equipment': 'Industrial Locking Equipment',
};

/** Capture CDN images for category tiles (fallback when category has no Image). */
const CATEGORY_IMAGE_FALLBACKS: Record<string, string> = {
  'digital-cylinders':
    'https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/PimDam/jpg/d/digitalcylinderbe/digitalcylinderbe-main.jpg?modified=20210120145406&extension=webp',
  'digital-handles':
    'https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/PimDam/jpg/d/digitalhandlesnl/digitalhandlesnl-main.jpg?modified=20210120152742&extension=webp',
  transponders:
    'https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/PimDam/jpg/m/medianl/medianl-main.jpg?modified=20210120145907&extension=webp',
  'wall-readers-and-terminals':
    'https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/PimDam/jpg/w/wallreaderbe/wallreaderbe-main.jpg?modified=20210120153459&extension=webp',
  'mechanical-cylinders':
    'https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/PimDam/jpg/m/mechanicalcylindersbe/mechanicalcylindersbe-main.jpg?modified=20210120140239&extension=webp',
  'mechanical-locks':
    'https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/PimDam/jpg/m/mechanicallocksnl/mechanicallocksnl-main.jpg?modified=20210120140239&extension=webp',
  'digital-furniture-locks':
    'https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/PimDam/jpg/d/digitalfurniturelocksbe/digitalfurniturelocksbe-main.jpg?modified=20210120145406&extension=webp',
  'furniture-locks':
    'https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/PimDam/jpg/f/furniturelocksbe/furniturelocksbe-main.jpg?modified=20210120145249&extension=webp',
  'trapped-key-interlocking-systems':
    'https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/PimDam/jpg/i/interlockingbe/interlockingbe-main.jpg?modified=20211216074751&extension=webp',
};

const CATEGORY_ORDER: Record<string, string[]> = {
  'access-control-solutions': [
    'digital-cylinders',
    'digital-handles',
    'transponders',
    'apps-software',
    'wall-readers-and-terminals',
  ],
  'door-hardware': ['mechanical-cylinders', 'mechanical-locks'],
  'industrial-locking-equipment': [
    'digital-furniture-locks',
    'furniture-locks',
    'trapped-key-interlocking-systems',
  ],
};

/** Live /products label casing (overrides Sitecore Title when present). */
const CATEGORY_TITLE_OVERRIDES: Record<string, string> = {
  'digital-cylinders': 'Digital Cylinders',
  'digital-handles': 'Digital Handles',
  transponders: 'Transponders',
  'apps-software': 'Apps & Software',
  'wall-readers-and-terminals': 'Wall Readers and Terminals',
  'mechanical-cylinders': 'Mechanical cylinders',
  'mechanical-locks': 'Mechanical Locks',
  'digital-furniture-locks': 'Digital Furniture Locks',
  'furniture-locks': 'Furniture Locks',
  'trapped-key-interlocking-systems': 'Trapped Key Interlocking Systems',
};

const DEALER_IMAGE =
  'https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/DOM-BE/image/find-a-dealer-Belgium.jpg?h=600&iar=0&w=990&modified=20211231080627&extension=webp';

function categorySlug(item: WildcardLinkedItem): string {
  return fieldText(item.fields, 'Category1 Slug') || item.name || '';
}

function categoryTitle(item: WildcardLinkedItem): string {
  const slug = categorySlug(item);
  return (
    CATEGORY_TITLE_OVERRIDES[slug] ||
    fieldText(item.fields, 'Title') ||
    item.displayName ||
    slug
  );
}

function categoryImage(
  item: WildcardLinkedItem,
  productsByCategory: Map<string, WildcardLinkedItem[]>,
): string {
  const slug = categorySlug(item);
  const fromField =
    fieldText(item.fields, 'Image Url') || fieldPrimaryImageSrc(item.fields);
  if (fromField) return fromField;
  if (CATEGORY_IMAGE_FALLBACKS[slug]) return CATEGORY_IMAGE_FALLBACKS[slug];
  const firstProduct = productsByCategory.get(slug)?.[0];
  return firstProduct ? fieldPrimaryImageSrc(firstProduct.fields) : '';
}

export const Default = (props: Props) => {
  const { fields } = props;
  const { page } = useSitecore();
  const language = page?.locale || 'en';
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  const productsRoot = fields?.['Products Root']?.value?.toString() || '';
  const categoriesRoot = fields?.['Categories Root']?.value?.toString() || '';

  const [categories, setCategories] = useState<WildcardLinkedItem[]>([]);
  const [productsByCategory, setProductsByCategory] = useState<
    Map<string, WildcardLinkedItem[]>
  >(new Map());
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty'>('loading');

  useEffect(() => {
    if (!categoriesRoot && !productsRoot) {
      setStatus('empty');
      return;
    }
    let cancelled = false;
    (async () => {
      const [categoryItems, productItems] = await Promise.all([
        categoriesRoot
          ? fetchWildcardChildren({ path: categoriesRoot, language })
          : Promise.resolve([]),
        productsRoot
          ? fetchWildcardChildren({ path: productsRoot, language })
          : Promise.resolve([]),
      ]);
      if (cancelled) return;

      const families = groupCatalogByFamily(productItems);
      const byCategory = new Map<string, WildcardLinkedItem[]>();
      for (const product of families) {
        const slug = fieldText(product.fields, 'Category1 Slug');
        if (!slug) continue;
        const list = byCategory.get(slug) ?? [];
        list.push(product);
        byCategory.set(slug, list);
      }
      setProductsByCategory(byCategory);
      setCategories(categoryItems);
      setStatus(categoryItems.length || families.length ? 'ready' : 'empty');
    })();
    return () => {
      cancelled = true;
    };
  }, [productsRoot, categoriesRoot, language]);

  const themeGroups = useMemo((): ThemeGroup[] => {
    const q = query.trim().toLowerCase();
    const filtered = categories.filter((category) => {
      if (!q) return true;
      return categoryTitle(category).toLowerCase().includes(q);
    });

    const byTheme = new Map<string, WildcardLinkedItem[]>();
    for (const category of filtered) {
      const theme = fieldText(category.fields, 'Theme Slug') || 'other';
      const list = byTheme.get(theme) ?? [];
      list.push(category);
      byTheme.set(theme, list);
    }

    const orderedThemes = [
      ...THEME_ORDER.filter((theme) => byTheme.has(theme)),
      ...[...byTheme.keys()].filter(
        (theme) => !(THEME_ORDER as readonly string[]).includes(theme),
      ),
    ];

    return orderedThemes.map((theme) => {
      const items = byTheme.get(theme) ?? [];
      const order = CATEGORY_ORDER[theme] ?? [];
      const sorted = [...items].sort((a, b) => {
        const ai = order.indexOf(categorySlug(a));
        const bi = order.indexOf(categorySlug(b));
        if (ai >= 0 || bi >= 0) {
          return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
        }
        return categoryTitle(a).localeCompare(categoryTitle(b));
      });
      return {
        theme,
        label:
          THEME_LABELS[theme] ||
          theme.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        categories: sorted,
      };
    });
  }, [categories, query]);

  const introLabel = fields?.['Intro Label']?.value?.toString() || 'I would like to see…';
  const searchPlaceholder =
    fields?.['Search Placeholder']?.value?.toString() || 'Search product name';
  const helpLabel = fields?.['Help Label']?.value?.toString() || 'Need help?';
  const helpHref = fields?.['Help Href']?.value?.toString() || '/find-a-dom-dealer';
  const dealerTitle = fields?.['Dealer Title']?.value?.toString() || 'Find a dealer';
  const dealerBody =
    fields?.['Dealer Body']?.value?.toString() ||
    'Search where you can buy DOM products in your neighbourhood.';
  const dealerCta = fields?.['Dealer Cta Label']?.value?.toString() || 'Find a dealer';
  const dealerHref = fields?.['Dealer Href']?.value?.toString() || '/find-a-dom-dealer';

  return (
    <section
      id={renderingId || undefined}
      className="w-full bg-white font-[Source_Sans_Pro] font-light text-black"
    >
      {/* Grey filter hero */}
      <div className="bg-[#646363] text-white">
        <div className="mx-auto w-full max-w-[1170px] px-[15px] pt-8 md:pt-12">
          <div className="flex flex-col gap-4 border-b border-white/25 pb-6 md:flex-row md:items-end md:justify-between">
            <Text
              field={fields?.Title}
              tag="h1"
              className="m-0 text-[2.4rem] font-light leading-none text-white md:text-[3.5rem] lg:text-[3.9rem]"
            />
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
            <p className="m-0 text-[1.35rem] font-light md:text-[1.67rem]">{introLabel}</p>
            <a
              href={helpHref}
              className="inline-flex items-center gap-2 text-sm text-white no-underline hover:underline"
            >
              {helpLabel}
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

      {/* Theme-grouped category tiles */}
      <div className="bg-white text-[#646363]">
        <div className="mx-auto w-full max-w-[1170px] px-[15px] pb-10 pt-8 md:pt-10">
          {status === 'loading' ? (
            <p className="text-[#7e7c7c]">Loading products…</p>
          ) : null}
          {status === 'empty' ? (
            <Text field={fields?.['Empty Message']} tag="p" className="text-[#7e7c7c]" />
          ) : null}

          {themeGroups.map((group) => (
            <div key={group.theme} className="mb-8 last:mb-0 md:mb-12">
              <h2 className="m-0 mb-2 text-[1.33rem] font-semibold leading-[1.72rem] text-[#646363] md:mb-7">
                {group.label}
              </h2>
              <div className="-mx-[15px] flex flex-wrap">
                {group.categories.map((category) => {
                  const slug = categorySlug(category);
                  const title = categoryTitle(category);
                  const image = categoryImage(category, productsByCategory);
                  return (
                    <a
                      key={category.id || slug}
                      href={`/products/categories/${slug}`}
                      className="mt-4 mb-6 block w-full px-[15px] text-center text-[#646363] no-underline transition-opacity hover:opacity-90 max-md:mt-0 max-md:mb-0 max-md:border-t max-md:border-[#c8c8c8] max-md:py-3 max-md:text-left first:max-md:border-t-0 sm:w-1/2 md:w-1/3 lg:w-1/4"
                    >
                      <div className="flex h-full min-h-[1.5rem] flex-col bg-[#e6e6e6] pb-5 max-md:flex-row max-md:items-center max-md:gap-4 max-md:bg-transparent max-md:pb-0">
                        <div className="relative top-[-1rem] mx-auto flex h-[8.7rem] w-[8.7rem] shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-[0_0_20px_-9px_rgba(0,0,0,0.5)] max-md:static max-md:mx-0 max-md:h-[2.67rem] max-md:w-[2.67rem] max-md:border max-md:border-[#d2d2d2] max-md:shadow-none">
                          {image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={image}
                              alt={title}
                              className="m-auto max-h-full max-w-full object-contain"
                            />
                          ) : null}
                        </div>
                        <h3 className="m-0 px-1.5 text-[1.2rem] font-normal leading-normal text-inherit md:text-[1.33rem] max-md:my-auto">
                          {title}
                        </h3>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          ))}

          {status === 'ready' && themeGroups.every((g) => g.categories.length === 0) ? (
            <p className="text-[#7e7c7c]">No categories match your search.</p>
          ) : null}
        </div>
      </div>

      {/* Find a dealer */}
      <div className="bg-[#e3e3e3] font-light text-black">
        <div className="flex flex-col lg:grid lg:grid-cols-[3fr_2fr]">
          <div className="order-1 flex min-h-[204px] items-stretch px-[15px] py-8 lg:order-none lg:min-h-[374px] lg:px-[42px]">
            <div className="flex w-full flex-col justify-between lg:mx-auto lg:max-w-[555px] lg:justify-center">
              <h2 className="m-0 text-[1.27rem] font-light leading-normal lg:text-[2.55rem] lg:leading-[2.78rem]">
                {dealerTitle}
              </h2>
              <p className="m-0 max-w-[390px] text-[0.67rem] font-light leading-[1.35] text-[#646363] lg:mb-[2.22rem] lg:text-[1rem] lg:leading-[1.67]">
                {dealerBody}
              </p>
              <DealerFinderSearch
                placeholder="Postal Code"
                ctaText={dealerCta}
                searchLink={{
                  value: { href: dealerHref, text: dealerCta },
                }}
              />
            </div>
          </div>
          <div className="order-none h-[193px] overflow-hidden lg:order-1 lg:h-[374px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={DEALER_IMAGE}
              alt="Find a dealer Belgium"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
