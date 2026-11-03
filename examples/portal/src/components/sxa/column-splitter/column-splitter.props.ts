// Adapted from Sitecore's xmcloud-starter-js (examples/kit-nextjs-skate-park/src/components/column-splitter/column-splitter.props.ts),
// Apache License 2.0 — see ../LICENSE-xmcloud-starter-js.md.
import { ComponentProps } from 'lib/component-props';

export type ColumnNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type ColumnWidths = {
  [K in ColumnNumber as `ColumnWidth${K}`]?: string;
};

export type ColumnStyles = {
  [K in ColumnNumber as `Styles${K}`]?: string;
};

export interface ColumnSplitterProps extends ComponentProps {
  params: ComponentProps['params'] & ColumnWidths & ColumnStyles;
}
