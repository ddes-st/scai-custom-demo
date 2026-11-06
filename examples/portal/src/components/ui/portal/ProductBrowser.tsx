"use client";

import { useMemo, useState } from "react";
import { Link } from "src/i18n/navigation";
import type { CatalogProduct } from "src/lib/ch/products";
import { productHref } from "src/lib/portal/sections";
import { useUi } from "src/lib/portal/ui-text-client";
import { ChImage } from "components/ui/portal/ChImage";

const EMPTY_STATUS = ["live", "seasonal", "development", "retiring"] as const;
const EMPTY_DIET = ["plant", "gluten", "nut"] as const;

/** Flat product grid in the brand-hub layout. Status, diet and completeness are not on the feed. */
export function ProductBrowser({ products }: { products: CatalogProduct[] }) {
  const t = useUi();
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");
  const [status, setStatus] = useState("");
  const [diet, setDiet] = useState("");
  const [table, setTable] = useState(false);
  const brands = useMemo(() => [...new Set(products.flatMap((p) => p.brands))].sort(), [products]);
  const shown = useMemo(() => {
    if (status || diet) return [];
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return products.filter((p) => (!brand || p.brands.includes(brand)) && words.every((w) => `${p.name} ${p.number} ${p.brands.join(" ")} ${p.summary}`.toLowerCase().includes(w)));
  }, [products, q, brand, status, diet]);
  const statusLabel = (id: string) => t(id === "live" ? "hubLive" : id === "seasonal" ? "hubSeasonal" : id === "development" ? "hubInDevelopment" : "hubRetiring");
  const dietLabel = (id: string) => t(id === "plant" ? "hubDietPlant" : id === "gluten" ? "hubDietGluten" : "hubDietNut");

  return (
    <div className="hub-products">
      <form className="hub-hero-search" onSubmit={(e) => e.preventDefault()}>
        <input type="search" value={q} placeholder={t("hubProductSearch")} onChange={(e) => setQ(e.target.value)} aria-label={t("search")} />
      </form>
      <div className="hub-chip-lines">
        <ChipRow label={t("brand")}>
          <button type="button" className={!brand ? "is-on" : undefined} onClick={() => setBrand("")}>{t("all")}</button>
          {brands.map((b) => <button key={b} type="button" className={brand === b ? "is-on" : undefined} onClick={() => setBrand(brand === b ? "" : b)}>{b}</button>)}
        </ChipRow>
        <ChipRow label={t("hubStatus")}>
          <button type="button" className={!status ? "is-on" : undefined} onClick={() => setStatus("")}>{t("all")}</button>
          {EMPTY_STATUS.map((id) => <button key={id} type="button" className={status === id ? "is-on" : undefined} onClick={() => setStatus(status === id ? "" : id)}>{statusLabel(id)}</button>)}
        </ChipRow>
        <ChipRow label={t("hubDiet")}>
          {EMPTY_DIET.map((id) => <button key={id} type="button" className={diet === id ? "is-on" : undefined} onClick={() => setDiet(diet === id ? "" : id)}>{dietLabel(id)}</button>)}
        </ChipRow>
      </div>
      <div className="hub-product-tools">
        <p>{t("hubProductsCount", { count: shown.length })}</p>
        <div role="group">
          <button type="button" className={!table ? "is-on" : undefined} onClick={() => setTable(false)}>{t("hubCards")}</button>
          <button type="button" className={table ? "is-on" : undefined} onClick={() => setTable(true)}>{t("hubTable")}</button>
        </div>
      </div>
      {(status || diet) && <p className="hub-gap">{t("hubNotOnFeed")}</p>}
      {shown.length === 0 && !status && !diet && <p className="portal-empty">{t("nothingMatches")}</p>}
      {table ? (
        <table className="hub-product-table">
          <tbody>
            {shown.map((p) => (
              <tr key={p.id}>
                <td>{p.brands[0]}</td>
                <td>{p.number}</td>
                <td><Link href={productHref(p.id)}>{p.name}</Link></td>
                <td className="hub-meter" title={t("hubNotOnFeed")} />
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="hub-product-grid">
          {shown.map((p) => (
            <Link key={p.id} href={productHref(p.id)} className="hub-product">
              <span className="media">{p.image ? <ChImage links={p.imageLinks} fallback={p.image} slot="card" alt="" /> : <span className="hub-needed"><span aria-hidden="true">▢</span>{t("hubImageNeeded")}</span>}</span>
              <span className="meta">{[p.brands[0], p.number].filter(Boolean).join(" · ")}</span>
              <span className="name">{p.name}</span>
              <span className="hub-meter" title={t("hubNotOnFeed")} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="hub-chip-line"><span>{label}</span><div>{children}</div></div>;
}
