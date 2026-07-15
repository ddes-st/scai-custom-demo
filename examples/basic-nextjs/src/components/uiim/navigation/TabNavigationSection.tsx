'use client';

import React, { JSX, useState } from 'react';
import Image from 'next/image';
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
const SODEXO_TAB_CONTENT: Record<string, { description: string; image: string }> = {
  'Business & Industries': {
    description:
      'Creating engaging workplaces that fuel human potential through food and hospitality services, which boost wellbeing and performance, attracting top talent.',
    image: 'https://ddes.sitecoresandbox.cloud/api/public/content/106461-section4-img6?v=b0b2d3d8',
  },
  Education: {
    description:
      'Delivering integrated food, cleaning and facilities management services for schools and universities — creating experiences where every student feels supported, connected and ready to learn.',
    image: 'https://ddes.sitecoresandbox.cloud/api/public/content/106449-section3-img5?v=409a0f3e',
  },
  Energy: {
    description:
      'Supporting people working in remote and complex environments with integrated food, accommodation and facilities services that keep operations safe, comfortable and running smoothly.',
    image: 'https://ddes.sitecoresandbox.cloud/api/public/content/106429-section3-img3?v=b3caf991',
  },
  Healthcare: {
    description:
      'Integrated food, cleaning, technology and hospitality services for hospitals and care facilities — empowering healthcare teams to focus on what matters most: patient care.',
    image: 'https://ddes.sitecoresandbox.cloud/api/public/content/106421-section3-img2?v=ee51d56f',
  },
  Seniors: {
    description:
      'Bringing consistency, care and human connection to senior living communities through dining, clinical nutrition and facilities management that help residents feel respected and truly at home.',
    image: 'https://ddes.sitecoresandbox.cloud/api/public/content/106470-section5-img7?v=70b49ab3',
  },
  'Sports leisure': {
    description:
      'Elevating the fan and visitor experience at stadiums, arenas and leisure venues with premium catering, hospitality and facilities services for major events and everyday operations.',
    image: 'https://ddes.sitecoresandbox.cloud/api/public/content/106413-section3-img1?v=d480f54d',
  },
};

export const Sodexo = ({ fields, params, page }: TabNavigationSectionProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;

  const datasource = fields?.data?.datasource;
  const tabs = datasource?.children?.results || [];
  const [activeId, setActiveId] = useState<string | undefined>(tabs[0]?.id);

  if (!datasource) return <TabNavigationSectionDefaultComponent />;

  const activeTab = tabs.find((tab) => tab.id === activeId) || tabs[0];
  const activeContent = activeTab && SODEXO_TAB_CONTENT[activeTab.tabLabel?.jsonValue?.value || ''];

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
            {tabs.map((tab) => {
              const isActive = tab.id === activeTab?.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveId(tab.id)}
                  className={cn(
                    'relative whitespace-nowrap pb-3 text-sm transition-all',
                    isActive ? 'font-semibold' : 'font-medium hover:opacity-70'
                  )}
                  style={{
                    color: isActive ? 'var(--brand-fg, #2a295c)' : 'var(--brand-primary, #283897)',
                    fontFamily: 'var(--brand-body-font, "Open Sans", sans-serif)',
                  }}
                >
                  <Text field={tab.tabLabel?.jsonValue} />
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-0.5"
                      style={{ backgroundColor: 'var(--brand-accent, #da2020)' }}
                    />
                  )}
                </button>
              );
            })}
          </div>
          {/* Content area — image left, text + CTA right */}
          {activeTab && (
            <div className="mt-10 grid items-center gap-10 md:grid-cols-2">
              <div
                className="relative min-h-[320px] overflow-hidden bg-gray-100 md:min-h-[380px]"
                style={{ borderRadius: '60px 3px 3px 3px' }}
              >
                {activeContent?.image && (
                  <Image
                    src={activeContent.image}
                    alt={activeTab.tabLabel?.jsonValue?.value || ''}
                    fill
                    sizes="(min-width: 768px) 50vw, 100vw"
                    className="object-cover"
                  />
                )}
              </div>
              <div>
                <h3
                  className="text-xl font-bold md:text-2xl"
                  style={{
                    color: 'var(--brand-fg, #2a295c)',
                    fontFamily: 'var(--brand-heading-font, "DM Sans", sans-serif)',
                  }}
                >
                  <Text field={activeTab.tabLabel?.jsonValue} />
                </h3>
                <p
                  className="mt-3 text-sm leading-relaxed opacity-70 md:text-base"
                  style={{
                    color: 'var(--brand-fg, #2a295c)',
                    fontFamily: 'var(--brand-body-font, "Open Sans", sans-serif)',
                  }}
                >
                  {activeContent?.description}
                </p>
                <ContentSdkLink
                  field={activeTab.tabLink?.jsonValue}
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

