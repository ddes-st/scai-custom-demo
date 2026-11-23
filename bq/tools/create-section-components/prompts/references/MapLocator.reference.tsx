/**
 * FROZEN REFERENCE — do not edit; add a new file if a new pattern is required.
 * Prompt text only — imports are the target pattern for generated src/components code; this file is not compiled.
 * Unstyled structure only. Codegen must take visual styling from capture evidence.
 * Type: Map / locator
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
import { getDatasource } from 'lib/component-props';
import componentMap from '.sitecore/component-map';

interface LocationFields {
  Name: Field<string>;
  Address: Field<string>;
  Latitude: Field<string>;
  Longitude: Field<string>;
  Link: LinkField;
}

interface LocationItem {
  id?: string;
  name?: string;
  fields: LocationFields;
}

interface Fields {
  Heading: Field<string>;
  'Search Label': Field<string>;
  'Search Placeholder': Field<string>;
  'Show Map': Field<boolean>;
  children?: { results?: LocationItem[] };
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { rendering, page } = props;
  const datasource = getDatasource<Fields>(props.fields);
  const params = props.params ?? props.rendering?.params ?? {};
  const phKey = params.DynamicPlaceholderId;
  const placeholderBase = 'map-slot';
  const phName = phKey ? `${placeholderBase}-${phKey}` : placeholderBase;

  if (!datasource) {
    return <div>Missing Component Datasource.</div>;
  }

  const showMap =
    datasource['Show Map']?.value === true ||
    String(datasource['Show Map']?.value) === '1';
  const locations = datasource.children?.results ?? [];

  return (
    <section>
      <h2>
        <Text field={datasource.Heading} />
      </h2>
      <label>
        <Text field={datasource['Search Label']} />
        <input
          type="search"
          placeholder={String(datasource['Search Placeholder']?.value || '')}
        />
      </label>
      {showMap ? (
        <div>
          <AppPlaceholder
            name={phName}
            rendering={rendering}
            page={page}
            componentMap={componentMap}
          />
        </div>
      ) : null}
      <ul>
        {locations.map((loc, index) => (
          <li key={loc.id || loc.name || index}>
            <h3>
              <Text field={loc.fields.Name} />
            </h3>
            <p>
              <Text field={loc.fields.Address} />
            </p>
            <span>
              <Text field={loc.fields.Latitude} />,{' '}
              <Text field={loc.fields.Longitude} />
            </span>
            <Link field={loc.fields.Link} />
          </li>
        ))}
      </ul>
    </section>
  );
};
