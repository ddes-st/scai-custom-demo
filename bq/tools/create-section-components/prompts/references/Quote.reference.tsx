/**
 * FROZEN REFERENCE — do not edit; add a new file if a new pattern is required.
 * Prompt text only — imports are the target pattern for generated src/components code; this file is not compiled.
 * Unstyled structure only. Codegen must take visual styling from capture evidence.
 * Type: Quote / testimonial
 */

import React, { JSX } from 'react';
import {
  Field,
  ImageField,
  LinkField,
  Text,
  Image,
  Link,
} from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';

interface Fields {
  Quote: Field<string>;
  Attribution: Field<string>;
  Role: Field<string>;
  Portrait: ImageField;
  'Profile Link': LinkField;
  'Show Portrait': Field<boolean>;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields } = props;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  const showPortrait =
    fields['Show Portrait']?.value === true ||
    String(fields['Show Portrait']?.value) === '1';

  return (
    <blockquote>
      <p>
        <Text field={fields.Quote} />
      </p>
      <footer>
        {showPortrait ? <Image field={fields.Portrait} /> : null}
        <cite>
          <Text field={fields.Attribution} />
        </cite>
        <span>
          <Text field={fields.Role} />
        </span>
        <Link field={fields['Profile Link']} />
      </footer>
    </blockquote>
  );
};
