// Adapted from Sitecore's xmcloud-starter-js (examples/kit-nextjs-skate-park/src/components/rich-text/rich-text.props.ts),
// Apache License 2.0 — see ../LICENSE-xmcloud-starter-js.md.
import { Field } from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';

export interface RichTextFields {
  Text?: Field<string>;
}

export type RichTextProps = ComponentProps & {
  fields?: RichTextFields;
};
