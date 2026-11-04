import React from "react";
import { Text, type Field } from "@sitecore-content-sdk/nextjs";
import { env } from "src/lib/ch/env";
import { cardsFor, expandEntity, profileFor, type EntityCard, type EntityRelation } from "src/lib/ch/entities";
import { attempt } from "src/lib/ch/portalEdge";
import { parsePicks } from "src/lib/portal/picks";
import { chrome, fieldsOf, isEditing, param, type PortalComponentProps } from "src/lib/portal/component";
import { EditorNotice, LoadError } from "src/lib/portal/editor";
import { EntityCardView } from "components/ui/portal/EntityCards";
import { columnsOf, EntityItems, variantOf } from "components/ui/portal/EntityItems";
import { Link } from "src/i18n/navigation";
import { SECTION_PATH } from "src/lib/portal/sections";
import { ui } from "src/lib/portal/ui-text";

/**
 * Hand-picked Content Hub entities of any definition (datasource "Portal Picks": Heading,
 * Intro and the Picks field filled through the "Content Hub items" Marketplace app), rendered
 * live from Experience Edge in the chosen order and design variant. A profile with an
 * `expand` relation (product families → products, collections → assets) lists the related
 * entities under each pick. Unpublished or out-of-scope picks drop out on the live site; the
 * Page builder lists them.
 */
export const Default = async (props: PortalComponentProps) => {
  const editing = isEditing(props.page);
  const c = chrome(props);
  const fields = fieldsOf(props);
  const heading = fields.Heading as Field<string> | undefined;
  const intro = fields.Intro as Field<string> | undefined;
  const picks = parsePicks((fields.Picks as Field<string> | undefined)?.value);
  const variant = variantOf(param(props, "Variant"));
  // ImageCrop: a named public link (HomePageHero, …) instead of the best fit per box
  const crop = param(props, "ImageCrop");
  // Columns: items per row (cards, tiles) or slides visible (carousel); auto = the layout's default
  const columns = columnsOf(param(props, "Columns"));

  const head = (heading?.value || intro?.value || editing || variant === "masonry") && (
    <div className="portal-section-head hub-section-head">
      <div>
        {(heading?.value || editing) && <h2><Text field={heading} /></h2>}
        {(intro?.value || editing) && <p><Text field={intro} /></p>}
      </div>
      {variant === "masonry" && <Link href={SECTION_PATH.media} className="hub-see-all">{ui("hubSeeEverything")}</Link>}
    </div>
  );
  const section = (children: React.ReactNode) => <section className={`portal-section ch-items ch-items-${variant} ${c.className}`.trim()} id={c.id}>{head}{children}</section>;

  if (!picks || !picks.items.length) {
    if (!editing) return null; // nothing picked: the live site shows no half-empty section
    return section(
      <EditorNotice title="Content Hub items">
        {fields.Picks ? "Nothing picked yet — select this component, open the Picks field and click Open app to choose products, brands, images or any other Content Hub type."
          : "Add a Portal Picks datasource to this component (Data → Portal Picks), then pick items in its Picks field."}
      </EditorNotice>
    );
  }
  if (!env.edgeToken) {
    const msg = "This section reads Experience Edge for Content Hub, which isn't connected (EDGE_TOKEN).";
    return editing ? <EditorNotice title="Content Hub items">{msg}</EditorNotice> : <LoadError message={msg} />;
  }

  const res = await attempt(async () => {
    const profile = await profileFor(picks.definition);
    if (!profile) return null;
    const { cards, missing } = await cardsFor(picks.definition, picks.items.map((p) => p.id));
    const expanded: Array<{ card: EntityCard; relation: EntityRelation | null }> = profile.expand
      ? await Promise.all(cards.map(async (card) => ({ card, relation: await expandEntity(picks.definition, card.id).catch(() => null) })))
      : [];
    return { profile, cards, missing, expanded };
  });
  if (res.error) return editing ? <EditorNotice title="Content Hub items">{res.error}</EditorNotice> : <LoadError message={res.error} />;
  if (!res.data) {
    const msg = `Experience Edge doesn't publish ${picks.definition} on this tenant.`;
    return editing ? section(<EditorNotice title="Content Hub items">{msg}</EditorNotice>) : null;
  }
  const { profile, cards, missing, expanded } = res.data;
  const names = new Map(picks.items.map((p) => [p.id, p.name || p.id]));

  return section(
    <>
      {editing && missing.length > 0 && (
        <EditorNotice title={`${missing.length} of ${picks.items.length} ${profile.labelPlural.toLowerCase()} not available`}>
          Not published, out of the brand scope or deleted in Content Hub: {missing.map((id) => names.get(id) ?? id).join(", ")}. They are skipped on the live site.
        </EditorNotice>
      )}
      {profile.expand ? (
        expanded.map(({ card, relation }) => (
          <section key={card.id} className="ch-expanded">
            <div className="portal-section-head ch-expanded-head">
              <h3>{card.href ? <Link href={card.href}>{card.title}</Link> : card.title}</h3>
              {card.summary && <p>{card.summary}</p>}
            </div>
            {relation?.items.length ? <EntityItems variant={variant === "hero" ? "cards" : variant} cards={relation.items} crop={crop} /> : <EntityCardView card={card} crop={crop} />}
          </section>
        ))
      ) : (
        <EntityItems variant={variant} cards={cards} crop={crop} columns={columns} />
      )}
    </>
  );
};
