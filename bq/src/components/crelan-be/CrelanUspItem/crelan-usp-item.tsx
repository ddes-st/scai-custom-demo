import React, { JSX } from 'react';
import { Link, RichText, Text } from '@sitecore-content-sdk/nextjs';
import type { LinkField, RichTextField, Field } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';

interface Fields {
  Title: Field<string>;
  Body: RichTextField;
  Link: LinkField;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields } = props;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  return (
    <article className="relative flex min-h-[208px] flex-col items-center justify-center gap-2 rounded-lg bg-white px-6 py-10 text-center shadow-[0_0_20px_rgba(0,0,0,0.1)] transition hover:shadow-[0_0_35px_rgba(0,0,0,0.15)]">
      <h3 className="z-10 m-0 max-w-[210px] font-['CrelanSunset',sans-serif] text-xl font-medium leading-6 text-[#018741]">
        <Link
          field={fields.Link}
          className="after:absolute after:inset-0 after:z-0 hover:underline"
        >
          <Text field={fields.Title} />
        </Link>
      </h3>
      <div className="z-10 m-0 max-w-[210px] font-['CrelanSunset',sans-serif] text-base leading-6">
        <RichText field={fields.Body} />
      </div>
    </article>
  );
};
