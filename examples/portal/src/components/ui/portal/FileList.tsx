import { sizedFileUrl } from "src/lib/ch/fileUrl";
import React from "react";
import type { PortalAsset } from "src/lib/ch/portalEdge";
import { ui } from "src/lib/portal/ui-text";

/** Files with a thumbnail (or the extension) and a download link (tracked by the usage tracker). */
export function FileList({ files }: { files: PortalAsset[] }) {
  return (
    <ul className="portal-files">
      {files.map((m) => (
        <li key={m.id}>
          {m.preview ? <img src={sizedFileUrl(m.preview, 320)} alt="" loading="lazy" decoding="async" /> : <span className="ext">{(m.fileName.split(".").pop() || m.kind).toUpperCase()}</span>}
          <span className="title">{m.title}</span>
          {m.download ? (
            <a href={m.download} target="_blank" rel="noreferrer" download data-track={m.id} data-track-title={m.title}>{ui("download")}</a>
          ) : (
            <span className="muted">{ui("noPublicLink")}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
