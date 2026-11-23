/**
 * FROZEN REFERENCE — do not edit; add a new file if a new pattern is required.
 * Prompt text only — imports are the target pattern for generated src/components code; this file is not compiled.
 * Unstyled structure only. Codegen must take visual styling from capture evidence.
 * Type: Search and filters
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

interface FilterOptionFields {
  Label: Field<string>;
  Value: Field<string>;
  Selected: Field<boolean>;
}

interface FilterOption {
  id?: string;
  name?: string;
  fields: FilterOptionFields;
}

interface Fields {
  Heading: Field<string>;
  'Search Label': Field<string>;
  'Search Placeholder': Field<string>;
  'Submit Link': LinkField;
  'Show Filters': Field<boolean>;
  children?: { results?: FilterOption[] };
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const datasource = getDatasource<Fields>(props.fields);

  if (!datasource) {
    return <div>Missing Component Datasource.</div>;
  }

  const showFilters =
    datasource['Show Filters']?.value === true ||
    String(datasource['Show Filters']?.value) === '1';
  const options = datasource.children?.results ?? [];

  return (
    <section>
      <h2>
        <Text field={datasource.Heading} />
      </h2>
      <form role="search">
        <label>
          <Text field={datasource['Search Label']} />
          <input
            type="search"
            placeholder={String(
              datasource['Search Placeholder']?.value || '',
            )}
          />
        </label>
        {showFilters ? (
          <fieldset>
            {options.map((option, index) => {
              const selected =
                option.fields?.Selected?.value === true ||
                String(option.fields?.Selected?.value) === '1';
              return (
                <label key={option.id || option.name || index}>
                  <input
                    type="checkbox"
                    value={String(option.fields.Value?.value || '')}
                    defaultChecked={selected}
                  />
                  <Text field={option.fields.Label} />
                </label>
              );
            })}
          </fieldset>
        ) : null}
        <Link field={datasource['Submit Link']} />
      </form>
    </section>
  );
};
