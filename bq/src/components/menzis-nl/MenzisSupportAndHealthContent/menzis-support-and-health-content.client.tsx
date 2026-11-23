'use client';

import React, { JSX, ReactNode } from 'react';
import { Text } from '@sitecore-content-sdk/nextjs';
import type { Field } from '@sitecore-content-sdk/nextjs';

interface Fields {
  Heading: Field<string>;
}
type Props = { fields: Fields; children: ReactNode };

export default function Chrome({ fields, children }: Props): JSX.Element {
  const parts = React.Children.toArray(children);
  return (
    <main className="w-full bg-white font-['Geologica',Arial,sans-serif] text-[#043572]">
      <section className="px-4 pb-2 pt-6 md:px-8">
        <div className="mx-auto max-w-[1180px]">
          <h2 className="pb-2 text-2xl font-bold leading-9 md:text-3xl">
            <Text field={fields.Heading} />
          </h2>
          {parts[0]}
        </div>
      </section>
      {parts[1]}
      <section className="px-4 py-6 md:px-8">
        <div className="mx-auto max-w-[1180px]">
          
          {parts[2]}
        </div>
      </section>
      {parts[3]}
    </main>
  );
}
