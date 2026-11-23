/**
 * FROZEN REFERENCE — do not edit; add a new file if a new pattern is required.
 * Prompt text only — imports are the target pattern for generated src/components code; this file is not compiled.
 * Unstyled structure only. Codegen must take visual styling from capture evidence.
 * Type: Statistics
 */

import React, { JSX } from 'react';
import { Field, Text } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import { getDatasource } from 'lib/component-props';

interface StatFields {
  Value: Field<string>;
  Label: Field<string>;
  Suffix: Field<string>;
  Emphasized: Field<boolean>;
}

interface StatItem {
  id?: string;
  name?: string;
  fields: StatFields;
}

interface Fields {
  Heading: Field<string>;
  Intro: Field<string>;
  children?: { results?: StatItem[] };
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const datasource = getDatasource<Fields>(props.fields);

  if (!datasource) {
    return <div>Missing Component Datasource.</div>;
  }

  const stats = datasource.children?.results ?? [];

  return (
    <section>
      <h2>
        <Text field={datasource.Heading} />
      </h2>
      <p>
        <Text field={datasource.Intro} />
      </p>
      <ul>
        {stats.map((stat, index) => {
          const emphasized =
            stat.fields?.Emphasized?.value === true ||
            String(stat.fields?.Emphasized?.value) === '1';
          return (
            <li
              key={stat.id || stat.name || index}
              data-emphasized={emphasized ? 'true' : 'false'}
            >
              <strong>
                <Text field={stat.fields.Value} />
                <Text field={stat.fields.Suffix} />
              </strong>
              <span>
                <Text field={stat.fields.Label} />
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
