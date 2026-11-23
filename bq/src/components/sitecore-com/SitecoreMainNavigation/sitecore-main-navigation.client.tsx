'use client';

import React, { JSX, useState } from 'react';
import { Image, Link, Text } from '@sitecore-content-sdk/nextjs';
import type { Fields } from './sitecore-main-navigation';

interface Category {
  text?: string;
}

interface Props {
  fields: Fields;
}

const iconStyle = (url: string): React.CSSProperties => ({
  WebkitMaskImage: `url(${url})`,
  maskImage: `url(${url})`,
  WebkitMaskPosition: 'center',
  maskPosition: 'center',
  WebkitMaskRepeat: 'no-repeat',
  maskRepeat: 'no-repeat',
  WebkitMaskSize: 'contain',
  maskSize: 'contain',
});

export default function SitecoreMainNavigationChrome({ fields }: Props): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const categories = (() => {
    try {
      const raw = fields.Categories?.value;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })() as Category[];

  const toggleCategory = (category: string) => {
    setExpandedCategory((current) => (current === category ? null : category));
  };

  return (
    <section
      id="header"
      className="relative z-[999999] flex h-16 w-full border-b border-[#e4e2e8] bg-white min-[1152px]:h-24 min-[1152px]:backdrop-blur-[5px] min-[1152px]:bg-white/90"
    >
      <div className="container mx-auto h-full max-[1919px]:w-full">
        <div className="mx-0 grid h-full grid-cols-12 px-[19px] min-[640px]:mx-[clamp(0rem,-3.3335rem+8.3338vw,2rem)] min-[640px]:px-[clamp(1.1875rem,-.1667rem+3.3854vw,2rem)] min-[1024px]:mx-[clamp(2rem,-.8571rem+4.4643vw,4.5rem)] min-[1024px]:px-[clamp(2rem,.8571rem+1.7857vw,3rem)] min-[1152px]:mx-0 min-[1152px]:px-0">
          <nav
            aria-label="Main navigation"
            className="col-span-12 flex h-full w-full items-center justify-between min-[1152px]:items-stretch"
          >
            <Link
              field={fields['Skip Link']}
              className="absolute left-2.5 top-[-180px] z-[9999999] bg-[#1e1c22] px-3 py-[5px] text-sm text-white focus:top-0"
            >
              <Text field={fields['Skip Label']} />
            </Link>
            <div className="flex items-center min-[1152px]:mr-14">
              <Link field={fields['Home Link']} aria-label="Sitecore home">
                <Image
                  field={fields.Logo}
                  className="h-7 w-auto max-w-none min-[640px]:h-8 min-[1152px]:h-[38px] max-[440px]:h-[30px] max-[389px]:h-[22px] max-[360px]:h-[19px]"
                />
              </Link>
            </div>
            <div className="ml-auto mr-4 min-[1152px]:hidden max-[440px]:mr-[9px] max-[389px]:mr-[7px] max-[360px]:mr-[5px] max-[321px]:hidden">
              <Link
                field={fields['Demo Link']}
                className="flex items-center justify-between rounded-full bg-[linear-gradient(90deg,#ff1f38_0%,#7c25df_100%)] px-5 py-2 text-lg font-medium text-white"
              >
                <Text field={fields['Demo Link Label']} />
                <span
                  aria-hidden="true"
                  className="ml-2 block h-[22px] w-[22px] bg-current"
                  style={iconStyle('https://www.sitecore.com/static/cta-arrow.svg')}
                />
              </Link>
            </div>
            <div className="flex h-full w-16 items-center justify-center border-l border-[#e4e2e8] min-[768px]:border-r min-[1152px]:hidden">
              <button
                type="button"
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((current) => !current)}
                className="p-3"
              >
                <Image
                  field={menuOpen ? fields['Close Icon'] : fields['Menu Icon']}
                  className="h-[25px] w-[25px]"
                />
              </button>
            </div>
            <div className="hidden w-full items-stretch justify-between min-[1152px]:flex">
              <ul className="flex items-stretch">
                {categories.map((category, index) => {
                  const label = category.text || '';
                  return (
                    <li
                      key={`${label}-${index}`}
                      className="mx-3 flex items-center min-[1152px]:max-[1449px]:mx-2"
                    >
                      <button
                        type="button"
                        aria-expanded={expandedCategory === label}
                        onClick={() => toggleCategory(label)}
                        className="flex h-full w-full items-center text-center text-lg font-[450] leading-[150%] hover:text-[#eb001a]"
                      >
                        {label}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-stretch">
                <Link
                  field={fields['Search Link']}
                  aria-label="Open Search"
                  className="flex items-center px-3"
                >
                  <span
                    aria-hidden="true"
                    className="block h-[25px] w-[25px] bg-[#1e1c22]"
                    style={iconStyle(
                      String(
                        fields['Search Icon']?.value?.src ||
                          'https://www.sitecore.com/static/magnifying.svg',
                      ),
                    )}
                  />
                </Link>
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded="false"
                  className="flex h-full items-center px-3 font-[450]"
                >
                  <Image field={fields['Language Icon']} className="mr-[5px] h-[27px] w-[27px]" />
                  <Text field={fields['Language Label']} />
                </button>
                <button
                  type="button"
                  aria-label="Open Sitecore sites listing"
                  aria-expanded="false"
                  className="flex h-full items-center px-3 font-[450]"
                >
                  <Text field={fields['Sites Label']} />
                </button>
                <div className="flex items-center pl-6 min-[1152px]:max-[1449px]:pl-2">
                  <Link
                    field={fields['Demo Link']}
                    className="flex items-center justify-between rounded-full bg-[linear-gradient(90deg,#ff1f38_0%,#7c25df_100%)] px-5 py-2 text-lg font-medium text-white"
                  >
                    <Text field={fields['Demo Link Label']} />
                    <span
                      aria-hidden="true"
                      className="ml-2 block h-[22px] w-[22px] bg-current"
                      style={iconStyle('https://www.sitecore.com/static/cta-arrow.svg')}
                    />
                  </Link>
                </div>
              </div>
            </div>
            <div
              className={`${menuOpen ? 'flex' : 'hidden'} absolute left-0 top-16 z-0 h-[calc(100vh-64px)] w-full flex-col items-start justify-between border-y border-[#e4e2e8] bg-white min-[1152px]:hidden`}
            >
              <div className="w-full">
                <ul className="flex w-full flex-col pt-0">
                  {categories.map((category, index) => {
                    const label = category.text || '';
                    return (
                      <li
                        key={`${label}-${index}`}
                        className={`flex items-center border-t border-[#e4e2e8] px-[19px] py-4 ${index === categories.length - 1 ? 'border-b' : ''}`}
                      >
                        <button
                          type="button"
                          aria-expanded={expandedCategory === label}
                          onClick={() => toggleCategory(label)}
                          className="relative block w-full text-left font-[450] text-[#1e1c22] after:absolute after:right-0 after:top-0 after:block after:h-[21px] after:w-[21px] after:bg-current after:content-['']"
                        >
                          {label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="mb-20 flex w-full flex-col items-center">
                <Link
                  field={fields['Search Link']}
                  className="flex w-full items-center border-t border-[#e4e2e8] px-[19px] py-4"
                >
                  <Image field={fields['Search Icon']} className="h-[25px] w-[25px]" />
                  <span className="ml-1">
                    <Text field={fields['Search Label']} />
                  </span>
                </Link>
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded="false"
                  className="flex w-full items-center border-t border-[#e4e2e8] px-[19px] py-4 font-[450]"
                >
                  <Image field={fields['Language Icon']} className="mr-[5px] h-[27px] w-[27px]" />
                  <Text field={fields['Language Label']} />
                </button>
                <button
                  type="button"
                  aria-label="Open Sitecore sites listing"
                  aria-expanded="false"
                  className="flex w-full items-center border-y border-[#e4e2e8] px-[19px] py-4 font-[450]"
                >
                  <Image field={fields['Sites Icon']} className="mr-[5px] h-[27px] w-[27px]" />
                  <Text field={fields['Sites Label']} />
                </button>
                <div className="w-full pt-8">
                  <Link
                    field={fields['Demo Link']}
                    className="flex w-full items-center justify-between rounded-none bg-[linear-gradient(90deg,#ff1f38_0%,#7c25df_100%)] px-[19px] py-4 text-base font-medium text-white"
                  >
                    <Text field={fields['Demo Link Label']} />
                  </Link>
                </div>
              </div>
            </div>
          </nav>
        </div>
      </div>
    </section>
  );
}
