const CH = 'https://ddes.sitecoresandbox.cloud/api/public/content';

export const SODEXO_BRANDS_HERO_IMAGE = `${CH}/106413-section3-img1?v=d480f54d`;
export const SODEXO_BRANDS_EXPERTISE_IMAGE = `${CH}/106421-section3-img2?v=ee51d56f`;
export const SODEXO_BRANDS_FORMAT_IMAGE = `${CH}/106470-section5-img7?v=70b49ab3`;

export const SODEXO_BRANDS_CARD_IMAGES: Record<string, string> = {
  'Modern Recipe': `${CH}/106413-section3-img1?v=d480f54d`,
  'The Good Eating Company': `${CH}/106421-section3-img2?v=ee51d56f`,
  'Kitchen Works': `${CH}/106470-section5-img7?v=70b49ab3`,
  Fooditude: `${CH}/106461-section4-img6?v=b0b2d3d8`,
  Clinicia: `${CH}/106421-section3-img2?v=ee51d56f`,
  Eat: `${CH}/106413-section3-img1?v=d480f54d`,
  Aarogyum: `${CH}/106461-section4-img6?v=b0b2d3d8`,
  'Sogeres Seniors': `${CH}/106470-section5-img7?v=70b49ab3`,
  Joyous: `${CH}/106413-section3-img1?v=d480f54d`,
  Oxygen: `${CH}/106421-section3-img2?v=ee51d56f`,
  Papilles: `${CH}/106461-section4-img6?v=b0b2d3d8`,
  'Think Green': `${CH}/106413-section3-img1?v=d480f54d`,
  'Bright Bites Kitchen': `${CH}/106421-section3-img2?v=ee51d56f`,
  Independents: `${CH}/106470-section5-img7?v=70b49ab3`,
  'Independents by Sodexo': `${CH}/106470-section5-img7?v=70b49ab3`,
  'One & All': `${CH}/106461-section4-img6?v=b0b2d3d8`,
  'One&All': `${CH}/106461-section4-img6?v=b0b2d3d8`,
  'Éveil et Goût': `${CH}/106413-section3-img1?v=d480f54d`,
  'Eveil et Gout': `${CH}/106413-section3-img1?v=d480f54d`,
  Novae: `${CH}/106461-section4-img6?v=b0b2d3d8`,
  Signature: `${CH}/106413-section3-img1?v=d480f54d`,
  'Food You': `${CH}/106470-section5-img7?v=70b49ab3`,
};

function isDeadSodexoCdn(src?: string): boolean {
  return !!src && src.includes('sodexofrance1-sodexocorpsites-prod');
}

export function isUsableBrandsImageSrc(src?: string): boolean {
  return !!src && !isDeadSodexoCdn(src);
}

export function sodexoBrandsCardImage(title?: string, src?: string): string {
  if (isUsableBrandsImageSrc(src)) return src as string;
  if (!title) return SODEXO_BRANDS_HERO_IMAGE;
  if (SODEXO_BRANDS_CARD_IMAGES[title]) return SODEXO_BRANDS_CARD_IMAGES[title];
  const normalized = title.toLowerCase();
  const match = Object.keys(SODEXO_BRANDS_CARD_IMAGES).find((key) => {
    const candidate = key.toLowerCase();
    return normalized.includes(candidate) || candidate.includes(normalized);
  });
  return (match && SODEXO_BRANDS_CARD_IMAGES[match]) || SODEXO_BRANDS_HERO_IMAGE;
}
