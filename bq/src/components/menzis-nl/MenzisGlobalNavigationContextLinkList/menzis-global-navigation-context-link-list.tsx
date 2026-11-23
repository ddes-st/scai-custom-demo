import React, { JSX } from 'react';
import { Link } from '@sitecore-content-sdk/nextjs';
import type { LinkField, TextField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';

interface LinkItemFields {
  Link: LinkField;
}
interface LinkItem {
  id?: string;
  name?: string;
  fields?: LinkItemFields;
}
interface Fields {
  data?: { datasource?: { field?: { title?: TextField }; children?: { results?: LinkItem[] } } };
}
type Props = ComponentWithContextProps & { fields?: Fields };

export const Default = (props: Props): JSX.Element => {
  const items = props.fields?.data?.datasource?.children?.results ?? [];
  return (
    <nav aria-label="Context selector">
      <ul className="list-none space-y-1">
        {items.map((item: LinkItem, index: number) =>
          item.fields?.Link ? (
            <li key={item.id ?? item.name ?? index}>
              <Link field={item.fields.Link} />
            </li>
          ) : null,
        )}
      </ul>
    </nav>
  );
};
