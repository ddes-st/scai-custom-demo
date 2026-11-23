/**
 * FROZEN REFERENCE — do not edit; add a new file if a new pattern is required.
 * Prompt text only — imports are the target pattern for generated src/components code; this file is not compiled.
 * Unstyled structure only. Codegen must take visual styling from capture evidence.
 * Type: Accordion
 *
 * Expandable rows via getDatasource → children.results (childItemTemplate).
 * Type chrome + `children?: { results?: … }` on the same Datasource/Fields type
 * (definition seeds use `children: [ … ]` arrays — never `children: { results }` in definitionTs).
 */

'use client';

import React, { JSX, useState } from 'react';
import { Field, Text, RichText } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import { getDatasource } from 'lib/component-props';

interface AccordionItemFields {
  Title: Field<string>;
  Body: Field<string>;
  'Default Open': Field<boolean>;
}

interface AccordionItem {
  id?: string;
  name?: string;
  fields: AccordionItemFields;
}

interface Fields {
  Heading: Field<string>;
  Intro: Field<string>;
  children?: { results?: AccordionItem[] };
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const datasource = getDatasource<Fields>(props.fields);
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});

  if (!datasource) {
    return <div>Missing Component Datasource.</div>;
  }

  const items = datasource.children?.results ?? [];

  return (
    <section>
      <h2>
        <Text field={datasource.Heading} />
      </h2>
      <p>
        <Text field={datasource.Intro} />
      </p>
      <div>
        {items.map((item, index) => {
          const key = item.id || item.name || String(index);
          const defaultOpen =
            item.fields?.['Default Open']?.value === true ||
            String(item.fields?.['Default Open']?.value) === '1';
          const isOpen =
            openIds[key] !== undefined ? openIds[key] : defaultOpen;

          return (
            <div key={key}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() =>
                  setOpenIds((prev) => ({ ...prev, [key]: !isOpen }))
                }
              >
                <Text field={item.fields.Title} />
              </button>
              {isOpen ? <RichText field={item.fields.Body} /> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
};
