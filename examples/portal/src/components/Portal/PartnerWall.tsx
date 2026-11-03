import React from "react";
import { Link } from "src/i18n/navigation";
import { attempt } from "src/lib/ch/portalEdge";
import { loadSponsorships } from "src/lib/ch/sports";
import { getViewer } from "src/lib/ch/viewer";
import { loadPartners, type PartnerProfile } from "src/lib/portal/partners";
import { chrome, isEditing, type PortalComponentProps } from "src/lib/portal/component";
import { EditorNotice, LoadError } from "src/lib/portal/editor";
import { SECTION_PATH } from "src/lib/portal/sections";
import { plainDate } from "src/lib/portal/sports-format";
import { ui } from "src/lib/portal/ui-text";
import { ChImage } from "components/ui/portal/ChImage";
import { pageLocale, sportsMissing } from "components/ui/portal/sports/shared";

/**
 * The partner wall: the club's sponsorships grouped by placement — logo (the sponsorship's
 * master asset, uncropped and contained: marks come on a white square), name, rights period, category exclusivity and activation. A sponsorship whose
 * name, brand or exclusivity names one of the portal's partners links to that partner's
 * profile for staff (the partner hub data: PORTAL_PARTNERS / Data/Partners).
 */
export const Default = async (props: PortalComponentProps) => {
  const editing = isEditing(props.page);
  const c = chrome(props);
  const missing = sportsMissing("sponsorships", "Partner wall", editing);
  if (missing !== false) return missing;
  const res = await attempt(() => loadSponsorships());
  if (res.error) return editing ? <EditorNotice title="Partner wall">{res.error}</EditorNotice> : <LoadError message={res.error} />;
  const list = res.data ?? [];
  if (!list.length) return editing ? <EditorNotice title="Partner wall">{ui("spNoSponsors")}</EditorNotice> : null;
  const [viewer, partners] = await Promise.all([getViewer(), loadPartners().catch((): PartnerProfile[] => [])]);
  const partnerOf = (text: string) => partners.find((p) => p.name.length > 2 && text.toLowerCase().includes(p.name.toLowerCase())) ?? null;
  const groups = new Map<string, typeof list>();
  for (const s of list) groups.set(s.placement || "—", [...(groups.get(s.placement || "—") ?? []), s]);
  const locale = pageLocale();
  return (
    <section className={`sp-wall ${c.className}`.trim()} id={c.id}>
      {[...groups.entries()].map(([placement, items]) => (
        <div key={placement} className="sp-wall-group">
          <h3>{placement}</h3>
          <div className="sp-wall-grid">
            {items.map((s) => {
              const partner = partnerOf([s.name, s.exclusivity, ...s.brands].join(" "));
              return (
                <article key={s.id} className="sp-sponsor">
                  <span className="logo">{s.logo ? <ChImage links={s.logo.links} fallback={s.logo.preview} slot="tile" crop="preview" alt={s.name} /> : <span className="glyph">{s.name.charAt(0)}</span>}</span>
                  <div className="body">
                    <h4>{s.name}</h4>
                    {(s.start || s.end) && <p className="sub">{ui("spRights", { start: plainDate(s.start, locale), end: plainDate(s.end, locale) })}</p>}
                    {s.exclusivity && <p><span className="label">{ui("spExclusive")}</span> {s.exclusivity}</p>}
                    {s.activation && <p className="activation"><span className="label">{ui("spActivation")}</span> {s.activation}</p>}
                    {partner && viewer.kind === "staff" && <p><Link href={`${SECTION_PATH.partners}/${encodeURIComponent(partner.user)}`}>{ui("spPartnerProfile")}</Link></p>}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
};
