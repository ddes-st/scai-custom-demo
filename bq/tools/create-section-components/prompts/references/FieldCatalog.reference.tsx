/**
 * FROZEN REFERENCE — do not edit; add a new file if a new pattern is required.
 * Prompt text only — imports are the target pattern for generated src/components code; this file is not compiled.
 * Unstyled structure only. Codegen must take visual styling from capture evidence.
 * Type: FieldCatalog (universal field + placeholder primer)
 *
 * BQ allowlist field types demonstrated:
 * Single-Line Text, Multi-Line Text, Rich Text, Image, General Link, Checkbox
 * → Field<string> | Field<boolean> | ImageField | LinkField
 *
 * NEVER import or declare CheckboxField — use Field<boolean> inline.
 */

import React, { JSX } from 'react';
import { Text, RichText, Image, Link, AppPlaceholder } from '@sitecore-content-sdk/nextjs';
import type { Field, ImageField, LinkField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import componentMap from '.sitecore/component-map';

interface Fields {
  Heading: Field<string>;
  'Supporting Text': Field<string>;
  Body: Field<string>;
  'Hero Media': ImageField;
  'Primary CTA': LinkField;
  'Feature Enabled': Field<boolean>;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields, rendering, page } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const phKey = params.DynamicPlaceholderId;
  const placeholderBase = 'content-sections';
  const phName = phKey ? `${placeholderBase}-${phKey}` : placeholderBase;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  const isFeatureActive =
    fields['Feature Enabled']?.value === true ||
    String(fields['Feature Enabled']?.value) === '1';

  return (
    <section>
      {isFeatureActive ? <span>Feature active</span> : null}

      <h2>
        <Text field={fields.Heading} />
      </h2>
      <p>
        <Text field={fields['Supporting Text']} />
      </p>
      <RichText field={fields.Body} />
      <Image field={fields['Hero Media']} />
      <Link field={fields['Primary CTA']} />

      <AppPlaceholder
        name={phName}
        rendering={rendering}
        page={page}
        componentMap={componentMap}
      />
    </section>
  );
};
