import React from "react";
import { Link } from "src/i18n/navigation";
import { env } from "src/lib/ch/env";
import { formatDate, loadPress, loadRelease } from "src/lib/ch/press";
import { attempt } from "src/lib/ch/portalEdge";
import { requestContext } from "src/lib/portal/request-context";
import { pressHref, SECTION_PATH } from "src/lib/portal/sections";
import { chrome, isEditing, type PortalComponentProps } from "src/lib/portal/component";
import { EditorNotice, LoadError } from "src/lib/portal/editor";
import { getPortalSettings } from "src/lib/portal/settings";
import { RichTextServer } from "components/ui/portal/RichTextServer";
import { FileList } from "components/ui/portal/FileList";
import { TrackView } from "components/ui/portal/UsageTracker";
import { JsonLd } from "components/ui/portal/JsonLd";
import { getBaseUrl } from "lib/utils";
import { ui } from "src/lib/portal/ui-text";
import { ChImage } from "components/ui/portal/ChImage";

/** One press release (/press/<id>, a wildcard page): hero, body, boilerplate, contact and media kit. */
export const Default = async (props: PortalComponentProps) => {
  const editing = isEditing(props.page);
  const { slug: urlId } = requestContext();
  const c = chrome(props);
  if (!env.edgeToken) {
    const msg = "This section reads Experience Edge for Content Hub, which isn't connected (EDGE_TOKEN).";
    return editing ? <EditorNotice title="Press release">{msg}</EditorNotice> : <LoadError message={msg} />;
  }
  let id = urlId;
  if (!id && editing) {
    const sample = await attempt(async () => (await loadPress())?.[0]?.id ?? "");
    id = sample.data ?? "";
    if (!id) return <EditorNotice title="Press release">{sample.error ?? "No published press release yet — the live page renders the release from the URL (/press/<id>)."}</EditorNotice>;
  }
  if (!id) return <LoadError message="No press release in the URL." missing />;
  const res = await attempt(() => loadRelease(id));
  if (res.error) return editing ? <EditorNotice title="Press release">{res.error}</EditorNotice> : <LoadError message={res.error} />;
  const r = res.data;
  if (!r) return editing ? <EditorNotice title="Press release">No published release with id “{id}”.</EditorNotice> : <LoadError message="This press release isn't published." missing />;
  const hero = r.media.find((m) => m.preview);
  const settings = await getPortalSettings(props.page.siteName, props.page.locale);
  const releaseLd = {
    "@type": "NewsArticle",
    headline: r.title,
    ...(r.lead && { description: r.lead }),
    ...(r.date && { datePublished: r.date }),
    ...(hero?.preview && { image: [hero.preview] }),
    ...(r.brands[0] && { publisher: { "@type": "Organization", name: r.brands[0] } }),
    mainEntityOfPage: `${getBaseUrl()}${pressHref(r.id)}`,
  };

  return (
    <article className={`portal-detail press ${c.className}`.trim()} id={c.id}>
      {!editing && <JsonLd data={releaseLd} />}
      {editing && urlId === "" && <EditorNotice title="Sample release shown">The live page renders the release from the URL (/press/&lt;id&gt;).</EditorNotice>}
      {settings.trackUsage && !editing && <TrackView kind="press" id={r.id} title={r.title} />}
      <p className="portal-note"><Link href={SECTION_PATH.press}>{ui("allReleasesBack")}</Link></p>
      <span className="eyebrow">{[ui("pressRelease"), formatDate(r.date), r.brands.join(", ")].filter(Boolean).join(" · ")}</span>
      <h1>{r.title}</h1>
      {r.lead && <p className="lead">{r.lead}</p>}
      {hero && (
        <figure className="hero wide">
          <ChImage links={hero.links} fallback={hero.preview} slot="wide" alt={hero.title} loading="eager" />
          <figcaption>{hero.title}</figcaption>
        </figure>
      )}
      <div className="portal-press-body">
        <div className="main">
          <RichTextServer html={r.bodyHtml} />
          {r.boilerplateHtml && (
            <section className="boilerplate">
              <h2>{r.brands[0] ? ui("aboutBrand", { name: r.brands[0] }) : ui("aboutUs")}</h2>
              <RichTextServer html={r.boilerplateHtml} />
            </section>
          )}
        </div>
        <aside>
          {r.contact && (
            <section>
              <h2>{ui("pressContact")}</h2>
              <RichTextServer html={r.contact} />
            </section>
          )}
          {r.media.length > 0 && (
            <section>
              <h2>{ui("mediaKit")}</h2>
              <FileList files={r.media} />
            </section>
          )}
        </aside>
      </div>
    </article>
  );
};
