import React, { JSX } from 'react';
import type { ComponentWithContextProps } from 'lib/component-props';
import type { Field, LinkField } from '@sitecore-content-sdk/nextjs';
import MenuBand from './menzis-header-menu-band.client';

interface Fields {
  'Menu Groups': Field<string>;
  'Search Heading': Field<string>;
  'Search Placeholder': Field<string>;
  'Search Description': Field<string>;
  'Home Link': LinkField;
}
type Props = ComponentWithContextProps & { fields: Fields };
export const Default = (props: Props): JSX.Element => <MenuBand fields={props.fields} />;
export default Default;
