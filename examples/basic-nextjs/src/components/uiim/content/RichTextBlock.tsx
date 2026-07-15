import React, { JSX } from 'react';
import {
  Field,
  RichText as ContentSdkRichText,
  Text,
} from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';
import { cn } from '@/lib/utils';

interface RichTextBlockFields {
  Title: Field<string>;
  Body: Field<string>;
}

type RichTextBlockProps = ComponentProps & {
  fields: RichTextBlockFields;
};

const RichTextBlockDefaultComponent = (): JSX.Element => (
  <div className="component rich-text-block">
    <div className="component-content">
      <span className="is-empty-hint">RichTextBlock</span>
    </div>
  </div>
);

/* ────────────────────────────────────────────
   Default — left-aligned, full container width
   ──────────────────────────────────────────── */
export const Default = ({ fields, params, page }: RichTextBlockProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  if (!fields) return <RichTextBlockDefaultComponent />;

  return (
    <div className={cn('component rich-text-block', styles)} id={RenderingIdentifier}>
      <section
        className="w-full px-4 py-12 md:py-16"
        style={{ backgroundColor: 'var(--brand-bg, #ffffff)' }}
      >
        <div className="mx-auto max-w-7xl">
          {(fields.Title?.value || isEditing) && (
            <Text
              field={fields.Title}
              tag="h2"
              className="mb-6 text-2xl font-bold md:text-3xl font-[var(--brand-heading-font,inherit)]"
              style={{ color: 'var(--brand-fg, #111111)' }}
            />
          )}
          {(fields.Body?.value || isEditing) && (
            <ContentSdkRichText
              field={fields.Body}
              className="prose prose-neutral max-w-none font-[var(--brand-body-font,inherit)]"
              style={{ color: 'var(--brand-fg, #111111)' }}
            />
          )}
        </div>
      </section>
    </div>
  );
};

/* ────────────────────────────────────────────
   Centered — centered text
   ──────────────────────────────────────────── */
export const Centered = ({ fields, params, page }: RichTextBlockProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  if (!fields) return <RichTextBlockDefaultComponent />;

  return (
    <div className={cn('component rich-text-block', styles)} id={RenderingIdentifier}>
      <section
        className="w-full px-4 py-12 md:py-16"
        style={{ backgroundColor: 'var(--brand-bg, #ffffff)' }}
      >
        <div className="mx-auto max-w-3xl text-center">
          {(fields.Title?.value || isEditing) && (
            <Text
              field={fields.Title}
              tag="h2"
              className="mb-6 text-2xl font-bold md:text-3xl font-[var(--brand-heading-font,inherit)]"
              style={{ color: 'var(--brand-fg, #111111)' }}
            />
          )}
          {(fields.Body?.value || isEditing) && (
            <ContentSdkRichText
              field={fields.Body}
              className="prose prose-neutral mx-auto max-w-none font-[var(--brand-body-font,inherit)]"
              style={{ color: 'var(--brand-fg, #111111)' }}
            />
          )}
        </div>
      </section>
    </div>
  );
};

/* ────────────────────────────────────────────
   Narrow — constrained width for long-form readability
   ──────────────────────────────────────────── */
export const Narrow = ({ fields, params, page }: RichTextBlockProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  if (!fields) return <RichTextBlockDefaultComponent />;

  return (
    <div className={cn('component rich-text-block', styles)} id={RenderingIdentifier}>
      <section
        className="w-full px-4 py-12 md:py-16"
        style={{ backgroundColor: 'var(--brand-bg, #ffffff)' }}
      >
        <div className="mx-auto max-w-2xl">
          {(fields.Title?.value || isEditing) && (
            <Text
              field={fields.Title}
              tag="h2"
              className="mb-6 text-2xl font-bold md:text-3xl font-[var(--brand-heading-font,inherit)]"
              style={{ color: 'var(--brand-fg, #111111)' }}
            />
          )}
          {(fields.Body?.value || isEditing) && (
            <ContentSdkRichText
              field={fields.Body}
              className="prose prose-neutral max-w-none font-[var(--brand-body-font,inherit)]"
              style={{ color: 'var(--brand-fg, #111111)' }}
            />
          )}
        </div>
      </section>
    </div>
  );
};

/* ────────────────────────────────────────────
   Sodexo — article-width prose with brand fonts
   ──────────────────────────────────────────── */
export const Sodexo = ({ fields, params, page }: RichTextBlockProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  if (!fields) return <RichTextBlockDefaultComponent />;

  return (
    <div className={cn('component rich-text-block', styles)} id={RenderingIdentifier}>
      <section
        className="w-full"
        style={{ backgroundColor: 'var(--brand-bg, #ffffff)' }}
      >
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
          {(fields.Body?.value || isEditing) && (
            <ContentSdkRichText
              field={fields.Body}
              className="prose prose-neutral max-w-none
                prose-headings:font-bold prose-headings:tracking-tight
                prose-h2:mb-4 prose-h2:mt-10 prose-h2:text-2xl sm:prose-h2:text-3xl
                prose-p:mb-4 prose-p:text-base prose-p:leading-relaxed prose-p:opacity-80
                prose-img:my-8 prose-img:rounded-2xl prose-img:w-full"
              style={{
                color: 'var(--brand-fg, #2a295c)',
                fontFamily: 'var(--brand-body-font, "Open Sans", sans-serif)',
                '--tw-prose-headings': 'var(--brand-fg, #2a295c)',
              } as React.CSSProperties}
            />
          )}
        </div>
      </section>
    </div>
  );
};
