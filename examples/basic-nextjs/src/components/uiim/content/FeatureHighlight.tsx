'use client';

import React, { JSX, useState } from 'react';
import Image from 'next/image';
import {
  Field,
  ImageField,
  LinkField,
  NextImage as ContentSdkImage,
  Link as ContentSdkLink,
  RichText as ContentSdkRichText,
  Text,
} from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';
import { cn } from '@/lib/utils';
import { SmartMedia } from '@/components/uiim/media/SmartMedia';

interface FeatureHighlightFields {
  EyebrowText: Field<string>;
  Title: Field<string>;
  Description: Field<string>;
  FeatureImage: ImageField;
  PrimaryLink: LinkField;
}

type FeatureHighlightProps = ComponentProps & {
  fields: FeatureHighlightFields;
};

const FeatureHighlightDefaultComponent = (): JSX.Element => (
  <div className="component feature-highlight">
    <div className="component-content">
      <span className="is-empty-hint">FeatureHighlight</span>
    </div>
  </div>
);

const Eyebrow = ({ field, isEditing }: { field: Field<string>; isEditing?: boolean }) => {
  if (!field?.value && !isEditing) return null;
  return (
    <Text
      field={field}
      tag="span"
      className="mb-3 inline-block text-xs font-semibold uppercase tracking-wider"
      style={{ color: 'var(--brand-primary)' }}
    />
  );
};

const CtaButton = ({ field, isEditing }: { field: LinkField; isEditing?: boolean }) => {
  if (!field?.value?.href && !isEditing) return null;
  return (
    <ContentSdkLink
      field={field}
      className="mt-6 inline-flex items-center justify-center px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90 rounded-[var(--brand-button-radius,0.375rem)]"
      style={{
        backgroundColor: 'var(--brand-primary)',
        color: 'var(--brand-primary-foreground)',
      }}
    />
  );
};

/* ────────────────────────────────────────────
   Default — image right, text left (alternates via CSS)
   ──────────────────────────────────────────── */
export const Default = ({ fields, params, page }: FeatureHighlightProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  if (!fields) return <FeatureHighlightDefaultComponent />;

  return (
    <div className={cn('component feature-highlight', styles)} id={RenderingIdentifier}>
      <section
        className="w-full px-4 py-16 md:py-24"
        style={{ backgroundColor: 'var(--brand-bg, #ffffff)' }}
      >
        <div className="mx-auto grid max-w-7xl items-center gap-10 md:grid-cols-2 md:px-6 even:[&]:direction-rtl even:[&>*]:direction-ltr">
          <div>
            <Eyebrow field={fields.EyebrowText} isEditing={isEditing} />
            {(fields.Title?.value || isEditing) && (
              <Text
                field={fields.Title}
                tag="h2"
                className="text-3xl font-bold tracking-tight sm:text-4xl font-[var(--brand-heading-font,inherit)]"
                style={{ color: 'var(--brand-fg, #111111)' }}
              />
            )}
            {(fields.Description?.value || isEditing) && (
              <ContentSdkRichText
                field={fields.Description}
                className="mt-4 text-base opacity-70 font-[var(--brand-body-font,inherit)]"
                style={{ color: 'var(--brand-fg, #111111)' }}
              />
            )}
            <CtaButton field={fields.PrimaryLink} isEditing={isEditing} />
          </div>
          <div className="relative h-full min-h-[400px] overflow-hidden rounded-[var(--brand-card-radius,0.75rem)]">
            {(fields.FeatureImage?.value?.src || isEditing) && (
              <SmartMedia
                field={fields.FeatureImage}
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover"
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

/* ────────────────────────────────────────────
   Centered — centered text above, image below
   ──────────────────────────────────────────── */
export const Centered = ({ fields, params, page }: FeatureHighlightProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  if (!fields) return <FeatureHighlightDefaultComponent />;

  return (
    <div className={cn('component feature-highlight', styles)} id={RenderingIdentifier}>
      <section
        className="w-full px-4 py-16 md:py-24"
        style={{ backgroundColor: 'var(--brand-bg, #ffffff)' }}
      >
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <Eyebrow field={fields.EyebrowText} isEditing={isEditing} />
            {(fields.Title?.value || isEditing) && (
              <Text
                field={fields.Title}
                tag="h2"
                className="text-3xl font-bold tracking-tight sm:text-4xl font-[var(--brand-heading-font,inherit)]"
                style={{ color: 'var(--brand-fg, #111111)' }}
              />
            )}
            {(fields.Description?.value || isEditing) && (
              <ContentSdkRichText
                field={fields.Description}
                className="mx-auto mt-4 max-w-2xl text-base opacity-70 font-[var(--brand-body-font,inherit)]"
                style={{ color: 'var(--brand-fg, #111111)' }}
              />
            )}
            <CtaButton field={fields.PrimaryLink} isEditing={isEditing} />
          </div>
          {(fields.FeatureImage?.value?.src || isEditing) && (
            <div className="relative mt-10 aspect-video overflow-hidden rounded-[var(--brand-card-radius,0.75rem)]">
              <SmartMedia
                field={fields.FeatureImage}
                fill
                sizes="(min-width: 768px) 896px, 100vw"
                className="object-cover"
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

/* ────────────────────────────────────────────
   WithVideo — same as Default but with play button overlay
   ──────────────────────────────────────────── */
export const WithVideo = ({ fields, params, page }: FeatureHighlightProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  if (!fields) return <FeatureHighlightDefaultComponent />;

  return (
    <div className={cn('component feature-highlight', styles)} id={RenderingIdentifier}>
      <section
        className="w-full px-4 py-16 md:py-24"
        style={{ backgroundColor: 'var(--brand-bg, #ffffff)' }}
      >
        <div className="mx-auto grid max-w-7xl items-center gap-10 md:grid-cols-2 md:px-6">
          <div>
            <Eyebrow field={fields.EyebrowText} isEditing={isEditing} />
            {(fields.Title?.value || isEditing) && (
              <Text
                field={fields.Title}
                tag="h2"
                className="text-3xl font-bold tracking-tight sm:text-4xl font-[var(--brand-heading-font,inherit)]"
                style={{ color: 'var(--brand-fg, #111111)' }}
              />
            )}
            {(fields.Description?.value || isEditing) && (
              <ContentSdkRichText
                field={fields.Description}
                className="mt-4 text-base opacity-70 font-[var(--brand-body-font,inherit)]"
                style={{ color: 'var(--brand-fg, #111111)' }}
              />
            )}
            <CtaButton field={fields.PrimaryLink} isEditing={isEditing} />
          </div>
          <div className="relative aspect-video min-h-[300px] overflow-hidden rounded-[var(--brand-card-radius,0.75rem)]">
            {(fields.FeatureImage?.value?.src || isEditing) && (
              <SmartMedia
                field={fields.FeatureImage}
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover"
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full opacity-90"
                style={{ backgroundColor: 'var(--brand-primary)' }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="var(--brand-primary-foreground, #fff)"
                >
                  <polygon points="6,3 20,12 6,21" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

/* ────────────────────────────────────────────
   IconLeft — small image left, text right
   ──────────────────────────────────────────── */
export const IconLeft = ({ fields, params, page }: FeatureHighlightProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  if (!fields) return <FeatureHighlightDefaultComponent />;

  return (
    <div className={cn('component feature-highlight', styles)} id={RenderingIdentifier}>
      <section
        className="w-full px-4 py-12 md:py-16"
        style={{ backgroundColor: 'var(--brand-bg, #ffffff)' }}
      >
        <div className="mx-auto flex max-w-4xl items-start gap-6 md:px-6">
          {(fields.FeatureImage?.value?.src || isEditing) && (
            <div className="h-16 w-16 shrink-0 overflow-hidden">
              <ContentSdkImage
                field={fields.FeatureImage}
                className="h-full w-full object-contain"
              />
            </div>
          )}
          <div className="flex-1">
            <Eyebrow field={fields.EyebrowText} isEditing={isEditing} />
            {(fields.Title?.value || isEditing) && (
              <Text
                field={fields.Title}
                tag="h3"
                className="text-xl font-bold font-[var(--brand-heading-font,inherit)]"
                style={{ color: 'var(--brand-fg, #111111)' }}
              />
            )}
            {(fields.Description?.value || isEditing) && (
              <ContentSdkRichText
                field={fields.Description}
                className="mt-2 text-sm opacity-70 font-[var(--brand-body-font,inherit)]"
                style={{ color: 'var(--brand-fg, #111111)' }}
              />
            )}
            {(fields.PrimaryLink?.value?.href || isEditing) && (
              <ContentSdkLink
                field={fields.PrimaryLink}
                className="mt-3 inline-flex text-sm font-medium underline underline-offset-4 transition-opacity hover:opacity-70"
                style={{ color: 'var(--brand-primary)' }}
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

/* ────────────────────────────────────────────
   Sodexo — 50/50 split, italic heading, asymmetric-radius image
   ──────────────────────────────────────────── */

// Detects the "Latest news and insights" instance so only that datasource
// renders as a rotating newsroom carousel; other FeatureHighlight instances
// (e.g. "Food services") keep the original single-image layout below.
const SODEXO_NEWS_TITLE = 'Latest news and insights';

interface SodexoNewsSlide {
  image: string;
  headline: string;
  description: string;
  linkHref: string;
  linkText: string;
}

// FeatureHighlightData has no child items / repeatable field, so the extra
// rotating slides are hardcoded here. Headlines, descriptions and images are
// sourced from the real sodexo.com/news/newsroom feed (July 2026), reusing
// images already uploaded to Content Hub during the demo build.
const SODEXO_NEWS_EXTRA_SLIDES: SodexoNewsSlide[] = [
  {
    image: 'https://ddes.sitecoresandbox.cloud/api/public/content/106479-section6-img8?v=81b54824',
    headline: 'Sodexo achieves Advocate status in the 2026 Workplace Pride Global Benchmark',
    description:
      'Sodexo has once again achieved Advocate status in the 2026 Workplace Pride Global Benchmark, with a score of 93.3%, marking the seventh consecutive year the company has reached this level of recognition.',
    linkHref: 'https://www.sodexo.com/news/newsroom',
    linkText: 'Learn more',
  },
  {
    image: 'https://ddes.sitecoresandbox.cloud/api/public/content/106439-section3-img4?v=b3ec3d50',
    headline: 'Alice Guéhennec, Sodexo Chief Tech Officer, wins the HotTopics Global CIO 100 2026',
    description:
      'The HotTopics Global CIO 100 Awards recognize worldwide technology and digital leaders who are redefining leadership by driving enterprise transformation and delivering impactful results at scale.',
    linkHref: 'https://www.sodexo.com/news/newsroom',
    linkText: 'Learn more',
  },
  {
    image: 'https://ddes.sitecoresandbox.cloud/api/public/content/106413-section3-img1?v=d480f54d',
    headline: "Sodexo accelerates its growth in Finland by acquiring Antell's restaurant businesses",
    description:
      "Sodexo announces the signing of a share purchase agreement to acquire Antell's restaurant businesses in Finland, strengthening Sodexo Finland's position in the food services market.",
    linkHref: 'https://www.sodexo.com/news/newsroom',
    linkText: 'Learn more',
  },
];

const SodexoNewsHeading = ({ value }: { value: string }) => {
  // Splits "Latest news and insights" so "news" renders in the accent color,
  // matching the two-tone heading treatment on the live site.
  const match = value.match(/^(.*?)\bnews\b(.*)$/i);
  if (!match) {
    return (
      <span style={{ color: 'var(--brand-fg, #2a295c)' }}>{value}</span>
    );
  }
  const [, before, after] = match;
  return (
    <>
      <span style={{ color: 'var(--brand-fg, #2a295c)' }}>{before}</span>
      <span style={{ color: 'var(--brand-primary, #283897)' }}>news</span>
      <span style={{ color: 'var(--brand-fg, #2a295c)' }}>{after}</span>
    </>
  );
};

const SodexoNewsCarousel = ({ fields, isEditing }: { fields: FeatureHighlightFields; isEditing?: boolean }) => {
  const slides: SodexoNewsSlide[] = [
    {
      image: fields.FeatureImage?.value?.src || SODEXO_NEWS_EXTRA_SLIDES[0].image,
      headline: 'Stop Hunger marks 30 years of action against hunger',
      description: "Discover how our global Stop Hunger movement has fought food insecurity for three decades.",
      linkHref: fields.PrimaryLink?.value?.href || SODEXO_NEWS_EXTRA_SLIDES[0].linkHref,
      linkText: fields.PrimaryLink?.value?.text || 'Learn more',
    },
    ...SODEXO_NEWS_EXTRA_SLIDES,
  ];
  const [index, setIndex] = useState(0);
  const goTo = (next: number) => setIndex((next + slides.length) % slides.length);

  return (
    <div
      className="mx-auto max-w-7xl overflow-hidden md:px-6"
      style={{ backgroundColor: 'var(--brand-muted, #f0eef8)', borderRadius: '32px' }}
    >
      <div className="grid items-center gap-10 p-6 md:grid-cols-2 md:gap-16 md:p-14">
        {/* Text side — static intro, does not rotate with the carousel */}
        <div>
          {(fields.EyebrowText?.value || isEditing) && (
            <Text
              field={fields.EyebrowText}
              tag="span"
              className="mb-3 inline-block text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--brand-primary, #283897)' }}
            />
          )}
          <h2
            className="text-2xl font-bold italic leading-snug sm:text-3xl md:text-4xl"
            style={{ fontFamily: 'var(--brand-heading-font, "DM Sans", sans-serif)' }}
          >
            <SodexoNewsHeading value={fields.Title?.value || SODEXO_NEWS_TITLE} />
          </h2>
          {(fields.Description?.value || isEditing) && (
            <ContentSdkRichText
              field={fields.Description}
              className="mt-4 text-sm leading-relaxed opacity-80 md:text-base"
              style={{
                color: 'var(--brand-fg, #2a295c)',
                fontFamily: 'var(--brand-body-font, "Open Sans", sans-serif)',
              }}
            />
          )}
        </div>

        {/* Carousel side */}
        <div className="relative">
          <div
            className="relative overflow-hidden"
            style={{ borderRadius: '60px 3px 3px 3px' }}
          >
            <div
              className="flex transition-transform duration-500 ease-in-out"
              style={{ transform: `translateX(-${index * 100}%)` }}
            >
              {slides.map((slide, i) => (
                <div key={i} className="relative aspect-[4/3] w-full shrink-0 sm:aspect-[16/10]">
                  <Image
                    src={slide.image}
                    alt={slide.headline}
                    fill
                    sizes="(min-width: 768px) 50vw, 100vw"
                    className="object-cover"
                    priority={i === 0}
                  />
                </div>
              ))}
            </div>
            {/* Prev / next arrows — fixed over the image, bottom-right */}
            <div className="absolute bottom-4 right-4 z-10 flex gap-2">
              <button
                type="button"
                onClick={() => goTo(index - 1)}
                aria-label="Previous news item"
                className="flex h-9 w-9 items-center justify-center rounded-full text-white shadow-md transition-opacity hover:opacity-85"
                style={{ backgroundColor: 'var(--brand-accent, #da2020)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="15 6 9 12 15 18" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => goTo(index + 1)}
                aria-label="Next news item"
                className="flex h-9 w-9 items-center justify-center rounded-full text-white shadow-md transition-opacity hover:opacity-85"
                style={{ backgroundColor: 'var(--brand-accent, #da2020)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="9 6 15 12 9 18" />
                </svg>
              </button>
            </div>
          </div>
          {/* Rotating caption below the image */}
          <div className="mt-5 overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-in-out"
              style={{ transform: `translateX(-${index * 100}%)` }}
            >
              {slides.map((slide, i) => (
                <div key={i} className="w-full shrink-0 pr-1">
                  <h3
                    className="text-lg font-semibold leading-snug md:text-xl"
                    style={{
                      color: 'var(--brand-fg, #2a295c)',
                      fontFamily: 'var(--brand-heading-font, "DM Sans", sans-serif)',
                    }}
                  >
                    {slide.headline}
                  </h3>
                  <p
                    className="mt-2 text-sm leading-relaxed opacity-70"
                    style={{
                      color: 'var(--brand-fg, #2a295c)',
                      fontFamily: 'var(--brand-body-font, "Open Sans", sans-serif)',
                    }}
                  >
                    {slide.description}
                  </p>
                  <a
                    href={slide.linkHref}
                    className="mt-3 inline-flex items-center gap-1 text-sm font-semibold transition-opacity hover:opacity-70"
                    style={{ color: 'var(--brand-primary, #283897)' }}
                  >
                    {slide.linkText}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </a>
                </div>
              ))}
            </div>
          </div>
          {/* Dots */}
          <div className="mt-4 flex gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Go to news item ${i + 1}`}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === index ? '20px' : '8px',
                  backgroundColor: i === index ? 'var(--brand-primary, #283897)' : 'var(--brand-border, #d8d6e8)',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const Sodexo = ({ fields, params, page }: FeatureHighlightProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  if (!fields) return <FeatureHighlightDefaultComponent />;

  if (fields.Title?.value === SODEXO_NEWS_TITLE) {
    return (
      <div className={cn('component feature-highlight', styles)} id={RenderingIdentifier}>
        <section className="w-full px-4 py-16 md:py-24">
          <SodexoNewsCarousel fields={fields} isEditing={isEditing} />
        </section>
      </div>
    );
  }

  return (
    <div className={cn('component feature-highlight', styles)} id={RenderingIdentifier}>
      <section
        className="w-full px-4 py-16 md:py-24"
        style={{ backgroundColor: 'var(--brand-bg, #ffffff)' }}
      >
        <div className="mx-auto grid max-w-7xl items-center gap-10 md:grid-cols-2 md:gap-16 md:px-6">
          {/* Text side */}
          <div>
            {(fields.EyebrowText?.value || isEditing) && (
              <Text
                field={fields.EyebrowText}
                tag="span"
                className="mb-3 inline-block text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--brand-primary, #283897)' }}
              />
            )}
            {(fields.Title?.value || isEditing) && (
              <Text
                field={fields.Title}
                tag="h2"
                className="text-2xl font-bold italic leading-snug sm:text-3xl md:text-4xl"
                style={{
                  color: 'var(--brand-fg, #2a295c)',
                  fontFamily: 'var(--brand-heading-font, "DM Sans", sans-serif)',
                }}
              />
            )}
            {(fields.Description?.value || isEditing) && (
              <ContentSdkRichText
                field={fields.Description}
                className="mt-4 text-sm leading-relaxed opacity-80 md:text-base"
                style={{
                  color: 'var(--brand-fg, #2a295c)',
                  fontFamily: 'var(--brand-body-font, "Open Sans", sans-serif)',
                }}
              />
            )}
            {(fields.PrimaryLink?.value?.href || isEditing) && (
              <ContentSdkLink
                field={fields.PrimaryLink}
                className="mt-6 inline-flex items-center gap-1 text-sm font-semibold transition-opacity hover:opacity-70"
                style={{ color: 'var(--brand-primary, #283897)' }}
              />
            )}
          </div>
          {/* Image side — Sodexo asymmetric border-radius */}
          <div
            className="relative h-full min-h-[360px] overflow-hidden md:min-h-[440px]"
            style={{ borderRadius: '60px 3px 3px 3px' }}
          >
            {(fields.FeatureImage?.value?.src || isEditing) && (
              <SmartMedia
                field={fields.FeatureImage}
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover"
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

