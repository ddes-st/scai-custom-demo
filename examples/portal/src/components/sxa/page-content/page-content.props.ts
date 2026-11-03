// Adapted from Sitecore's xmcloud-starter-js (examples/kit-nextjs-skate-park/src/components/page-content/page-content.props.ts),
// Apache License 2.0 — see ../LICENSE-xmcloud-starter-js.md.
import { RichTextField } from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';

export interface PageContentFields {
  Content?: RichTextField;
}

export type PageContentProps = ComponentProps & {
  fields?: PageContentFields;
};
