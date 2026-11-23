/**
 * FROZEN REFERENCE — do not edit; add a new file if a new pattern is required.
 * Prompt text only — imports are the target pattern for generated src/components code; this file is not compiled.
 * Unstyled structure only. Codegen must take visual styling from capture evidence.
 * Type: Comparison
 */

import React, { JSX } from 'react';
import {
  Field,
  LinkField,
  Text,
  Link,
  AppPlaceholder,
} from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import componentMap from '.sitecore/component-map';

interface Fields {
  Heading: Field<string>;
  Intro: Field<string>;
  'Primary CTA': LinkField;
  'Highlight Middle': Field<boolean>;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields, rendering, page } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const phKey = params.DynamicPlaceholderId;
  const placeholderBase = 'comparison-columns';
  const phName = phKey ? `${placeholderBase}-${phKey}` : placeholderBase;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  const highlightMiddle =
    fields['Highlight Middle']?.value === true ||
    String(fields['Highlight Middle']?.value) === '1';

  return (
    <section data-highlight-middle={highlightMiddle ? 'true' : 'false'}>
      <h2>
        <Text field={fields.Heading} />
      </h2>
      <p>
        <Text field={fields.Intro} />
      </p>
      <div>
        <AppPlaceholder
          name={phName}
          rendering={rendering}
          page={page}
          componentMap={componentMap}
        />
      </div>
      <Link field={fields['Primary CTA']} />
    </section>
  );
};
