'use client';

import React, { JSX, ReactNode } from 'react';
import { Image, Link, Text } from '@sitecore-content-sdk/nextjs';
import type { ImageField, LinkField, Field } from '@sitecore-content-sdk/nextjs';

interface Fields {
  Heading: Field<string>;
  Logo: ImageField;
  'Logo Link': LinkField;
}

type Props = {
  fields: Fields;
  children?: ReactNode;
};

export default function FooterLegalLinksChrome(props: Props): JSX.Element {
  return (
    <footer className="w-full bg-white text-[#043572]">
      <div className="relative px-4 py-6 md:px-8 xl:px-0">
        <div className="mx-auto grid w-full max-w-[1180px] grid-cols-12 gap-x-4 md:gap-x-6 lg:gap-x-8">
          <div className="col-span-12 flex flex-wrap items-center gap-4 border-b border-[#abcffc] py-4 md:col-span-12 md:border-b-0 lg:col-span-3">
            <p className="m-0 w-full pt-4 text-base font-bold leading-6 text-[#043572] md:w-auto md:text-lg">
              <Text field={props.fields.Heading} />
            </p>
            <div className="block">
              <Link field={props.fields['Logo Link']} className="block">
                <Image field={props.fields.Logo} className="block h-auto w-auto max-w-none" />
              </Link>
            </div>
          </div>
          <div className="col-span-12 flex flex-wrap items-center justify-center md:col-span-12 md:justify-end lg:col-span-9 lg:justify-end">
            {props.children}
          </div>
        </div>
      </div>
    </footer>
  );
}
