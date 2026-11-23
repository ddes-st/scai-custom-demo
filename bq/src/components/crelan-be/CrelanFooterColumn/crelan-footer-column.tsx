import React, { JSX } from 'react';
import { Link, Text } from '@sitecore-content-sdk/nextjs';
import type { Field, LinkField } from '@sitecore-content-sdk/nextjs';
import { FaIcon } from 'components/icons/fa-icon';
import type { ComponentWithContextProps } from 'lib/component-props';
import Chrome from './crelan-footer-column.client';

interface Fields {
  Title: Field<string>;
  Links: Field<string>;
  'Social Links': Field<string>;
  'Card Stop Link': LinkField;
  'Show Preferences': Field<boolean>;
}

type Props = ComponentWithContextProps & { fields: Fields };

type FooterLinkRow = { text?: string; url?: string };
type SocialRow = { text?: string; url?: string; icon?: string };

const parseRows = <T,>(value: unknown): T[] => {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const Default = (props: Props): JSX.Element => {
  const { fields } = props;
  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  const links = parseRows<FooterLinkRow>(fields.Links?.value);
  const socials = parseRows<SocialRow>(fields['Social Links']?.value);
  const showPreferences =
    fields['Show Preferences']?.value === true || String(fields['Show Preferences']?.value) === '1';
  const cardStopHref = fields['Card Stop Link']?.value?.href;

  return (
    <section>
      <h2 className="mb-4 font-['CrelanSunset',sans-serif] text-[1.75rem] font-normal leading-[1.2] text-[#3c3c3c] min-[692px]:text-[2rem]">
        <Text field={fields.Title} />
      </h2>
      <ul className="m-0 list-none p-0">
        {links.map((link, index) => (
          <li key={index} className="m-0">
            <a
              href={link.url || '#'}
              className="group flex w-fit items-center gap-2 py-3 font-['CrelanSunset',sans-serif] text-sm leading-none text-[#3c3c3c] transition-colors duration-300 hover:text-[#00ae53] hover:underline"
            >
              <span>{link.text || ''}</span>
              <span
                aria-hidden="true"
                className="text-base leading-none text-[#3c3c3c] transition-colors group-hover:text-[#00ae53]"
              >
                →
              </span>
            </a>
          </li>
        ))}
        <Chrome showPreferences={showPreferences}>{null}</Chrome>
      </ul>
      {socials.length > 0 || cardStopHref ? (
        <ul className="mt-4 list-none space-y-0 p-0">
          {socials.map((social, index) => (
            <li key={index} className="m-0">
              <a
                href={social.url || '#'}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-2 py-[0.85rem] font-['CrelanSunset',sans-serif] text-sm leading-none text-[#3c3c3c] hover:text-[#00ae53] hover:underline"
              >
                {social.icon ? (
                  <FaIcon
                    name={social.icon.toLowerCase()}
                    faStyle="brands"
                    className="w-8 text-[2rem] text-[#6e6e6e]"
                  />
                ) : null}
                <span>{social.text || ''}</span>
                <span aria-hidden="true" className="text-base leading-none">
                  →
                </span>
              </a>
            </li>
          ))}
          {cardStopHref ? (
            <li className="m-0">
              <Link
                field={fields['Card Stop Link']}
                className="group flex items-center gap-2 py-[0.85rem] font-['CrelanSunset',sans-serif] text-sm leading-none text-[#3c3c3c] hover:text-[#00ae53] hover:underline"
              >
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#6e6e6e] text-[9px] font-bold text-[#6e6e6e]"
                >
                  CS
                </span>
                <span>Card Stop 078 170 170</span>
                <span aria-hidden="true" className="text-base leading-none">
                  →
                </span>
              </Link>
            </li>
          ) : null}
        </ul>
      ) : null}
    </section>
  );
};

export default Default;
