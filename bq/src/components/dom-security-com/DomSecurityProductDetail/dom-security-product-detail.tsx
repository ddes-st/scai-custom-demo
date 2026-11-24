'use client';

import { Text, useSitecore } from '@sitecore-content-sdk/nextjs';
import type { TextField } from '@sitecore-content-sdk/nextjs';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ComponentProps } from 'lib/component-props';
import {
  fieldImageSrc,
  fieldPrimaryImageSrc,
  fieldText,
  useWildcardItem,
  useWildcardItemContext,
  type WildcardLinkedItem,
} from 'src/lib/wildcard';
import { trackProductDetailView } from '../_demo/demo-cdp';

interface Fields {
  'About Tab Label'?: TextField;
  'Benefits Tab Label'?: TextField;
  'Specs Tab Label'?: TextField;
  'Variants Label'?: TextField;
  'Source Root'?: TextField;
}

type Props = ComponentProps & { fields?: Fields };

type SpecSection = { title: string; html: string };

function parseGallery(fields: Record<string, unknown> | undefined, fallback?: string): string[] {
  const raw = fieldText(fields ?? {}, 'Gallery Images');
  const urls = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^https?:\/\//i.test(line));
  if (urls.length) return urls;
  if (fallback) return [fallback];
  return [];
}

const PROFILE_ORDER = [
  'european profile',
  'scandinavian oval profile',
  'scandinavian round profile',
  'swiss profile',
];

const TYPE_ORDER = [
  'double cylinder 1-sided readability',
  'lever cylinder',
  'padlock',
  'double cylinder 1-sided readability without inner knob',
  'double cylinder 2-sided readability',
  'double cylinder ee 1-sided readability',
  'double cylinder ee 1-sided readability mechanical inner locking',
  'double cylinder ee 1-sided readability without inner knob',
  'double cylinder glass door version 1-sided readability',
  'double cylinder short-long-version 1-sided readability',
  'half cylinder 1-sided readability',
  'half cylinder for pivoted lever handles',
  'half cylinder m4 1-sided readability',
];

function variantLabel(variant: WildcardLinkedItem): string {
  return (fieldText(variant.fields, 'Label') || variant.displayName || variant.name || '').toLowerCase();
}

function sortByOrder(items: WildcardLinkedItem[], order: string[]): WildcardLinkedItem[] {
  return [...items].sort((a, b) => {
    const ai = order.indexOf(variantLabel(a));
    const bi = order.indexOf(variantLabel(b));
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
}

function groupVariants(variants: WildcardLinkedItem[]) {
  const profiles: WildcardLinkedItem[] = [];
  const types: WildcardLinkedItem[] = [];
  for (const variant of variants) {
    const group = fieldText(variant.fields, 'Group').toLowerCase();
    if (group === 'profile') profiles.push(variant);
    else types.push(variant);
  }
  return {
    profiles: sortByOrder(profiles, PROFILE_ORDER),
    types: sortByOrder(types, TYPE_ORDER),
  };
}

/** Prefer CDN Image Url (immediate), then Sitecore Image.src. */
function variantImageSrc(variant?: WildcardLinkedItem | null): string {
  if (!variant) return '';
  return (
    fieldText(variant.fields, 'Image Url') ||
    fieldImageSrc(variant.fields, 'Image') ||
    ''
  );
}

function isDefaultVariant(variant: WildcardLinkedItem): boolean {
  const value = variant.fields?.['Is Default'];
  if (typeof value === 'boolean') return value;
  if (value && typeof value === 'object' && 'value' in value) {
    return Boolean((value as { value?: unknown }).value);
  }
  return false;
}

function parseSpecSections(specsHtml: string): SpecSection[] {
  if (!specsHtml) return [];
  const parts = specsHtml.split(/<h4[^>]*>/i).filter(Boolean);
  if (parts.length <= 1 && !/<h4/i.test(specsHtml)) {
    return [{ title: 'Specifications', html: specsHtml }];
  }
  return parts
    .map((part) => {
      const match = part.match(/^([^<]*)<\/h4>([\s\S]*)$/i);
      if (!match) return null;
      return { title: match[1].trim(), html: match[2].trim() };
    })
    .filter((section): section is SpecSection => Boolean(section?.title));
}

export const Default = (props: Props) => {
  const { fields } = props;
  const { page } = useSitecore();
  const language = page?.locale || 'en';
  const router = useRouter();
  const pathname = usePathname() || '';
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  const ambient = useWildcardItemContext();
  const sourceRoot = fields?.['Source Root']?.value?.toString() || '';
  const local = useWildcardItem({
    sourceRoot: ambient ? undefined : sourceRoot,
    language,
  });
  const state = ambient ?? local;

  const variants: WildcardLinkedItem[] = state.item?.children ?? [];
  const { profiles, types } = useMemo(() => groupVariants(variants), [variants]);

  const title =
    state.status === 'resolved'
      ? fieldText(state.fields, 'Title') || state.item?.displayName || ''
      : '';
  const tagline = fieldText(state.fields, 'Tagline');
  const certifications = fieldText(state.fields, 'Certifications');
  const about = fieldText(state.fields, 'About');
  const benefits = fieldText(state.fields, 'Benefits');
  const specs = fieldText(state.fields, 'Specs');
  const categorySlug = fieldText(state.fields, 'Category1 Slug');
  const heroFallback = fieldPrimaryImageSrc(state.fields);

  const defaultType =
    types.find(isDefaultVariant) ||
    types.find((variant) => fieldText(variant.fields, 'Href').endsWith(pathname.split('/').pop() || '')) ||
    types[0];
  const defaultProfile = profiles.find(isDefaultVariant) || profiles[0];

  const [profileName, setProfileName] = useState(defaultProfile?.name || '');
  const [typeName, setTypeName] = useState(defaultType?.name || '');
  const [slide, setSlide] = useState(0);
  const [openSpec, setOpenSpec] = useState(0);
  /** Optimistic hero override so the image swaps before navigation completes. */
  const [heroOverride, setHeroOverride] = useState<string>('');

  useEffect(() => {
    setProfileName(defaultProfile?.name || '');
    setTypeName(defaultType?.name || '');
    setSlide(0);
    setHeroOverride('');
  }, [state.item?.id, defaultProfile?.name, defaultType?.name]);

  const trackedProductId = useRef('');

  useEffect(() => {
    if (state.status !== 'resolved') return;
    const id = state.item?.id || state.item?.name || '';
    if (!id || trackedProductId.current === id) return;
    trackedProductId.current = id;
    const name = fieldText(state.fields, 'Title') || state.item?.displayName || state.item?.name || '';
    trackProductDetailView(id, name);
  }, [state.status, state.item?.id, state.item?.name, state.item?.displayName, state.fields]);

  const activeType = types.find((variant) => variant.name === typeName) || defaultType;
  const activeProfile = profiles.find((variant) => variant.name === profileName) || defaultProfile;

  const selectedVariantImage =
    variantImageSrc(activeType) || variantImageSrc(activeProfile) || '';

  const gallery = useMemo(() => {
    const base = parseGallery(state.fields, heroFallback);
    const lead = heroOverride || selectedVariantImage || heroFallback;
    const ordered = [lead, ...base].filter(Boolean) as string[];
    return Array.from(new Set(ordered));
  }, [state.fields, heroFallback, selectedVariantImage, heroOverride]);

  const currentImage = gallery[slide] || gallery[0] || selectedVariantImage || '';
  const specSections = useMemo(() => parseSpecSections(specs), [specs]);

  const selectVariant = (variant: WildcardLinkedItem | undefined, kind: 'profile' | 'type') => {
    if (!variant) return;

    // European profile should show the currently selected type image (not a fixed DC1 shot).
    const isEuropeanProfile =
      kind === 'profile' && variantLabel(variant).includes('european profile');
    const nextImage = isEuropeanProfile
      ? variantImageSrc(types.find((item) => item.name === typeName) || defaultType) ||
        variantImageSrc(variant)
      : variantImageSrc(variant);

    if (nextImage) {
      setHeroOverride(nextImage);
      setSlide(0);
    }
    if (kind === 'profile') setProfileName(variant.name || '');
    if (kind === 'type') setTypeName(variant.name || '');

    const href = fieldText(variant.fields, 'Href').trim();
    if (!href) return;
    const currentSlug = pathname.split('/').filter(Boolean).pop() || '';
    const targetSlug = href.split('/').filter(Boolean).pop() || '';
    if (targetSlug && targetSlug !== currentSlug) {
      router.push(href);
    }
  };

  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <section className="mx-auto max-w-[1170px] px-[15px] py-16 font-[Source_Sans_Pro] font-light text-[#646363]">
        Loading product…
      </section>
    );
  }

  if (state.status !== 'resolved') {
    return (
      <section className="mx-auto max-w-[1170px] px-[15px] py-16 font-[Source_Sans_Pro] font-light text-[#7e7c7c]">
        Product not found.
      </section>
    );
  }

  return (
    <section
      id={renderingId || undefined}
      className="w-full bg-[#f8f8f8] font-[Source_Sans_Pro] font-light text-black"
    >
      <div className="mx-auto w-full max-w-[1170px] px-[15px] py-6 md:py-10">
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-[#00a0de]">
          <a href="/products" className="no-underline hover:underline">
            Product Overview
          </a>
          <span className="text-[#979696]">›</span>
          {categorySlug ? (
            <>
              <a
                href={`/products/categories/${categorySlug}`}
                className="capitalize no-underline hover:underline"
              >
                {categorySlug.replace(/-/g, ' ')}
              </a>
              <span className="text-[#979696]">›</span>
            </>
          ) : null}
          <span className="text-black">{title}</span>
        </nav>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-7">
            <div className="relative flex min-h-[240px] items-center justify-center bg-white px-10 py-8 md:min-h-[420px]">
              {gallery.length > 1 ? (
                <>
                  <button
                    type="button"
                    aria-label="Previous image"
                    onClick={() => setSlide((value) => (value - 1 + gallery.length) % gallery.length)}
                    className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-3xl text-[#00a0de]"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    aria-label="Next image"
                    onClick={() => setSlide((value) => (value + 1) % gallery.length)}
                    className="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-3xl text-[#00a0de]"
                  >
                    ›
                  </button>
                </>
              ) : null}
              {currentImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={currentImage}
                  src={currentImage}
                  alt={title}
                  className="max-h-[500px] max-w-[90%] object-contain transition-opacity duration-200"
                />
              ) : null}
            </div>
            {gallery.length > 1 ? (
              <div className="mt-3 flex justify-center gap-2">
                {gallery.map((url, index) => (
                  <button
                    key={url}
                    type="button"
                    aria-label={`Show image ${index + 1}`}
                    onClick={() => setSlide(index)}
                    className={`h-2.5 w-2.5 rounded-full ${
                      index === slide ? 'bg-[#d51130]' : 'bg-[#c9c9c9]'
                    }`}
                  />
                ))}
              </div>
            ) : null}
          </div>

          <div className="lg:col-span-5">
            <h1 className="m-0 text-[2.2rem] font-light leading-[1.1] md:text-[2.78rem] md:leading-[3.06rem]">
              {title}
            </h1>
            {tagline && tagline !== title ? (
              <p className="m-0 mt-1 text-[1.11rem] leading-[1.83rem] text-[#646363]">{tagline}</p>
            ) : null}
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-[#00a0de] underline-offset-2 hover:underline"
              onClick={() => {
                if (typeof navigator !== 'undefined' && navigator.share) {
                  void navigator.share({ title, url: window.location.href }).catch(() => undefined);
                }
              }}
            >
              <span aria-hidden="true" className="text-base leading-none">
                ↗
              </span>
              Share this product
            </button>

            {(profiles.length > 0 || types.length > 0) ? (
              <div className="mt-8">
                <p className="m-0 mb-3 text-sm font-normal text-black">
                  {fields?.['Variants Label']?.value?.toString() || 'Available variants:'}
                </p>
                {profiles.length > 0 ? (
                  <label className="relative mb-4 block">
                    <span className="sr-only">Profile</span>
                    <select
                      id="profile"
                      className="w-full min-h-[2.8rem] appearance-none rounded-[3px] border border-[#c9c9c9] bg-white px-3 pr-10 text-base text-black"
                      value={profileName}
                      onChange={(event) => {
                        const next = profiles.find((variant) => variant.name === event.target.value);
                        selectVariant(next, 'profile');
                      }}
                    >
                      {profiles.map((variant) => (
                        <option key={variant.id || variant.name} value={variant.name}>
                          {fieldText(variant.fields, 'Label') || variant.displayName || variant.name}
                        </option>
                      ))}
                    </select>
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#646363]"
                    >
                      ▾
                    </span>
                  </label>
                ) : null}
                {types.length > 0 ? (
                  <label className="relative block">
                    <span className="sr-only">Variant type</span>
                    <select
                      id="cylinder"
                      className="w-full min-h-[2.8rem] appearance-none rounded-[3px] border border-[#c9c9c9] bg-white px-3 pr-10 text-base text-black"
                      value={typeName}
                      aria-label="Variant type"
                      onChange={(event) => {
                        const next = types.find((variant) => variant.name === event.target.value);
                        selectVariant(next, 'type');
                      }}
                    >
                      {types.map((variant) => (
                        <option key={variant.id || variant.name} value={variant.name}>
                          {fieldText(variant.fields, 'Label') || variant.displayName || variant.name}
                        </option>
                      ))}
                    </select>
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#646363]"
                    >
                      ▾
                    </span>
                  </label>
                ) : null}
              </div>
            ) : null}

            {certifications ? (
              <p className="mt-6 text-xs uppercase tracking-[0.08em] text-[#7e7c7c]">
                {certifications}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="border-t border-[#e6e6e6] bg-[#f8f8f8]">
        <div className="mx-auto w-full max-w-[1170px] px-[15px] py-10 md:py-16">
          <div className="space-y-10 md:space-y-16">
            {about ? (
              <section>
                <h2 className="m-0 mb-4 text-[1.67rem] font-light md:text-[2.55rem]">
                  {fields?.['About Tab Label']?.value?.toString() || 'About'}
                </h2>
                <div
                  className="border border-[#e6e6e6] bg-white p-4 text-base leading-[1.67rem] text-[#646363] md:p-8 [&_p]:m-0"
                  dangerouslySetInnerHTML={{ __html: about }}
                />
              </section>
            ) : null}

            {benefits ? (
              <section>
                <h2 className="m-0 mb-4 text-[1.67rem] font-light md:text-[2.55rem]">
                  {fields?.['Benefits Tab Label']?.value?.toString() || 'Benefits'}
                </h2>
                <div
                  className="border border-[#e6e6e6] bg-white p-4 text-base leading-[1.67rem] text-[#646363] md:p-8 [&_li]:mb-2 [&_ul]:m-0 [&_ul]:list-disc [&_ul]:pl-5"
                  dangerouslySetInnerHTML={{ __html: benefits }}
                />
              </section>
            ) : null}

            {specSections.length ? (
              <section>
                <h2 className="m-0 mb-4 text-[1.67rem] font-light md:text-[2.55rem]">
                  {fields?.['Specs Tab Label']?.value?.toString() || 'Specifications'}
                </h2>
                <div className="border border-[#e6e6e6] bg-white">
                  {specSections.map((section, index) => {
                    const isOpen = openSpec === index;
                    return (
                      <div key={section.title} className="border-b border-[#e3e3e3] last:border-b-0">
                        <button
                          type="button"
                          onClick={() => setOpenSpec(isOpen ? -1 : index)}
                          className="flex w-full items-center justify-between px-4 py-4 text-left text-lg font-light text-black md:px-6"
                        >
                          <span>{section.title}</span>
                          <span className="text-[#00a0de]">{isOpen ? '−' : '+'}</span>
                        </button>
                        {isOpen ? (
                          <div
                            className="px-4 pb-5 text-base text-[#646363] md:px-6 [&_h4]:hidden [&_table]:mb-4 [&_table]:w-full [&_td]:border-t [&_td]:border-[#eee] [&_td]:py-2 [&_td]:pr-3 [&_th]:border-t [&_th]:border-[#eee] [&_th]:py-2 [&_th]:pr-4 [&_th]:text-left [&_th]:font-normal [&_th]:text-black"
                            dangerouslySetInnerHTML={{ __html: section.html }}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </div>
          <Text field={fields?.['About Tab Label']} tag="span" className="hidden" />
        </div>
      </div>
    </section>
  );
};
