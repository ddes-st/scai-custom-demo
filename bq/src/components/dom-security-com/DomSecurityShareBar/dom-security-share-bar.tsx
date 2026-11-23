import { Link, Text } from '@sitecore-content-sdk/nextjs';
import type { LinkField, TextField } from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';
import { FaIcon } from 'components/icons/fa-icon';
import { fieldHasValue, preferField, routeFields } from '../news/page-fields.util';

interface Fields {
  Label: TextField;
  LinkedIn: LinkField;
  Twitter: LinkField;
  Facebook: LinkField;
  Email: LinkField;
  Title?: TextField;
  'Page Url'?: TextField;
  Summary?: TextField;
}

function shareLink(href: string, text: string): LinkField {
  return { value: { href, text, target: href.startsWith('mailto:') ? undefined : '_blank' } };
}

type DomSecurityShareBarProps = ComponentProps & {
  fields: Fields;
  page?: { layout?: Parameters<typeof routeFields>[0] };
};

export const Default = (props: DomSecurityShareBarProps) => {
  const route = routeFields(props.page?.layout);
  const fields = props.fields || ({} as Fields);
  const label = preferField(fields.Label, route.Label as TextField | undefined);
  const pageUrl = String(
    preferField(fields['Page Url'], route['Page Url'] as TextField | undefined)?.value || '',
  );
  const title = String(preferField(fields.Title, route.Title as TextField | undefined)?.value || '');
  const summary = String(
    preferField(fields.Summary, route.Summary as TextField | undefined)?.value || '',
  );
  const encodedUrl = encodeURIComponent(pageUrl);
  const encodedTitle = encodeURIComponent(title);
  const encodedSummary = encodeURIComponent(summary);
  const linkedIn = fieldHasValue(fields.LinkedIn)
    ? fields.LinkedIn
    : pageUrl
      ? shareLink(
          `https://www.linkedin.com/shareArticle?url=${encodedUrl}&title=${encodedTitle}&summary=${encodedSummary}&`,
          'share to linkedin',
        )
      : fields.LinkedIn;
  const twitter = fieldHasValue(fields.Twitter)
    ? fields.Twitter
    : pageUrl
      ? shareLink(`http://twitter.com/intent/tweet?url=${encodedUrl}`, 'share to twitter')
      : fields.Twitter;
  const facebook = fieldHasValue(fields.Facebook)
    ? fields.Facebook
    : pageUrl
      ? shareLink(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, 'share to facebook')
      : fields.Facebook;
  const email = fieldHasValue(fields.Email)
    ? fields.Email
    : pageUrl
      ? shareLink(
          `mailto:?subject=${encodedTitle}&body=${encodedSummary}`,
          'share to mail',
        )
      : fields.Email;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="w-full bg-white px-[15px] py-8 font-[Source_Sans_Pro] font-light text-[18px] leading-[1.43] text-black"
    >
      <div className="mx-auto w-full max-w-[1170px] bg-[#e3e3e3] px-8 py-4 text-left text-base leading-normal text-black">
        <Text field={label} tag="span" />
        <div className="ml-4 inline-flex items-center gap-4 align-middle">
          {linkedIn ? (
            <Link field={linkedIn} target="_blank" aria-label="share to linkedin" className="inline-flex min-w-4 items-center justify-center text-black no-underline hover:text-black">
              <FaIcon name="linkedin" faStyle="brands" className="!static !inset-auto !m-0 inline-block h-[1em] w-[1em]" />
            </Link>
          ) : null}
          {twitter ? (
            <Link field={twitter} target="_blank" aria-label="share to twitter" className="inline-flex min-w-4 items-center justify-center text-black no-underline hover:text-black">
              <FaIcon name="twitter" faStyle="brands" className="!static !inset-auto !m-0 inline-block h-[1em] w-[1em]" />
            </Link>
          ) : null}
          {facebook ? (
            <Link field={facebook} target="_blank" aria-label="share to facebook" className="inline-flex min-w-4 items-center justify-center text-black no-underline hover:text-black">
              <FaIcon name="facebook" faStyle="brands" className="!static !inset-auto !m-0 inline-block h-[1em] w-[1em]" />
            </Link>
          ) : null}
          {email ? (
            <Link field={email} aria-label="share to mail" className="inline-flex min-w-4 items-center justify-center text-black no-underline hover:text-black">
              <FaIcon name="envelope" faStyle="solid" className="!static !inset-auto !m-0 inline-block h-[1em] w-[1em]" />
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
};
