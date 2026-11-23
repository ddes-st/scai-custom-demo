import React, { JSX } from 'react';
import { Text } from '@sitecore-content-sdk/nextjs';
import type { Field } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';

interface Fields {
  Title: Field<string>;
  Links: Field<string>;
}
type Props = ComponentWithContextProps & { fields: Fields };

export const Default = ({ fields }: Props): JSX.Element => {
  let links: { text?: string; url?: string; tag?: string; external?: boolean }[] = [];
  try {
    const parsed = JSON.parse(fields.Links?.value || '[]');
    links = Array.isArray(parsed) ? parsed : [];
  } catch {}
  return (
    <div className="w-full sm:w-[40%] md:w-auto lg:flex-1">
      <h2 className="mb-2 text-[18px] font-normal leading-[1.56] sm:text-[21px]">
        <Text field={fields.Title} />
      </h2>
      <ul>
        {links.map((link, index) => (
          <li key={index} className="py-[2px] text-[14px] leading-6 sm:text-[15px]">
            <a
              href={link.url || '#'}
              target={link.external ? '_blank' : undefined}
              rel={link.external ? 'noopener noreferrer' : undefined}
              className="inline-flex items-center gap-2 font-light hover:underline hover:underline-offset-2"
            >
              <span>{link.text || ''}</span>
              {link.tag ? (
                <span className="font-black tracking-[.35px] text-[#2ebdff]">{link.tag}</span>
              ) : null}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Default;
