import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

const CDN = "https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/PimDam/jpg/dom";
const img = (path: string, webp = true) =>
  `${CDN}/${path}${webp ? "?extension=webp" : ""}`;

const IMG = {
  dc1: img("e/elsprodc1sided/domelsprodc1sided-main-stainlesssteel-greenled.jpg"),
  dc1Angle: img("e/elsprodc1sided/domelsprodc1sided-angle-stainlesssteel-ledoff.jpg"),
  dc1AngleOn: img("e/elsprodc1sided/domelsprodc1sided-angle-stainlesssteel-greenled.jpg"),
  dc1Front: img("e/elsprodc1sided/domelsprodc1sided-front-stainlesssteel-greenled.jpg"),
  dc1Back: img("e/elsprodc1sided/domelsprodc1sided-back-stainlesssteel-greenled.jpg"),
  lever: img("e/elspro382/domelspro382-main-stainlesssteel-greenled.jpg"),
  leverAngle: img("e/elspro382/domelspro382-angle-stainlesssteel-ledoff.jpg"),
  padlock: img("e/elspropadlock/domelspropadlock-main-stainlesssteel-greenled.jpg"),
  padlockAngle: img("e/elspropadlock/domelspropadlock-angle-stainlesssteel-ledoff.jpg"),
  dc1oi: img("e/elsprodc1sidedoi/domelsprodc1sidedoi-main-stainlesssteel-greenled.jpg"),
  dc2: img("e/elsprodc2sided/domelsprodc2sided-main-stainlesssteel-greenled.jpg"),
  dc2Angle: img("e/elsprodc2sided/domelsprodc2sided-angle-stainlesssteel-ledoff.jpg"),
  ee1: img("e/elsproee1sided/domelsproee1sided-main-stainlesssteel-greenled.jpg"),
  ee1mi: img("e/elsproee1sidedmi/domelsproee1sidedmi-main-stainlesssteel-greenled.jpg"),
  ee1oi: img("e/elsproee1sidedoi/domelsproee1sidedoi-main-stainlesssteel-greenled.jpg"),
  glass: img("e/elsprodcglassdoor/domelsprodcglassdoor-main-stainlesssteel-greenled.jpg"),
  shortLong: img("e/elsprokl1sided/domelsprokl1sided-main-stainlesssteel-greenled.jpg"),
  half: img("e/elsprohalf1sided/domelsprohalf1sided-main-stainlesssteel-greenled.jpg"),
  halfAngle: img("e/elsprohalf1sided/domelsprohalf1sided-angle-stainlesssteel-ledoff.jpg"),
  halfPivot: img("e/elspro1328/domelspro1328-main-stainlesssteel-greenled.jpg"),
  halfPivotAngle: img("e/elspro1328/domelspro1328-angle-stainlesssteel-ledoff.jpg"),
  halfM4: img("e/elspro/domelspro-main-stainlesssteel-greenled.jpg"),
  swiss: img("e/elsprodc1sidedch/domelsprodc1sidedch-main-stainlesssteel-greenled.jpg"),
  swissAngle: img("e/elsprodc1sidedch/domelsprodc1sidedch-angle-stainlesssteel-ledoff.jpg"),
  oval: img("e/elspro656/domelspro656-main-stainlesssteel-greenled.jpg"),
  ovalAngle: img("e/elspro656/domelspro656-angle-stainlesssteel-ledoff.jpg"),
  round: img("e/elspro555/domelspro555-main-stainlesssteel-greenled.jpg"),
  roundAngle: img("e/elspro555/domelspro555-angle-stainlesssteel-ledoff.jpg"),
  handle: img("e/elssoftware/domelssoftware-main-p-p-laptop-els-software.jpg"),
  media: img("e/elsct/domelsct-main-anthracite.jpg"),
  furn: img("e/elsrfnetv8/domelsrfnetv8-main-white-greenled.jpg"),
} as const;

const IMG_ELS_MAIN = IMG.dc1;
const IMG_HANDLE = IMG.handle;
const IMG_MEDIA = IMG.media;
const IMG_FURN = IMG.furn;

const ELS_ABOUT = `<p>With the highest security certifications, such as VDS, SKG, IP, T90 the ELS Pro cylinder conforms to all European EN norms. The Plug &amp; Play system offers you flexibility, and with a few parts you always get the right fit directly. With 10 different types we have a solution for almost every door setup. It offers a tremendous level of reliability, which guarantees the ELS Pro cylinder's long-term durability. It is available in four tints - stainless steel, black, white and polished brass - thereby responding to the trends and needs of modern architecture.</p>`;

const ELS_BENEFITS = `<ul>
<li>Whatever security needs you have for your facility, ELS Pro will cover them.</li>
<li>Standard application on burglar-resistant (SKG3), fire-resistant (T90) and external doors (IP65).</li>
<li>Available in various versions, such as half, whole, double-sided, for escape doors (EN179) or glass doors.</li>
<li>Plug &amp; Play system allows you to easily convert the cylinder to the correct length when moving or changing door thickness.</li>
<li>Easy battery replacement so you are never locked outside.</li>
<li>Different colour finishes create a solution for every taste.</li>
<li>Tremendous level of reliability for long-term durability.</li>
<li>No need to change the locks if you choose to upgrade to online features - already provided as standard.</li>
</ul>
<p><strong>Suggested application of use:</strong> Airports, Education, Financial, Homes, Hospitals, Hotels, Industrial, Medium to Large Sized Businesses, Offices, Plants, Public Buildings, Small to Medium Sized Businesses</p>`;

const ELS_SPECS = `<h4>Technical features</h4>
<table><tbody>
<tr><th>Fire Resistant</th><td>Yes, 90 Minutes</td></tr>
<tr><th>Water Resistant</th><td>Yes</td></tr>
<tr><th>Patent Protection</th><td>Yes</td></tr>
<tr><th>Anti Corrosion Protection</th><td>Yes</td></tr>
<tr><th>Anti Drill Protection</th><td>Yes</td></tr>
<tr><th>Anti Pull Protection</th><td>Yes</td></tr>
<tr><th>Standard Warranty</th><td>1 Year</td></tr>
<tr><th>Communication Technology</th><td>RF 868 MHz</td></tr>
<tr><th>Stand-alone Functionality</th><td>Yes</td></tr>
<tr><th>Data On Card</th><td>Yes</td></tr>
<tr><th>Battery Lifetime Cycles</th><td>Up to 50000 cycles</td></tr>
<tr><th>User Identification Technology</th><td>RFID 125 kHz</td></tr>
<tr><th>Optical Signalling</th><td>Yes</td></tr>
<tr><th>Supported Locking Media</th><td>Hitag 1, Hitag 2, Hitag S, EM 4100, EM 4102, EM 4150, EM 4450</td></tr>
<tr><th>Programming Methods</th><td>Software, Master Card, Programming Card, USB Key</td></tr>
<tr><th>Battery Type</th><td>CR2</td></tr>
<tr><th>Number of Batteries</th><td>2</td></tr>
<tr><th>Battery Lifetime Years</th><td>Up to 3 Years</td></tr>
</tbody></table>
<h4>Certifications</h4>
<table><tbody>
<tr><th>VdS 2156:2 Classification</th><td>BZ+</td></tr>
<tr><th>Ingress Protection Rating</th><td>IP65</td></tr>
<tr><th>EN 179:2008</th><td>Suitable for escape routes according to EN179</td></tr>
<tr><th>EN 1125:2008</th><td>Suitable for escape routes according to EN1125</td></tr>
</tbody></table>
<h4>Configuration</h4>
<table><tbody>
<tr><th>Surface Finish</th><td>Matt Nickel</td></tr>
<tr><th>Outer Knob Finish</th><td>Stainless Steel, High Gloss Black, High Gloss White, Brass</td></tr>
<tr><th>Inner Knob Finish</th><td>Matt Nickel, High Gloss Black, High Gloss White, Brass</td></tr>
<tr><th>Power Type</th><td>Battery</td></tr>
<tr><th>Events Storage Capacity</th><td>2000</td></tr>
<tr><th>RFID Encryption</th><td>AES-128 Bit</td></tr>
<tr><th>Operating Temperature</th><td>-25° to 65° C</td></tr>
</tbody></table>`;

const ELS_ACCESSORY_KEYS = [
  "fixing-bracket",
  "els-design-tag",
  "torx-screwdriver-tx-6",
  "els-combined-transponder-standard-tag",
  "special-key-ee-im",
  "els-clip-tag-with-magnet",
  "els-usb-radio-stick",
  "els-clip-tag-without-magnet",
  "els-rf-netmanager-v8",
  "battery-pack",
  "installation-tool-set",
  "knob-tool",
].join("\n");

type VariantSeed = {
  name: string;
  label: string;
  group: string;
  isDefault?: boolean;
  image: string;
  imageUrl: string;
  href?: string;
  gallery?: string;
};

type ProductSeed = {
  name: string;
  title: string;
  tagline: string;
  family: string;
  category1: string;
  theme: string;
  about: string;
  benefits: string;
  specs: string;
  certifications: string;
  image: string;
  gallery?: string;
  softwareKeys?: string;
  accessoryKeys?: string;
  variants?: VariantSeed[];
};

const TYPE_VARIANTS: Array<{ slug: string; label: string; image: string; gallery: string[] }> = [
  {
    slug: "double-cylinder-1-sided-readability",
    label: "Double Cylinder 1-Sided Readability",
    image: IMG.dc1,
    gallery: [IMG.dc1, IMG.dc1Angle, IMG.dc1AngleOn, IMG.dc1Front, IMG.dc1Back],
  },
  {
    slug: "lever-cylinder",
    label: "Lever Cylinder",
    image: IMG.lever,
    gallery: [IMG.lever, IMG.leverAngle, IMG.dc1],
  },
  {
    slug: "padlock",
    label: "Padlock",
    image: IMG.padlock,
    gallery: [IMG.padlock, IMG.padlockAngle, IMG.dc1],
  },
  {
    slug: "double-cylinder-1-sided-readability-without-inner-knob",
    label: "Double Cylinder 1-Sided Readability without Inner Knob",
    image: IMG.dc1oi,
    gallery: [IMG.dc1oi, IMG.dc1Angle, IMG.dc1],
  },
  {
    slug: "double-cylinder-2-sided-readability",
    label: "Double Cylinder 2-Sided Readability",
    image: IMG.dc2,
    gallery: [IMG.dc2, IMG.dc2Angle, IMG.dc1],
  },
  {
    slug: "double-cylinder-ee-1-sided-readability",
    label: "Double Cylinder EE 1-Sided Readability",
    image: IMG.ee1,
    gallery: [IMG.ee1, IMG.dc1Angle, IMG.dc1],
  },
  {
    slug: "double-cylinder-ee-1-sided-readability-mechanical-inner-locking",
    label: "Double Cylinder EE 1-Sided Readability Mechanical Inner Locking",
    image: IMG.ee1mi,
    gallery: [IMG.ee1mi, IMG.dc1Angle, IMG.dc1],
  },
  {
    slug: "double-cylinder-ee-1-sided-readability-without-inner-knob",
    label: "Double Cylinder EE 1-Sided Readability without Inner Knob",
    image: IMG.ee1oi,
    gallery: [IMG.ee1oi, IMG.dc1Angle, IMG.dc1],
  },
  {
    slug: "double-cylinder-glass-door-version-1-sided-readability",
    label: "Double Cylinder Glass Door Version 1-Sided Readability",
    image: IMG.glass,
    gallery: [IMG.glass, IMG.dc1Angle, IMG.dc1],
  },
  {
    slug: "double-cylinder-short-long-version-1-sided-readability",
    label: "Double Cylinder Short-Long-Version 1-Sided Readability",
    image: IMG.shortLong,
    gallery: [IMG.shortLong, IMG.dc1Angle, IMG.dc1],
  },
  {
    slug: "half-cylinder-1-sided-readability",
    label: "Half Cylinder 1-Sided Readability",
    image: IMG.half,
    gallery: [IMG.half, IMG.halfAngle, IMG.dc1],
  },
  {
    slug: "half-cylinder-for-pivoted-lever-handles",
    label: "Half Cylinder for Pivoted Lever Handles",
    image: IMG.halfPivot,
    gallery: [IMG.halfPivot, IMG.halfPivotAngle, IMG.half],
  },
  {
    slug: "half-cylinder-m4-1-sided-readability",
    label: "Half Cylinder M4 1-Sided Readability",
    image: IMG.halfM4,
    gallery: [IMG.halfM4, IMG.halfAngle, IMG.half],
  },
];

const PROFILE_VARIANTS: Array<{
  name: string;
  label: string;
  image: string;
  href: string;
  key: "european" | "oval" | "round" | "swiss";
}> = [
  {
    name: "European Profile",
    label: "European Profile",
    image: IMG.dc1,
    href: "",
    key: "european",
  },
  {
    name: "Scandinavian Oval Profile",
    label: "Scandinavian Oval Profile",
    image: IMG.oval,
    href: "/products/scandinavian-oval-cylinder",
    key: "oval",
  },
  {
    name: "Scandinavian Round Profile",
    label: "Scandinavian Round Profile",
    image: IMG.round,
    href: "/products/scandinavian-round-cylinder",
    key: "round",
  },
  {
    name: "Swiss Profile",
    label: "Swiss Profile",
    image: IMG.swiss,
    href: "/products/swiss-double-cylinder-1-sided-readability",
    key: "swiss",
  },
];

const elsProTypeVariants = (activeSlug: string): VariantSeed[] =>
  TYPE_VARIANTS.map((type) => ({
    name: type.slug,
    label: type.label,
    group: "Type",
    isDefault: activeSlug === type.slug,
    image: type.image,
    imageUrl: type.image,
    href: `/products/${type.slug}`,
    gallery: type.gallery.join("\n"),
  }));

const elsProProfileVariants = (
  active: "european" | "oval" | "round" | "swiss" = "european",
  activeSlug = "double-cylinder-1-sided-readability",
): VariantSeed[] => {
  const activeTypeImage =
    TYPE_VARIANTS.find((type) => type.slug === activeSlug)?.image ?? IMG.dc1;
  return PROFILE_VARIANTS.map((profile) => {
    const europeanHref = `/products/${activeSlug}`;
    const image = profile.key === "european" ? activeTypeImage : profile.image;
    return {
      name: profile.name,
      label: profile.label,
      group: "Profile",
      isDefault: active === profile.key,
      image,
      imageUrl: image,
      href: profile.key === "european" ? europeanHref : profile.href || europeanHref,
    };
  });
};

const elsProProduct = (
  seed: {
    name: string;
    tagline: string;
    image: string;
    gallery: string;
    activeSlug: string;
    activeProfile?: "european" | "oval" | "round" | "swiss";
  },
): ProductSeed => ({
  name: seed.name,
  title: "DOM ELS Pro",
  tagline: seed.tagline,
  family: "dom-els-pro",
  category1: "digital-cylinders",
  theme: "access-control-solutions",
  about: ELS_ABOUT,
  benefits: ELS_BENEFITS,
  specs: ELS_SPECS,
  certifications: "IP65, CE, SKG***, VdS BZ+, EN 179, EN 1125, T90",
  image: seed.image,
  gallery: seed.gallery,
  softwareKeys: "ELS Software\nELS Mobile",
  accessoryKeys: ELS_ACCESSORY_KEYS,
  variants: [
    ...elsProProfileVariants(seed.activeProfile ?? "european", seed.activeSlug),
    ...elsProTypeVariants(seed.activeSlug),
  ],
});

const elsProTypeProducts: ProductSeed[] = TYPE_VARIANTS.map((type) =>
  elsProProduct({
    name: type.slug,
    tagline: type.label === "Double Cylinder 1-Sided Readability" ? "Technical all-rounder" : type.label,
    image: type.image,
    gallery: type.gallery.join("\n"),
    activeSlug: type.slug,
    activeProfile: "european",
  }),
);

const elsProProfileProducts: ProductSeed[] = [
  elsProProduct({
    name: "scandinavian-oval-cylinder",
    tagline: "Scandinavian Oval Profile",
    image: IMG.oval,
    gallery: [IMG.oval, IMG.ovalAngle, IMG.dc1].join("\n"),
    activeSlug: "double-cylinder-1-sided-readability",
    activeProfile: "oval",
  }),
  elsProProduct({
    name: "scandinavian-round-cylinder",
    tagline: "Scandinavian Round Profile",
    image: IMG.round,
    gallery: [IMG.round, IMG.roundAngle, IMG.dc1].join("\n"),
    activeSlug: "double-cylinder-1-sided-readability",
    activeProfile: "round",
  }),
  elsProProduct({
    name: "swiss-double-cylinder-1-sided-readability",
    tagline: "Swiss Profile · Double Cylinder 1-Sided Readability",
    image: IMG.swiss,
    gallery: [IMG.swiss, IMG.swissAngle, IMG.dc1].join("\n"),
    activeSlug: "double-cylinder-1-sided-readability",
    activeProfile: "swiss",
  }),
];

const products: ProductSeed[] = [
  ...elsProTypeProducts,
  ...elsProProfileProducts,
  // Digital handles
  {
    name: "eniq-guard",
    title: "DOM ENiQ Guard",
    tagline: "Digital door handle with integrated reader",
    family: "dom-eniq-guard",
    category1: "digital-handles",
    theme: "access-control-solutions",
    about: "<p>Award-winning digital door handle for offices and public buildings.</p>",
    benefits: "<ul><li>Integrated reader</li><li>Battery powered</li><li>ENiQ App ready</li></ul>",
    specs: "<p>Type: Digital handle · Protocol: ENiQ</p>",
    certifications: "CE, SKG",
    image: IMG_HANDLE,
    softwareKeys: "ENiQ App",
    accessoryKeys: "eniq-transponder",
  },
  {
    name: "eniq-touchbar",
    title: "DOM ENiQ TouchBar",
    tagline: "Electronic panic bar with access control",
    family: "dom-eniq",
    category1: "digital-handles",
    theme: "access-control-solutions",
    about: "<p>Combines emergency egress with electronic access management.</p>",
    benefits: "<ul><li>EN 1125 compliant egress</li><li>Electronic outer access</li></ul>",
    specs: "<p>Type: TouchBar · Use: Escape routes</p>",
    certifications: "EN 1125, CE",
    image: IMG_HANDLE,
    softwareKeys: "ENiQ App",
  },
  // Mechanical cylinders
  {
    name: "ix-twinstar",
    title: "DOM ix Twinstar",
    tagline: "High-security mechanical cylinder",
    family: "dom-ix-twinstar",
    category1: "mechanical-cylinders",
    theme: "door-hardware",
    about: "<p>Modular mechanical cylinder with patented key technology.</p>",
    benefits: "<ul><li>Copy-protected keys</li><li>Master-key system ready</li></ul>",
    specs: "<p>Type: Mechanical · Profile: European</p>",
    certifications: "SKG***, CE",
    image: IMG_ELS_MAIN,
  },
  {
    name: "ix-teco",
    title: "DOM ix Teco",
    tagline: "Patented mechanical locking system",
    family: "dom-ix-teco",
    category1: "mechanical-cylinders",
    theme: "door-hardware",
    about: "<p>European-patented mechanical cylinder for residential and commercial use.</p>",
    benefits: "<ul><li>Anti-drill protection</li><li>Flexible modular lengths</li></ul>",
    specs: "<p>Type: Mechanical · Profile: European</p>",
    certifications: "SKG**, CE",
    image: IMG_ELS_MAIN,
  },
  // Mechanical locks
  {
    name: "mortise-lock-standard",
    title: "DOM Mortise Lock",
    tagline: "Standard mortise lock case",
    family: "dom-mortise",
    category1: "mechanical-locks",
    theme: "door-hardware",
    about: "<p>Reliable mortise lock case for timber and metal doors.</p>",
    benefits: "<ul><li>Multiple backset options</li><li>DIN-compatible</li></ul>",
    specs: "<p>Type: Mortise · Backset: 55/60 mm</p>",
    certifications: "CE, EN 12209",
    image: IMG_FURN,
  },
  {
    name: "multipoint-lock",
    title: "DOM Multipoint Lock",
    tagline: "Multipoint locking for entrance doors",
    family: "dom-multipoint",
    category1: "mechanical-locks",
    theme: "door-hardware",
    about: "<p>Multipoint locking system for enhanced door security.</p>",
    benefits: "<ul><li>Multiple locking points</li><li>Smooth operation</li></ul>",
    specs: "<p>Type: Multipoint · Points: 3–5</p>",
    certifications: "RC2, CE",
    image: IMG_FURN,
  },
  // Wall readers
  {
    name: "els-rf-net",
    title: "ELS RF Net Reader",
    tagline: "Online wall reader for ELS systems",
    family: "dom-els",
    category1: "wall-readers-and-terminals",
    theme: "access-control-solutions",
    about: "<p>Networked wall reader extending ELS access beyond the cylinder.</p>",
    benefits: "<ul><li>Online decisioning</li><li>LED status feedback</li></ul>",
    specs: "<p>Type: Wall reader · Connectivity: RF Net</p>",
    certifications: "IP54, CE",
    image: IMG_FURN,
    softwareKeys: "ELS Software",
  },
  {
    name: "eniq-wall-reader",
    title: "ENiQ Wall Reader",
    tagline: "Wall reader for ENiQ media",
    family: "dom-eniq",
    category1: "wall-readers-and-terminals",
    theme: "access-control-solutions",
    about: "<p>Compact wall reader for doors that cannot take a digital handle.</p>",
    benefits: "<ul><li>Flush mounting options</li><li>ENiQ credential support</li></ul>",
    specs: "<p>Type: Wall reader · Protocol: ENiQ</p>",
    certifications: "IP54, CE",
    image: IMG_FURN,
    softwareKeys: "ENiQ App",
  },
  // Apps & software
  {
    name: "els-software-suite",
    title: "ELS Software Suite",
    tagline: "Desktop management for ELS Pro",
    family: "els-software",
    category1: "apps-software",
    theme: "access-control-solutions",
    about: "<p>Program cylinders, manage users and audit events from your desktop.</p>",
    benefits: "<ul><li>Central credential management</li><li>Works with ELS Mobile</li></ul>",
    specs: "<p>Platform: Windows · Companion: ELS Mobile</p>",
    certifications: "",
    image: IMG_HANDLE,
    softwareKeys: "ELS Software\nELS Mobile",
  },
  {
    name: "eniq-app-suite",
    title: "ENiQ App Suite",
    tagline: "Mobile access management",
    family: "eniq-app",
    category1: "apps-software",
    theme: "access-control-solutions",
    about: "<p>Smartphone app to issue rights and manage ENiQ devices.</p>",
    benefits: "<ul><li>On-the-go programming</li><li>Data-on-card workflows</li></ul>",
    specs: "<p>Platforms: iOS, Android</p>",
    certifications: "",
    image: IMG_HANDLE,
    softwareKeys: "ENiQ App",
  },
  // Media / transponders
  {
    name: "clip-tag-v2",
    title: "Clip Tag V2",
    tagline: "Compact RFID clip tag",
    family: "dom-media",
    category1: "transponders",
    theme: "access-control-solutions",
    about: "<p>Wearable clip tag for electronic locking systems.</p>",
    benefits: "<ul><li>Durable housing</li><li>ELS and ENiQ compatible variants</li></ul>",
    specs: "<p>Type: Clip tag · Frequency: 13.56 MHz</p>",
    certifications: "CE",
    image: IMG_MEDIA,
  },
  {
    name: "combined-transponder-iso-cheque-card",
    title: "ISO Cheque Card Transponder",
    tagline: "Card-format access media",
    family: "dom-media",
    category1: "transponders",
    theme: "access-control-solutions",
    about: "<p>ISO card with integrated RFID for everyday access.</p>",
    benefits: "<ul><li>Printable face</li><li>Wallet-friendly</li></ul>",
    specs: "<p>Format: ISO · Type: Cheque card</p>",
    certifications: "CE",
    image: IMG_MEDIA,
  },
  {
    name: "combined-transponder-standard-tag",
    title: "Standard Tag Transponder",
    tagline: "Keyring RFID tag",
    family: "dom-media",
    category1: "transponders",
    theme: "access-control-solutions",
    about: "<p>Standard keyring tag for electronic cylinders and readers.</p>",
    benefits: "<ul><li>Easy to carry</li><li>Cost-effective media</li></ul>",
    specs: "<p>Type: Key tag · Frequency: 13.56 MHz</p>",
    certifications: "CE",
    image: IMG_MEDIA,
  },
  // Digital furniture locks
  {
    name: "dom-225018",
    title: "DOM Digital Furniture Lock 225018",
    tagline: "Electronic cabinet lock",
    family: "dom-furniture-digital",
    category1: "digital-furniture-locks",
    theme: "industrial-locking-equipment",
    about: "<p>Electronic lock for lockers and furniture in shared spaces.</p>",
    benefits: "<ul><li>Battery powered</li><li>PIN or RFID options</li></ul>",
    specs: "<p>Type: Furniture lock · Power: Battery</p>",
    certifications: "CE",
    image: IMG_FURN,
  },
  {
    name: "dom-22501b1",
    title: "DOM Digital Furniture Lock 22501B1",
    tagline: "RFID furniture lock",
    family: "dom-furniture-digital",
    category1: "digital-furniture-locks",
    theme: "industrial-locking-equipment",
    about: "<p>RFID-enabled furniture lock for offices and leisure facilities.</p>",
    benefits: "<ul><li>Shared media with access systems</li><li>Compact footprint</li></ul>",
    specs: "<p>Type: RFID furniture lock</p>",
    certifications: "CE",
    image: IMG_FURN,
  },
  // Furniture locks
  {
    name: "dom-22501c1",
    title: "DOM Furniture Lock 22501C1",
    tagline: "Mechanical furniture cam lock",
    family: "dom-furniture",
    category1: "furniture-locks",
    theme: "industrial-locking-equipment",
    about: "<p>Mechanical cam lock for cabinets and drawers.</p>",
    benefits: "<ul><li>Simple installation</li><li>Multiple keying options</li></ul>",
    specs: "<p>Type: Cam lock · Material: Metal</p>",
    certifications: "CE",
    image: IMG_FURN,
  },
  {
    name: "dom-225081",
    title: "DOM Furniture Lock 225081",
    tagline: "Industrial furniture lock",
    family: "dom-furniture",
    category1: "furniture-locks",
    theme: "industrial-locking-equipment",
    about: "<p>Robust mechanical lock for industrial furniture applications.</p>",
    benefits: "<ul><li>High cycle durability</li><li>Keyed alike options</li></ul>",
    specs: "<p>Type: Furniture lock</p>",
    certifications: "CE",
    image: IMG_FURN,
  },
  // Trapped key
  {
    name: "dom-225083",
    title: "DOM Trapped Key Interlock 225083",
    tagline: "Process safety interlocking",
    family: "dom-trapped-key",
    category1: "trapped-key-interlocking-systems",
    theme: "industrial-locking-equipment",
    about: "<p>Trapped key interlock for controlled industrial sequences.</p>",
    benefits: "<ul><li>Forces safe operating order</li><li>Mechanical reliability</li></ul>",
    specs: "<p>Type: Trapped key · Use: Process safety</p>",
    certifications: "CE",
    image: IMG_FURN,
  },
  {
    name: "dom-2250850",
    title: "DOM Trapped Key Station 2250850",
    tagline: "Multi-key exchange station",
    family: "dom-trapped-key",
    category1: "trapped-key-interlocking-systems",
    theme: "industrial-locking-equipment",
    about: "<p>Key exchange station coordinating multiple interlock keys.</p>",
    benefits: "<ul><li>Central key control</li><li>Scalable key positions</li></ul>",
    specs: "<p>Type: Exchange station</p>",
    certifications: "CE",
    image: IMG_FURN,
  },
];

export const domSecurityProductDefinition = {
  kind: "component",
  definitionKey: "dom-security-product",
  name: "dom-security-product",
  displayName: "Product",
  componentName: "DomSecurityProduct",
  icon: "People/32x32/product.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Products"],
  },
  model: {
    folderTemplate: {
      name: "Product Folder",
      displayName: "Products",
    },
    itemTemplate: {
      name: "Product",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Title", type: "Single-Line Text" },
            { name: "Tagline", type: "Single-Line Text" },
            { name: "Family", type: "Single-Line Text", shared: true },
            { name: "Category1 Slug", type: "Single-Line Text", shared: true },
            { name: "Theme Slug", type: "Single-Line Text", shared: true },
            { name: "About", type: "Rich Text" },
            { name: "Benefits", type: "Rich Text" },
            { name: "Specs", type: "Rich Text" },
            { name: "Certifications", type: "Single-Line Text" },
            { name: "Image", type: "Image" },
            { name: "Image Url", type: "Single-Line Text", shared: true },
            { name: "Gallery Images", type: "Multi-Line Text", shared: true },
            { name: "Related Software Keys", type: "Multi-Line Text", shared: true },
            { name: "Accessory Keys", type: "Multi-Line Text", shared: true },
            {
              name: "Related Software",
              type: "Multilist",
              shared: true,
              source: { root: "data", folder: ["Product Software"] },
            },
            {
              name: "Optional Accessories",
              type: "Multilist",
              shared: true,
              source: { root: "data", folder: ["Product Accessories"] },
            },
          ],
        },
      ],
    },
    childItemTemplate: {
      name: "Product Variant",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Label", type: "Single-Line Text" },
            { name: "Group", type: "Single-Line Text", shared: true },
            { name: "Image", type: "Image" },
            { name: "Image Url", type: "Single-Line Text", shared: true },
            { name: "Href", type: "Single-Line Text", shared: true },
            { name: "Is Default", type: "Checkbox", shared: true },
          ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: {
      root: "data",
      folder: ["Products"],
    },
    culture: "en",
    cultures: ["nl-BE", "fr-BE"],
    items: products.map((product) => ({
      name: product.name,
      displayName: product.title,
      fields: {
        Title: product.title,
        Tagline: product.tagline,
        Family: product.family,
        "Category1 Slug": product.category1,
        "Theme Slug": product.theme,
        About: product.about,
        Benefits: product.benefits,
        Specs: product.specs,
        Certifications: product.certifications,
        Image: { url: product.image, alt: product.title },
        "Image Url": product.image,
        "Gallery Images": product.gallery ?? product.image,
        "Related Software Keys": product.softwareKeys ?? "",
        "Accessory Keys": product.accessoryKeys ?? "",
      },
      children: (product.variants ?? []).map((variant) => ({
        name: variant.name,
        displayName: variant.label,
        fields: {
          Label: variant.label,
          Group: variant.group,
          Image: variant.image ? { url: variant.image, alt: variant.label } : undefined,
          "Image Url": variant.imageUrl || variant.image || "",
          Href: variant.href ?? "",
          "Is Default": Boolean(variant.isDefault),
        },
      })),
    })),
  },
} satisfies ComponentTemplateDefinition;
