import { Text, Image, Link } from '@sitecore-content-sdk/nextjs';
import type { ImageField, LinkField, TextField } from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';

interface Fields {
  Title?: TextField;
  Image?: ImageField;
  Link?: LinkField;
}

type Props = ComponentProps & { fields?: Fields };

export const Default = (props: Props) => {
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  return (
    <div
      key={renderingId || props.rendering?.uid || 'DomSecurityNewsTeaser'}
      id={renderingId || undefined}
      className="flex flex-col gap-2"
      data-component="DomSecurityNewsTeaser"
    >
      {props.fields?.Image ? (
        <Image field={props.fields.Image} className="h-24 w-auto object-contain" />
      ) : null}
      <Text field={props.fields?.Title} tag="h3" className="text-lg font-medium" />
      {props.fields?.Link ? (
        <Link
          field={props.fields.Link}
          className="inline-flex items-center text-sm font-semibold underline decoration-black/30 underline-offset-[0.3em]"
          showLinkTextWithChildrenPresent
        >
          <span aria-hidden="true" className="ml-4">→</span>
        </Link>
      ) : null}
    </div>
  );
};
