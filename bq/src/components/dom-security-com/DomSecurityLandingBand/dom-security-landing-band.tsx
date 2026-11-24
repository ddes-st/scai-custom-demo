import { AppPlaceholder, Image, Link, RichText, Text } from "@sitecore-content-sdk/nextjs";
import type { ImageField, LinkField, RichTextField, TextField } from "@sitecore-content-sdk/nextjs";
import componentMap from ".sitecore/component-map";
import type { ComponentWithContextProps } from "lib/component-props";

interface Fields {
  Title: TextField;
  Subtitle: TextField;
  Body: RichTextField;
  Image: ImageField;
  Link: LinkField;
}

type LandingBandProps = ComponentWithContextProps & { fields: Fields };

const CDN = "https://p-cdn-sfpi.azureedge.net/fr/fr/-/media/DOM";
const HERO_VIDEO = `${CDN}/DOM-Global/Video/Hero/Extrait2-VDO-Site-v4.mp4?modified=20220310161820`;
const CHOOSER_BG = `${CDN}/DOM-Global/dom-eniq/background-cant-find.jpg?extension=webp`;
const INTEGRATE_IMAGE = `${CDN}/DOM-Global/dom-eniq/integrate-security.jpg?h=372&iar=0&w=555&extension=webp`;

const bodyClassName = [
  "text-[18px] font-light leading-[25.7px] text-[#333]",
  "[&_p]:mb-4 [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-[1.35rem] [&_h3]:font-light [&_h3]:text-[#111]",
  "[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6",
  "[&_a]:text-[#00a0de] [&_a]:no-underline hover:[&_a]:underline",
  "[&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-[#e4e4e4] [&_th]:px-3 [&_th]:py-3 [&_th]:text-left",
  "[&_td]:border [&_td]:border-[#e4e4e4] [&_td]:px-3 [&_td]:py-3 [&_td]:text-center",
  "[&_thead_th]:bg-[#f7f7f7] [&_thead_th]:font-normal",
].join(" ");

const headingClass =
  "dom-accent !mb-0 max-w-[16ch] text-[1.6rem] leading-tight md:!text-[45.9px] md:!leading-[50px]";

function sectionId(props: LandingBandProps): string | undefined {
  const params = props.params ?? props.rendering?.params ?? {};
  return params.RenderingIdentifier || params.id || undefined;
}

function plain(field: TextField | undefined): string {
  return typeof field?.value === "string" ? field.value.trim() : "";
}

function linkHref(field: LinkField | undefined): string {
  const href = field?.value?.href;
  return typeof href === "string" ? href : "";
}

function Cards(props: LandingBandProps) {
  const params = props.params ?? props.rendering?.params ?? {};
  const dynId = params.DynamicPlaceholderId;
  const placeholderName = dynId ? `landing-cards-${dynId}` : "landing-cards";
  return (
    <AppPlaceholder
      name={placeholderName}
      rendering={props.rendering}
      page={props.page}
      componentMap={componentMap}
    />
  );
}

function accessLayout(props: LandingBandProps): string | null {
  const id = sectionId(props) || "";
  if (id.startsWith("access-")) return id;
  const title = plain(props.fields?.Title);
  if (title.startsWith("Contrôle d'accès")) return "access-hero";
  if (title.startsWith("Qu'est-ce")) return "access-intro";
  if (title.startsWith("Découvrez l'efficacité")) return "access-benefits";
  if (title.startsWith("Définissez comment")) return "access-manage";
  if (title.startsWith("Comparez les systèmes")) return "access-compare";
  if (title.startsWith("Vous ne savez pas")) return "access-chooser";
  if (title.startsWith("Demandez votre brochure")) return "access-brochure";
  if (title.startsWith("Intégrez l'écosystème")) return "access-integrate";
  if (title.startsWith("Découvrez les produits")) return "access-products";
  return null;
}

function AccessHero(props: LandingBandProps) {
  return (
    <section id={sectionId(props)} className="relative min-h-[100svh] overflow-hidden bg-[#111] font-[Source_Sans_Pro] text-white">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      >
        <source src={HERO_VIDEO} type="video/mp4" />
      </video>
      <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-[1170px] items-center px-[15px]">
        <Text
          field={props.fields.Title}
          tag="h1"
          className="m-0 max-w-[570px] text-[2rem] font-light leading-[1.15] text-white md:text-[70.2px] md:leading-[77.22px]"
        />
      </div>
    </section>
  );
}

function AccessIntro(props: LandingBandProps) {
  return (
    <section id={sectionId(props)} className="bg-white py-10 font-[Source_Sans_Pro] md:py-[90px]">
      <div className="mx-auto grid w-full max-w-[1170px] items-start gap-8 px-[15px] md:grid-cols-12">
        <Text field={props.fields.Title} tag="h2" className={`${headingClass} !max-w-none md:col-span-5`} />
        <div className={`${bodyClassName} text-[#4a4a4a] md:col-span-6 md:col-start-7`}>
          <RichText field={props.fields.Body} />
        </div>
      </div>
    </section>
  );
}

function AccessIcons(props: LandingBandProps) {
  return (
    <section id={sectionId(props)} className="bg-[#e3e3e3] py-[90px] font-[Source_Sans_Pro]">
      <div className="mx-auto grid w-full max-w-[980px] grid-cols-2 gap-x-8 gap-y-16 px-[15px] [&_.landing-card-link]:hidden [&_.landing-card-text]:hidden [&_.landing-card-title]:sr-only [&_.landing-card-media]:flex [&_.landing-card-media]:h-[208px] [&_.landing-card-media]:items-center [&_.landing-card-media]:justify-center [&_.landing-card-media_img]:h-20 [&_.landing-card-media_img]:w-20 [&_.landing-card-media_img]:object-contain">
        <Cards {...props} />
      </div>
    </section>
  );
}

function AccessBenefits(props: LandingBandProps) {
  return (
    <section id={sectionId(props)} className="bg-white py-10 font-[Source_Sans_Pro] md:py-[90px]">
      <div className="mx-auto flex w-full max-w-[1170px] flex-col gap-10 px-[15px] md:flex-row md:items-start">
        <Text
          field={props.fields.Title}
          tag="h2"
          className={`${headingClass} md:sticky md:top-28 md:w-[320px] md:shrink-0`}
        />
        <div className="min-w-0 flex-1 [&_.landing-card]:mb-14 [&_.landing-card]:!grid [&_.landing-card]:grid-cols-1 [&_.landing-card]:gap-6 md:[&_.landing-card]:grid-cols-[380px_minmax(0,1fr)] md:[&_.landing-card]:items-center md:[&_.landing-card]:gap-x-10 [&_.landing-card:nth-child(even)]:md:grid-cols-[minmax(0,1fr)_380px] [&_.landing-card:nth-child(even)_.landing-card-media]:md:col-start-2 [&_.landing-card:nth-child(even)_.landing-card-copy]:md:col-start-1 [&_.landing-card:nth-child(even)_.landing-card-copy]:md:row-start-1 [&>div:nth-child(even)_.landing-card]:md:grid-cols-[minmax(0,1fr)_380px] [&>div:nth-child(even)_.landing-card-media]:md:col-start-2 [&>div:nth-child(even)_.landing-card-copy]:md:col-start-1 [&_.landing-card-media]:md:h-[360px] [&_.landing-card-title]:mb-3 [&_.landing-card-title]:text-[30px] [&_.landing-card-title]:font-light [&_.landing-card-title]:leading-snug [&_.landing-card-title]:text-[#333] [&_.landing-card-text]:text-[18px] [&_.landing-card-text]:leading-[26px] [&_.landing-card-text]:text-[#666] [&_.landing-card-link]:hidden">
          <Cards {...props} />
        </div>
      </div>
    </section>
  );
}

function AccessLogos(props: LandingBandProps) {
  return (
    <section id={sectionId(props)} className="bg-[#e3e3e3] py-[110px] font-[Source_Sans_Pro]">
      <div className="mx-auto flex w-full max-w-[1170px] flex-nowrap items-center justify-between px-[15px] [&_.landing-card]:w-[165px] [&_.landing-card]:shrink-0 [&_.landing-card-link]:hidden [&_.landing-card-text]:hidden [&_.landing-card-title]:sr-only [&_.landing-card-media]:flex [&_.landing-card-media]:h-[165px] [&_.landing-card-media]:w-[165px] [&_.landing-card-media]:items-center [&_.landing-card-media]:justify-center [&_.landing-card-media_img]:max-h-[165px] [&_.landing-card-media_img]:w-auto [&_.landing-card-media_img]:object-contain">
        <Cards {...props} />
      </div>
    </section>
  );
}

function AccessManage(props: LandingBandProps) {
  return (
    <section id={sectionId(props)} className="bg-white py-10 font-[Source_Sans_Pro] md:py-[90px]">
      <div className="mx-auto w-full max-w-[1170px] px-[15px]">
        <Text field={props.fields.Title} tag="h2" className={`${headingClass} mb-12 !max-w-none`} />
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3 [&_.landing-card-media]:mb-6 [&_.landing-card-media]:flex [&_.landing-card-media]:h-[145px] [&_.landing-card-media]:items-center [&_.landing-card-media]:justify-center [&_.landing-card-media_img]:max-h-[145px] [&_.landing-card-media_img]:w-auto [&_.landing-card-media_img]:object-contain [&_.landing-card-title]:mb-3 [&_.landing-card-title]:text-[30px] [&_.landing-card-title]:font-light [&_.landing-card-text]:text-[18px] [&_.landing-card-text]:leading-[26px] [&_.landing-card-text]:text-[#666]">
          <Cards {...props} />
        </div>
      </div>
    </section>
  );
}

function Check() {
  return (
    <span aria-label="Oui" className="inline-block text-[1.25rem] leading-none text-[#333]">
      ✓
    </span>
  );
}

function AccessCompare(props: LandingBandProps) {
  const columns = [
    {
      name: "Logiciel ENiQ",
      image: `${CDN}/DOM-Global/dom-eniq/icons/eniq-software.jpg?extension=webp`,
      platform: `${CDN}/DOM-Global/dom-eniq/icons/windows-eniq-software.gif?extension=webp`,
      doors: "100+ portes",
      users: "Jusqu'à 100 000 utilisateurs",
      admins: true,
      keys: true,
      href: "https://www.dom-security.com/fr/fr/produits-1/access-control",
    },
    {
      name: "ENiQ App",
      image: `${CDN}/DOM-Global/dom-eniq/icons/eniq-app.jpg?extension=webp`,
      platform: `${CDN}/DOM-Global/dom-eniq/icons/android-eniq-app.gif?extension=webp`,
      doors: "<100 portes",
      users: "<500 utilisateurs",
      admins: false,
      keys: true,
      href: "https://www.dom-security.com/fr/fr/produits-1/access-control",
    },
    {
      name: "DOM Tapkey",
      image: `${CDN}/DOM-Global/dom-eniq/icons/tapkey.jpg?extension=webp`,
      platform: `${CDN}/DOM-Global/dom-eniq/icons/ios-tapkey-1.jpg?extension=webp`,
      doors: "<100 portes",
      users: "N/A, basé sur le Cloud",
      admins: true,
      keys: true,
      href: "https://www.dom-security.com/fr/fr/produits-1/dom-tapkey-family/dom-tapkey-for-coworking",
    },
  ];
  const rows = [
    { label: "Nombre de portes", values: columns.map((column) => column.doors) },
    { label: "Nombre d'utilisateurs", values: columns.map((column) => column.users) },
  ];

  return (
    <section id={sectionId(props)} className="bg-white py-10 font-[Source_Sans_Pro] md:py-[70px]">
      <div className="mx-auto w-full max-w-[1170px] px-[15px]">
        <Text field={props.fields.Title} tag="h2" className={`${headingClass} mb-10 !max-w-[24ch]`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-[16px] font-light text-[#333]">
            <thead>
              <tr>
                <th className="w-[24%] border-b border-[#e4e4e4]" />
                {columns.map((column) => (
                  <th key={column.name} className="border-b border-[#e4e4e4] px-4 py-4 text-center font-normal">
                    <img src={column.image} alt="" className="mx-auto mb-3 h-[125px] w-[125px] object-contain" />
                    <span className="block text-[18px]">{column.name}</span>
                    <img src={column.platform} alt="" className="mx-auto mt-3 h-11 w-auto object-contain" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <th className="border-b border-[#e4e4e4] px-3 py-4 text-left font-normal">{row.label}</th>
                  {row.values.map((value, index) => (
                    <td key={`${row.label}-${index}`} className="border-b border-[#e4e4e4] px-3 py-4 text-center">
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <th className="border-b border-[#e4e4e4] px-3 py-4 text-left font-normal">Plusieurs administrateurs</th>
                {columns.map((column) => (
                  <td key={column.name} className="border-b border-[#e4e4e4] px-3 py-4 text-center">
                    {column.admins ? <Check /> : "—"}
                  </td>
                ))}
              </tr>
              <tr>
                <th className="border-b border-[#e4e4e4] px-3 py-4 text-left font-normal">Clés mobiles et badges</th>
                {columns.map((column) => (
                  <td key={column.name} className="border-b border-[#e4e4e4] px-3 py-4 text-center">
                    {column.keys ? <Check /> : "—"}
                  </td>
                ))}
              </tr>
              <tr>
                <th className="px-3 py-5" />
                {columns.map((column) => (
                  <td key={column.name} className="px-3 py-5 text-center">
                    <a href={column.href} className="text-[#00a0de] no-underline hover:underline">
                      Découvrir
                    </a>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function AccessChooser(props: LandingBandProps) {
  const primary = "https://www.dom-security.com/fr/fr/produits-1/access-control/configurator";
  return (
    <section
      id={sectionId(props)}
      className="relative bg-[#111] bg-cover bg-center py-16 font-[Source_Sans_Pro] text-white md:py-[90px]"
      style={{ backgroundImage: `url(${CHOOSER_BG})` }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/10" />
      <div className="relative z-10 mx-auto w-full max-w-[1170px] px-[15px]">
        <Text
          field={props.fields.Title}
          tag="h2"
          className="m-0 mb-4 max-w-[920px] text-[2rem] font-light leading-tight text-white md:text-[45.9px] md:leading-[50px]"
        />
        <div className="max-w-[520px] text-[18px] font-light leading-[26px] text-white [&_p]:mb-0">
          <RichText field={props.fields.Body} />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href={primary} className="inline-flex items-center gap-2 rounded-full bg-[#d51130] px-5 py-2.5 text-[16px] text-white no-underline hover:bg-[#a50d25]">
            Utiliser le configurateur <span aria-hidden="true">→</span>
          </a>
          <a href="#contact" className="inline-flex items-center rounded-full bg-white px-5 py-2.5 text-[16px] text-[#333] no-underline hover:bg-[#f3f3f3]">
            Nous contacter
          </a>
        </div>
      </div>
    </section>
  );
}

function AccessIntegrate(props: LandingBandProps) {
  const src = props.fields.Image?.value?.src || INTEGRATE_IMAGE;
  const href = linkHref(props.fields.Link) || "https://www.dom-security.com/fr/fr/produits-1/domconnect";
  return (
    <section id={sectionId(props)} className="bg-white py-10 font-[Source_Sans_Pro] md:py-[70px]">
      <div className="mx-auto grid w-full max-w-[1170px] items-center gap-8 px-[15px] md:grid-cols-2">
        <img src={src} alt="" className="block h-auto w-full object-cover" />
        <div>
          <Text
            field={props.fields.Title}
            tag="h2"
            className="m-0 mb-8 text-[2rem] font-light leading-tight text-[#333] md:text-[45.9px] md:leading-[50px]"
          />
          <a href={href} className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-2.5 text-[16px] text-white no-underline hover:bg-[#222]">
            Découvrez DOMConnect <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </section>
  );
}

function AccessProducts(props: LandingBandProps) {
  return (
    <section id={sectionId(props)} className="bg-white py-10 font-[Source_Sans_Pro] md:py-[70px]">
      <div className="mx-auto w-full max-w-[1170px] px-[15px]">
        <Text field={props.fields.Title} tag="h2" className={`${headingClass} mb-10 !max-w-none`} />
        <div className="grid grid-cols-2 gap-4 pb-6 md:grid-cols-4 md:gap-6 [&_.landing-card]:relative [&_.landing-card-copy]:absolute [&_.landing-card-copy]:bottom-0 [&_.landing-card-copy]:left-3 [&_.landing-card-copy]:right-3 [&_.landing-card-copy]:z-10 [&_.landing-card-copy]:flex [&_.landing-card-copy]:translate-y-4 [&_.landing-card-copy]:flex-col [&_.landing-card-copy]:bg-white [&_.landing-card-copy]:px-6 [&_.landing-card-copy]:py-4 [&_.landing-card-copy]:pr-10 [&_.landing-card-copy]:shadow-[7px_7px_65px_-16px_rgba(0,0,0,0.75)] [&_.landing-card-copy]:after:absolute [&_.landing-card-copy]:after:right-4 [&_.landing-card-copy]:after:top-1/2 [&_.landing-card-copy]:after:-translate-y-1/2 [&_.landing-card-copy]:after:text-[20px] [&_.landing-card-copy]:after:content-['→'] [&_.landing-card-link]:absolute [&_.landing-card-link]:inset-0 [&_.landing-card-link]:z-20 [&_.landing-card-link]:text-[0] [&_.landing-card-media]:aspect-square [&_.landing-card-media_img]:h-full [&_.landing-card-media_img]:w-full [&_.landing-card-media_img]:object-cover [&_.landing-card-text]:order-1 [&_.landing-card-text]:mb-0 [&_.landing-card-text]:text-[16.2px] [&_.landing-card-text]:font-light [&_.landing-card-text]:leading-snug [&_.landing-card-text]:text-black [&_.landing-card-text_p]:mb-0 [&_.landing-card-title]:order-2 [&_.landing-card-title]:mb-0 [&_.landing-card-title]:text-[24.3px] [&_.landing-card-title]:font-normal [&_.landing-card-title]:leading-tight [&_.landing-card-title]:text-black">
          <Cards {...props} />
        </div>
      </div>
    </section>
  );
}

function AccessBrochure(props: LandingBandProps) {
  return (
    <section id={sectionId(props) || "access-brochure"} className="bg-[#e3e3e3] py-10 font-[Source_Sans_Pro] md:py-[90px]">
      <div className="mx-auto grid w-full max-w-[1170px] items-start gap-10 px-[15px] md:grid-cols-2">
        <div>
          <Text field={props.fields.Title} tag="h2" className={`${headingClass} mb-6 !max-w-none`} />
          <div className="text-[18px] font-light leading-[26px] text-[#333] [&_p]:mb-3">
            <RichText field={props.fields.Body} />
          </div>
        </div>
        <form className="grid grid-cols-6 gap-x-4 gap-y-4" action="https://www.dom-security.com/fr/fr/produits-1/access-control">
          {["Nom", "Entreprise"].map((label) => (
            <label key={label} className="col-span-6 block text-[14px] text-[#333] md:col-span-3">
              <span className="mb-1 block">{label}</span>
              <input className="w-full border border-[#d7d7d7] bg-white px-3 py-2 text-[16px]" name={label} />
            </label>
          ))}
          {["Code postal", "Adresse email", "Téléphone"].map((label) => (
            <label key={label} className="col-span-6 block text-[14px] text-[#333] md:col-span-2">
              <span className="mb-1 block">{label}</span>
              <input className="w-full border border-[#d7d7d7] bg-white px-3 py-2 text-[16px]" name={label} />
            </label>
          ))}
          <div className="col-span-6 flex justify-end">
            <button type="submit" className="inline-flex items-center gap-2 rounded-full bg-[#d51130] px-6 py-2.5 text-[16px] text-white hover:bg-[#a50d25]">
              Envoyer <span aria-hidden="true">→</span>
            </button>
          </div>
          <p className="col-span-6 m-0 text-right text-[14px] leading-snug text-[#666]">
            En cliquant sur ce formulaire, vous acceptez que les informations fournies soient transmises à DOM Security afin d'être traitées conformément à notre{" "}
            <a className="text-[#00a0de] underline" href="https://www.dom-security.com/fr/fr/protection-des-donnees">
              politique de protection des données
            </a>
            .
          </p>
        </form>
      </div>
    </section>
  );
}

function AccessBand(props: LandingBandProps, layout: string) {
  switch (layout) {
    case "access-hero":
      return <AccessHero {...props} />;
    case "access-intro":
      return <AccessIntro {...props} />;
    case "access-icons":
      return <AccessIcons {...props} />;
    case "access-benefits":
      return <AccessBenefits {...props} />;
    case "access-logos":
      return <AccessLogos {...props} />;
    case "access-manage":
      return <AccessManage {...props} />;
    case "access-compare":
      return <AccessCompare {...props} />;
    case "access-chooser":
      return <AccessChooser {...props} />;
    case "access-integrate":
      return <AccessIntegrate {...props} />;
    case "access-products":
      return <AccessProducts {...props} />;
    case "access-brochure":
      return <AccessBrochure {...props} />;
    default:
      return null;
  }
}

function GenericHero(props: LandingBandProps) {
  const { fields } = props;
  return (
    <section id={sectionId(props)} className="relative bg-[#111] font-[Source_Sans_Pro] font-light text-white">
      <Image field={fields.Image} className="block h-[280px] w-full object-cover md:h-[460px]" />
      <div className="absolute inset-0 bg-black/40" />
      <div className="absolute inset-0 flex items-end">
        <div className="mx-auto w-full max-w-[1170px] px-[15px] pb-10 md:pb-16">
          <Text field={fields.Title} tag="h1" className="m-0 max-w-[18ch] text-[2rem] font-light leading-tight md:text-[3.4rem]" />
          <Text field={fields.Subtitle} tag="p" className="m-0 mt-3 max-w-[36ch] text-[1.15rem] leading-snug text-white/90 md:text-[1.5rem]" />
        </div>
      </div>
    </section>
  );
}

function GenericDefault(props: LandingBandProps) {
  const { fields } = props;
  const imageSrc = fields.Image?.value?.src;
  const href = linkHref(fields.Link);
  return (
    <section id={sectionId(props)} className="bg-white py-10 font-[Source_Sans_Pro] md:py-16">
      {imageSrc ? (
        <div className="relative mb-8 min-h-[280px] overflow-hidden bg-[#111] text-white md:min-h-[460px]">
          <Image field={fields.Image} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-0 flex items-end">
            <div className="mx-auto w-full max-w-[1170px] px-[15px] pb-10 md:pb-16">
              <Text field={fields.Title} tag="h1" className="m-0 max-w-[18ch] text-[2rem] font-light leading-tight md:text-[3.4rem]" />
              <Text field={fields.Subtitle} tag="p" className="m-0 mt-3 max-w-[36ch] text-[1.15rem] leading-snug text-white/90 md:text-[1.5rem]" />
            </div>
          </div>
        </div>
      ) : null}
      <div className="mx-auto w-full max-w-[1170px] px-[15px]">
        {imageSrc ? null : (
          <Text field={fields.Title} tag="h2" className="m-0 mb-6 text-[1.8rem] font-light leading-snug text-[#111] md:text-[2.4rem]" />
        )}
        <Text field={fields.Subtitle} tag="p" className={imageSrc ? "hidden" : "m-0 mb-4 text-[1.15rem] text-[#646363]"} />
        <div className={bodyClassName}>
          <RichText field={fields.Body} />
        </div>
        <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          <Cards {...props} />
        </div>
        {href ? (
          <Link field={fields.Link} className="mt-6 inline-block bg-[#d51130] px-6 py-3 text-[1rem] text-white no-underline hover:bg-[#a50d25]" />
        ) : null}
      </div>
    </section>
  );
}

function GenericCardGrid(props: LandingBandProps) {
  return (
    <section id={sectionId(props)} className="bg-[#f7f7f7] py-10 font-[Source_Sans_Pro] md:py-16">
      <div className="mx-auto w-full max-w-[1170px] px-[15px]">
        <Text field={props.fields.Title} tag="h2" className="m-0 mb-8 max-w-[24ch] text-[1.8rem] font-light leading-snug text-[#111] md:text-[2.4rem]" />
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          <Cards {...props} />
        </div>
      </div>
    </section>
  );
}

function GenericSteps(props: LandingBandProps) {
  return (
    <section id={sectionId(props)} className="bg-white py-10 font-[Source_Sans_Pro] md:py-16">
      <div className="mx-auto w-full max-w-[1170px] px-[15px]">
        <Text field={props.fields.Title} tag="h2" className="m-0 mb-4 text-[1.8rem] font-light leading-snug text-[#111] md:text-[2.4rem]" />
        <div className={`${bodyClassName} mb-8 max-w-[70ch]`}>
          <RichText field={props.fields.Body} />
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <Cards {...props} />
        </div>
      </div>
    </section>
  );
}

function GenericCta(props: LandingBandProps) {
  return (
    <section id={sectionId(props)} className="bg-[#111] py-12 font-[Source_Sans_Pro] text-white md:py-16">
      <div className="mx-auto w-full max-w-[1170px] px-[15px]">
        <Text field={props.fields.Title} tag="h2" className="m-0 mb-4 max-w-[22ch] text-[1.8rem] font-light leading-snug md:text-[2.4rem]" />
        <div className="max-w-[62ch] text-[1rem] leading-[1.67rem] text-white/90 [&_p]:mb-4">
          <RichText field={props.fields.Body} />
        </div>
        <Link field={props.fields.Link} className="mt-4 inline-block bg-[#d51130] px-6 py-3 text-[1rem] text-white no-underline hover:bg-[#a50d25]" />
      </div>
    </section>
  );
}

function renderBand(props: LandingBandProps, variant: "Hero" | "Default" | "CardGrid" | "Steps" | "Cta") {
  const layout = accessLayout(props);
  if (layout) {
    const access = AccessBand(props, layout);
    if (access) return access;
  }
  if (variant === "Hero") return <GenericHero {...props} />;
  if (variant === "CardGrid") return <GenericCardGrid {...props} />;
  if (variant === "Steps") return <GenericSteps {...props} />;
  if (variant === "Cta") return <GenericCta {...props} />;
  return <GenericDefault {...props} />;
}

export const Hero = (props: LandingBandProps) => renderBand(props, "Hero");
export const Default = (props: LandingBandProps) => renderBand(props, "Default");
export const CardGrid = (props: LandingBandProps) => renderBand(props, "CardGrid");
export const Steps = (props: LandingBandProps) => renderBand(props, "Steps");
export const Cta = (props: LandingBandProps) => renderBand(props, "Cta");
