'use client';
import { JSX, useState } from 'react';
import { Text, RichText, Image } from '@sitecore-content-sdk/nextjs';
import type { Field, RichTextField, ImageField } from '@sitecore-content-sdk/nextjs';
interface Reason {
  fields: {
    Title?: Field<string>;
    Body?: RichTextField;
    Icon?: ImageField;
  };
}
interface Fields {
  Heading?: Field<string>;
  children?: { results?: Reason[] };
}
type Props = { fields: Fields };
export default function ReasonsClient(props: Props): JSX.Element {
  const [active, setActive] = useState<number | null>(null);
  const reasons = props.fields.children?.results ?? [];
  return (
    <section className="px-4 py-6 md:px-8">
      <div className="mx-auto max-w-[118rem]">
        <h2 className="mb-4 pt-2 text-2xl font-bold md:text-[2.8rem]">
          <Text field={props.fields.Heading} />
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {reasons.map((reason: Reason, index: number) => (
            <button
              key={index}
              type="button"
              aria-pressed={active === index}
              onClick={() => setActive(active === index ? null : index)}
              className={`flex min-h-[15rem] flex-col rounded-2xl border bg-white p-6 text-left shadow-[inset_0_0_0_1px_#abcffc] ${active === index ? 'ring-2 ring-[#0762d4]' : ''}`}
            >
              <Image field={reason.fields.Icon} />
              <span className="text-xl font-bold leading-7">
                <Text field={reason.fields.Title} />
              </span>
              <span className="mt-2 text-base leading-6">
                <RichText field={reason.fields.Body} />
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
