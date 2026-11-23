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
  const id = renderingId || props.rendering?.uid;
  return (
    <div key={id} id={renderingId || undefined} className="flex flex-col gap-2" data-component="PillarCardSliderItem">
      {props.fields?.Image && (
        <Image field={props.fields.Image} className="h-24 w-auto object-contain" />
      )}
      {props.fields?.Title && (
        <Text field={props.fields.Title} tag="h3" className="text-lg font-medium" />
      )}
      {props.fields?.Link && (
        <Link field={props.fields.Link} className="underline" />
      )}
    </div>
  );
};
