// Adapted from Sitecore's xmcloud-starter-js (examples/kit-nextjs-skate-park/src/components/row-splitter/RowSplitter.tsx),
// Apache License 2.0 — see ../LICENSE-xmcloud-starter-js.md.
// Changes: placeholders resolve through the portal's component map (src/lib/component-map).
import React, { JSX } from 'react';
import componentMap from 'src/lib/component-map';
import { AppPlaceholder } from "@sitecore-content-sdk/nextjs";
import { RowNumber, RowSplitterProps } from './row-splitter.props';

export const Default = ({
  params,
  rendering,
  page,
}: RowSplitterProps): JSX.Element => {
  const enabledPlaceholders = params.EnabledPlaceholders?.split(",") ?? [];
  const id = params.RenderingIdentifier;

  return (
    <section className={`component row-splitter ${params.styles}`} id={id}>
      {enabledPlaceholders.map((ph, index) => {
        const num = Number(ph) as RowNumber;
        const placeholderKey = `row-${num}-{*}`;
        const rowStyles = `${params[`Styles${num}`] ?? ""}`.trimEnd();

        return (
          <section key={index} className={`container-fluid ${rowStyles}`.trimEnd()}>
            <div>
              <div className="row">
                <AppPlaceholder
                  name={placeholderKey}
                  rendering={rendering}
                  page={page}
                  componentMap={componentMap}
                />
              </div>
            </div>
          </section>
        );
      })}
    </section>
  );
};