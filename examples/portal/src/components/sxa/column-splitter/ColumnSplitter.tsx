// Adapted from Sitecore's xmcloud-starter-js (examples/kit-nextjs-skate-park/src/components/column-splitter/ColumnSplitter.tsx),
// Apache License 2.0 — see ../LICENSE-xmcloud-starter-js.md.
// Changes: placeholders resolve through the portal's component map (src/lib/component-map).
import React, { JSX } from 'react';
import componentMap from 'src/lib/component-map';
import { AppPlaceholder } from "@sitecore-content-sdk/nextjs";
import { ColumnNumber, ColumnSplitterProps } from './column-splitter.props';

export const Default = ({
  params,
  rendering,
  page,
}: ColumnSplitterProps): JSX.Element => {
  const { EnabledPlaceholders, RenderingIdentifier: id, styles } = params;

  const enabledColumns = EnabledPlaceholders?.split(",") ?? [];

  return (
    <section className={`row component column-splitter ${styles}`} id={id}>
      {enabledColumns.map((columnNum, index) => {
        const num = Number(columnNum) as ColumnNumber;
        const columnWidth = params[`ColumnWidth${num}`] ?? "";
        const columnStyle = params[`Styles${num}`] ?? "";
        const columnClassNames = `${columnWidth} ${columnStyle}`.trim();

        return (
          <div key={index} className={columnClassNames}>
            <div className="row">
              <AppPlaceholder
                name={`column-${columnNum}-{*}`}
                rendering={rendering}
                page={page}
                componentMap={componentMap}
              />
            </div>
          </div>
        );
      })}
    </section>
  );
};