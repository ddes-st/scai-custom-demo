import React, { JSX } from 'react';
import { Image, Link, Text } from '@sitecore-content-sdk/nextjs';
import type { Field, ImageField, LinkField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';

interface Fields {
  Icon: ImageField;
  Title: Field<string>;
  CTA: Field<string>;
  Link: LinkField;
  External: Field<boolean>;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = ({ fields }: Props): JSX.Element => {
  const external = fields.External?.value === true || String(fields.External?.value) === '1';
  return (
    <Link
      field={fields.Link}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="group flex items-center border-t border-white/35 py-4 first:border-0"
    >
      <Image
        field={fields.Icon}
        className="mr-6 h-[42px] w-[42px] object-contain transition duration-300 group-hover:rotate-[-5deg] group-hover:scale-125 group-hover:mr-7"
      />
      <span className="flex w-full flex-col justify-between xl:flex-row xl:items-center">
        <strong className="text-[18px] font-normal leading-[1.56] sm:text-[21px]">
          <Text field={fields.Title} />
        </strong>
        <span className="mt-0 text-[14px] leading-[1.72] sm:text-[15px] group-hover:underline group-hover:underline-offset-2">
          <Text field={fields.CTA} />
          <span className="ml-2 text-[20px]">→</span>
        </span>
      </span>
    </Link>
  );
};

export default Default;
