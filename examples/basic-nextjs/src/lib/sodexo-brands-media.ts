const CH = 'https://ddes.sitecoresandbox.cloud/api/public/content';

export const SODEXO_BRANDS_HERO_IMAGE = `${CH}/108131-our-brands-hero?v=873ef934`;
export const SODEXO_BRANDS_EXPERTISE_IMAGE = `${CH}/108139-brand-overview-culinary-expertise?v=262f8677`;
export const SODEXO_BRANDS_FORMAT_IMAGE = `${CH}/108149-tab-restaurants?v=a3570e17`;

export const SODEXO_BRANDS_CARD_IMAGES: Record<string, string> = {
  'Modern Recipe': `${CH}/108160-modern-recipe-flip?v=6298278e`,
  'The Good Eating Company': `${CH}/108169-good-eating-co-flip?v=766f61d2`,
  'Kitchen Works': `${CH}/108180-kitchen-works-flip?v=39ca410b`,
  'Kitchen Works BI': `${CH}/108180-kitchen-works-flip?v=39ca410b`,
  'Kitchen Works Healthcare': `${CH}/108212-kitchen-works-hc-flip?v=dedca7f4`,
  'Kitchen Works Energy': `${CH}/108365-kitchen-works-er-flip?v=d15b85e5`,
  Novae: `${CH}/108191-novae-flip?v=3697c724`,
  Signature: `${CH}/108204-signature-flip2?v=179e1556`,
  Clinicia: `${CH}/108226-clinicia-flip?v=bebfc20e`,
  Eat: `${CH}/108235-eat-hc-flip?v=9a57094b`,
  Aarogyum: `${CH}/108250-aarogyum-flip?v=5af1a31a`,
  'Sogeres Seniors': `${CH}/108258-sogeres-seniors-flip?v=73bae34b`,
  Joyous: `${CH}/108270-joyous-flip?v=621a3724`,
  Oxygen: `${CH}/108281-oxygen-flip?v=384d8379`,
  Papilles: `${CH}/108292-papilles-flip?v=c669a12f`,
  'Think Green': `${CH}/108301-think-green-flip?v=81b77c67`,
  'Bright Bites Kitchen': `${CH}/108311-bright-bites-flip?v=a820f918`,
  Independents: `${CH}/108322-independents-flip?v=f9b4f64f`,
  'Independents by Sodexo': `${CH}/108322-independents-flip?v=f9b4f64f`,
  'One & All': `${CH}/108331-one-and-all-flip?v=8bfd8faf`,
  'One&All': `${CH}/108331-one-and-all-flip?v=8bfd8faf`,
  'Food You': `${CH}/108340-food-and-you-flip?v=9c6eb5cc`,
  'Éveil et Goût': `${CH}/108354-eveil-et-gout-flip?v=648a217f`,
  'Eveil et Gout': `${CH}/108354-eveil-et-gout-flip?v=648a217f`,
};

export const SODEXO_BRANDS_INSIGHT_IMAGES: Record<string, string> = {
  'Eating at Work Made Easy': `${CH}/108374-eating-at-work?v=45de026c`,
  'Why healthy food means healthy business': `${CH}/108386-healthy-food-healthy-business?v=e8cf24fa`,
  '6 delicious foods that naturally boost your energy': `${CH}/108395-food-energy-boost?v=b9fb77a8`,
  'How social connection boosts the power of the lunch hour': `${CH}/108404-connecting-over-lunch?v=97c32ccb`,
};

function isDeadSodexoCdn(src?: string): boolean {
  return !!src && src.includes('sodexofrance1-sodexocorpsites-prod');
}

export function isUsableBrandsImageSrc(src?: string): boolean {
  return !!src && !isDeadSodexoCdn(src);
}

export function sodexoBrandsCardImage(title?: string, src?: string, environment?: string): string {
  if (isUsableBrandsImageSrc(src)) return src as string;
  if (!title) return SODEXO_BRANDS_HERO_IMAGE;
  if (/kitchen works/i.test(title) && environment) {
    if (/healthcare/i.test(environment)) return SODEXO_BRANDS_CARD_IMAGES['Kitchen Works Healthcare'];
    if (/energy/i.test(environment)) return SODEXO_BRANDS_CARD_IMAGES['Kitchen Works Energy'];
    if (/business/i.test(environment)) return SODEXO_BRANDS_CARD_IMAGES['Kitchen Works BI'];
  }
  if (SODEXO_BRANDS_CARD_IMAGES[title]) return SODEXO_BRANDS_CARD_IMAGES[title];
  if (SODEXO_BRANDS_INSIGHT_IMAGES[title]) return SODEXO_BRANDS_INSIGHT_IMAGES[title];
  const normalized = title.toLowerCase();
  const catalogs = { ...SODEXO_BRANDS_CARD_IMAGES, ...SODEXO_BRANDS_INSIGHT_IMAGES };
  const match = Object.keys(catalogs).find((key) => {
    const candidate = key.toLowerCase();
    return normalized.includes(candidate) || candidate.includes(normalized);
  });
  return (match && catalogs[match]) || SODEXO_BRANDS_HERO_IMAGE;
}
