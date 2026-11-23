/**
 * FROZEN REFERENCE — do not edit; add a new file if a new pattern is required.
 * Prompt text only — imports are the target pattern for generated src/components code; this file is not compiled.
 * Unstyled structure only. Codegen must take visual styling from capture evidence.
 * Type: Form
 *
 * Authoring fields describe labels/actions; runtime inputs are structural demos.
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

interface FormFieldItemFields {
  Label: Field<string>;
  Placeholder: Field<string>;
  'Field Name': Field<string>;
  Required: Field<boolean>;
}

interface FormFieldItem {
  id?: string;
  name?: string;
  fields: FormFieldItemFields;
}

interface Fields {
  Heading: Field<string>;
  Intro: Field<string>;
  'Submit Label': Field<string>;
  'Submit Link': LinkField;
  'Privacy Note': Field<string>;
  children?: { results?: FormFieldItem[] };
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const datasource = getDatasource<Fields>(props.fields);

  if (!datasource) {
    return <div>Missing Component Datasource.</div>;
  }

  const formFields = datasource.children?.results ?? [];

  return (
    <section>
      <h2>
        <Text field={datasource.Heading} />
      </h2>
      <p>
        <Text field={datasource.Intro} />
      </p>
      <form>
        {formFields.map((item, index) => {
          const required =
            item.fields?.Required?.value === true ||
            String(item.fields?.Required?.value) === '1';
          const name = String(item.fields?.['Field Name']?.value || item.name || index);
          return (
            <div key={item.id || item.name || index}>
              <label htmlFor={name}>
                <Text field={item.fields.Label} />
              </label>
              <input
                id={name}
                name={name}
                placeholder={String(item.fields.Placeholder?.value || '')}
                required={required}
              />
            </div>
          );
        })}
        <button type="submit">
          <Text field={datasource['Submit Label']} />
        </button>
        <Link field={datasource['Submit Link']} />
        <p>
          <Text field={datasource['Privacy Note']} />
        </p>
      </form>
    </section>
  );
};
