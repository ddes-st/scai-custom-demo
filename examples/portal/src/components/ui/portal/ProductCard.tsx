import React from "react";
import { Link } from "src/i18n/navigation";
import type { CatalogProduct } from "src/lib/ch/products";
import { productHref } from "src/lib/portal/sections";
import { ChImage } from "components/ui/portal/ChImage";

export function ProductCard({ p }: { p: CatalogProduct }) {
  return (
    <Link href={productHref(p.id)} className="portal-card">
      <span className="media">{p.image ? <ChImage links={p.imageLinks} fallback={p.image} slot="card" alt="" /> : <span className="glyph">{p.name.charAt(0)}</span>}</span>
      <span className="body">
        <span className="name">{p.name}</span>
        {p.summary && <span className="summary">{p.summary}</span>}
        <span className="sub">{[p.number, p.brands[0]].filter(Boolean).join(" · ") || "Product"}</span>
      </span>
    </Link>
  );
}
