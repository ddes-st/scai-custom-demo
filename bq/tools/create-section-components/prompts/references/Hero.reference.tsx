/**
 * FROZEN REFERENCE — do not edit; add a new file if a new pattern is required.
 * Prompt text only — imports are the target pattern for generated src/components code; this file is not compiled.
 * Unstyled structure only. Codegen must take visual styling from capture evidence.
 * Type: Hero
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
  Eyebrow: Field<string>;
  Body: Field<string>;
  'Background Image': ImageField;
  'Primary CTA': LinkField;
  'Secondary CTA': LinkField;
  'Show Overlay': Field<boolean>;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields } = props;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  const showOverlay =
    fields['Show Overlay']?.value === true ||
    String(fields['Show Overlay']?.value) === '1';

  return (
    <section>
      <Image field={fields['Background Image']} />
      {showOverlay ? <div /> : null}
      <p>
        <Text field={fields.Eyebrow} />
      </p>
      <h1>
        <Text field={fields.Heading} />
      </h1>
      <RichText field={fields.Body} />
      <Link field={fields['Primary CTA']} />
      <Link field={fields['Secondary CTA']} />
    </section>
  );
};
