// Adapted from Sitecore's xmcloud-starter-js (examples/kit-nextjs-skate-park/src/components/page-content/PageContent.tsx),
// Apache License 2.0 — see ../LICENSE-xmcloud-starter-js.md.
// Changes: no JSON-LD (structured data) output.
import React, { JSX } from 'react';
import {
  RichText as ContentSdkRichText,
  RichTextField,
} from '@sitecore-content-sdk/nextjs';
import { PageContentProps } from './page-content.props';

export const Default = ({ params, fields, page }: PageContentProps): JSX.Element => {
  const { styles, RenderingIdentifier: id } = params;

  const field = fields?.Content ?? (page.layout.sitecore.route?.fields?.Content as RichTextField);

  return (
    <article className={`component content ${styles}`} id={id}>
      <div className="component-content">
        <div className="field-content">
          {field ? <ContentSdkRichText field={field} /> : '[Content]'}
        </div>
      </div>
    </article>
  );
};
