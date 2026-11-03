import React from "react";
import { env } from "src/lib/ch/env";
import { loadCatalog } from "src/lib/ch/products";
import { attempt, idParam } from "src/lib/ch/portalEdge";
import { chrome, isEditing, type PortalComponentProps } from "src/lib/portal/component";
import { EditorNotice, LoadError } from "src/lib/portal/editor";
import { ProductCard } from "components/ui/portal/ProductCard";
import { ui } from "src/lib/portal/ui-text";

/** The product catalog: families (each a card grid), then the products without a family. */
export const Default = async (props: PortalComponentProps) => {
  const editing = isEditing(props.page);
  const c = chrome(props);
  if (!env.edgeToken) {
    const msg = "This section reads Experience Edge for Content Hub, which isn't connected (EDGE_TOKEN).";
    return editing ? <EditorNotice title="Product catalog">{msg}</EditorNotice> : <LoadError message={msg} />;
  }
  const res = await attempt(() => loadCatalog());
  if (!res.data) return editing ? <EditorNotice title="Product catalog">{res.error}</EditorNotice> : <LoadError message={res.error} />;
  const catalog = res.data;
  if (catalog.total === 0) {
    return <p className="portal-empty">{ui("noProducts")}</p>;
  }
  return (
    <div className={c.className || undefined} id={c.id}>
      {catalog.families.map((f) => (
        <section key={f.id} className="portal-section" id={idParam(f.id)}>
          <div className="portal-section-head">
            <h2>{f.name}</h2>
            {f.summary && <p>{f.summary}</p>}
          </div>
          <div className="portal-grid">{f.products.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        </section>
      ))}
      {catalog.unassigned.length > 0 && (
        <section className="portal-section">
          <div className="portal-section-head"><h2>{catalog.families.length ? ui("moreProducts") : ui("allProducts")}</h2></div>
          <div className="portal-grid">{catalog.unassigned.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        </section>
      )}
    </div>
  );
};
