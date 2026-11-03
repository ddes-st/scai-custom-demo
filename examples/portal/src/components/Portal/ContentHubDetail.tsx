import React from "react";
import { Link } from "src/i18n/navigation";
import { env } from "src/lib/ch/env";
import { listEntities, loadEntity, profileFor } from "src/lib/ch/entities";
import { attempt } from "src/lib/ch/portalEdge";
import { requestContext } from "src/lib/portal/request-context";
import { fieldValue } from "src/lib/portal/sections";
import { chrome, isEditing, routeFields, type PortalComponentProps } from "src/lib/portal/component";
import { EditorNotice, LoadError } from "src/lib/portal/editor";
import { RichTextServer } from "components/ui/portal/RichTextServer";
import { FileList } from "components/ui/portal/FileList";
import { EntityItems } from "components/ui/portal/EntityItems";
import { JsonLd } from "components/ui/portal/JsonLd";
import { getBaseUrl } from "lib/utils";
import { ui } from "src/lib/portal/ui-text";
import { ChImage } from "components/ui/portal/ChImage";

/**
 * The generic detail page of a Content Hub entity (a `*` page whose `Definition` field names
 * the Edge type): title, subtitle, summary, hero image, long text, every other field, images,
 * files and the related entities as cards — all from the entity's profile. In the Page
 * builder (no id in the URL) the first published entity is shown as a sample.
 */
export const Default = async (props: PortalComponentProps) => {
  const editing = isEditing(props.page);
  const { slug: urlId, segments } = requestContext();
  const c = chrome(props);
  const definition = fieldValue(routeFields(props.page), "Definition");
  if (!definition) {
    return editing ? <EditorNotice title="Content Hub detail">Set the page’s Definition field (Page content) to the Edge type, e.g. M_CMP_Campaign.</EditorNotice> : null;
  }
  if (!env.edgeToken) {
    const msg = "This section reads Experience Edge for Content Hub, which isn't connected (EDGE_TOKEN).";
    return editing ? <EditorNotice title="Content Hub detail">{msg}</EditorNotice> : <LoadError message={msg} />;
  }
  let id = urlId;
  if (!id && editing) {
    const sample = await attempt(async () => (await listEntities(definition))[0]?.id ?? "");
    id = sample.data ?? "";
    if (!id) return <EditorNotice title="Content Hub detail">{sample.error ?? `No published ${definition} yet — the live page renders the entity from the URL.`}</EditorNotice>;
  }
  if (!id) return <LoadError message="No entity in the URL." missing />;
  const res = await attempt(async () => ({ profile: await profileFor(definition), entity: await loadEntity(definition, id) }));
  if (!res.data) return editing ? <EditorNotice title="Content Hub detail">{res.error}</EditorNotice> : <LoadError message={res.error ?? "Content Hub didn't answer."} />;
  const { profile, entity: e } = res.data;
  if (!profile) return editing ? <EditorNotice title="Content Hub detail">Experience Edge doesn’t publish {definition} on this tenant.</EditorNotice> : null;
  if (!e) return editing ? <EditorNotice title="Content Hub detail">No published {profile.label.toLowerCase()} with id “{id}”.</EditorNotice> : <LoadError message={`This ${profile.label.toLowerCase()} isn't published.`} />;
  const hero = e.images[0];
  const back = profile.detailPath || (segments[0] ? `/${segments[0]}` : "");
  const ld = {
    "@type": /^M_Content/.test(definition) ? "CreativeWork" : "Thing",
    name: e.title,
    ...(e.summary && { description: e.summary }),
    ...(e.images.length && { image: e.images.map((i) => i.preview || i.download).filter(Boolean) }),
    ...(e.href && { url: `${getBaseUrl()}${e.href}` }),
  };

  return (
    <article className={`portal-detail ${c.className}`.trim()} id={c.id}>
      {!editing && <JsonLd data={ld} />}
      {editing && urlId === "" && <EditorNotice title={`Sample ${profile.label.toLowerCase()} shown`}>The live page renders the entity from the URL ({back || "/section"}/&lt;id&gt;).</EditorNotice>}
      {back && <p className="portal-note"><Link href={back}>← {ui("all")} {profile.labelPlural.toLowerCase()}</Link></p>}
      <div className="portal-detail-head">
        <div className="text">
          <span className="eyebrow">{[profile.label, e.subtitle].filter(Boolean).join(" · ")}</span>
          <h1>{e.title}</h1>
          {e.summary && <p className="lead">{e.summary}</p>}
        </div>
        {hero?.preview && (
          <figure className="hero">
            <ChImage links={hero.links} fallback={hero.preview} slot="detail" alt={hero.title} loading="eager" />
            {hero.download && <a className="download" href={hero.download} target="_blank" rel="noreferrer" download data-track={hero.id} data-track-title={hero.title}>{ui("downloadOriginal")}</a>}
          </figure>
        )}
      </div>

      {e.html && (
        <section className="portal-block">
          <h2>{ui("description")}</h2>
          <RichTextServer html={e.html} />
        </section>
      )}

      {e.fields.length > 0 && (
        <section className="portal-block">
          <h2>{ui("details")}</h2>
          <table className="portal-table">
            <tbody>{e.fields.map((f) => (<tr key={f.label}><th>{f.label}</th><td>{f.value}</td></tr>))}</tbody>
          </table>
        </section>
      )}

      {e.images.length > 1 && (
        <section className="portal-block">
          <h2>{ui("images")}</h2>
          <div className="portal-asset-grid">
            {e.images.slice(1).map((a) => (
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

      {e.files.length > 0 && (
        <section className="portal-block">
          <h2>{ui("files")}</h2>
          <FileList files={e.files} />
        </section>
      )}

      {e.relations.map((rel) => (
        <section key={rel.name} className="portal-block ch-items ch-items-cards">
          <h2>{rel.label}</h2>
          <EntityItems variant="cards" cards={rel.items} />
        </section>
      ))}
    </article>
  );
};
