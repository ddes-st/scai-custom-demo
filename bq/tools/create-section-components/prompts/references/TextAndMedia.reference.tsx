/**
 * FROZEN REFERENCE — do not edit; add a new file if a new pattern is required.
 * Prompt text only — imports are the target pattern for generated src/components code; this file is not compiled.
 * Unstyled structure only. Codegen must take visual styling from capture evidence.
 * Type: Text and media
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
  Heading: Field<string>;
  Body: Field<string>;
  Media: ImageField;
  CTA: LinkField;
  'Media On Right': Field<boolean>;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields } = props;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  const mediaOnRight =
    fields['Media On Right']?.value === true ||
    String(fields['Media On Right']?.value) === '1';

  const textBlock = (
    <div>
      <h2>
        <Text field={fields.Heading} />
      </h2>
      <RichText field={fields.Body} />
      <Link field={fields.CTA} />
    </div>
  );
  const mediaBlock = <Image field={fields.Media} />;

  return (
    <section>
      {mediaOnRight ? (
        <>
          {textBlock}
          {mediaBlock}
        </>
      ) : (
        <>
          {mediaBlock}
          {textBlock}
        </>
      )}
    </section>
  );
};
