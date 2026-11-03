// Adapted from Sitecore's xmcloud-starter-js (examples/kit-nextjs-skate-park/src/components/row-splitter/row-splitter.props.ts),
// Apache License 2.0 — see ../LICENSE-xmcloud-starter-js.md.
import { ComponentRendering } from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';

export type RowNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type RowStyles = {
  [K in `Styles${RowNumber}`]?: string;
};

export interface RowSplitterProps extends ComponentProps {
  rendering: ComponentRendering;
  params: ComponentProps['params'] & RowStyles;
}
