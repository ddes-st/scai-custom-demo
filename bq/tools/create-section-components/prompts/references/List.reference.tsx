/**
 * FROZEN REFERENCE — do not edit; add a new file if a new pattern is required.
 * Prompt text only — imports are the target pattern for generated src/components code; this file is not compiled.
 * Unstyled structure only. Codegen must take visual styling from capture evidence.
 * Type: List
 *
 * Repeating rows via getDatasource → children.results (childItemTemplate), not AppPlaceholder.
 */

import React, { JSX } from 'react';
import {
  Field,
  LinkField,
  Text,
  Link,
} from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import { getDatasource } from 'lib/component-props';

interface ListItemFields {
  Title: Field<string>;
  Description: Field<string>;
  Link: LinkField;
  Enabled: Field<boolean>;
}

interface ListItem {
  id?: string;
  name?: string;
  fields: ListItemFields;
}

interface Fields {
  Heading: Field<string>;
  Intro: Field<string>;
  Ordered: Field<boolean>;
  children?: { results?: ListItem[] };
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const datasource = getDatasource<Fields>(props.fields);
  if (!datasource) {
    return <div>Missing Component Datasource.</div>;
  }

  const ordered =
    datasource.Ordered?.value === true ||
    String(datasource.Ordered?.value) === '1';
  const items = datasource.children?.results ?? [];
  const ListTag = ordered ? 'ol' : 'ul';

  return (
    <section>
      <h2>
        <Text field={datasource.Heading} />
      </h2>
      <p>
        <Text field={datasource.Intro} />
      </p>
      <ListTag>
        {items.map((item, index) => {
          const enabled =
            item.fields?.Enabled?.value === true ||
            String(item.fields?.Enabled?.value) === '1';
          if (!enabled && item.fields?.Enabled) {
            return null;
          }
          return (
            <li key={item.id || item.name || index}>
              <h3>
                <Text field={item.fields.Title} />
              </h3>
              <p>
                <Text field={item.fields.Description} />
              </p>
              <Link field={item.fields.Link} />
            </li>
          );
        })}
      </ListTag>
    </section>
  );
};
