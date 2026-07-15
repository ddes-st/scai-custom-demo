'use client';

import React, { JSX } from 'react';
import Image from 'next/image';
import {
  Field,
  Text,
} from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';
import { cn } from '@/lib/utils';

interface RelatedContentFields {
  Title: Field<string>;
}

type RelatedContentProps = ComponentProps & {
  fields: RelatedContentFields;
};

const RelatedContentDefaultComponent = (): JSX.Element => (
  <div className="component related-content">
    <div className="component-content">
      <span className="is-empty-hint">RelatedContent</span>
    </div>
  </div>
);

/* ────────────────────────────────────────────
   Default — title + placeholder grid
   ──────────────────────────────────────────── */
export const Default = ({ fields, params, page }: RelatedContentProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  if (!fields) return <RelatedContentDefaultComponent />;

  return (
    <div className={cn('component related-content', styles)} id={RenderingIdentifier}>
      <section className="w-full px-4 py-12 md:py-16" style={{ backgroundColor: 'var(--brand-bg, #ffffff)' }}>
        <div className="mx-auto max-w-5xl">
          {(fields.Title?.value || isEditing) && (
            <Text
              field={fields.Title}
              tag="h2"
              className="mb-8 text-center text-2xl font-bold"
              style={{ color: 'var(--brand-fg, #111)' }}
            />
          )}
          <p className="text-center text-sm opacity-50">Related content will appear here.</p>
        </div>
      </section>
    </div>
  );
};

/* ────────────────────────────────────────────
   Sodexo — "More about Sodexo" 4-card grid
   ──────────────────────────────────────────── */

const brandFg = 'var(--brand-fg, #2a295c)';
const brandAccent = 'var(--brand-accent, #da2020)';
const brandPrimary = 'var(--brand-primary, #283897)';
const headingFont = 'var(--brand-heading-font, "DM Sans", sans-serif)';
const bodyFont = 'var(--brand-body-font, "Open Sans", sans-serif)';

interface RelatedArticle {
  category: string;
  title: string;
  image: string;
  href: string;
}

const RelatedArticleCard = ({ category, title, image, href }: RelatedArticle) => (
  <a
    href={href}
    className="group flex flex-col overflow-hidden rounded-xl border transition-shadow hover:shadow-md"
    style={{ borderColor: 'var(--brand-border, #e0dff0)' }}
  >
    <div className="p-4 pb-2">
      <span className="text-xs font-semibold" style={{ color: brandPrimary, fontFamily: bodyFont }}>
        {category}
      </span>
      <h4
        className="mt-1 line-clamp-3 text-sm font-bold leading-snug"
        style={{ color: brandFg, fontFamily: headingFont }}
      >
        {title}
      </h4>
    </div>
    <div className="relative mt-auto aspect-[4/3] w-full">
      <Image src={image} alt={title} fill sizes="(min-width: 768px) 25vw, 50vw" className="object-cover" />
    </div>
    <div className="flex items-center gap-1 px-4 py-3">
      <span
        className="text-xs font-semibold transition-colors group-hover:opacity-70"
        style={{ color: brandAccent, fontFamily: bodyFont }}
      >
        Read more
      </span>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: brandAccent }}>
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
    </div>
  </a>
);

const RELATED_ARTICLES: RelatedArticle[] = [
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
];

export const Sodexo = ({ fields, params, page }: RelatedContentProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  if (!fields) return <RelatedContentDefaultComponent />;

  return (
    <div className={cn('component related-content', styles)} id={RenderingIdentifier}>
      <section
        className="w-full px-4 pb-16 pt-8"
        style={{ backgroundColor: 'var(--brand-bg, #ffffff)' }}
      >
        <div className="mx-auto max-w-5xl">
          {(fields.Title?.value || isEditing) && (
            <Text
              field={fields.Title}
              tag="h2"
              className="mb-8 text-center text-2xl font-bold"
              style={{ color: brandFg, fontFamily: headingFont }}
            />
          )}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {RELATED_ARTICLES.map((article, i) => (
              <RelatedArticleCard key={i} {...article} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
