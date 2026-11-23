'use client';

import React, { JSX, ReactNode } from 'react';
import { Image, Link, RichText, Text } from '@sitecore-content-sdk/nextjs';
import type { Field, ImageField, LinkField } from '@sitecore-content-sdk/nextjs';

interface Fields {
  Heading: Field<string>;
  Body: Field<string>;
  'Contact Link': LinkField;
  'Pebble Graphic': ImageField;
}

type Props = {
  fields: Fields;
  children: ReactNode;
};

const emptyLink: LinkField = { value: { href: '', text: '' } };

export default function MenzisFooterSupportNavigationClient({
  fields,
  children,
}: Props): JSX.Element {
  const graphicSrc = fields['Pebble Graphic']?.value?.src;

  return (
    <footer className="relative w-full max-w-[100vw] overflow-hidden text-[#043572]">
      <section className="relative z-0 bg-gradient-to-b from-white to-[#f2f2f2] px-4 py-6 md:px-8 lg:px-8 lg:py-20">
        <div className="mx-auto w-full max-w-[1180px]">
          <div className="grid grid-cols-12 gap-x-4 lg:gap-x-8">
            <div className="relative col-span-12 flex min-h-0 flex-col justify-center text-left lg:col-span-7 lg:pr-32">
              {graphicSrc ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -left-[100px] -top-[60px] -z-10 hidden h-[360px] w-[650px] bg-[length:100%_auto] bg-[position:100%_100%] bg-no-repeat lg:block"
                  style={{ backgroundImage: `url(${graphicSrc})` }}
                />
              ) : null}
              <div className="relative z-10 max-w-2xl md:mx-auto md:flex md:h-[300px] md:max-h-[300px] md:flex-col md:justify-center md:px-6 md:text-left lg:mx-0 lg:h-auto lg:max-w-none lg:px-0">
                <h2 className="mb-4 pt-2 text-[28px] font-bold leading-9 text-[#043572] max-[767px]:text-2xl max-[767px]:leading-8">
                  <Text field={fields.Heading} />
                </h2>
                <div className="mb-6 text-base font-normal leading-6 text-[#043572] lg:text-lg">
                  <RichText field={fields.Body} />
                  {fields['Contact Link']?.value?.href ? (
                    <Link field={fields['Contact Link']} />
                  ) : null}
                </div>
              </div>
            </div>
            <div className="col-span-12 text-center lg:col-span-2">{children}</div>
          </div>
        </div>
      </section>
    </footer>
  );
}
