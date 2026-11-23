/**
 * FROZEN REFERENCE — do not edit; add a new file if a new pattern is required.
 * Prompt text only — imports are the target pattern for generated src/components code; this file is not compiled.
 * Unstyled structure only. Codegen must take visual styling from capture evidence.
 * Type: Steps / process
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
import { getDatasource } from 'lib/component-props';

interface StepFields {
  Title: Field<string>;
  Description: Field<string>;
  Icon: ImageField;
  Link: LinkField;
}

interface StepItem {
  id?: string;
  name?: string;
  fields: StepFields;
}

interface Fields {
  Heading: Field<string>;
  Intro: Field<string>;
  Numbered: Field<boolean>;
  children?: { results?: StepItem[] };
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const datasource = getDatasource<Fields>(props.fields);

  if (!datasource) {
    return <div>Missing Component Datasource.</div>;
  }

  const numbered =
    datasource.Numbered?.value === true ||
    String(datasource.Numbered?.value) === '1';
  const steps = datasource.children?.results ?? [];
  const ListTag = numbered ? 'ol' : 'ul';

  return (
    <section>
      <h2>
        <Text field={datasource.Heading} />
      </h2>
      <p>
        <Text field={datasource.Intro} />
      </p>
      <ListTag>
        {steps.map((step, index) => (
          <li key={step.id || step.name || index}>
            <Image field={step.fields.Icon} />
            <h3>
              <Text field={step.fields.Title} />
            </h3>
            <p>
              <Text field={step.fields.Description} />
            </p>
            <Link field={step.fields.Link} />
          </li>
        ))}
      </ListTag>
    </section>
  );
};
