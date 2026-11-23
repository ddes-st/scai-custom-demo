/**
 * FROZEN REFERENCE — do not edit; add a new file if a new pattern is required.
 * Prompt text only — imports are the target pattern for generated src/components code; this file is not compiled.
 * Unstyled structure only. Codegen must take visual styling from capture evidence.
 * Type: Media block
 */

import React, { JSX } from 'react';
import {
  Field,
  ImageField,
  LinkField,
  Text,
  RichText,
  Image,
  Link,
} from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';

interface Fields {
  Title: Field<string>;
  Caption: Field<string>;
  Body: Field<string>;
  Media: ImageField;
  'Video URL': Field<string>;
  CTA: LinkField;
  'Prefer Video': Field<boolean>;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields } = props;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  const preferVideo =
    fields['Prefer Video']?.value === true ||
    String(fields['Prefer Video']?.value) === '1';
  const videoUrl = fields['Video URL']?.value;

  return (
    <figure>
      {preferVideo && videoUrl ? (
        <a href={String(videoUrl)}>
          <Text field={fields['Video URL']} />
        </a>
      ) : (
        <Image field={fields.Media} />
      )}
      <figcaption>
        <h2>
          <Text field={fields.Title} />
        </h2>
        <p>
          <Text field={fields.Caption} />
        </p>
        <RichText field={fields.Body} />
        <Link field={fields.CTA} />
      </figcaption>
    </figure>
  );
};
