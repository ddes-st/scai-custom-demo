/**
 * FROZEN REFERENCE — do not edit; add a new file if a new pattern is required.
 * Prompt text only — imports are the target pattern for generated src/components code; this file is not compiled.
 * Unstyled structure only. Codegen must take visual styling from capture evidence.
 * Type: Gallery
 */

import React, { JSX } from 'react';
import {
  Field,
  ImageField,
  Text,
  Image,
} from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import { getDatasource } from 'lib/component-props';

interface GalleryItemFields {
  Image: ImageField;
  Caption: Field<string>;
}

interface GalleryItem {
  id?: string;
  name?: string;
  fields: GalleryItemFields;
}

interface Fields {
  Heading: Field<string>;
  Intro: Field<string>;
  'Show Captions': Field<boolean>;
  children?: { results?: GalleryItem[] };
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const datasource = getDatasource<Fields>(props.fields);

  if (!datasource) {
    return <div>Missing Component Datasource.</div>;
  }

  const showCaptions =
    datasource['Show Captions']?.value === true ||
    String(datasource['Show Captions']?.value) === '1';
  const items = datasource.children?.results ?? [];

  return (
    <section>
      <h2>
        <Text field={datasource.Heading} />
      </h2>
      <p>
        <Text field={datasource.Intro} />
      </p>
      <ul>
        {items.map((item, index) => (
          <li key={item.id || item.name || index}>
            <Image field={item.fields.Image} />
            {showCaptions ? (
              <p>
                <Text field={item.fields.Caption} />
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
};
