import React from "react";
import { Text, type Field } from "@sitecore-content-sdk/nextjs";
import { env } from "src/lib/ch/env";
import { attempt } from "src/lib/ch/portalEdge";
import { loadHighlights, loadMarkets, loadMicrosite, type Highlight } from "src/lib/ch/automotive";
import { marketFor, numberOf, type Market } from "src/lib/ch/automotive-match";
import { parsePicks } from "src/lib/portal/picks";
import { chrome, fieldsOf, isEditing, type PortalComponentProps } from "src/lib/portal/component";
import { EditorNotice, LoadError } from "src/lib/portal/editor";
import { ui } from "src/lib/portal/ui-text";
import { Link } from "src/i18n/navigation";
import { ChImage } from "components/ui/portal/ChImage";
import { pageLocale } from "components/ui/portal/sports/shared";

const tag = (locale: string) => (!locale || locale === "en" ? "en-GB" : locale);
function fmt(value: string | undefined, locale: string, kind: "price" | "km" | "hp" | "co2"): string {
  if (!value) return "";
  const n = numberOf(value);
  if (n == null) return value;
  try {
    if (kind === "price") return new Intl.NumberFormat(tag(locale), { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
    const num = new Intl.NumberFormat(tag(locale), { maximumFractionDigits: 1 }).format(n);
    return kind === "km" ? `${num} km` : kind === "hp" ? `${num} hp` : `${num} g/km`;
  } catch { return value; }
}

/**
 * Model highlights: the products the author picked (datasource "Portal Picks": Heading, Intro and
 * the Picks field, Content Hub items app) with their range (test cycle of the market), starting
 * price, power and CO2 — found by what the product's fields are called — and the mandatory
 * disclaimer of the market for the page's language (the microsite's markets; English takes the
 * first English-speaking one).
 */
export const Default = async (props: PortalComponentProps) => {
  const editing = isEditing(props.page);
  const c = chrome(props);
  const fields = fieldsOf(props);
  const heading = fields.Heading as Field<string> | undefined;
  const intro = fields.Intro as Field<string> | undefined;
  const picks = parsePicks((fields.Picks as Field<string> | undefined)?.value);
  const ids = (picks?.items ?? []).map((p) => p.id);
  if (!env.edgeToken) return editing ? <EditorNotice title="Model highlights">This component reads Experience Edge for Content Hub, which isn&apos;t connected (EDGE_TOKEN).</EditorNotice> : null;
  if (!ids.length) return editing ? <EditorNotice title="Model highlights">Nothing picked yet — select this component, open its Content Hub items field and pick the models (products).</EditorNotice> : null;
  const locale = pageLocale();
  const [res, site, markets] = await Promise.all([
    attempt(() => loadHighlights(ids)),
    loadMicrosite(editing).catch(() => null),
    loadMarkets().catch(() => [] as Market[]),
  ]);
  if (res.error) return editing ? <EditorNotice title="Model highlights">{res.error}</EditorNotice> : <LoadError message={res.error} />;
  const models = res.data ?? [];
  if (!models.length) return editing ? <EditorNotice title="Model highlights">None of the picked products is published to Experience Edge (or in this portal&apos;s brand scope).</EditorNotice> : null;
  const market = marketFor(site?.markets.length ? site.markets : markets, locale);
  const cycle = market?.testCycle || "WLTP";
  const card = (h: Highlight) => {
    const facts: Array<[string, string]> = [
      [ui("auRange", { cycle }), fmt(h.figures.range, locale, "km")],
      [ui("auPower"), fmt(h.figures.power, locale, "hp")],
      [ui("auCo2"), fmt(h.figures.co2, locale, "co2")],
      [ui("auModelYear"), h.figures.modelYear ?? ""],
    ].filter((f): f is [string, string] => !!f[1]);
    const price = fmt(h.figures.price, locale, "price");
    const body = (
      <>
        {h.image && <span className="media"><ChImage links={h.image.links} fallback={h.image.preview} slot="card" alt="" /></span>}
        <div className="body">
          <h3>{h.name}</h3>
          {h.figures.powertrain && <p className="sub">{h.figures.powertrain}</p>}
          {price && <p className="au-price">{ui("auFrom", { price })}</p>}
          {facts.length > 0 && <dl className="au-facts">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
        </div>
      </>
    );
    return <article key={h.id} className="au-model">{h.href ? <Link href={h.href} className="au-model-link">{body}</Link> : body}</article>;
  };
  return (
    <section className={`au-models ${c.className}`.trim()} id={c.id}>
      {(heading?.value || editing) && <h2><Text field={heading} /></h2>}
      {(intro?.value || editing) && <p className="au-intro"><Text field={intro} /></p>}
      <div className="au-model-grid">{models.map(card)}</div>
      {market?.disclaimer ? <p className="au-disclaimer">{market.disclaimer}</p> : editing ? <EditorNotice title="Model highlights">No market disclaimer: the industry model has no Market for this language with a mandatory disclaimer.</EditorNotice> : null}
    </section>
  );
};
