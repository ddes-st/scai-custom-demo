import React from "react";
import type { PartnerProfile } from "src/lib/portal/partners";
import { loadPartnerArea } from "src/lib/portal/partner-area";
import { listEntities } from "src/lib/ch/entities";
import { env } from "src/lib/ch/env";
import { attempt } from "src/lib/ch/portalEdge";
import { ui } from "src/lib/portal/ui-text";
import { MediaBrowser } from "components/ui/portal/MediaBrowser";
import { EntityItems } from "components/ui/portal/EntityItems";
import { PartnerUploads } from "components/ui/portal/PartnerUploads";

/**
 * One partner's area (src/lib/portal/partner-area.ts): profile facts and its Partner Manager,
 * then what the brand shares with it — files (its own documents, its kit and collections;
 * filterable by collection in the media browser), products, content, its uploads with their
 * review status, the collections — and the campaign kits of its focus brand. `as`: "partner" (its
 * own area — it can upload) or "staff" (looking at a partner, uploads read-only). Server component.
 */
export async function PartnerKit({ partner, trackViews, heading, as = "partner" }: { partner: PartnerProfile; trackViews: boolean; heading?: string; as?: "partner" | "staff" }) {
  const [area, campaigns] = await Promise.all([
    attempt(() => loadPartnerArea(partner)),
    attempt(() => listEntities("M_CMP_Campaign")),
  ]);
  const a = area.data;
  const masters = (campaigns.data ?? []).filter((c) => !/\.locvar\./.test(c.id));
  const brandWord = (partner.brand.split(".").pop() ?? "").toLowerCase();
  const forBrand = brandWord ? masters.filter((c) => (c.subtitle + " " + c.summary + " " + c.title).toLowerCase().includes(brandWord)) : [];
  const kits = (forBrand.length ? forBrand : masters).slice(0, 6);
  const facts: Array<[string, React.ReactNode]> = ([[ui("partnerType"), partner.type], [ui("tier"), partner.tier], [ui("region"), partner.region], [ui("focusBrand"), partner.brand.split(".").pop() ?? ""]] as Array<[string, string]>).filter(([, v]) => v);
  // staff see the partner's contact person (with a mail link); the partner itself is greeted by them
  if (as === "staff" && partner.contact) facts.push([ui("contact"), partner.contactEmail ? <>{partner.contact} · <a href={`mailto:${partner.contactEmail}`}>{partner.contactEmail}</a></> : partner.contact]);
  if (as === "staff") facts.push([ui("loginName"), partner.login || partner.user]);
  const firstName = partner.contact.split(/\s+/)[0] ?? "";
  const uploads = !!env.uploads && env.siteMode !== "public" && !!partner.entity;
  const nav = a ? [
    ["files", `${ui("files")} (${a.files.length})`],
    a.products.length ? ["products", `${ui("productsLabel")} (${a.products.length})`] : null,
    a.content.length ? ["content", `${ui("contentLabel")} (${a.content.length})`] : null,
    uploads ? ["uploads", as === "partner" ? ui("myUploads") : ui("uploads")] : null,
    a.collections.length ? ["collections", `${ui("collections")} (${a.collections.length})`] : null,
    kits.length ? ["campaign-kits", ui("campaignKits")] : null,
  ].filter((x): x is string[] => !!x) : [];
  return (
    <div className="portal-partner">
      <div className="portal-detail-head">
        <div className="text">
          <span className="eyebrow">{ui("partnerLogin")}</span>
          <h1>{heading ?? ui("welcome", { name: firstName || partner.name })}</h1>
          {as === "partner" && !heading && partner.contact && <p className="portal-manager">{ui("signedInAs")} <strong>{partner.contact}</strong>, {partner.name}</p>}
          {partner.about && <p className="lead">{partner.about}</p>}
          {facts.length > 0 && <dl className="portal-facts">{facts.map(([k, v]) => (<React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>))}</dl>}
          {partner.manager && <p className="portal-manager">{as === "partner" ? ui("partnerManager", { name: partner.manager }) : ui("partnerManagerOf", { name: partner.manager })}</p>}
        </div>
      </div>
      {nav.length > 1 && (
        <nav className="portal-chips" aria-label={ui("sharedWithYou")}>
          <span className="portal-chips-label">{ui("sharedWithYou")}</span>
          {nav.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
        </nav>
      )}
      <section className="portal-section" id="files">
        <div className="portal-section-head"><h2>{ui("files")}</h2><p>{ui("partnerFilesLead")}</p></div>
        {area.error ? <p className="portal-empty">{area.error}</p>
          : !a || !a.files.length ? <p className="portal-empty">{a && !a.record && !partner.kit ? ui("kitEmpty") : ui("filesBeingPrepared")}</p>
          : <MediaBrowser items={a.files} collections={a.collections} brands={[...new Set(a.files.flatMap((i) => i.brands))].sort()} trackViews={trackViews} />}
      </section>
      {a && a.products.length > 0 && (
        <section className="portal-section" id="products">
          <div className="portal-section-head"><h2>{ui("productsLabel")}</h2><p>{ui("partnerProductsLead")}</p></div>
          <EntityItems variant="cards" cards={a.products} />
        </section>
      )}
      {a && a.content.length > 0 && (
        <section className="portal-section" id="content">
          <div className="portal-section-head"><h2>{ui("contentLabel")}</h2><p>{ui("partnerContentLead")}</p></div>
          <EntityItems variant="list" cards={a.content} />
        </section>
      )}
      {uploads && <PartnerUploads maxMb={env.uploads!.maxMb} canUpload={as === "partner"} {...(as === "staff" ? { partner: partner.user } : {})} />}
      {a && a.collections.length > 0 && (
        <section className="portal-section" id="collections">
          <div className="portal-section-head"><h2>{ui("collections")}</h2><p>{ui("collectionsLead")}</p></div>
          <dl className="portal-facts">
            {a.collections.map((c) => (
              <React.Fragment key={c.id}><dt>{c.name}</dt><dd>{ui("kitCount", { count: c.count })}{c.description ? ` · ${c.description}` : ""}</dd></React.Fragment>
            ))}
          </dl>
        </section>
      )}
      {kits.length > 0 && (
        <section className="portal-block" id="campaign-kits">
          <h2>{ui("campaignKits")}</h2>
          <EntityItems variant="cards" cards={kits} />
        </section>
      )}
    </div>
  );
}
