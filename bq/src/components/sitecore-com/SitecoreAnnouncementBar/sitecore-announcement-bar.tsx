import React, { JSX } from 'react';
import { Link, Text } from '@sitecore-content-sdk/nextjs';
import type { Field, LinkField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';

interface Fields {
  'Announcement Prefix': Field<string>;
  'CTA Label': Field<string>;
  CTA: LinkField;
  'Announcement Suffix': Field<string>;
}

type Props = ComponentWithContextProps & { fields: Fields };

const AnnouncementMessage = ({
  fields,
  hidden = false,
}: {
  fields: Fields;
  hidden?: boolean;
}): JSX.Element => (
  <span
    aria-hidden={hidden || undefined}
    className="inline-flex shrink-0 items-center whitespace-nowrap pr-8 text-[15px] font-medium leading-[150%] text-white"
  >
    <Text field={fields['Announcement Prefix']} />
    <Link
      field={fields.CTA}
      target="_blank"
      rel="noopener"
      className="inline-flex items-center whitespace-nowrap font-extrabold leading-[150%] text-white underline decoration-1 underline-offset-2 transition-colors"
    >
      <Text field={fields['CTA Label']} />
    </Link>
    <Text field={fields['Announcement Suffix']} />
  </span>
);

export const Default = (props: Props): JSX.Element => {
  const { fields } = props;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  return (
    <>
      <style>{`
        @keyframes sitecoreAnnouncementTicker {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (max-width: 950px) {
          .sitecore-announcement-rail {
            animation: sitecoreAnnouncementTicker 24s linear infinite;
          }
        }
        @media (min-width: 951px) {
          .sitecore-announcement-copy {
            display: none;
          }
        }
      `}</style>
      <div
        aria-label="Announcement bar"
        className="fixed left-0 top-0 z-[1000001] flex h-[34px] w-full items-center justify-center overflow-hidden border-b border-[#e4e2e8] bg-[#8629ff] text-white min-[1152px]:h-[38px]"
      >
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#ff1f38] to-[#8629ff]" />
        <div className="flex min-w-0 w-full items-center justify-start px-3 md:px-4 lg:justify-center">
          <div className="flex min-w-0 w-full justify-start overflow-hidden lg:justify-center">
            <div className="sitecore-announcement-rail inline-flex w-max min-w-max items-center md:ml-0 lg:mx-auto">
              <div className="inline-flex shrink-0 items-center justify-start whitespace-nowrap lg:justify-center lg:pr-0">
                <AnnouncementMessage fields={fields} />
              </div>
              <div className="sitecore-announcement-copy inline-flex shrink-0 items-center justify-start whitespace-nowrap lg:justify-center">
                <AnnouncementMessage fields={fields} hidden />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Default;
