// Adapted from Sitecore's xmcloud-starter-js (examples/kit-nextjs-skate-park/src/components/link-list/link-list.props.ts),
// Apache License 2.0 — see ../LICENSE-xmcloud-starter-js.md.
import { CompatibleDatasource, ComponentProps } from 'lib/component-props';
import { LinkField, TextField } from '@sitecore-content-sdk/nextjs';

export interface LinkListProps extends ComponentProps {
  fields?: CompatibleDatasource<{
    children?: {
      results?: Array<{
        field?: {
          link?: LinkField;
        };
      }>;
    };
    field?: {
      title?: TextField;
    };
  }>;
}

export interface LinkListItemProps {
  index: number;
  total: number;
  field: LinkField;
}
