import React, { JSX } from 'react';
import {
  Field,
  RichText as ContentSdkRichText,
  Text,
} from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';
import { cn } from '@/lib/utils';
import { isSodexoHelpPage } from '@/lib/sodexo-page';

interface FAQItemFields {
  id: string;
  question: { jsonValue: Field<string> };
  answer: { jsonValue: Field<string> };
}

interface FAQAccordionDatasource {
  title: { jsonValue: Field<string> };
  description: { jsonValue: Field<string> };
  children: {
    results: FAQItemFields[];
  };
}

interface FAQAccordionFields {
  data: {
    datasource: FAQAccordionDatasource;
  };
}

type FAQAccordionProps = ComponentProps & {
  fields: FAQAccordionFields;
};

const FAQAccordionDefaultComponent = (): JSX.Element => (
  <div className="component faq-accordion">
    <div className="component-content">
      <span className="is-empty-hint">FAQAccordion</span>
    </div>
  </div>
);

const SectionHeader = ({
  datasource,
  isEditing,
}: {
  datasource: FAQAccordionDatasource;
  isEditing?: boolean;
}) => (
  <div className="mx-auto mb-10 max-w-3xl text-center">
    {(datasource.title?.jsonValue?.value || isEditing) && (
      <Text
        field={datasource.title?.jsonValue}
        tag="h2"
        className="text-3xl font-bold tracking-tight sm:text-4xl font-[var(--brand-heading-font,inherit)]"
        style={{ color: 'var(--brand-fg, #111111)' }}
      />
    )}
    {(datasource.description?.jsonValue?.value || isEditing) && (
      <ContentSdkRichText
        field={datasource.description?.jsonValue}
        className="mt-4 text-lg opacity-70 font-[var(--brand-body-font,inherit)]"
        style={{ color: 'var(--brand-fg, #111111)' }}
      />
    )}
  </div>
);

const AccordionItem = ({
  item,
  isEditing,
  defaultOpen = false,
}: {
  item: FAQItemFields;
  isEditing?: boolean;
  defaultOpen?: boolean;
}) => (
  <details
    className="group border-b"
    style={{ borderColor: 'var(--brand-border, #e5e7eb)' }}
    open={defaultOpen || undefined}
  >
    <summary
      className="flex cursor-pointer items-center justify-between py-4 text-left font-medium transition-colors hover:opacity-70 font-[var(--brand-heading-font,inherit)] [&::-webkit-details-marker]:hidden list-none"
      style={{ color: 'var(--brand-fg, #111111)' }}
    >
      {(item.question?.jsonValue?.value || isEditing) && (
        <Text field={item.question?.jsonValue} tag="span" className="flex-1 pr-4" />
      )}
      <svg
        className="h-5 w-5 shrink-0 transition-transform duration-200 group-open:rotate-180"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </summary>
    <div className="pb-4">
      {(item.answer?.jsonValue?.value || isEditing) && (
        <ContentSdkRichText
          field={item.answer?.jsonValue}
          className="text-sm opacity-70 font-[var(--brand-body-font,inherit)]"
          style={{ color: 'var(--brand-fg, #111111)' }}
        />
      )}
    </div>
  </details>
);

/* ────────────────────────────────────────────
   Default — standard accordion, one item open at a time
   ──────────────────────────────────────────── */
export const Default = (props: FAQAccordionProps): JSX.Element => {
  const { fields, params, page } = props;
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  const datasource = fields?.data?.datasource;
  if (!datasource) return <FAQAccordionDefaultComponent />;
  if (isSodexoHelpPage(page)) return SodexoSearch(props);
  const items = datasource.children?.results || [];

  return (
    <div className={cn('component faq-accordion', styles)} id={RenderingIdentifier}>
      <section
        className="w-full px-4 py-16 md:py-24"
        style={{ backgroundColor: 'var(--brand-bg, #ffffff)' }}
      >
        <div className="mx-auto max-w-3xl">
          <SectionHeader datasource={datasource} isEditing={isEditing} />
          <div
            className="border-t"
            style={{ borderColor: 'var(--brand-border, #e5e7eb)' }}
          >
            {items.map((item) => (
              <AccordionItem key={item.id} item={item} isEditing={isEditing} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

/* ────────────────────────────────────────────
   AllOpen — all items expanded by default
   ──────────────────────────────────────────── */
export const AllOpen = ({ fields, params, page }: FAQAccordionProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  const datasource = fields?.data?.datasource;
  if (!datasource) return <FAQAccordionDefaultComponent />;
  const items = datasource.children?.results || [];

  return (
    <div className={cn('component faq-accordion', styles)} id={RenderingIdentifier}>
      <section
        className="w-full px-4 py-16 md:py-24"
        style={{ backgroundColor: 'var(--brand-bg, #ffffff)' }}
      >
        <div className="mx-auto max-w-3xl">
          <SectionHeader datasource={datasource} isEditing={isEditing} />
          <div
            className="border-t"
            style={{ borderColor: 'var(--brand-border, #e5e7eb)' }}
          >
            {items.map((item) => (
              <AccordionItem
                key={item.id}
                item={item}
                isEditing={isEditing}
                defaultOpen
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

/* ────────────────────────────────────────────
   TwoColumn — questions split into two columns
   ──────────────────────────────────────────── */
export const TwoColumn = ({ fields, params, page }: FAQAccordionProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  const datasource = fields?.data?.datasource;
  if (!datasource) return <FAQAccordionDefaultComponent />;
  const items = datasource.children?.results || [];
  const mid = Math.ceil(items.length / 2);
  const leftItems = items.slice(0, mid);
  const rightItems = items.slice(mid);

  return (
    <div className={cn('component faq-accordion', styles)} id={RenderingIdentifier}>
      <section
        className="w-full px-4 py-16 md:py-24"
        style={{ backgroundColor: 'var(--brand-bg, #ffffff)' }}
      >
        <div className="mx-auto max-w-7xl">
          <SectionHeader datasource={datasource} isEditing={isEditing} />
          <div className="grid gap-8 md:grid-cols-2">
            <div
              className="border-t"
              style={{ borderColor: 'var(--brand-border, #e5e7eb)' }}
            >
              {leftItems.map((item) => (
                <AccordionItem key={item.id} item={item} isEditing={isEditing} />
              ))}
            </div>
            <div
              className="border-t"
              style={{ borderColor: 'var(--brand-border, #e5e7eb)' }}
            >
              {rightItems.map((item) => (
                <AccordionItem key={item.id} item={item} isEditing={isEditing} />
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

/* ────────────────────────────────────────────
   SodexoSearch — help landing FAQ groups
   ──────────────────────────────────────────── */
export const SodexoSearch = ({ fields, params, page }: FAQAccordionProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  const datasource = fields?.data?.datasource;
  if (!datasource) return <FAQAccordionDefaultComponent />;
  const items = datasource.children?.results || [];

  return (
    <div className={cn('component faq-accordion', styles)} id={RenderingIdentifier}>
      <section className="w-full" style={{ backgroundColor: 'var(--brand-bg, #ffffff)' }}>
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          {(datasource.title?.jsonValue?.value || isEditing) && (
            <Text
              field={datasource.title?.jsonValue}
              tag="h2"
              className="mb-2 text-2xl font-bold"
              style={{
                color: 'var(--brand-accent, #da2020)',
                fontFamily: 'var(--brand-heading-font, "DM Sans", sans-serif)',
              }}
            />
          )}
          <div>
            {items.map((item) => (
              <details
                key={item.id}
                className="group border-b"
                style={{ borderColor: 'var(--brand-border, #e0dff0)' }}
              >
                <summary
                  className="flex cursor-pointer list-none items-center justify-between py-6 text-left [&::-webkit-details-marker]:hidden"
                  style={{
                    color: 'var(--brand-fg, #2a295c)',
                    fontFamily: 'var(--brand-body-font, "Open Sans", sans-serif)',
                  }}
                >
                  {(item.question?.jsonValue?.value || isEditing) && (
                    <Text field={item.question?.jsonValue} tag="span" className="flex-1 pr-4 text-base" />
                  )}
                  <span
                    className="flex h-6 w-6 items-center justify-center text-2xl font-light leading-none group-open:hidden"
                    aria-hidden
                  >
                    +
                  </span>
                  <span
                    className="hidden h-6 w-6 items-center justify-center text-2xl font-light leading-none group-open:flex"
                    aria-hidden
                  >
                    −
                  </span>
                </summary>
                <div className="pb-6">
                  {(item.answer?.jsonValue?.value || isEditing) && (
                    <ContentSdkRichText
                      field={item.answer?.jsonValue}
                      className="text-sm opacity-80 [&>*]:m-0"
                      style={{
                        color: 'var(--brand-fg, #2a295c)',
                        fontFamily: 'var(--brand-body-font, "Open Sans", sans-serif)',
                      }}
                    />
                  )}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
