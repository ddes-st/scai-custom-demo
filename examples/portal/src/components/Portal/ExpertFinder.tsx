import React from "react";
import { attempt } from "src/lib/ch/portalEdge";
import { loadExperts } from "src/lib/ch/university";
import { chrome, isEditing, type PortalComponentProps } from "src/lib/portal/component";
import { EditorNotice, LoadError } from "src/lib/portal/editor";
import { ExpertBrowser } from "components/ui/portal/university/ExpertBrowser";
import { universityMissing } from "components/ui/portal/university/shared";

/** The media room's expert finder: faculty experts by topic and language, media-trained filter; portraits only with photo consent. */
export const Default = async (props: PortalComponentProps) => {
  const editing = isEditing(props.page);
  const c = chrome(props);
  const missing = universityMissing("experts", "Expert finder", editing);
  if (missing !== false) return missing;
  const res = await attempt(() => loadExperts());
  if (res.error) return editing ? <EditorNotice title="Expert finder">{res.error}</EditorNotice> : <LoadError message={res.error} />;
  const experts = res.data ?? [];
  if (!experts.length) return editing ? <EditorNotice title="Expert finder">No experts are published.</EditorNotice> : null;
  return (
    <div className={c.className || undefined} id={c.id}>
      <ExpertBrowser experts={experts.map((e) => ({ id: e.id, name: e.name, title: e.title, topics: e.topics, languages: e.languages, mediaTrained: e.mediaTrained, portrait: e.portrait ? { preview: e.portrait.preview, links: e.portrait.links } : null }))} />
    </div>
  );
};
