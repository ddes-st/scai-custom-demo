/**
 * FROZEN REFERENCE — do not edit; add a new file if a new pattern is required.
 * Prompt text only — imports are the target pattern for generated src/components code; this file is not compiled.
 * Unstyled structure only. Codegen must take visual styling from capture evidence.
 * Type: Card
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
  Title: Field<string>;
  Description: Field<string>;
  Image: ImageField;
  Link: LinkField;
  'Promo Label': Field<string>;
  Featured: Field<boolean>;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields } = props;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  const featured =
    fields.Featured?.value === true || String(fields.Featured?.value) === '1';

  return (
    <article>
      {featured ? (
        <span>
          <Text field={fields['Promo Label']} />
        </span>
      ) : null}
      <Image field={fields.Image} />
      <h3>
        <Text field={fields.Title} />
      </h3>
      <p>
        <Text field={fields.Description} />
      </p>
      <Link field={fields.Link} />
    </article>
  );
};
