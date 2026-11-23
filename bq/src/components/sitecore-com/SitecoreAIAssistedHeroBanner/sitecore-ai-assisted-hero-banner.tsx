import React, { JSX } from 'react';
import { Link, Text } from '@sitecore-content-sdk/nextjs';
import type { Field, LinkField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';

interface Fields {
  'Heading Intro': Field<string>;
  'Heading Emphasis': Field<string>;
  Lead: Field<string>;
  'Primary CTA': LinkField;
  'Primary CTA Label': Field<string>;
  'Secondary CTA': LinkField;
  'Secondary CTA Label': Field<string>;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields } = props;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  return (
    <section
      aria-labelledby="sitecore-ai-hero-title"
      className="relative isolate overflow-hidden bg-transparent px-4 pb-7 pt-7 font-['DM_Sans',sans-serif] text-[#1e1c22] sm:px-6 sm:pb-8 sm:pt-8 lg:px-8 lg:pb-10 lg:pt-12"
    >
      <div className="mx-auto w-full max-w-[1280px]">
        <div className="mx-auto w-full max-w-[1240px] text-center">
          <h1
            id="sitecore-ai-hero-title"
            className="mx-auto mb-[1.15rem] w-full max-w-[34rem] text-center font-semibold leading-none [text-wrap:balance] sm:mb-5 sm:max-w-[760px] lg:mb-6 lg:max-w-[1240px]"
          >
            <span className="mx-auto block text-[clamp(1.85rem,8vw,2.25rem)] leading-[1.06] tracking-[-0.035em] sm:text-[clamp(1.9rem,4.5vw,2.35rem)] sm:tracking-[-0.04em] lg:text-[clamp(2rem,2.85vw,2.5rem)]">
              <Text field={fields['Heading Intro']} />
            </span>
            <br className="hidden" />
            <span className="mx-auto mt-[0.3em] block w-full max-w-[17ch] bg-gradient-to-r from-[#ff1f38] to-[#8629ff] bg-clip-text text-[clamp(2.4rem,10.5vw,3.1rem)] font-semibold leading-[1.04] tracking-[-0.045em] text-transparent [text-wrap:balance] sm:mt-[0.28em] sm:max-w-[17.5ch] sm:text-[clamp(2.7rem,6.6vw,3.75rem)] sm:leading-[1.02] lg:mt-[0.3em] lg:max-w-[18ch] lg:text-[clamp(3.2rem,5.2vw,5.2rem)] lg:leading-none lg:tracking-[-0.05em]">
              <Text field={fields['Heading Emphasis']} />
            </span>
          </h1>
          <p className="mx-auto mb-5 max-w-[29rem] text-base leading-[1.5] text-[#1e1c22] [text-wrap:pretty] sm:max-w-[680px] lg:mb-[1.4rem] lg:max-w-[860px] lg:text-[clamp(0.98rem,1.15vw,1.08rem)] lg:leading-[1.55]">
            <Text field={fields.Lead} />
          </p>
          <div className="flex flex-col items-center justify-center gap-2.5 sm:flex-row sm:flex-wrap sm:gap-3">
            <Link
              field={fields['Primary CTA']}
              className="group inline-flex min-h-10 items-center justify-between gap-2.5 rounded-full bg-gradient-to-r from-[#ff1f38] to-[#8629ff] px-5 py-2 text-base font-medium leading-6 text-white no-underline transition-[background-position,background-size,box-shadow] duration-500 hover:bg-[length:300%_100%] hover:bg-[position:100%_50%] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#c794ff] focus-visible:outline-offset-4 sm:text-[17px] sm:leading-6 lg:text-lg lg:leading-[27px]"
            >
              <Text field={fields['Primary CTA Label']} />
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                className="h-[1.375rem] w-[1.375rem] shrink-0 stroke-current"
              >
                <path
                  d="M4 10h11M11 6l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <Link
              field={fields['Secondary CTA']}
              className="inline-flex min-h-10 items-center justify-between gap-2.5 rounded-full border border-[#c1bdc7] bg-white px-5 py-2 text-base font-medium leading-6 text-[#1e1c22] no-underline transition-[background-color,border-color,color] duration-150 hover:border-[#8629ff] hover:bg-[#8629ff] hover:text-white focus-visible:border-[#8629ff] focus-visible:bg-[#8629ff] focus-visible:text-white focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#c794ff] focus-visible:outline-offset-4 sm:text-[17px] sm:leading-6 lg:text-lg lg:leading-[27px]"
            >
              <Text field={fields['Secondary CTA Label']} />
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                className="h-[1.375rem] w-[1.375rem] shrink-0 stroke-current"
              >
                <path
                  d="M4 10h11M11 6l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Default;
