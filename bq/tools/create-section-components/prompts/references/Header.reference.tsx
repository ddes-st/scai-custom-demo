/**
 * FROZEN REFERENCE — do not edit; add a new file if a new pattern is required.
 * Prompt text only — imports are the target pattern for generated src/components code; this file is not compiled.
 * Unstyled structure only. Codegen must take visual styling from capture evidence.
 * Type: Header
 *
 * Site branding, utility actions, and a Navigation placeholder for menus.
 */

import React, { JSX } from 'react';
import {
  Field,
  ImageField,
  LinkField,
  Text,
  Image,
  Link,
  AppPlaceholder,
} from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import componentMap from '.sitecore/component-map';

interface Fields {
  Logo: ImageField;
  'Home Link': LinkField;
  'Sign In Link': LinkField;
  'Search Label': Field<string>;
  'Menu Open': Field<boolean>;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields, rendering, page } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const phKey = params.DynamicPlaceholderId;
  const placeholderBase = 'header-navigation';
  const phName = phKey ? `${placeholderBase}-${phKey}` : placeholderBase;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  const menuOpen =
    fields['Menu Open']?.value === true ||
    String(fields['Menu Open']?.value) === '1';

  return (
    <header>
      <Link field={fields['Home Link']}>
        <Image field={fields.Logo} />
      </Link>
      <span>
        <Text field={fields['Search Label']} />
      </span>
      <Link field={fields['Sign In Link']} />
      {menuOpen ? <span>Menu open</span> : null}
      <AppPlaceholder
        name={phName}
        rendering={rendering}
        page={page}
        componentMap={componentMap}
      />
    </header>
  );
};
