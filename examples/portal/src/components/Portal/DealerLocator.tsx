import React from "react";
import { listBrands } from "src/lib/ch/data";
import type { BrandSummary } from "src/lib/ch/types";
import { deploymentDealers } from "src/lib/portal/dealers";
import { requestContext } from "src/lib/portal/request-context";
import { chrome, isEditing, type PortalComponentProps } from "src/lib/portal/component";
import { EditorNotice } from "src/lib/portal/editor";
import { ui } from "src/lib/portal/ui-text";
import { DealerLocatorClient, type LocatorDealer } from "components/ui/portal/automotive/DealerLocatorClient";

/**
 * The dealer locator: the deployment's dealers (PORTAL_DEALERS, else the public facts of
 * PORTAL_PARTNERS) by marque and region, with their showrooms on a map. ?brand=<marque slug>
 * opens it filtered (the microsite's "Book a test drive"). Only public facts reach the page.
 */
export const Default = async (props: PortalComponentProps) => {
  const editing = isEditing(props.page);
  const c = chrome(props);
  const dealers = deploymentDealers();
  if (!dealers.length) return editing ? <EditorNotice title="Dealer locator">No dealers in this deployment (PORTAL_DEALERS — set by the Demo Builder&apos;s portal and microsite deploys).</EditorNotice> : <p className="portal-empty">{ui("auNoDealers")}</p>;
  const brands = await listBrands().catch((): BrandSummary[] => []);
  const view: LocatorDealer[] = dealers.map((d) => {
    const b = brands.find((x) => x.identifier === d.brand);
    return {
      id: d.id, name: d.name, marque: b?.name ?? "", marqueSlug: b?.slug ?? "", region: d.region, tier: d.tier,
      showrooms: d.showrooms.map((s, i) => ({ key: `${d.id}#${i}`, name: s.name, city: s.city, address: s.address, country: s.country, lat: Number.isFinite(s.lat) ? s.lat : null, lng: Number.isFinite(s.lng) ? s.lng : null, phone: s.phone })),
    };
  });
  let wanted = "";
  try { wanted = requestContext().search.brand ?? ""; } catch { /* no request */ }
  return (
    <section className={`au-dealer-locator ${c.className}`.trim()} id={c.id}>
      <DealerLocatorClient
        dealers={view}
        initialMarque={wanted}
        labels={{ allMarques: ui("auAllMarques"), allRegions: ui("auAllRegions"), count: ui("auDealerCount"), none: ui("auNoDealers"), directions: ui("auDirections"), map: ui("auMapLabel"), marque: ui("auAllMarques"), region: ui("auAllRegions") }}
      />
    </section>
  );
};
