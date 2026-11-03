import React from "react";
import { Text, type Field } from "@sitecore-content-sdk/nextjs";
import { chrome, fieldsOf, isEditing, type PortalComponentProps } from "src/lib/portal/component";
import { ui } from "src/lib/portal/ui-text";

/** The footer line (partial design): two texts from the datasource (template Portal Footer). */
export const Default = (props: PortalComponentProps) => {
  const fields = fieldsOf(props);
  const left = fields.LeftText as Field<string> | undefined;
  const right = fields.RightText as Field<string> | undefined;
  const editing = isEditing(props.page);
  const c = chrome(props);
  return (
    <div className={`site-footer ${c.className}`.trim()} id={c.id}>
      <span>{left?.value || editing ? <Text field={left} /> : ui("footerLeft")}</span>
      <span>{right?.value || editing ? <Text field={right} /> : ui("footerRight")}</span>
    </div>
  );
};
