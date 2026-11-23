import { Image, Link, Text } from '@sitecore-content-sdk/nextjs';
import type { ImageField, LinkField, TextField } from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';

interface Fields {
  Title: TextField;
  Image: ImageField;
  Link: LinkField;
  "Promo Label": TextField;
  "Promo Link": LinkField;
}

type InsuranceCategoryCardsItemProps = ComponentProps & { fields: Fields };

const cardShell =
  'relative flex w-full max-w-[255px] shrink-0 rounded-[8px] border border-[rgba(0,0,143,0.32)] bg-white text-[#20212c] transition-colors hover:border-[#00008f] hover:bg-[#f8faff]';

const linkShell =
  'flex min-h-[216px] w-full flex-col items-center justify-between rounded-[6px] p-6 text-center no-underline max-md:min-h-[160px] max-md:p-4';

const titleClass =
  'w-full break-words font-[Source_Sans_Pro] text-[24px] font-semibold leading-8 max-md:text-[20px] max-md:leading-6';

/** Standard image + title — no ribbon, no ↓. */
export const Default = (props: InsuranceCategoryCardsItemProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <article
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className={cardShell}
    >
      <Link field={fields.Link} className={linkShell} showLinkTextWithChildrenPresent>
        <Image
          field={fields.Image}
          className="h-[100px] w-[100px] object-contain max-md:h-[75px] max-md:w-[75px]"
        />
        <Text field={fields.Title} tag="span" className={titleClass} />
      </Link>
    </article>
  );
};

/** Image + title + red promo ribbon (Promo Label / Promo Link only here). */
export const Promo = (props: InsuranceCategoryCardsItemProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const promoLink = fields['Promo Link'] || fields.Link;

  return (
    <article
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className={cardShell}
    >
      <Link field={fields.Link} className={linkShell} showLinkTextWithChildrenPresent>
        <Image
          field={fields.Image}
          className="h-[100px] w-[100px] object-contain max-md:h-[75px] max-md:w-[75px]"
        />
        <Text field={fields.Title} tag="span" className={titleClass} />
      </Link>
      <Link
        field={promoLink}
        className="absolute left-[-10px] top-0 z-[2] inline-flex max-w-full -translate-y-1/2 items-center rounded-[4px] bg-[#ec000a] px-2 py-1 text-[14px] font-semibold leading-5 text-white no-underline"
        showLinkTextWithChildrenPresent
      >
        <Text field={fields['Promo Label']} tag="span" />
        <span className="ml-2 text-[16px] leading-4" aria-hidden="true">
          →
        </span>
      </Link>
    </article>
  );
};

/** Title + ↓ teaser — no Image, no ribbon. */
export const Teaser = (props: InsuranceCategoryCardsItemProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <article
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className={`${cardShell} imgcard--teaser`}
    >
      <Link
        field={fields.Link}
        className={`${linkShell} justify-center`}
        showLinkTextWithChildrenPresent
      >
        <Text field={fields.Title} tag="span" className={`${titleClass} max-w-[190px]`} />
        <span className="mt-4 text-[28px] leading-6 text-[#00008f]" aria-hidden="true">
          ↓
        </span>
      </Link>
    </article>
  );
};
