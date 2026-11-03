import React from "react";
import { attempt } from "src/lib/ch/portalEdge";
import { loadClaims } from "src/lib/ch/university";
import { chrome, isEditing, type PortalComponentProps } from "src/lib/portal/component";
import { EditorNotice, LoadError } from "src/lib/portal/editor";
import { ui } from "src/lib/portal/ui-text";
import { universityMissing } from "components/ui/portal/university/shared";

/** By the numbers: the institution's published claims — only Verified ones whose expiry hasn't passed — with source and data year in small print. */
export const Default = async (props: PortalComponentProps) => {
  const editing = isEditing(props.page);
  const c = chrome(props);
  const missing = universityMissing("claims", "By the numbers", editing);
  if (missing !== false) return missing;
  const res = await attempt(() => loadClaims());
  if (res.error) return editing ? <EditorNotice title="By the numbers">{res.error}</EditorNotice> : <LoadError message={res.error} />;
  const claims = res.data ?? [];
  if (!claims.length) return editing ? <EditorNotice title="By the numbers">{ui("unNoClaims")}</EditorNotice> : null;
  return (
    <section className={`un-numbers ${c.className}`.trim()} id={c.id}>
      {claims.map((k) => {
        const figure = /^(#?\d[\d.,]*\s*%?|\$[\d.,]+[kmb]?)/i.exec(k.name)?.[1] ?? "";
        return (
          <figure key={k.id} className="un-claim">
            {figure && <span className="figure">{figure.trim()}</span>}
            <blockquote>{k.wording}</blockquote>
            <figcaption>{[k.source && ui("unSource", { source: k.source }), k.dataYear && ui("unDataYear", { year: k.dataYear })].filter(Boolean).join(" · ")}</figcaption>
          </figure>
        );
      })}
    </section>
  );
};
