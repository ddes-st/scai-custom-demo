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
   Sodexo — article body: heading type, split image+text
   ──────────────────────────────────────────── */
export const Sodexo = ({ fields, params, page }: RichTextBlockProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  if (!fields) return <RichTextBlockDefaultComponent />;

  const brandFg = 'var(--brand-fg, #2a295c)';

  return (
    <div className={cn('component rich-text-block', styles)} id={RenderingIdentifier}>
      <section className="w-full" style={{ backgroundColor: 'var(--brand-bg, #ffffff)' }}>
        <div className="mx-auto w-full max-w-[1224px] px-4 py-6 sm:px-8 lg:px-24">
          {(fields.Body?.value || isEditing) && (
            <ContentSdkRichText
              field={fields.Body}
              className={cn(
                'sodexo-article-rte max-w-none',
                '[&_.ck-content]:max-w-none',
                // Headings — live article uses 40px / weight 400 / heading font
                '[&_h2]:mt-8 [&_h2]:mb-6 [&_h2]:max-w-[810px] [&_h2]:text-[32px] [&_h2]:font-normal [&_h2]:leading-[1.25] [&_h2]:tracking-tight',
                '[&_h2]:[font-family:var(--brand-heading-font,"DM_Sans",sans-serif)]',
                'sm:[&_h2]:text-[40px] sm:[&_h2]:leading-[50px]',
                // Body copy
                '[&_p]:mb-6 [&_p]:max-w-[810px] [&_p]:text-base [&_p]:font-normal [&_p]:leading-7',
                '[&_strong]:font-bold',
                '[&_em]:italic',
                // Horizontal image + text (custom wrapper in Body HTML)
                '[&_.media-split]:mb-12 [&_.media-split]:grid [&_.media-split]:items-center [&_.media-split]:gap-8',
                'md:[&_.media-split]:grid-cols-2 md:[&_.media-split]:gap-10',
                '[&_.media-split]:max-w-none',
                '[&_.media-split_h2]:mt-0 [&_.media-split_h2]:mb-4 [&_.media-split_h2]:max-w-none',
                '[&_.media-split_p]:mb-4 [&_.media-split_p]:max-w-none',
                '[&_.media-split_img]:!my-0 [&_.media-split_img]:aspect-square [&_.media-split_img]:w-full [&_.media-split_img]:rounded-lg [&_.media-split_img]:object-cover',
                // CKEditor / Pages left-right image alignment
                '[&_.image-style-align-left]:float-left [&_.image-style-align-left]:mb-6 [&_.image-style-align-left]:mr-8 [&_.image-style-align-left]:w-[min(48%,480px)]',
                '[&_.image-style-align-right]:float-right [&_.image-style-align-right]:mb-6 [&_.image-style-align-right]:ml-8 [&_.image-style-align-right]:w-[min(48%,480px)]',
                '[&_img[align=left]]:float-left [&_img[align=left]]:mb-6 [&_img[align=left]]:mr-8 [&_img[align=left]]:w-[min(48%,480px)]',
                '[&_img[align=right]]:float-right [&_img[align=right]]:mb-6 [&_img[align=right]]:ml-8 [&_img[align=right]]:w-[min(48%,480px)]',
                '[&_img[style*="float:left"]]:mb-6 [&_img[style*="float:left"]]:mr-8 [&_img[style*="float:left"]]:w-[min(48%,480px)]',
                '[&_img[style*="float: left"]]:mb-6 [&_img[style*="float: left"]]:mr-8 [&_img[style*="float: left"]]:w-[min(48%,480px)]',
                '[&_.ck-content]:after:block [&_.ck-content]:after:clear-both [&_.ck-content]:after:content-[""]',
                // Default images (full-width photos in the article column)
                '[&_img]:my-8 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg'
              )}
              style={{
                color: brandFg,
                fontFamily: 'var(--brand-body-font, "Open Sans", sans-serif)',
              }}
            />
          )}
        </div>
      </section>
    </div>
  );
};
