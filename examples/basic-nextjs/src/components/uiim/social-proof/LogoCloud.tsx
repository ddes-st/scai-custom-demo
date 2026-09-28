import React, { JSX } from 'react';
import {
  Field,
  ImageField,
  LinkField,
  NextImage as ContentSdkImage,
  Link as ContentSdkLink,
  Text,
} from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';
import { cn } from '@/lib/utils';
import { isSodexoArticlesPage } from '@/lib/sodexo-page';

interface LogoItemFields {
  id: string;
  logoImage: { jsonValue: ImageField };
  companyName: { jsonValue: Field<string> };
  logoLink: { jsonValue: LinkField };
}

interface LogoCloudDatasource {
  title: { jsonValue: Field<string> };
  children: {
    results: LogoItemFields[];
  };
}

interface LogoCloudFields {
  data: {
    datasource: LogoCloudDatasource;
  };
}

type LogoCloudProps = ComponentProps & {
  fields: LogoCloudFields;
};

const LogoCloudDefaultComponent = (): JSX.Element => (
  <div className="component logo-cloud">
    <div className="component-content">
      <span className="is-empty-hint">LogoCloud</span>
    </div>
  </div>
);

const SectionTitle = ({
  datasource,
  isEditing,
}: {
  datasource: LogoCloudDatasource;
  isEditing?: boolean;
}) => {
  if (!datasource.title?.jsonValue?.value && !isEditing) return null;
  return (
    <Text
      field={datasource.title?.jsonValue}
      tag="h2"
      className="mb-8 text-center text-xl font-semibold font-[var(--brand-heading-font,inherit)]"
      style={{ color: 'var(--brand-muted-foreground, #6b7280)' }}
    />
  );
};

const LogoWrapper = ({
  item,
  isEditing,
  children,
}: {
  item: LogoItemFields;
  isEditing?: boolean;
  children: React.ReactNode;
}) => {
  if (item.logoLink?.jsonValue?.value?.href || isEditing) {
    return (
      <ContentSdkLink
        field={item.logoLink?.jsonValue}
        className="flex items-center justify-center"
      >
        {children}
      </ContentSdkLink>
    );
  }
  return <div className="flex items-center justify-center">{children}</div>;
};

/* ────────────────────────────────────────────
   Default — horizontal row, grayscale with hover color
   ──────────────────────────────────────────── */
export const Default = (props: LogoCloudProps): JSX.Element => {
  const { fields, params, page } = props;
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  const datasource = fields?.data?.datasource;
  if (isSodexoArticlesPage(page) && datasource) return SodexoArticles(props);
  if (!datasource) return <LogoCloudDefaultComponent />;
  const items = datasource.children?.results || [];

  return (
    <div className={cn('component logo-cloud', styles)} id={RenderingIdentifier}>
      <section
        className="w-full px-4 py-12 md:py-16"
        style={{ backgroundColor: 'var(--brand-bg, #ffffff)' }}
      >
        <div className="mx-auto max-w-7xl">
          <SectionTitle datasource={datasource} isEditing={isEditing} />
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
            {items.map((item) => (
              <LogoWrapper key={item.id} item={item} isEditing={isEditing}>
                {(item.logoImage?.jsonValue?.value?.src || isEditing) && (
                  <ContentSdkImage
                    field={item.logoImage?.jsonValue}
                    className="h-10 max-w-[140px] object-contain opacity-60 grayscale transition-all hover:opacity-100 hover:grayscale-0"
                  />
                )}
              </LogoWrapper>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

/* ────────────────────────────────────────────
   Grid — multi-row grid for many logos
   ──────────────────────────────────────────── */
export const Grid = ({ fields, params, page }: LogoCloudProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  const datasource = fields?.data?.datasource;
  if (!datasource) return <LogoCloudDefaultComponent />;
  const items = datasource.children?.results || [];

  return (
    <div className={cn('component logo-cloud', styles)} id={RenderingIdentifier}>
      <section
        className="w-full px-4 py-12 md:py-16"
        style={{ backgroundColor: 'var(--brand-bg, #ffffff)' }}
      >
        <div className="mx-auto max-w-7xl">
          <SectionTitle datasource={datasource} isEditing={isEditing} />
          <div className="grid grid-cols-3 gap-8 md:grid-cols-6">
            {items.map((item) => (
              <LogoWrapper key={item.id} item={item} isEditing={isEditing}>
                {(item.logoImage?.jsonValue?.value?.src || isEditing) && (
                  <ContentSdkImage
                    field={item.logoImage?.jsonValue}
                    className="h-10 max-w-[140px] object-contain opacity-60 grayscale transition-all hover:opacity-100 hover:grayscale-0"
                  />
                )}
              </LogoWrapper>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

/* ────────────────────────────────────────────
   WithLabels — logo above, company name below
   ──────────────────────────────────────────── */
export const WithLabels = ({ fields, params, page }: LogoCloudProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  const datasource = fields?.data?.datasource;
  if (!datasource) return <LogoCloudDefaultComponent />;
  const items = datasource.children?.results || [];

  return (
    <div className={cn('component logo-cloud', styles)} id={RenderingIdentifier}>
      <section
        className="w-full px-4 py-12 md:py-16"
        style={{ backgroundColor: 'var(--brand-bg, #ffffff)' }}
      >
        <div className="mx-auto max-w-7xl">
          <SectionTitle datasource={datasource} isEditing={isEditing} />
          <div className="flex flex-wrap items-start justify-center gap-10 md:gap-14">
            {items.map((item) => (
              <div key={item.id} className="flex flex-col items-center gap-2">
                <LogoWrapper item={item} isEditing={isEditing}>
                  {(item.logoImage?.jsonValue?.value?.src || isEditing) && (
                    <ContentSdkImage
                      field={item.logoImage?.jsonValue}
                      className="h-10 max-w-[140px] object-contain opacity-60 grayscale transition-all hover:opacity-100 hover:grayscale-0"
                    />
                  )}
                </LogoWrapper>
                {(item.companyName?.jsonValue?.value || isEditing) && (
                  <Text
                    field={item.companyName?.jsonValue}
                    tag="span"
                    className="text-xs font-medium font-[var(--brand-body-font,inherit)]"
                    style={{ color: 'var(--brand-muted-foreground, #6b7280)' }}
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

const SODEXO_SOCIAL_ICONS: Record<string, string> = {
  LinkedIn:
    'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 110-4.124 2.062 2.062 0 010 4.124zM7.119 20.452H3.555V9h3.564v11.452z',
  X: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  Instagram:
    'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z',
  TikTok:
    'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',
  YouTube:
    'M23.498 6.186a2.966 2.966 0 00-2.088-2.088C19.692 3.5 12 3.5 12 3.5s-7.692 0-9.41.598A2.966 2.966 0 00.502 6.186 30.909 30.909 0 000 12a30.909 30.909 0 00.502 5.814 2.966 2.966 0 002.088 2.088C4.308 20.5 12 20.5 12 20.5s7.692 0 9.41-.598a2.966 2.966 0 002.088-2.088A30.909 30.909 0 0024 12a30.909 30.909 0 00-.502-5.814zM9.75 15.568V8.432L15.818 12 9.75 15.568z',
};

/* ────────────────────────────────────────────
   SodexoArticles — social follow bar on the Articles listing
   ──────────────────────────────────────────── */
export const SodexoArticles = ({ fields, params, page }: LogoCloudProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  const datasource = fields?.data?.datasource;
  if (!datasource) return <LogoCloudDefaultComponent />;
  const items = datasource.children?.results || [];
  const headingFont = 'var(--brand-heading-font, "DM Sans", sans-serif)';

  return (
    <div className={cn('component logo-cloud', styles)} id={RenderingIdentifier}>
      <section className="w-full" style={{ backgroundColor: 'var(--brand-bg, #ffffff)' }}>
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-10 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
          {(datasource.title?.jsonValue?.value || isEditing) && (
            <Text
              field={datasource.title?.jsonValue}
              tag="p"
              className="text-center text-base sm:text-left"
              style={{ color: 'var(--brand-fg, #2a295c)', fontFamily: headingFont }}
            />
          )}
          <div className="flex items-center gap-3">
            {items.map((item) => {
              const name = item.companyName?.jsonValue?.value || '';
              const iconPath = SODEXO_SOCIAL_ICONS[name];
              return (
                <LogoWrapper key={item.id} item={item} isEditing={isEditing}>
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full transition-opacity hover:opacity-80"
                    style={{ backgroundColor: 'var(--brand-primary, #283897)' }}
                    aria-label={name}
                  >
                    {item.logoImage?.jsonValue?.value?.src ? (
                      <ContentSdkImage field={item.logoImage?.jsonValue} className="h-4 w-4 object-contain" />
                    ) : iconPath ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                        <path d={iconPath} />
                      </svg>
                    ) : (
                      <span className="text-[10px] text-white">{name.slice(0, 2)}</span>
                    )}
                  </span>
                </LogoWrapper>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};
