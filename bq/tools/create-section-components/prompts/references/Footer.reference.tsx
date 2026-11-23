/**
 * FROZEN REFERENCE — do not edit; add a new file if a new pattern is required.
 * Prompt text only — imports are the target pattern for generated src/components code; this file is not compiled.
 * Unstyled structure only. Codegen must take visual styling from capture evidence.
 * Type: Footer
 *
 * Site links via placeholder columns, contact, and legal copy.
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
  AppPlaceholder,
} from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import componentMap from '.sitecore/component-map';

interface Fields {
  Logo: ImageField;
  Heading: Field<string>;
  'Legal Text': Field<string>;
  'Contact Link': LinkField;
  'Show Social': Field<boolean>;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields, rendering, page } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const phKey = params.DynamicPlaceholderId;
  const placeholderBase = 'footer-navigation';
  const phName = phKey ? `${placeholderBase}-${phKey}` : placeholderBase;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  const showSocial =
    fields['Show Social']?.value === true ||
    String(fields['Show Social']?.value) === '1';

  return (
    <footer>
      <Image field={fields.Logo} />
      <h2>
        <Text field={fields.Heading} />
      </h2>
      <AppPlaceholder
        name={phName}
        rendering={rendering}
        page={page}
        componentMap={componentMap}
      />
      <Link field={fields['Contact Link']} />
      <RichText field={fields['Legal Text']} />
      {showSocial ? <span>Social links</span> : null}
    </footer>
  );
};
