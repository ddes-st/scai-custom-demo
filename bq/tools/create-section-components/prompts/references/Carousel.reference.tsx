/**
 * FROZEN REFERENCE — do not edit; add a new file if a new pattern is required.
 * Prompt text only — imports are the target pattern for generated src/components code; this file is not compiled.
 * Unstyled structure only. Codegen must take visual styling from capture evidence.
 * Type: Carousel / scrolling rail
 *
 * Parent chrome + placeholder for slide/card children. Client interactivity is
 * structural only (prev/next controls) — no presentational styling.
 */

'use client';

import React, { JSX, useState } from 'react';
import { Field, Text, AppPlaceholder } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import componentMap from '.sitecore/component-map';

interface Fields {
  Heading: Field<string>;
  'Auto Play': Field<boolean>;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields, rendering, page } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const phKey = params.DynamicPlaceholderId;
  const placeholderBase = 'carousel-slides';
  const phName = phKey ? `${placeholderBase}-${phKey}` : placeholderBase;
  const [index, setIndex] = useState(0);

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  const autoPlay =
    fields['Auto Play']?.value === true ||
    String(fields['Auto Play']?.value) === '1';

  return (
    <section data-auto-play={autoPlay ? 'true' : 'false'} data-slide={index}>
      <h2>
        <Text field={fields.Heading} />
      </h2>
      <button type="button" aria-label="Previous" onClick={() => setIndex((i) => Math.max(0, i - 1))}>
        Previous
      </button>
      <div>
        <AppPlaceholder
          name={phName}
          rendering={rendering}
          page={page}
          componentMap={componentMap}
        />
      </div>
      <button type="button" aria-label="Next" onClick={() => setIndex((i) => i + 1)}>
        Next
      </button>
    </section>
  );
};
