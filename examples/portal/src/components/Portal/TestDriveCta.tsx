import React from "react";
import { listBrands } from "src/lib/ch/data";
import type { BrandSummary } from "src/lib/ch/types";
import { loadMicrosite } from "src/lib/ch/automotive";
import { chrome, isEditing, type PortalComponentProps } from "src/lib/portal/component";
import { ui } from "src/lib/portal/ui-text";
import { Link } from "src/i18n/navigation";

/**
 * "Book a test drive": to the dealer locator (/dealers), filtered to the microsite's marque when
 * the page belongs to a microsite (its record's brand).
 */
export const Default = async (props: PortalComponentProps) => {
  const editing = isEditing(props.page);
  const c = chrome(props);
  const m = await loadMicrosite(editing).catch(() => null);
  const slug = m?.brand ? (await listBrands().catch((): BrandSummary[] => [])).find((b) => b.identifier === m.brand!.id)?.slug ?? "" : "";
  const href = slug ? `/dealers?brand=${encodeURIComponent(slug)}` : "/dealers";
  return (
    <section className={`au-cta ${c.className}`.trim()} id={c.id}>
      <Link href={href} className="au-cta-button">{ui("auBookTestDrive")}</Link>
      <span className="au-cta-sub">{ui("auFindDealer")}{m?.brand?.name ? ` · ${m.brand.name}` : ""}</span>
    </section>
  );
};
