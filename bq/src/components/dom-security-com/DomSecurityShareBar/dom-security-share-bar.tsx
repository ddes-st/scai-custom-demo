import { Link, Text } from '@sitecore-content-sdk/nextjs';
import type { LinkField, TextField } from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';
import { FaIcon } from 'components/icons/fa-icon';

interface Fields {
  Label: TextField;
  LinkedIn: LinkField;
  Twitter: LinkField;
  Facebook: LinkField;
  Email: LinkField;
}

type DomSecurityShareBarProps = ComponentProps & { fields: Fields };

export const Default = (props: DomSecurityShareBarProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="mx-auto w-full max-w-[1170px] px-[15px] font-[Source_Sans_Pro] font-light text-[18px] leading-[1.43] text-black"
    >
      <div className="my-8 bg-[#e3e3e3] px-8 py-4 text-left text-base leading-normal text-black">
        <Text field={fields.Label} tag="span" />
        <div className="ml-4 inline-flex items-center gap-4 align-middle">
          <Link field={fields.LinkedIn} target="_blank" aria-label="share to linkedin" className="inline-flex min-w-4 items-center justify-center text-black no-underline hover:text-black">
            <FaIcon name="linkedin" faStyle="brands" className="!static !inset-auto !m-0 inline-block h-[1em] w-[1em]" />
          </Link>
          <Link field={fields.Twitter} target="_blank" aria-label="share to twitter" className="inline-flex min-w-4 items-center justify-center text-black no-underline hover:text-black">
            <FaIcon name="twitter" faStyle="brands" className="!static !inset-auto !m-0 inline-block h-[1em] w-[1em]" />
          </Link>
          <Link field={fields.Facebook} target="_blank" aria-label="share to facebook" className="inline-flex min-w-4 items-center justify-center text-black no-underline hover:text-black">
            <FaIcon name="facebook" faStyle="brands" className="!static !inset-auto !m-0 inline-block h-[1em] w-[1em]" />
          </Link>
          <Link field={fields.Email} aria-label="share to mail" className="inline-flex min-w-4 items-center justify-center text-black no-underline hover:text-black">
            <FaIcon name="envelope" faStyle="solid" className="!static !inset-auto !m-0 inline-block h-[1em] w-[1em]" />
          </Link>
        </div>
      </div>
    </section>
  );
};
