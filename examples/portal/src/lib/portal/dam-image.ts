import type { ImageField } from "@sitecore-content-sdk/nextjs";
import { env } from "src/lib/ch/env";
import { gatedFileUrl, imageFromOrigin, sizedFileUrl } from "src/lib/ch/fileUrl";

/** A Content Hub public link: https://<tenant>/api/public/content/<relative url>[?v=…]. */
const CH_PUBLIC = /^https:\/\/[^/]+\/api\/public\/content\/([\w.-]+)(?:\?(.*))?$/i;

/**
 * A SitecoreAI Image field filled through the Content Hub DAM connector (the media dialog's Content
 * hub tab: the value is the asset's public link plus its `dam-id`) as the portal serves it. When
 * binaries go through /api/asset (hybrid, gated, PORTAL_FILES=asset) the image comes from there too
 * — the same public link, after the access check, resized to `width` — so the page carries no
 * Content Hub link (renders and crawls don't count as public-link views). Other values unchanged;
 * the field's editing metadata is kept.
 */
export function portalImageField(field: ImageField | undefined, width = 0): ImageField | undefined {
  const v = field?.value as Record<string, unknown> | undefined;
  if (!field || !v || !env.gatedFiles) return field;
  const m = CH_PUBLIC.exec(String(v.src ?? ""));
  const damId = String(v["dam-id"] ?? "").trim();
  if (!m || !damId) return field;
  const version = new URLSearchParams(m[2] ?? "").get("v") ?? "";
  const url = gatedFileUrl(damId, { publicLink: m[1], version });
  // the connector's own thumbnail / srcset point at Content Hub too
  const { thumbnailsrc: _thumb, srcset: _srcset, ...rest } = v;
  void _thumb; void _srcset;
  // an editing host: from the live portal (fileUrl.imageOrigin)
  return { ...field, value: { ...rest, src: imageFromOrigin(width ? sizedFileUrl(url, width) : url) } } as ImageField;
}
