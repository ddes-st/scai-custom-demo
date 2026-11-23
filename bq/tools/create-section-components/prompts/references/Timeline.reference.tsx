/**
 * FROZEN REFERENCE — do not edit; add a new file if a new pattern is required.
 * Prompt text only — imports are the target pattern for generated src/components code; this file is not compiled.
 * Unstyled structure only. Codegen must take visual styling from capture evidence.
 * Type: Timeline
 */

import React, { JSX } from 'react';
import {
  Field,
  ImageField,
  Text,
  RichText,
  Image,
} from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import { getDatasource } from 'lib/component-props';

interface MilestoneFields {
  Title: Field<string>;
  Date: Field<string>;
  Body: Field<string>;
  Image: ImageField;
  Current: Field<boolean>;
}

interface Milestone {
  id?: string;
  name?: string;
  fields: MilestoneFields;
}

interface Fields {
  Heading: Field<string>;
  Intro: Field<string>;
  children?: { results?: Milestone[] };
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const datasource = getDatasource<Fields>(props.fields);

  if (!datasource) {
    return <div>Missing Component Datasource.</div>;
  }

  const milestones = datasource.children?.results ?? [];

  return (
    <section>
      <h2>
        <Text field={datasource.Heading} />
      </h2>
      <p>
        <Text field={datasource.Intro} />
      </p>
      <ol>
        {milestones.map((item, index) => {
          const current =
            item.fields?.Current?.value === true ||
            String(item.fields?.Current?.value) === '1';
          return (
            <li
              key={item.id || item.name || index}
              data-current={current ? 'true' : 'false'}
            >
              <time>
                <Text field={item.fields.Date} />
              </time>
              <h3>
                <Text field={item.fields.Title} />
              </h3>
              <Image field={item.fields.Image} />
              <RichText field={item.fields.Body} />
            </li>
          );
        })}
      </ol>
    </section>
  );
};
