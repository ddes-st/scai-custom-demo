import React from "react";
import { Link } from "src/i18n/navigation";
import { env } from "src/lib/ch/env";
import { loadCatalog, loadProduct } from "src/lib/ch/products";
import { attempt } from "src/lib/ch/portalEdge";
import { requestContext } from "src/lib/portal/request-context";
import { productHref, SECTION_PATH } from "src/lib/portal/sections";
import { chrome, isEditing, type PortalComponentProps } from "src/lib/portal/component";
import { EditorNotice, LoadError } from "src/lib/portal/editor";
import { getPortalSettings } from "src/lib/portal/settings";
import { RichTextServer } from "components/ui/portal/RichTextServer";
import { DataSheet } from "components/ui/portal/DataSheet";
import { FileList } from "components/ui/portal/FileList";
import { TrackView } from "components/ui/portal/UsageTracker";
import { JsonLd } from "components/ui/portal/JsonLd";
import { getBaseUrl } from "lib/utils";
import { ui } from "src/lib/portal/ui-text";
import { ChImage } from "components/ui/portal/ChImage";

/**
 * One product (/products/<id>, a wildcard page): description, every scalar field of the
 * tenant's product schema, the data sheet, images, documents, variants and related content.
 * In the Page builder (no id in the URL) the first catalog product is shown as a sample.
 */
export const Default = async (props: PortalComponentProps) => {
  const editing = isEditing(props.page);
  const { slug: urlId } = requestContext();
  const c = chrome(props);
  if (!env.edgeToken) {
    const msg = "This section reads Experience Edge for Content Hub, which isn't connected (EDGE_TOKEN).";
    return editing ? <EditorNotice title="Product detail">{msg}</EditorNotice> : <LoadError message={msg} />;
  }
  let id = urlId;
  if (!id && editing) {
    const sample = await attempt(async () => {
      const cat = await loadCatalog();
      return cat.families[0]?.products[0]?.id ?? cat.unassigned[0]?.id ?? "";
    });
    id = sample.data ?? "";
    if (!id) return <EditorNotice title="Product detail">{sample.error ?? "No published product yet — the live page renders the product from the URL (/products/<id>)."}</EditorNotice>;
  }
  if (!id) return <LoadError message="No product in the URL." missing />;
  const res = await attempt(() => loadProduct(id));
  if (res.error) return editing ? <EditorNotice title="Product detail">{res.error}</EditorNotice> : <LoadError message={res.error} />;
  const p = res.data;
  if (!p) return editing ? <EditorNotice title="Product detail">No published product with id “{id}”.</EditorNotice> : <LoadError message="This product isn't published." missing />;
  const hero = p.images[0];
  const settings = await getPortalSettings(props.page.siteName, props.page.locale);
  const productLd = {
    "@type": "Product",
    name: p.name,
    ...(p.number && { sku: p.number }),
    ...(p.summary && { description: p.summary }),
    ...(p.images.length && { image: p.images.map((i) => i.preview || i.download).filter(Boolean) }),
    ...(p.brands[0] && { brand: { "@type": "Brand", name: p.brands[0] } }),
    url: `${getBaseUrl()}${productHref(p.id)}`,
  };

  return (
    <article className={`portal-detail ${c.className}`.trim()} id={c.id}>
      {!editing && <JsonLd data={productLd} />}
      {editing && urlId === "" && <EditorNotice title="Sample product shown">The live page renders the product from the URL (/products/&lt;id&gt;).</EditorNotice>}
      {settings.trackUsage && !editing && <TrackView kind="product" id={p.id} title={p.name} />}
      <p className="portal-note"><Link href={SECTION_PATH.products}>{ui("allProductsBack")}</Link></p>
      <div className="portal-detail-head">
        <div className="text">
          <span className="eyebrow">{p.families.map((f) => f.name).join(" · ") || p.brands.join(" · ") || ui("product")}</span>
          <h1>{p.name}</h1>
          {p.summary && <p className="lead">{p.summary}</p>}
          <dl className="portal-facts">
            {p.number && (<><dt>{ui("productNumber")}</dt><dd>{p.number}</dd></>)}
            {p.brands.length > 0 && (<><dt>{ui("brand")}</dt><dd>{p.brands.join(", ")}</dd></>)}
          </dl>
        </div>
        {hero?.preview && (
          <figure className="hero">
            <ChImage links={hero.links} fallback={hero.preview} slot="detail" alt={hero.title} loading="eager" />
            {hero.download && <a className="download" href={hero.download} target="_blank" rel="noreferrer" download data-track={hero.id} data-track-title={hero.title}>{ui("downloadOriginal")}</a>}
          </figure>
        )}
      </div>

      {p.descriptionHtml && (
        <section className="portal-block">
          <h2>{ui("description")}</h2>
          <RichTextServer html={p.descriptionHtml} />
        </section>
      )}

      {p.fields.length > 0 && (
        <section className="portal-block">
          <h2>{ui("productData")}</h2>
          <table className="portal-table">
            <tbody>
              {p.fields.map((f) => (<tr key={f.label}><th>{f.label}</th><td>{f.value}</td></tr>))}
            </tbody>
          </table>
        </section>
      )}

      {p.dataSheet && (
        <section className="portal-block">
          <h2>{ui("dataSheet")}</h2>
          <DataSheet sheet={p.dataSheet} />
        </section>
      )}

      {p.images.length > 1 && (
        <section className="portal-block">
          <h2>{ui("images")}</h2>
          <div className="portal-asset-grid">
            {p.images.slice(1).map((a) => (
              <figure key={a.id} className="portal-asset">
                <div className="thumb">{a.preview ? <ChImage links={a.links} fallback={a.preview} slot="thumb" alt={a.title} /> : null}{a.kind === "video" && <span className="badge">{ui("video")}</span>}</div>
                <figcaption>
                  <span className="title" title={a.title}>{a.title}</span>
                  {a.download && <a className="download" href={a.download} target="_blank" rel="noreferrer" download data-track={a.id} data-track-title={a.title}>{ui("download")}</a>}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {p.files.length > 0 && (
        <section className="portal-block">
          <h2>{ui("documents")}</h2>
          <FileList files={p.files} />
        </section>
      )}

      {(p.variants.length > 0 || p.related.length > 0) && (
        <section className="portal-block two">
          {p.variants.length > 0 && (
            <div>
              <h2>{ui("variants")}</h2>
              <ul className="portal-links">{p.variants.map((v) => <li key={v.id}><Link href={productHref(v.id)}>{v.name}</Link></li>)}</ul>
            </div>
          )}
          {p.related.length > 0 && (
            <div>
              <h2>{ui("related")}</h2>
              <ul className="portal-links">{p.related.map((r) => <li key={r.id}>{r.name}</li>)}</ul>
            </div>
          )}
        </section>
      )}
    </article>
  );
};
