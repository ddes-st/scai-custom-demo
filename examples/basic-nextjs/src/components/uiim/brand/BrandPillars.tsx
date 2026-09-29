import React, { JSX } from 'react';
import {
  Field,
  ImageField,
  RichTextField,
  Text,
  NextImage as ContentSdkImage,
  RichText as ContentSdkRichText,
} from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';
import { cn } from '@/lib/utils';
import { isSodexoBrandDetailPage } from '@/lib/sodexo-page';
import { brandStyleVars, getPageBrandStyle, resolveBrandStyle } from '@/lib/sodexo-brand-style';

interface BrandPillarsRouteFields {
  brandPillarsTitle?: Field<string>;
  brandPillar1Title?: Field<string>;
  brandPillar1Description?: RichTextField;
  brandPillar1Image?: ImageField;
  brandPillar2Title?: Field<string>;
  brandPillar2Description?: RichTextField;
  brandPillar2Image?: ImageField;
  brandPillar3Title?: Field<string>;
  brandPillar3Description?: RichTextField;
  brandPillar3Image?: ImageField;
  brandPillar4Title?: Field<string>;
  brandPillar4Description?: RichTextField;
  brandPillar4Image?: ImageField;
}

const BrandPillarsDefaultComponent = (): JSX.Element => (
  <div className="component brand-pillars">
    <div className="component-content">
      <span className="is-empty-hint">BrandPillars</span>
    </div>
  </div>
);

function getRouteFields(page: ComponentProps['page']): BrandPillarsRouteFields | null {
  const fields = page?.layout?.sitecore?.route?.fields;
  return fields ? (fields as unknown as BrandPillarsRouteFields) : null;
}

export const Default = (props: ComponentProps): JSX.Element => {
  if (isSodexoBrandDetailPage(props.page)) return SodexoBrand(props);
  return BrandPillarsLayout(props);
};

export const SodexoBrand = (props: ComponentProps): JSX.Element => BrandPillarsLayout(props);

function BrandPillarsLayout({ params, page }: ComponentProps): JSX.Element {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  const routeFields = getRouteFields(page);
  if (!routeFields) return <BrandPillarsDefaultComponent />;

  const style = resolveBrandStyle(getPageBrandStyle(page), params.BrandStyle);
  const pillars = [1, 2, 3, 4].map((index) => ({
    title: routeFields[`brandPillar${index}Title` as keyof BrandPillarsRouteFields] as Field<string> | undefined,
    description: routeFields[`brandPillar${index}Description` as keyof BrandPillarsRouteFields] as
      | RichTextField
      | undefined,
    image: routeFields[`brandPillar${index}Image` as keyof BrandPillarsRouteFields] as ImageField | undefined,
  }));

  return (
    <div className={cn('component brand-pillars', styles)} id={RenderingIdentifier} style={brandStyleVars(style)}>
      <section className="w-full bg-white px-6 py-14 lg:px-12">
        <div className="mx-auto max-w-[1224px]">
          {(routeFields.brandPillarsTitle?.value || isEditing) && (
            <Text
              field={routeFields.brandPillarsTitle}
              tag="h2"
              className="mx-auto mb-12 max-w-3xl text-center text-[28px] font-normal leading-tight sm:text-[36px]"
              style={{ color: 'var(--brand-fg)', fontFamily: 'var(--brand-heading-font)' }}
            />
          )}
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map((pillar, index) => {
              if (!pillar.title?.value && !pillar.description?.value && !pillar.image?.value?.src && !isEditing) {
                return null;
              }
              return (
                <article key={index} className="flex flex-col">
                  {(pillar.image?.value?.src || isEditing) && (
                    <div className="relative mb-5 aspect-[4/3] overflow-hidden">
                      <ContentSdkImage field={pillar.image} className="h-full w-full object-cover" />
                    </div>
                  )}
                  {(pillar.title?.value || isEditing) && (
                    <Text
                      field={pillar.title}
                      tag="h3"
                      className="text-lg font-normal"
                      style={{ color: 'var(--brand-fg)', fontFamily: 'var(--brand-heading-font)' }}
                    />
                  )}
                  {(pillar.description?.value || isEditing) && (
                    <ContentSdkRichText
                      field={pillar.description}
                      className="mt-3 text-sm leading-6"
                      style={{ color: 'var(--brand-fg)', fontFamily: 'var(--brand-body-font)' }}
                    />
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
