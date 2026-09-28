const CH = 'https://ddes.sitecoresandbox.cloud/api/public/content';

export const SODEXO_ABOUT_HERO_IMAGE = `${CH}/107999-about-us-banner?v=c018cef1`;
export const SODEXO_ABOUT_TECH_IMAGE = `${CH}/108064-about-technology?v=57147cf0`;

export const SODEXO_ABOUT_CARD_IMAGES: Record<string, string> = {
  'Mission & Ambition': `${CH}/108007-about-mission-ambition?v=5927ffb9`,
  Services: `${CH}/108015-about-services?v=548ee6fd`,
  Sectors: `${CH}/108024-about-sectors?v=944641ae`,
  'Ethical principles': `${CH}/108034-about-ethical-principles?v=91d60cff`,
  Values: `${CH}/108043-about-values?v=edffbb37`,
  'Family owned': `${CH}/108052-about-family-owned?v=e9696549`,
  'Global Executive Team:': `${CH}/108076-about-executive-team?v=5961ac4a`,
  'Board of Directors:': `${CH}/108085-about-board-directors?v=0913973c`,
  'History:': `${CH}/108093-about-history?v=b80b12ae`,
  Awards: `${CH}/108104-about-awards?v=1aee5e69`,
};

function isDeadSodexoCdn(src?: string): boolean {
  return !!src && src.includes('sodexofrance1-sodexocorpsites-prod');
}

export function isUsableAboutImageSrc(src?: string): boolean {
  return !!src && !isDeadSodexoCdn(src);
}

export function sodexoAboutCardImage(title?: string, src?: string): string {
  if (isUsableAboutImageSrc(src)) return src as string;
  if (!title) return '';
  return SODEXO_ABOUT_CARD_IMAGES[title] || '';
}
