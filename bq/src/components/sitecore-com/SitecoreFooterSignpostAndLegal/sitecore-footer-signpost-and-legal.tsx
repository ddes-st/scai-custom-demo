import React, { JSX } from 'react';
import { AppPlaceholder, Image, Link, RichText, Text } from '@sitecore-content-sdk/nextjs';
import type { Field, ImageField, LinkField, RichTextField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import componentMap from '.sitecore/component-map';

interface Fields {
  Heading: Field<string>;
  Body: RichTextField;
  'Primary CTA': LinkField;
  'Secondary CTA': LinkField;
  Logo: ImageField;
  Copyright: Field<string>;
  'Legal Links': Field<string>;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields, rendering, page } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const phKey = params.DynamicPlaceholderId;
  const signpostsBase = 'signposts';
  const columnsBase = 'link-columns';
  const socialLinksBase = 'social-links';
  const signpostsName = phKey ? `${signpostsBase}-${phKey}` : signpostsBase;
  const columnsName = phKey ? `${columnsBase}-${phKey}` : columnsBase;
  const socialLinksName = phKey ? `${socialLinksBase}-${phKey}` : socialLinksBase;

  const legalLinks = (() => {
    try {
      const parsed = JSON.parse(fields['Legal Links']?.value || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })() as { text?: string; url?: string }[];

  if (!fields) return <div>Missing Component Datasource.</div>;

  return (
    <footer className="mt-12 bg-[#090342] font-['DM_Sans',sans-serif] text-white md:mt-8">
      <section className="border-y border-white/35 px-[19px] py-10 sm:mx-8 sm:px-8 lg:mx-[clamp(2rem,4vw,4.5rem)] lg:grid lg:grid-cols-12 lg:gap-8 lg:px-8 lg:py-20">
        <div className="border-b border-white/35 pb-10 lg:col-span-5 lg:border-0 lg:pb-0">
          <h2 className="text-[26px] font-normal leading-none tracking-[-.195px] sm:text-[clamp(26px,2vw,36px)]">
            <Text field={fields.Heading} />
          </h2>
          <div className="mt-2 max-w-md text-[16px] leading-[1.625] tracking-[.16px] sm:text-[17px] lg:text-[18px]">
            <RichText field={fields.Body} />
          </div>
          <div className="mt-6 flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:gap-4">
            <Link
              field={fields['Primary CTA']}
              className="inline-flex items-center rounded-full bg-gradient-to-r from-[#ff1f38] to-[#7c25df] px-5 py-2 text-[16px] font-medium leading-6 sm:text-[17px] lg:text-[18px]"
            />
            <Link
              field={fields['Secondary CTA']}
              className="inline-flex items-center rounded-full border border-[#c1bdc7] bg-white px-5 py-2 text-[16px] font-medium leading-6 text-[#1e1c22] sm:text-[17px] lg:text-[18px]"
            />
          </div>
        </div>
        <div className="lg:col-span-6 lg:col-start-7">
          <AppPlaceholder
            name={signpostsName}
            rendering={rendering}
            page={page}
            componentMap={componentMap}
          />
        </div>
      </section>
      <section className="px-[19px] sm:mx-8 sm:px-8 lg:mx-[clamp(2rem,4vw,4.5rem)] lg:px-8">
        <div className="flex flex-col gap-8 py-12 sm:flex-row sm:flex-wrap sm:gap-x-8 sm:gap-y-10 lg:flex-nowrap lg:justify-between lg:gap-4 lg:py-20">
          <AppPlaceholder
            name={columnsName}
            rendering={rendering}
            page={page}
            componentMap={componentMap}
          />
        </div>
        <div className="flex flex-col items-center justify-between gap-6 border-y border-white/35 py-8 md:flex-row md:gap-16">
          <Image field={fields.Logo} className="max-w-[180px] lg:max-w-[220px]" />
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:gap-2">
            <AppPlaceholder
              name={socialLinksName}
              rendering={rendering}
              page={page}
              componentMap={componentMap}
            />
          </div>
        </div>
      </section>
      <section className="px-[19px] pb-6 pt-6 sm:mx-8 sm:px-8 lg:mx-[clamp(2rem,4vw,4.5rem)] lg:px-8 lg:pb-12">
        <div className="flex flex-col-reverse items-end gap-4 lg:flex-row lg:items-center lg:justify-between">
          <p className="w-[90%] text-center text-[12px] font-light leading-8 tracking-[.48px] sm:w-full sm:leading-6 lg:w-auto lg:pl-8 lg:text-left">
            <Text field={fields.Copyright} />
          </p>
          <ul className="flex w-full flex-col flex-wrap gap-2 text-[14px] font-light leading-[1.72] sm:flex-row sm:justify-center sm:text-[13px] lg:w-auto lg:flex-nowrap lg:gap-0">
            {legalLinks.map((link, index) => (
              <li key={index}>
                <a href={link.url || '#'} className="px-2 hover:underline hover:underline-offset-2">
                  {link.text || ''}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </footer>
  );
};

export default Default;
