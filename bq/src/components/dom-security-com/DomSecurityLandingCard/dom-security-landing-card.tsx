import { Image, Link, RichText, Text } from "@sitecore-content-sdk/nextjs";
import type { ImageField, LinkField, RichTextField, TextField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps } from "lib/component-props";

interface Fields {
  Title: TextField;
  Text: RichTextField;
  Image: ImageField;
  Link: LinkField;
}

type LandingCardProps = ComponentProps & { fields: Fields };

const CDN = "https://p-cdn-sfpi.azureedge.net/fr/fr/-/media/DOM";

/** Live CDN art used when the Sitecore image field is still empty. */
const FALLBACK_IMAGES: Record<string, string> = {
  "Suivez l'historique des accès": `${CDN}/DOM-Global/dom-eniq/access-control-grid-scroll-1.jpg?extension=webp`,
  "Accordez des autorisations flexibles en temps réel": `${CDN}/DOM-Global/dom-eniq/access-control-grid-scroll-2.jpg?extension=webp`,
  "Chiffrement de haute sécurité": `${CDN}/DOM-Global/dom-eniq/access-control-grid-scroll-3.jpg?extension=webp`,
  "Risque minimal": `${CDN}/DOM-Global/dom-eniq/access-control-grid-scroll-4.jpg?extension=webp`,
  Performance: `${CDN}/DOM-France/sandbox/icone-performance.svg?h=80&w=80&extension=webp`,
  "Cybersécurité embarquée": `${CDN}/DOM-France/sandbox/icone-cybersecurite-embarquee.svg?h=80&w=80&extension=webp`,
  "Matériel ENiQ et Tapkey": `${CDN}/DOM-France/sandbox/icone-eniq-tapkey-hardware.svg?h=80&w=80&extension=webp`,
  Design: `${CDN}/DOM-France/sandbox/icone-design.svg?h=80&w=80&extension=webp`,
  "France TV": `${CDN}/DOM-France/references/logo-france-tv-gris.png?h=512&w=512&extension=webp`,
  CHU: `${CDN}/DOM-France/references/logo-chu-gris.png?h=512&w=512&extension=webp`,
  Framatome: `${CDN}/DOM-France/references/logo-framatome-gris.png?h=512&w=512&extension=webp`,
  "Port de La Rochelle": `${CDN}/DOM-France/references/logo-port-rochelle-gris.png?h=512&w=512&extension=webp`,
  RATP: `${CDN}/DOM-France/references/logo-ratp-gris.png?h=512&w=512&extension=webp`,
  Total: `${CDN}/DOM-France/references/logo-total-gris.png?h=512&w=512&extension=webp`,
  "Logiciel ENiQ": `${CDN}/DOM-Global/dom-eniq/icons/eniq-software.jpg?extension=webp`,
  "ENiQ App": `${CDN}/DOM-Global/dom-eniq/icons/eniq-app.jpg?extension=webp`,
  "DOM Tapkey": `${CDN}/DOM-Global/dom-eniq/icons/tapkey.jpg?extension=webp`,
  "DOM Guard": `${CDN}/DOM-Global/dom-eniq/the-guard.jpg?mw=900&crop=1&extension=webp`,
  "DOM Pro": `${CDN}/DOM-Global/dom-eniq/the-pro.jpg?mw=900&crop=1&extension=webp`,
  "DOM Loq": `${CDN}/DOM-Global/dom-eniq/the-loq.jpg?mw=900&crop=1&extension=webp`,
  "DOM Wallreader": `${CDN}/DOM-Global/dom-eniq/the-wall-reader.jpg?mw=900&crop=1&extension=webp`,
};

function hasLink(field: LinkField | undefined): boolean {
  const href = field?.value?.href;
  return typeof href === "string" && href.trim().length > 0;
}

function titleText(field: TextField | undefined): string {
  return typeof field?.value === "string" ? field.value.trim() : "";
}

export const Default = (props: LandingCardProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const title = titleText(fields.Title);
  const sitecoreSrc = fields.Image?.value?.src;
  const fallbackSrc = FALLBACK_IMAGES[title];

  return (
    <article
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="landing-card flex h-full flex-col bg-transparent font-[Source_Sans_Pro] font-light text-[#333]"
    >
      {sitecoreSrc || fallbackSrc ? (
        <div className="landing-card-media">
          {sitecoreSrc ? (
            <Image field={fields.Image} className="block h-full w-full object-cover" />
          ) : (
            <img src={fallbackSrc} alt={title} className="block h-full w-full object-cover" />
          )}
        </div>
      ) : null}
      <div className="landing-card-copy">
        <Text
          field={fields.Title}
          tag="h3"
          className="landing-card-title m-0 mb-3 text-[1.35rem] font-light leading-snug text-[#111]"
        />
        <RichText
          field={fields.Text}
          className="landing-card-text text-[1rem] leading-[1.55rem] text-[#333] [&_p]:mb-3"
        />
        {hasLink(fields.Link) ? (
          <Link
            field={fields.Link}
            className="landing-card-link mt-auto inline-block pt-2 text-[1rem] text-[#00a0de] no-underline hover:underline"
          />
        ) : null}
      </div>
    </article>
  );
};
