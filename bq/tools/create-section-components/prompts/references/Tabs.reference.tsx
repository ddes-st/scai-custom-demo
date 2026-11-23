/**
 * FROZEN REFERENCE — do not edit; add a new file if a new pattern is required.
 * Prompt text only — imports are the target pattern for generated src/components code; this file is not compiled.
 * Unstyled structure only. Codegen must take visual styling from capture evidence.
 * Type: Tabs
 */

'use client';

import React, { JSX, useState } from 'react';
import { Field, Text, AppPlaceholder } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import { getDatasource } from 'lib/component-props';
import componentMap from '.sitecore/component-map';

interface TabItemFields {
  Label: Field<string>;
}

interface TabItem {
  id?: string;
  name?: string;
  fields: TabItemFields;
}

interface Fields {
  Heading: Field<string>;
  children?: { results?: TabItem[] };
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { rendering, page } = props;
  const datasource = getDatasource<Fields>(props.fields);
  const params = props.params ?? props.rendering?.params ?? {};
  const phKey = params.DynamicPlaceholderId;
  const placeholderBase = 'tab-panels';
  const phName = phKey ? `${placeholderBase}-${phKey}` : placeholderBase;
  const [active, setActive] = useState(0);

  if (!datasource) {
    return <div>Missing Component Datasource.</div>;
  }

  const tabs = datasource.children?.results ?? [];

  return (
    <section>
      <h2>
        <Text field={datasource.Heading} />
      </h2>
      <div role="tablist">
        {tabs.map((tab, index) => (
          <button
            key={tab.id || tab.name || index}
            type="button"
            role="tab"
            aria-selected={active === index}
            onClick={() => setActive(index)}
          >
            <Text field={tab.fields.Label} />
          </button>
        ))}
      </div>
      <div role="tabpanel" data-active-tab={active}>
        <AppPlaceholder
          name={phName}
          rendering={rendering}
          page={page}
          componentMap={componentMap}
        />
      </div>
    </section>
  );
};
