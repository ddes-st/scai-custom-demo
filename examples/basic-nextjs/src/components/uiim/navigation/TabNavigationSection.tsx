import React, { JSX } from 'react';
import {
  Field,
  LinkField,
  Link as ContentSdkLink,
  Text,
} from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';
import { cn } from '@/lib/utils';

interface TabItemFields {
  id: string;
  tabLabel: { jsonValue: Field<string> };
  tabLink: { jsonValue: LinkField };
}

interface TabNavigationSectionDatasource {
  title: { jsonValue: Field<string> };
  children: {
    results: TabItemFields[];
  };
}

interface TabNavigationSectionFields {
  data: {
    datasource: TabNavigationSectionDatasource;
  };
}

type TabNavigationSectionProps = ComponentProps & {
  fields: TabNavigationSectionFields;
};

const TabNavigationSectionDefaultComponent = (): JSX.Element => (
  <div className="component tab-navigation-section">
    <div className="component-content">
      <span className="is-empty-hint">TabNavigationSection</span>
    </div>
  </div>
);

/* ────────────────────────────────────────────
   Default — pill-shaped tabs
   ──────────────────────────────────────────── */
export const Default = ({ fields, params, page }: TabNavigationSectionProps): JSX.Element => {  
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;

  const datasource = fields?.data?.datasource;
  if (!datasource) return <TabNavigationSectionDefaultComponent />;

  const tabs = datasource.children?.results || [];

  return (
    <div className={cn('component tab-navigation-section', styles)} id={RenderingIdentifier}>
      <section
        className="w-full px-4 py-6"
        style={{ backgroundColor: 'var(--brand-bg, #ffffff)' }}
      >
        <div className="mx-auto max-w-7xl">
          {(datasource.title?.jsonValue?.value || isEditing) && (
            <Text
              field={datasource.title?.jsonValue}
              tag="h2"
              className="mb-4 text-lg font-semibold font-[var(--brand-heading-font,inherit)]"
              style={{ color: 'var(--brand-fg, #111111)' }}
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            {tabs.map((tab, index) => (
              <ContentSdkLink
                key={tab.id}
                field={tab.tabLink?.jsonValue}
                className={cn(
                  'inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition-all',
                  index === 0
                    ? 'text-[var(--brand-primary-foreground)]'
                    : 'hover:opacity-70'
                )}
                style={
                  index === 0
                    ? { backgroundColor: 'var(--brand-primary)', color: 'var(--brand-primary-foreground)' }
                    : {
                        backgroundColor: 'var(--brand-muted, #f3f4f6)',
                        color: 'var(--brand-fg, #111111)',
                      }
                }
              >
                <Text field={tab.tabLabel?.jsonValue} />
              </ContentSdkLink>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

/* ────────────────────────────────────────────
   Underline — flat text with bottom border
   ──────────────────────────────────────────── */
export const Underline = ({ fields, params, page }: TabNavigationSectionProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;

  const datasource = fields?.data?.datasource;
  if (!datasource) return <TabNavigationSectionDefaultComponent />;

  const tabs = datasource.children?.results || [];

  return (
    <div className={cn('component tab-navigation-section', styles)} id={RenderingIdentifier}>
      <section
        className="w-full px-4 py-6"
        style={{ backgroundColor: 'var(--brand-bg, #ffffff)' }}
      >
        <div className="mx-auto max-w-7xl">
          {(datasource.title?.jsonValue?.value || isEditing) && (
            <Text
              field={datasource.title?.jsonValue}
              tag="h2"
              className="mb-4 text-lg font-semibold font-[var(--brand-heading-font,inherit)]"
              style={{ color: 'var(--brand-fg, #111111)' }}
            />
          )}
          <div
            className="flex items-center gap-6 border-b"
            style={{ borderColor: 'var(--brand-border, #e5e7eb)' }}
          >
            {tabs.map((tab, index) => (
              <ContentSdkLink
                key={tab.id}
                field={tab.tabLink?.jsonValue}
                className={cn(
                  'relative pb-3 text-sm font-medium transition-all',
                  index === 0 ? '' : 'opacity-60 hover:opacity-100'
                )}
                style={{ color: 'var(--brand-fg, #111111)' }}
              >
                <Text field={tab.tabLabel?.jsonValue} />
                {index === 0 && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ backgroundColor: 'var(--brand-primary)' }}
                  />
                )}
              </ContentSdkLink>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

/* ────────────────────────────────────────────
   Boxed — rectangular tabs with border
   ──────────────────────────────────────────── */
export const Boxed = ({ fields, params, page }: TabNavigationSectionProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;

  const datasource = fields?.data?.datasource;
  if (!datasource) return <TabNavigationSectionDefaultComponent />;

  const tabs = datasource.children?.results || [];

  return (
    <div className={cn('component tab-navigation-section', styles)} id={RenderingIdentifier}>
      <section
        className="w-full px-4 py-6"
        style={{ backgroundColor: 'var(--brand-bg, #ffffff)' }}
      >
        <div className="mx-auto max-w-7xl">
          {(datasource.title?.jsonValue?.value || isEditing) && (
            <Text
              field={datasource.title?.jsonValue}
              tag="h2"
              className="mb-4 text-lg font-semibold font-[var(--brand-heading-font,inherit)]"
              style={{ color: 'var(--brand-fg, #111111)' }}
            />
          )}
          <div className="flex flex-wrap items-center gap-0">
            {tabs.map((tab, index) => (
              <ContentSdkLink
                key={tab.id}
                field={tab.tabLink?.jsonValue}
                className={cn(
                  'inline-flex items-center border px-5 py-2.5 text-sm font-medium transition-all',
                  index === 0 ? '' : 'hover:opacity-70'
                )}
                style={
                  index === 0
                    ? {
                        backgroundColor: 'var(--brand-primary)',
                        color: 'var(--brand-primary-foreground)',
                        borderColor: 'var(--brand-primary)',
                      }
                    : {
                        backgroundColor: 'transparent',
                        color: 'var(--brand-fg, #111111)',
                        borderColor: 'var(--brand-border, #e5e7eb)',
                      }
                }
              >
                <Text field={tab.tabLabel?.jsonValue} />
              </ContentSdkLink>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

/* ────────────────────────────────────────────
   Sodexo — underline tabs + split content below with asymmetric image
   ──────────────────────────────────────────── */
export const Sodexo = ({ fields, params, page }: TabNavigationSectionProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;

  const datasource = fields?.data?.datasource;
  if (!datasource) return <TabNavigationSectionDefaultComponent />;

  const tabs = datasource.children?.results || [];
  const firstTab = tabs[0];

  return (
    <div className={cn('component tab-navigation-section', styles)} id={RenderingIdentifier}>
      <section
        className="w-full px-4 py-12 md:py-16"
        style={{ backgroundColor: 'var(--brand-bg, #ffffff)' }}
      >
        <div className="mx-auto max-w-7xl md:px-6">
          {(datasource.title?.jsonValue?.value || isEditing) && (
            <Text
              field={datasource.title?.jsonValue}
              tag="h2"
              className="mb-6 text-2xl font-bold md:text-3xl"
              style={{
                color: 'var(--brand-fg, #2a295c)',
                fontFamily: 'var(--brand-heading-font, "DM Sans", sans-serif)',
              }}
            />
          )}
          {/* Tab bar with underline active state */}
          <div
            className="flex items-center gap-6 overflow-x-auto border-b"
            style={{ borderColor: 'var(--brand-border, #e5e7eb)' }}
          >
            {tabs.map((tab, index) => (
              <ContentSdkLink
                key={tab.id}
                field={tab.tabLink?.jsonValue}
                className={cn(
                  'relative whitespace-nowrap pb-3 text-sm font-medium transition-all',
                  index === 0 ? '' : 'opacity-60 hover:opacity-100'
                )}
                style={{
                  color: index === 0 ? 'var(--brand-primary, #283897)' : 'var(--brand-fg, #2a295c)',
                  fontFamily: 'var(--brand-body-font, "Open Sans", sans-serif)',
                }}
              >
                <Text field={tab.tabLabel?.jsonValue} />
                {index === 0 && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ backgroundColor: 'var(--brand-primary, #283897)' }}
                  />
                )}
              </ContentSdkLink>
            ))}
          </div>
          {/* Content area — image left, text + CTA right */}
          {firstTab && (
            <div className="mt-10 grid items-center gap-10 md:grid-cols-2">
              <div
                className="relative min-h-[320px] overflow-hidden bg-gray-100 md:min-h-[380px]"
                style={{ borderRadius: '60px 3px 3px 3px' }}
              >
                <div className="absolute inset-0 flex items-center justify-center text-sm opacity-30">
                  Image
                </div>
              </div>
              <div>
                <h3
                  className="text-xl font-bold md:text-2xl"
                  style={{
                    color: 'var(--brand-fg, #2a295c)',
                    fontFamily: 'var(--brand-heading-font, "DM Sans", sans-serif)',
                  }}
                >
                  <Text field={firstTab.tabLabel?.jsonValue} />
                </h3>
                <p
                  className="mt-3 text-sm leading-relaxed opacity-70 md:text-base"
                  style={{
                    color: 'var(--brand-fg, #2a295c)',
                    fontFamily: 'var(--brand-body-font, "Open Sans", sans-serif)',
                  }}
                >
                  Discover how we serve this industry with tailored food and facilities management solutions.
                </p>
                <ContentSdkLink
                  field={firstTab.tabLink?.jsonValue}
                  className="mt-6 inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{
                    backgroundColor: 'var(--brand-primary, #283897)',
                    borderRadius: '3px 3px 3px 16px',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

