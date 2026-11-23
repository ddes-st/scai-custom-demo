/**
 * FROZEN REFERENCE — do not edit; add a new file if a new pattern is required.
 * Prompt text only — imports are the target pattern for generated src/components code; this file is not compiled.
 * Unstyled structure only. Codegen must take visual styling from capture evidence.
 * Type: Table
 */

import React, { JSX } from 'react';
import { Field, Text } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import { getDatasource } from 'lib/component-props';

interface TableCellFields {
  'Column One': Field<string>;
  'Column Two': Field<string>;
  'Column Three': Field<string>;
  Highlight: Field<boolean>;
}

interface TableRow {
  id?: string;
  name?: string;
  fields: TableCellFields;
}

interface Fields {
  Heading: Field<string>;
  Caption: Field<string>;
  'Header One': Field<string>;
  'Header Two': Field<string>;
  'Header Three': Field<string>;
  children?: { results?: TableRow[] };
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const datasource = getDatasource<Fields>(props.fields);

  if (!datasource) {
    return <div>Missing Component Datasource.</div>;
  }

  const rows = datasource.children?.results ?? [];

  return (
    <section>
      <h2>
        <Text field={datasource.Heading} />
      </h2>
      <table>
        <caption>
          <Text field={datasource.Caption} />
        </caption>
        <thead>
          <tr>
            <th>
              <Text field={datasource['Header One']} />
            </th>
            <th>
              <Text field={datasource['Header Two']} />
            </th>
            <th>
              <Text field={datasource['Header Three']} />
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const highlight =
              row.fields?.Highlight?.value === true ||
              String(row.fields?.Highlight?.value) === '1';
            return (
              <tr
                key={row.id || row.name || index}
                data-highlight={highlight ? 'true' : 'false'}
              >
                <td>
                  <Text field={row.fields['Column One']} />
                </td>
                <td>
                  <Text field={row.fields['Column Two']} />
                </td>
                <td>
                  <Text field={row.fields['Column Three']} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
};
