/**
 * FROZEN REFERENCE — do not edit; add a new file if a new pattern is required.
 * Prompt text only — imports are the target pattern for generated src/components code; this file is not compiled.
 * Unstyled structure only. Codegen must take visual styling from capture evidence.
 * Type: Content section
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
  Intro: Field<string>;
  Body: Field<string>;
  Media: ImageField;
  CTA: LinkField;
  'Media First': Field<boolean>;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields } = props;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  const mediaFirst =
    fields['Media First']?.value === true ||
    String(fields['Media First']?.value) === '1';

  const media = <Image field={fields.Media} />;
  const copy = (
    <>
      <h2>
        <Text field={fields.Heading} />
      </h2>
      <p>
        <Text field={fields.Intro} />
      </p>
      <RichText field={fields.Body} />
      <Link field={fields.CTA} />
    </>
  );

  return (
    <section>
      {mediaFirst ? (
        <>
          {media}
          {copy}
        </>
      ) : (
        <>
          {copy}
          {media}
        </>
      )}
    </section>
  );
};
