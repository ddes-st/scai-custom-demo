import React, { JSX } from 'react';
import {
  Field,
  ImageField,
  NextImage as ContentSdkImage,
  RichText as ContentSdkRichText,
  Text,
} from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';
import { cn } from '@/lib/utils';
import { isSodexoAboutPage } from '@/lib/sodexo-page';

interface StatItemFields {
  id: string;
  statValue: { jsonValue: Field<string> };
  statLabel: { jsonValue: Field<string> };
  statDescription: { jsonValue: Field<string> };
  statIcon: { jsonValue: ImageField };
}

interface TrustStatsRowDatasource {
  title: { jsonValue: Field<string> };
  eyebrowText: { jsonValue: Field<string> };
  children: {
    results: StatItemFields[];
  };
}

interface TrustStatsRowFields {
  data: {
    datasource: TrustStatsRowDatasource;
  };
}

type TrustStatsRowProps = ComponentProps & {
  fields: TrustStatsRowFields;
};

const TrustStatsRowDefaultComponent = (): JSX.Element => (
  <div className="component trust-stats-row">
    <div className="component-content">
      <span className="is-empty-hint">TrustStatsRow</span>
    </div>
  </div>
);

const SectionHeader = ({
  datasource,
  isEditing,
}: {
  datasource: TrustStatsRowDatasource;
  isEditing?: boolean;
}) => {
  const hasEyebrow = datasource.eyebrowText?.jsonValue?.value || isEditing;
  const hasTitle = datasource.title?.jsonValue?.value || isEditing;
  if (!hasEyebrow && !hasTitle) return null;
  return (
    <div className="mx-auto mb-10 max-w-3xl text-center">
      {hasEyebrow && (
        <Text
          field={datasource.eyebrowText?.jsonValue}
          tag="span"
          className="mb-2 inline-block text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--brand-primary)' }}
        />
      )}
      {hasTitle && (
        <Text
          field={datasource.title?.jsonValue}
          tag="h2"
          className="text-3xl font-bold tracking-tight sm:text-4xl font-[var(--brand-heading-font,inherit)]"
          style={{ color: 'var(--brand-fg, #111111)' }}
        />
      )}
    </div>
  );
};

/* ────────────────────────────────────────────
   Default — big centered numbers, 4-column grid
   ──────────────────────────────────────────── */
export const Default = ({ fields, params, page }: TrustStatsRowProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  if (isSodexoAboutPage(page)) return SodexoAbout({ fields, params, page });
  const datasource = fields?.data?.datasource;
  if (!datasource) return <TrustStatsRowDefaultComponent />;
  const items = datasource.children?.results || [];

  return (
    <div className={cn('component trust-stats-row', styles)} id={RenderingIdentifier}>
      <section
        className="w-full px-4 py-16 md:py-24"
        style={{ backgroundColor: 'var(--brand-bg, #ffffff)' }}
      >
        <div className="mx-auto max-w-7xl">
          <SectionHeader datasource={datasource} isEditing={isEditing} />
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((item) => (
              <div key={item.id} className="text-center">
                {(item.statValue?.jsonValue?.value || isEditing) && (
                  <Text
                    field={item.statValue?.jsonValue}
                    tag="p"
                    className="text-4xl font-bold md:text-5xl font-[var(--brand-heading-font,inherit)]"
                    style={{ color: 'var(--brand-primary)' }}
                  />
                )}
                {(item.statLabel?.jsonValue?.value || isEditing) && (
                  <Text
                    field={item.statLabel?.jsonValue}
                    tag="p"
                    className="mt-2 text-sm font-medium font-[var(--brand-body-font,inherit)]"
                    style={{ color: 'var(--brand-fg, #111111)' }}
                  />
                )}
                {(item.statDescription?.jsonValue?.value || isEditing) && (
                  <ContentSdkRichText
                    field={item.statDescription?.jsonValue}
                    className="mt-1 text-xs opacity-60 font-[var(--brand-body-font,inherit)]"
                    style={{ color: 'var(--brand-fg, #111111)' }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

/* ────────────────────────────────────────────
   WithIcons — icon above each stat number
   ──────────────────────────────────────────── */
export const WithIcons = ({ fields, params, page }: TrustStatsRowProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  const datasource = fields?.data?.datasource;
  if (!datasource) return <TrustStatsRowDefaultComponent />;
  const items = datasource.children?.results || [];

  return (
    <div className={cn('component trust-stats-row', styles)} id={RenderingIdentifier}>
      <section
        className="w-full px-4 py-16 md:py-24"
        style={{ backgroundColor: 'var(--brand-bg, #ffffff)' }}
      >
        <div className="mx-auto max-w-7xl">
          <SectionHeader datasource={datasource} isEditing={isEditing} />
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((item) => (
              <div key={item.id} className="flex flex-col items-center text-center">
                {(item.statIcon?.jsonValue?.value?.src || isEditing) && (
                  <div className="mb-3 h-12 w-12 overflow-hidden">
                    <ContentSdkImage
                      field={item.statIcon?.jsonValue}
                      className="h-full w-full object-contain"
                    />
                  </div>
                )}
                {(item.statValue?.jsonValue?.value || isEditing) && (
                  <Text
                    field={item.statValue?.jsonValue}
                    tag="p"
                    className="text-4xl font-bold md:text-5xl font-[var(--brand-heading-font,inherit)]"
                    style={{ color: 'var(--brand-primary)' }}
                  />
                )}
                {(item.statLabel?.jsonValue?.value || isEditing) && (
                  <Text
                    field={item.statLabel?.jsonValue}
                    tag="p"
                    className="mt-2 text-sm font-medium font-[var(--brand-body-font,inherit)]"
                    style={{ color: 'var(--brand-fg, #111111)' }}
                  />
                )}
                {(item.statDescription?.jsonValue?.value || isEditing) && (
                  <ContentSdkRichText
                    field={item.statDescription?.jsonValue}
                    className="mt-1 text-xs opacity-60 font-[var(--brand-body-font,inherit)]"
                    style={{ color: 'var(--brand-fg, #111111)' }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

/* ────────────────────────────────────────────
   LogoRow — images/logos as primary visual, StatValue hidden
   ──────────────────────────────────────────── */
export const LogoRow = ({ fields, params, page }: TrustStatsRowProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  const datasource = fields?.data?.datasource;
  if (!datasource) return <TrustStatsRowDefaultComponent />;
  const items = datasource.children?.results || [];

  return (
    <div className={cn('component trust-stats-row', styles)} id={RenderingIdentifier}>
      <section
        className="w-full px-4 py-12 md:py-16"
        style={{ backgroundColor: 'var(--brand-muted, #f5f5f5)' }}
      >
        <div className="mx-auto max-w-7xl">
          <SectionHeader datasource={datasource} isEditing={isEditing} />
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
            {items.map((item) => (
              <div key={item.id} className="flex flex-col items-center">
                {(item.statIcon?.jsonValue?.value?.src || isEditing) && (
                  <div className="h-12 w-auto overflow-hidden opacity-60 grayscale transition-all hover:opacity-100 hover:grayscale-0">
                    <ContentSdkImage
                      field={item.statIcon?.jsonValue}
                      className="h-full w-auto object-contain"
                    />
                  </div>
                )}
                {(item.statLabel?.jsonValue?.value || isEditing) && (
                  <Text
                    field={item.statLabel?.jsonValue}
                    tag="p"
                    className="mt-2 text-xs font-medium opacity-50 font-[var(--brand-body-font,inherit)]"
                    style={{ color: 'var(--brand-fg, #111111)' }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

/* ────────────────────────────────────────────
   SodexoAbout — lavender stats bar, no section heading
   ──────────────────────────────────────────── */
export const SodexoAbout = ({ fields, params, page }: TrustStatsRowProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  const datasource = fields?.data?.datasource;
  if (!datasource) return <TrustStatsRowDefaultComponent />;
  const items = datasource.children?.results || [];
  const brandFg = 'var(--brand-fg, #2a295c)';
  const headingFont = 'var(--brand-heading-font, "DM Sans", sans-serif)';
  const bodyFont = 'var(--brand-body-font, "Open Sans", sans-serif)';

  return (
    <div className={cn('component trust-stats-row', styles)} id={RenderingIdentifier}>
      <section className="w-full px-4 py-10 md:py-12" style={{ backgroundColor: 'var(--brand-muted, #e7e9f7)' }}>
        <div className="mx-auto grid max-w-[1224px] gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:px-16">
          {items.map((item) => (
            <div key={item.id} className="text-center">
              {(item.statValue?.jsonValue?.value || isEditing) && (
                <Text
                  field={item.statValue?.jsonValue}
                  tag="p"
                  className="text-[28px] font-bold leading-none sm:text-[32px]"
                  style={{ color: brandFg, fontFamily: headingFont }}
                />
              )}
              {(item.statLabel?.jsonValue?.value || isEditing) && (
                <Text
                  field={item.statLabel?.jsonValue}
                  tag="p"
                  className="mt-2 text-sm leading-snug"
                  style={{ color: brandFg, fontFamily: bodyFont }}
                />
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
