'use client';

import React, { JSX, useState } from 'react';
import { Field, Text } from '@sitecore-content-sdk/nextjs';
import Image from 'next/image';
import Link from 'next/link';
import { ComponentProps } from 'lib/component-props';
import { cn } from '@/lib/utils';

interface BlogListingFields {
  Title: Field<string>;
  Body: Field<string>;
}

type BlogListingProps = ComponentProps & {
  fields: BlogListingFields;
};

const BlogListingDefaultComponent = (): JSX.Element => (
  <div className="component blog-listing">
    <div className="component-content">
      <span className="is-empty-hint">BlogListing</span>
    </div>
  </div>
);

export const Default = ({ fields, params, page }: BlogListingProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;

  if (!fields) return <BlogListingDefaultComponent />;

  return (
    <div className={cn('component blog-listing', styles)} id={RenderingIdentifier}>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        {(fields.Title?.value || isEditing) && (
          <Text field={fields.Title} tag="h1" className="text-3xl font-bold" />
        )}
        <p className="mt-4 text-sm opacity-60">Article listing coming soon.</p>
      </section>
    </div>
  );
};

/* ────────────────────────────────────────────
   Sodexo — "Our Everyday Stories" blog listing page
   Replicates sodexo.com/blog/our-everyday-stories
   ──────────────────────────────────────────── */

interface SodexoArticleCard {
  category: string;
  title: string;
  image: string;
  href: string;
}

interface SodexoFeaturedStory {
  title: string;
  date: string;
  image: string;
  href: string;
}

const SODEXO_FEATURED: SodexoFeaturedStory[] = [
  {
    title: 'Healthy Places + Happy People = The Dynamic Workplace Experience',
    date: 'Oct. 13, 2025',
    image: 'https://ddes.sitecoresandbox.cloud/api/public/content/106479-section6-img8?v=81b54824',
    href: '#',
  },
  {
    title: 'AI the vital ingredient in workplace dining that fuels community',
    date: 'Jan. 22, 2026',
    image: 'https://ddes.sitecoresandbox.cloud/api/public/content/106439-section3-img4?v=b3ec3d50',
    href: '#',
  },
  {
    title: 'The sustainable chef superstars fuelling your day',
    date: 'Dec. 04, 2025',
    image: 'https://ddes.sitecoresandbox.cloud/api/public/content/106449-section3-img5?v=409a0f3e',
    href: '#',
  },
];

const SODEXO_ARTICLES: SodexoArticleCard[] = [
  {
    category: 'Workplace Experience',
    title: 'Turning strategic insight into optimized experiences',
    image: 'https://ddes.sitecoresandbox.cloud/api/public/content/106413-section3-img1?v=d480f54d',
    href: '#',
  },
  {
    category: 'Healthcare',
    title: 'Why day one matters: Mobilizing critical FM services in healthcare',
    image: 'https://ddes.sitecoresandbox.cloud/api/public/content/106421-section3-img2?v=ee51d56f',
    href: '#',
  },
  {
    category: 'Food',
    title: 'Shaping food services to fuel the future of manufacturing',
    image: 'https://ddes.sitecoresandbox.cloud/api/public/content/106429-section3-img3?v=b3caf991',
    href: '#',
  },
  {
    category: 'Modern Recipe',
    title: 'Eating Healthy at Work Made Easy',
    image: 'https://ddes.sitecoresandbox.cloud/api/public/content/106439-section3-img4?v=b3ec3d50',
    href: '#',
  },
  {
    category: 'Workplace Experience',
    title: 'Facilities Management in Manufacturing: how providers can reduce downtime',
    image: 'https://ddes.sitecoresandbox.cloud/api/public/content/106461-section4-img6?v=b0b2d3d8',
    href: '#',
  },
  {
    category: 'Food',
    title: 'How AI is empowering site managers to keep client service seamless',
    image: 'https://ddes.sitecoresandbox.cloud/api/public/content/106449-section3-img5?v=409a0f3e',
    href: '#',
  },
  {
    category: 'Food',
    title: 'Building supplier partnerships which drive innovation and quality for clients',
    image: 'https://ddes.sitecoresandbox.cloud/api/public/content/106470-section5-img7?v=70b49ab3',
    href: '#',
  },
  {
    category: 'Food',
    title: 'Turning imperfect produce into perfect opportunities',
    image: 'https://ddes.sitecoresandbox.cloud/api/public/content/106413-section3-img1?v=d480f54d',
    href: '#',
  },
  {
    category: 'Workplace Experience',
    title: 'Creating Workplace Environments that Support Brain Health',
    image: 'https://ddes.sitecoresandbox.cloud/api/public/content/106479-section6-img8?v=81b54824',
    href: '#',
  },
  {
    category: 'Food',
    title: "Cook for Change! The recipe for success: insights from last year's winning chefs",
    image: 'https://ddes.sitecoresandbox.cloud/api/public/content/106421-section3-img2?v=ee51d56f',
    href: '#',
  },
  {
    category: 'Corporate Responsibility',
    title: 'Better Tomorrow Celebration Book',
    image: 'https://ddes.sitecoresandbox.cloud/api/public/content/106429-section3-img3?v=b3caf991',
    href: '#',
  },
  {
    category: 'Corporate Responsibility',
    title: 'Fiscal 2025 Sustainability Report',
    image: 'https://ddes.sitecoresandbox.cloud/api/public/content/106461-section4-img6?v=b0b2d3d8',
    href: '#',
  },
];

const SODEXO_SOCIAL_ICONS = [
  { label: 'LinkedIn', path: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 110-4.124 2.062 2.062 0 010 4.124zM7.119 20.452H3.555V9h3.564v11.452z' },
  { label: 'X', path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z' },
  { label: 'Instagram', path: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z' },
  { label: 'TikTok', path: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z' },
  { label: 'YouTube', path: 'M23.498 6.186a2.966 2.966 0 00-2.088-2.088C19.692 3.5 12 3.5 12 3.5s-7.692 0-9.41.598A2.966 2.966 0 00.502 6.186 30.909 30.909 0 000 12a30.909 30.909 0 00.502 5.814 2.966 2.966 0 002.088 2.088C4.308 20.5 12 20.5 12 20.5s7.692 0 9.41-.598a2.966 2.966 0 002.088-2.088A30.909 30.909 0 0024 12a30.909 30.909 0 00-.502-5.814zM9.75 15.568V8.432L15.818 12 9.75 15.568z' },
];

const SodexoBreadcrumb = () => (
  <nav
    className="mb-2 flex items-center gap-1.5 text-xs"
    style={{ color: 'var(--brand-fg, #2a295c)', fontFamily: 'var(--brand-body-font, "Open Sans", sans-serif)' }}
  >
    <Link href="/" className="opacity-60 transition-opacity hover:opacity-100">Home</Link>
    <span className="opacity-40">&gt;</span>
    <span className="font-medium">Blog</span>
  </nav>
);

const SodexoFeaturedCarousel = () => {
  const [index, setIndex] = useState(0);
  const goTo = (n: number) => setIndex((n + SODEXO_FEATURED.length) % SODEXO_FEATURED.length);
  const current = SODEXO_FEATURED[index];

  return (
    <div className="relative overflow-hidden rounded-2xl" style={{ minHeight: '400px' }}>
      <div
        className="flex transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {SODEXO_FEATURED.map((story, i) => (
          <div key={i} className="relative w-full shrink-0" style={{ minHeight: '400px' }}>
            <Image src={story.image} alt={story.title} fill sizes="100vw" className="object-cover" priority={i === 0} />
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10">
        <div className="max-w-md">
          <h3
            className="text-xl font-bold text-white sm:text-2xl"
            style={{ fontFamily: 'var(--brand-heading-font, "DM Sans", sans-serif)' }}
          >
            {current.title}
          </h3>
          <p className="mt-2 text-sm text-white/70">{current.date}</p>
        </div>
      </div>
      <div className="absolute bottom-6 right-6 flex gap-2 sm:bottom-10 sm:right-10">
        {SODEXO_FEATURED.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            className={cn(
              'h-2.5 rounded-full transition-all',
              i === index ? 'w-6 bg-white' : 'w-2.5 bg-white/50'
            )}
            aria-label={`Go to featured story ${i + 1}`}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() => goTo(index + 1)}
        className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-opacity hover:bg-white/30 sm:right-10 sm:top-10"
        aria-label="Next story"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="9 6 15 12 9 18" />
        </svg>
      </button>
    </div>
  );
};

const SodexoSocialBar = () => (
  <div className="flex flex-col items-center gap-4 py-10 sm:flex-row sm:justify-between">
    <p
      className="text-center text-base sm:text-left"
      style={{ color: 'var(--brand-fg, #2a295c)', fontFamily: 'var(--brand-heading-font, "DM Sans", sans-serif)' }}
    >
      {"Don't miss Sodexo news, follow "}
      <strong>us on social media</strong>
    </p>
    <div className="flex items-center gap-3">
      {SODEXO_SOCIAL_ICONS.map((icon) => (
        <a
          key={icon.label}
          href="#"
          className="flex h-10 w-10 items-center justify-center rounded-full transition-opacity hover:opacity-80"
          style={{ backgroundColor: 'var(--brand-primary, #283897)' }}
          aria-label={icon.label}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d={icon.path} />
          </svg>
        </a>
      ))}
    </div>
  </div>
);

const SodexoArticleCard = ({ card }: { card: SodexoArticleCard }) => (
  <a
    href={card.href}
    className="group flex flex-col overflow-hidden rounded-xl border transition-shadow hover:shadow-md"
    style={{ borderColor: 'var(--brand-border, #e0dff0)' }}
  >
    <div className="p-5 pb-2">
      <span
        className="text-xs font-semibold"
        style={{ color: 'var(--brand-primary, #283897)', fontFamily: 'var(--brand-body-font, "Open Sans", sans-serif)' }}
      >
        {card.category}
      </span>
      <h3
        className="mt-2 line-clamp-3 text-sm font-bold leading-snug"
        style={{ color: 'var(--brand-fg, #2a295c)', fontFamily: 'var(--brand-heading-font, "DM Sans", sans-serif)' }}
      >
        {card.title}
      </h3>
    </div>
    <div className="relative mt-auto aspect-[4/3] w-full">
      <Image src={card.image} alt={card.title} fill sizes="(min-width: 768px) 25vw, 50vw" className="object-cover" />
    </div>
    <div className="flex items-center gap-1 px-5 py-3">
      <span
        className="text-xs font-semibold transition-colors group-hover:opacity-70"
        style={{ color: 'var(--brand-accent, #da2020)', fontFamily: 'var(--brand-body-font, "Open Sans", sans-serif)' }}
      >
        Read more
      </span>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--brand-accent, #da2020)" strokeWidth="2.5">
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
    </div>
  </a>
);

export const Sodexo = ({ fields, params, page }: BlogListingProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  const [visibleCount, setVisibleCount] = useState(8);

  if (!fields && !isEditing) return <BlogListingDefaultComponent />;

  const visibleArticles = SODEXO_ARTICLES.slice(0, visibleCount);
  const hasMore = visibleCount < SODEXO_ARTICLES.length;

  return (
    <div className={cn('component blog-listing', styles)} id={RenderingIdentifier}>
      <section className="w-full" style={{ backgroundColor: 'var(--brand-bg, #ffffff)' }}>
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <SodexoBreadcrumb />
          <h1
            className="text-3xl font-bold sm:text-4xl"
            style={{
              color: 'var(--brand-fg, #2a295c)',
              fontFamily: 'var(--brand-heading-font, "DM Sans", sans-serif)',
            }}
          >
            {fields?.Title?.value || 'Our Everyday Stories'}
          </h1>
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SodexoFeaturedCarousel />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SodexoSocialBar />
        </div>

        <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {visibleArticles.map((card, i) => (
              <SodexoArticleCard key={i} card={card} />
            ))}
          </div>

          {hasMore && (
            <div className="mt-10 flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + 4)}
                className="text-sm font-semibold underline underline-offset-4 transition-opacity hover:opacity-70"
                style={{ color: 'var(--brand-primary, #283897)', fontFamily: 'var(--brand-body-font, "Open Sans", sans-serif)' }}
              >
                Load more
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
