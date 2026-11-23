/**
 * FROZEN REFERENCE — do not edit; add a new file if a new pattern is required.
 * Prompt text only — imports are the target pattern for generated src/components code; this file is not compiled.
 * Unstyled structure only. Codegen must take visual styling from capture evidence.
 * Type: Embed
 */

import React, { JSX } from 'react';
import {
  Field,
  LinkField,
  Text,
  Link,
} from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';

interface Fields {
  Title: Field<string>;
  'Embed URL': Field<string>;
  'Embed Markup': Field<string>;
  Caption: Field<string>;
  'Fallback Link': LinkField;
  'Prefer Markup': Field<boolean>;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields } = props;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  const preferMarkup =
    fields['Prefer Markup']?.value === true ||
    String(fields['Prefer Markup']?.value) === '1';
  const embedUrl = String(fields['Embed URL']?.value || '');
  const markup = String(fields['Embed Markup']?.value || '');

  return (
    <section>
      <h2>
        <Text field={fields.Title} />
      </h2>
      {preferMarkup && markup ? (
        <div dangerouslySetInnerHTML={{ __html: markup }} />
      ) : embedUrl ? (
        <iframe title={String(fields.Title?.value || 'Embed')} src={embedUrl} />
      ) : (
        <Link field={fields['Fallback Link']} />
      )}
      <p>
        <Text field={fields.Caption} />
      </p>
    </section>
  );
};
