import React, { JSX } from 'react';
import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
import componentMap from '.sitecore/component-map';
import { ComponentWithContextProps } from 'lib/component-props';

/**
 * SXA Partial Design wrapper - Layout Service nests partial chrome under
 * placeholder key sxa-{Signature}. Required on the editing/rendering host.
 */
const PartialDesignDynamicPlaceholder = (
  props: ComponentWithContextProps,
): JSX.Element => (
  <AppPlaceholder
    name={props.rendering?.params?.sig || ''}
    rendering={props.rendering}
    page={props.page}
    componentMap={componentMap}
  />
);

export default PartialDesignDynamicPlaceholder;
