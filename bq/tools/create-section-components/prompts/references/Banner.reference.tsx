/**
 * FROZEN REFERENCE — do not edit; add a new file if a new pattern is required.
 * Prompt text only — imports are the target pattern for generated src/components code; this file is not compiled.
 * Unstyled structure only. Codegen must take visual styling from capture evidence.
 * Type: Banner
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
  Message: Field<string>;
  Icon: ImageField;
  CTA: LinkField;
  Visible: Field<boolean>;
  Dismissible: Field<boolean>;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields } = props;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  const visible =
    fields.Visible?.value === true || String(fields.Visible?.value) === '1';
  const dismissible =
    fields.Dismissible?.value === true ||
    String(fields.Dismissible?.value) === '1';

  if (!visible) {
    return <></>;
  }

  return (
    <aside role="status">
      <Image field={fields.Icon} />
      <h2>
        <Text field={fields.Title} />
      </h2>
      <p>
        <Text field={fields.Message} />
      </p>
      <Link field={fields.CTA} />
      {dismissible ? (
        <button type="button" aria-label="Dismiss">
          Dismiss
        </button>
      ) : null}
    </aside>
  );
};
