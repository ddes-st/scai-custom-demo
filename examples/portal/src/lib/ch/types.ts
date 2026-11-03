export interface RgbValue {
  red: number;
  green: number;
  blue: number;
}

export interface CmykValue {
  cyan: number;
  magenta: number;
  yellow: number;
  black: number;
}

/** The .cihubcolor file format. */
export interface CihubColor {
  id: string;
  name: string;
  colorDescription: string;
  hexValue: string;
  rgbValue: RgbValue;
  pantone: string;
  cmyk: CmykValue;
}

export interface BrandColorAsset {
  assetId: number;
  title: string;
  color: CihubColor | null;
  loadError?: string;
}

export interface LogoAsset {
  assetId: number;
  title: string;
  fileName: string;
  /** Public link to the original rendition. */
  url: string;
}

export interface GuidelineAsset {
  assetId: number;
  title: string;
  fileName: string;
  /** Public link to the original rendition (the PDF itself). */
  url: string;
  sizeBytes: number | null;
  updatedAt: string | null;
}

export interface FontAsset {
  assetId: number;
  title: string;
  fileName: string;
  /** Public link to the original rendition (the font file). */
  url: string;
}

export interface TemplateAsset {
  assetId: number;
  title: string;
  fileName: string;
  /** Public link to the original rendition. */
  url: string;
  sizeBytes: number | null;
}

export interface DoDontItem {
  contentId: string;
  name: string;
  summary: string;
  /** Sanitized HTML from BrandDoDont_Description. */
  html: string;
  /** Public link to the master image's original rendition. */
  imageUrl: string;
  isDont: boolean;
}

export interface PersonaItem {
  contentId: string;
  name: string;
  tagLine: string;
  /** Sanitized HTML from TargetPersona_PersonaDetails. */
  detailsHtml: string;
  /** Public link to the master image's original rendition. */
  imageUrl: string;
}

export interface CharacteristicItem {
  contentId: string;
  name: string;
  /** Sanitized HTML from Characteristics_Characteristic. */
  html: string;
}

export type LayoutKind = "tabbed" | "editorial";

/** Canonical section keys used by BrandSite.Config (client-safe — no server imports here). */
export const SECTION_KEYS = [
  "colour",
  "logo",
  "typography",
  "documents",
  "templates",
  "dodont",
  "personas",
  "characteristics",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const DEFAULT_SECTION_LABELS: Record<SectionKey, string> = {
  colour: "Colour",
  logo: "Logo",
  typography: "Typography",
  documents: "Documents",
  templates: "Templates",
  dodont: "Do & don't",
  personas: "Personas",
  characteristics: "Characteristics",
};

export interface BookSection {
  key: SectionKey;
  label: string;
}

/** The admin-config slice a brand book needs at render time (resolved server-side). */
export interface BookConfig {
  /** Enabled sections in display order, with resolved labels. */
  sections: BookSection[];
  doDontColumns: number;
  downloads: boolean;
  contact: { name: string; email: string };
}

export const DEFAULT_BOOK: BookConfig = {
  sections: SECTION_KEYS.map((key) => ({ key, label: DEFAULT_SECTION_LABELS[key] })),
  doDontColumns: 1,
  downloads: true,
  contact: { name: "", email: "" },
};

export interface BrandSummary {
  brandId: number;
  /** The M.Brand identifier (its Experience Edge id). */
  identifier: string;
  name: string;
  slug: string;
  /** Colour NAME from Entity.Visualization, e.g. "yellow". Empty when unset. */
  visualizationColor: string;
  /** Public link to a logo original, when the brand has one. */
  logoUrl: string;
}

export interface BrandGuidelineData {
  brandId: number;
  brandName: string;
  visualizationColor: string;
  colors: BrandColorAsset[];
  logos: LogoAsset[];
  guidelines: GuidelineAsset[];
  fonts: FontAsset[];
  templates: TemplateAsset[];
  doDonts: DoDontItem[];
  personas: PersonaItem[];
  characteristics: CharacteristicItem[];
}
