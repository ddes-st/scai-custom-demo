import React, { JSX } from 'react';
import {
  Field,
  RichText as ContentSdkRichText,
  Text,
} from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';
import { cn } from '@/lib/utils';
import { isSodexoSite } from '@/lib/sodexo-page';

interface QuoteFields {
  QuoteTitle: Field<string>;
  Description: Field<string>;
  AuthorName: Field<string>;
  AuthorRole: Field<string>;
}

type QuoteProps = ComponentProps & {
  fields: QuoteFields;
};

const QuoteDefaultComponent = (): JSX.Element => (
  <div className="component quote">
    <div className="component-content">
      <span className="is-empty-hint">Quote</span>
    </div>
  </div>
);

const QuoteMarkIcon = ({ className, color }: { className?: string; color: string }) => (
  <svg
    className={className}
    width="42"
    height="32"
    viewBox="0 0 42 32"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <path
      fill={color}
      d="M4 32V18.2C4 10.6 8.2 4.8 15.4 3v6.6c-3.4 1.1-5.3 4-5.3 8.4H16V32H4Zm22 0V18.2C26 10.6 30.2 4.8 37.4 3v6.6c-3.4 1.1-5.3 4-5.3 8.4H42V32H26Z"
    />
  </svg>
);

/* ────────────────────────────────────────────
   Default — generic pull-quote
   On the sodexo site, routes to the Sodexo variant
   so Pages can insert without setting FieldNames.
   ──────────────────────────────────────────── */
export const Default = (props: QuoteProps): JSX.Element => {
  if (isSodexoSite(props.page)) return Sodexo(props);

  const { fields, params, page } = props;
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  if (!fields) return <QuoteDefaultComponent />;

  return (
    <div className={cn('component quote', styles)} id={RenderingIdentifier}>
      <section className="w-full bg-white px-4 py-12 md:px-8 md:py-16">
        <blockquote className="mx-auto max-w-3xl border-l-4 border-[var(--brand-primary,#283897)] pl-6 md:pl-8">
          {(fields.QuoteTitle?.value || isEditing) && (
            <Text
              field={fields.QuoteTitle}
              tag="h2"
              className="mb-4 text-2xl font-semibold leading-snug text-[var(--brand-fg,#111111)]"
            />
          )}
          {(fields.Description?.value || isEditing) && (
            <ContentSdkRichText
              field={fields.Description}
              className="mb-6 text-base leading-7 text-[var(--brand-fg,#111111)] [&_p]:mb-4 [&_p:last-child]:mb-0"
            />
          )}
          {(fields.AuthorName?.value || fields.AuthorRole?.value || isEditing) && (
            <footer>
              {(fields.AuthorName?.value || isEditing) && (
                <Text
                  field={fields.AuthorName}
                  tag="cite"
                  className="block text-sm font-semibold not-italic text-[var(--brand-fg,#111111)]"
                />
              )}
              {(fields.AuthorRole?.value || isEditing) && (
                <Text
                  field={fields.AuthorRole}
                  tag="p"
                  className="mt-0.5 text-sm text-[var(--brand-muted-fg,#5c5b7a)]"
                />
              )}
            </footer>
          )}
        </blockquote>
      </section>
    </div>
  );
};

/* ────────────────────────────────────────────
   Sodexo — matches live sodexo-group quote block
   ──────────────────────────────────────────── */
export const Sodexo = ({ fields, params, page }: QuoteProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  if (!fields) return <QuoteDefaultComponent />;

  const brandFg = 'var(--brand-fg, #2a295c)';
  const quoteMark = '#b8b3d4';
  const accent = 'var(--brand-accent, #da2020)';
  const muted = 'var(--brand-muted-fg, #5c5b7a)';
  const headingFont = 'var(--brand-heading-font, "DM Sans", sans-serif)';
  const bodyFont = 'var(--brand-body-font, "Open Sans", sans-serif)';

  return (
    <div className={cn('component quote', styles)} id={RenderingIdentifier}>
      <section className="w-full bg-white">
        <div className="mx-auto w-full max-w-[1100px] px-6 py-12 sm:px-10 sm:py-16 lg:px-16">
          <blockquote className="grid grid-cols-[auto_1fr] gap-x-5 sm:gap-x-7">
            <QuoteMarkIcon
              className="mt-1 h-8 w-[42px] shrink-0 sm:h-9 sm:w-[48px]"
              color={quoteMark}
            />
            <div>
              {(fields.QuoteTitle?.value || isEditing) && (
                <Text
                  field={fields.QuoteTitle}
                  tag="h2"
                  className="m-0 text-[22px] font-bold leading-[1.35] tracking-tight sm:text-[26px]"
                  style={{ color: brandFg, fontFamily: headingFont }}
                />
              )}
              {(fields.Description?.value || isEditing) && (
                <ContentSdkRichText
                  field={fields.Description}
                  className={cn(
                    'mt-4 text-[15px] font-normal leading-[1.7] sm:text-base sm:leading-[1.75]',
                    '[&_p]:mb-4 [&_p:last-child]:mb-0'
                  )}
                  style={{ color: brandFg, fontFamily: bodyFont }}
                />
              )}
              {(fields.AuthorName?.value || fields.AuthorRole?.value || isEditing) && (
                <footer className="mt-8 border-l-[3px] pl-4" style={{ borderColor: accent }}>
                  {(fields.AuthorName?.value || isEditing) && (
                    <Text
                      field={fields.AuthorName}
                      tag="cite"
                      className="block text-[15px] font-bold not-italic leading-snug"
                      style={{ color: brandFg, fontFamily: headingFont }}
                    />
                  )}
                  {(fields.AuthorRole?.value || isEditing) && (
                    <Text
                      field={fields.AuthorRole}
                      tag="p"
                      className="mt-0.5 text-[13px] font-normal leading-snug"
                      style={{ color: muted, fontFamily: bodyFont }}
                    />
                  )}
                </footer>
              )}
            </div>
          </blockquote>
        </div>
      </section>
    </div>
  );
};
