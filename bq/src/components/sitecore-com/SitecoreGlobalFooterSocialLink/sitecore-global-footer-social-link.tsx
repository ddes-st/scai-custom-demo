import React, { JSX } from 'react';
import { Image, Link } from '@sitecore-content-sdk/nextjs';
import type { Field, ImageField, LinkField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';

interface Fields {
  Icon: ImageField;
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
      className="flex items-center p-2 invert"
    >
      <Image
        field={fields.Icon}
        className="h-6 w-6 object-contain transition duration-300 hover:rotate-[-5deg] hover:scale-125"
      />
    </Link>
  );
};

export default Default;
