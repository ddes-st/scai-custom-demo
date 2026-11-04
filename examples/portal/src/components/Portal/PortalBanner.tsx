import React from "react";
import { Image, Link, Text, type Field, type ImageField, type LinkField } from "@sitecore-content-sdk/nextjs";
import { chrome, fieldsOf, isEditing, param, type PortalComponentProps } from "src/lib/portal/component";
import { EditorNotice } from "src/lib/portal/editor";
import { pickedImage } from "src/lib/portal/image-pick";
import { ChImage } from "components/ui/portal/ChImage";
import { portalImageField } from "src/lib/portal/dam-image";

/**
 * A banner with an authored image (datasource template Portal Banner: ImagePick, Image, Eyebrow,
 * Title, Text, Link). ImagePick ("Content Hub image", Open app) is an asset of this portal's own
 * Content Hub tenant, served from its best-fitting public link; it wins over Image, which is
 * picked in the media dialog (the DAM connector serves one tenant per environment). Nothing is
 * copied into SitecoreAI. Rendering parameter Variant: "full" (image behind the text) or "split" (image
 * beside the text) or "guide" (brand-hub: the same split on a full-bleed brand band).
 */
export const Default = async (props: PortalComponentProps) => {
  const fields = fieldsOf(props);
  const image = portalImageField(fields.Image as ImageField | undefined, 1920);
  const pick = await pickedImage((fields.ImagePick as Field<string> | undefined)?.value);
  const eyebrow = fields.Eyebrow as Field<string> | undefined;
  const title = fields.Title as Field<string> | undefined;
  const text = fields.Text as Field<string> | undefined;
  const link = fields.Link as LinkField | undefined;
  const editing = isEditing(props.page);
  const raw = param(props, "Variant").toLowerCase();
  const variant = raw === "guide" || raw === "split" ? raw : "full";
  const c = chrome(props);
  const hasImage = !!pick.image || !!image?.value?.src;
  const hasText = !!(title?.value || text?.value || eyebrow?.value);

  if (!hasImage && !hasText) {
    return editing ? (
      <EditorNotice title="Banner">
        {fields.Image ? "Pick an image (Content Hub image field → Open app) and write a title." : "This banner has no content item: select it and assign one under Data → Portal Banners (the demo's is “Home banner”). Until then the panel shows the page's own fields — an image picked there is the page hero's, not this banner's."}
      </EditorNotice>
    ) : null;
  }

  return (
    <section className={`site-banner site-banner-${variant}${hasImage ? "" : " no-image"} ${c.className}`.trim()} id={c.id}>
      {(hasImage || editing) && (
        <div className="media">
          {pick.image ? <ChImage links={pick.image.links} fallback={pick.image.src} slot={variant === "full" ? "wide" : "lead"} alt={pick.image.title} /> : <Image field={image} />}
          {editing && pick.missing && <EditorNotice title="Content Hub image">“{pick.missing}” isn’t on Experience Edge (not approved, not published or outside the brand scope).</EditorNotice>}
        </div>
      )}
      <div className="body">
        {(eyebrow?.value || editing) && <span className="eyebrow"><Text field={eyebrow} /></span>}
        {(title?.value || editing) && <h2><Text field={title} /></h2>}
        {(text?.value || editing) && <p><Text field={text} /></p>}
        {link && (link.value?.href || editing) && <Link field={link} className="site-button" />}
      </div>
    </section>
  );
};
