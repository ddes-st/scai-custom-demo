import React from "react";
import { Image, Text, type Field, type ImageField } from "@sitecore-content-sdk/nextjs";
import { chrome, isEditing, param, routeFields, type PortalComponentProps } from "src/lib/portal/component";
import { EditorNotice } from "src/lib/portal/editor";
import { pickedImage } from "src/lib/portal/image-pick";
import { ChImage } from "components/ui/portal/ChImage";
import { HeroSearch } from "components/ui/portal/HeroSearch";
import { portalImageField } from "src/lib/portal/dam-image";
import { heroPrompts } from "src/lib/portal/hero-prompts";
import { ui } from "src/lib/portal/ui-text";

/**
 * The page hero from the page's own fields (templates Portal Home/Section Page: Eyebrow,
 * Title, Lead, and an optional image: HeroImagePick — a "Content Hub image" from this portal's
 * own tenant (Open app), served from its best-fitting public link — or else HeroImage, picked
 * through the media dialog's DAM connector).
 * Rendering parameter Variant: "home" (large), "compact" (section pages) or "search"
 * (brand-hub: headline, scoped search and one suggestion chip per line of Lead).
 */
export const Default = async (props: PortalComponentProps) => {
  const f = routeFields(props.page);
  const pick = await pickedImage((f.HeroImagePick as Field<string> | undefined)?.value);
  const eyebrow = f.Eyebrow as Field<string> | undefined;
  const title = f.Title as Field<string> | undefined;
  const lead = f.Lead as Field<string> | undefined;
  const image = portalImageField(f.HeroImage as ImageField | undefined, 1920);
  const hasImage = !!pick.image || !!image?.value?.src;
  const variant = param(props, "Variant").toLowerCase();
  const compact = variant !== "home" && variant !== "search";
  const editing = isEditing(props.page);
  const c = chrome(props);
  if (variant === "search") {
    return (
      <section className={`variant-search site-index-hero ${c.className}`.trim()} id={c.id}>
        <div className="text">
          <h1 className="hub-display"><Text field={title} /></h1>
        </div>
        <HeroSearch
          prompts={heroPrompts(String(lead?.value ?? ""))}
          placeholder={ui("hubSearchPlaceholder")}
          searchLabel={ui("search")}
          kinds={[
            { id: "", label: ui("hubAnything") },
            { id: "image", label: ui("images") },
            { id: "video", label: ui("videos") },
            { id: "document", label: ui("documents") },
          ]}
        />
        {editing && (
          <p className="lead"><Text field={lead} /></p>
        )}
      </section>
    );
  }
  return (
    <div className={`site-index-hero${compact ? " compact" : ""}${hasImage ? " with-image" : ""} ${c.className}`.trim()} id={c.id}>
      <div className="text">
        {(eyebrow?.value || editing) && <span className="eyebrow"><Text field={eyebrow} /></span>}
        <h1><Text field={title} /></h1>
        {(lead?.value || editing) && <p className="lead"><Text field={lead} /></p>}
      </div>
      {(hasImage || editing) && (
        <div className="media">
          {pick.image ? <ChImage links={pick.image.links} fallback={pick.image.src} slot="lead" alt={pick.image.title} loading="eager" /> : <Image field={image} />}
          {editing && pick.missing && <EditorNotice title="Content Hub image">“{pick.missing}” isn’t on Experience Edge (not approved, not published or outside the brand scope).</EditorNotice>}
        </div>
      )}
    </div>
  );
};
