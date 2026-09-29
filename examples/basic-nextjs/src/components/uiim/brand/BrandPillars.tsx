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
  brandStoryTitle?: Field<string>;
  brandStoryBody?: RichTextField;
  brandStoryImage?: ImageField;
  brandHighlight1Title?: Field<string>;
  brandHighlight1Body?: RichTextField;
  brandHighlight2Title?: Field<string>;
  brandHighlight2Body?: RichTextField;
  brandHighlight3Title?: Field<string>;
  brandHighlight3Body?: RichTextField;
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
  const cards = [1, 2, 3].map((index) => ({
    title: routeFields[`brandPillar${index}Title` as keyof BrandPillarsRouteFields] as Field<string> | undefined,
    description: routeFields[`brandPillar${index}Description` as keyof BrandPillarsRouteFields] as
      | RichTextField
      | undefined,
    image: routeFields[`brandPillar${index}Image` as keyof BrandPillarsRouteFields] as ImageField | undefined,
  }));
  const featured = {
    title: routeFields.brandPillar4Title,
    description: routeFields.brandPillar4Description,
    image: routeFields.brandPillar4Image,
  };
  const highlights = [1, 2, 3].map((index) => ({
    title: routeFields[`brandHighlight${index}Title` as keyof BrandPillarsRouteFields] as Field<string> | undefined,
    body: routeFields[`brandHighlight${index}Body` as keyof BrandPillarsRouteFields] as RichTextField | undefined,
  }));
  const hasHighlights = highlights.some((item) => item.title?.value || item.body?.value) || isEditing;
  const hasStory =
    !!(routeFields.brandStoryTitle?.value || routeFields.brandStoryBody?.value || routeFields.brandStoryImage?.value?.src) ||
    isEditing;
  const hasFeatured = !!(featured.title?.value || featured.description?.value || featured.image?.value?.src) || isEditing;

  return (
    <div className={cn('component brand-pillars', styles)} id={RenderingIdentifier} style={brandStyleVars(style)}>
      <section className="w-full bg-white px-4 py-12 sm:px-8 lg:px-16 lg:py-16">
        <div className="mx-auto max-w-[1224px]">
          {(routeFields.brandPillarsTitle?.value || isEditing) && routeFields.brandPillarsTitle && (
            <Text
              field={routeFields.brandPillarsTitle}
              tag="h2"
              className="mb-10 max-w-3xl text-left text-[28px] font-normal leading-tight sm:text-[36px]"
              style={{ color: 'var(--brand-fg)', fontFamily: 'var(--brand-heading-font)' }}
            />
          )}
          <div className="grid gap-10 md:grid-cols-3">
            {cards.map((card, index) => {
              if (!card.title?.value && !card.description?.value && !card.image?.value?.src && !isEditing) {
                return null;
              }
              return (
                <article key={index} className="flex flex-col">
                  {(card.image?.value?.src || isEditing) && card.image && (
                    <div className="relative mb-5 aspect-[4/3] overflow-hidden">
                      <ContentSdkImage field={card.image} className="h-full w-full object-cover" />
                    </div>
                  )}
                  {(card.title?.value || isEditing) && card.title && (
                    <Text
                      field={card.title}
                      tag="h3"
                      className="text-[22px] font-normal leading-snug"
                      style={{ color: 'var(--brand-fg)', fontFamily: 'var(--brand-heading-font)' }}
                    />
                  )}
                  {(card.description?.value || isEditing) && card.description && (
                    <ContentSdkRichText
                      field={card.description}
                      className="mt-3 text-sm leading-7"
                      style={{ color: 'var(--brand-fg)', fontFamily: 'var(--brand-body-font)' }}
                    />
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {hasStory && (
        <section className="w-full bg-white px-4 py-6 sm:px-8 lg:px-16 lg:py-10">
          <div className="mx-auto grid max-w-[1224px] items-center gap-10 md:grid-cols-2 lg:gap-16">
            {(routeFields.brandStoryImage?.value?.src || isEditing) && routeFields.brandStoryImage && (
              <div className="relative min-h-[260px] overflow-hidden sm:min-h-[380px]">
                <ContentSdkImage field={routeFields.brandStoryImage} className="h-full w-full object-cover" />
              </div>
            )}
            <div>
              {(routeFields.brandStoryTitle?.value || isEditing) && routeFields.brandStoryTitle && (
                <Text
                  field={routeFields.brandStoryTitle}
                  tag="h2"
                  className="text-[28px] font-normal leading-tight sm:text-[36px]"
                  style={{ color: 'var(--brand-fg)', fontFamily: 'var(--brand-heading-font)' }}
                />
              )}
              {(routeFields.brandStoryBody?.value || isEditing) && routeFields.brandStoryBody && (
                <ContentSdkRichText
                  field={routeFields.brandStoryBody}
                  className="mt-5 text-base leading-7"
                  style={{ color: 'var(--brand-fg)', fontFamily: 'var(--brand-body-font)' }}
                />
              )}
            </div>
          </div>
        </section>
      )}

      {hasFeatured && (
        <section className="w-full bg-white px-4 py-10 sm:px-8 lg:px-16 lg:py-14">
          <div className="mx-auto grid max-w-[1224px] items-center gap-10 md:grid-cols-2 lg:gap-16">
            {(featured.image?.value?.src || isEditing) && featured.image && (
              <div className="relative min-h-[260px] overflow-hidden sm:min-h-[380px]">
                <ContentSdkImage field={featured.image} className="h-full w-full object-cover" />
              </div>
            )}
            <div>
              {(featured.title?.value || isEditing) && featured.title && (
                <Text
                  field={featured.title}
                  tag="h3"
                  className="text-[28px] font-normal leading-tight sm:text-[32px]"
                  style={{ color: 'var(--brand-fg)', fontFamily: 'var(--brand-heading-font)' }}
                />
              )}
              {(featured.description?.value || isEditing) && featured.description && (
                <ContentSdkRichText
                  field={featured.description}
                  className="mt-5 text-base leading-7"
                  style={{ color: 'var(--brand-fg)', fontFamily: 'var(--brand-body-font)' }}
                />
              )}
            </div>
          </div>
        </section>
      )}

      {hasHighlights && (
        <section className="w-full bg-white px-4 py-10 sm:px-8 lg:px-16 lg:pb-16">
          <div className="mx-auto grid max-w-[1224px] gap-10 md:grid-cols-3">
            {highlights.map((item, index) => {
              if (!item.title?.value && !item.body?.value && !isEditing) return null;
              return (
                <article key={index}>
                  {(item.title?.value || isEditing) && item.title && (
                    <Text
                      field={item.title}
                      tag="h2"
                      className="text-[24px] font-normal leading-tight sm:text-[28px]"
                      style={{ color: 'var(--brand-fg)', fontFamily: 'var(--brand-heading-font)' }}
                    />
                  )}
                  {(item.body?.value || isEditing) && item.body && (
                    <ContentSdkRichText
                      field={item.body}
                      className="mt-4 text-sm leading-7 [&_li]:ml-4 [&_li]:list-disc [&_ul]:mt-3"
                      style={{ color: 'var(--brand-fg)', fontFamily: 'var(--brand-body-font)' }}
                    />
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
