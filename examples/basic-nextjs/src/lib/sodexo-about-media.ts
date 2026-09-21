const CDN =
  'https://edge.sitecorecloud.io/sodexofrance1-sodexocorpsites-prod-e74c/media/Project/Sodexo-Corp/Global/Media-prod/Images';

export const SODEXO_ABOUT_HERO_IMAGE = `${CDN}/hero-720x540/about-us-banner.jpg`;
export const SODEXO_ABOUT_TECH_IMAGE = `${CDN}/BannerCard-503x503/about-technology.jpg`;

export const SODEXO_ABOUT_CARD_IMAGES: Record<string, string> = {
  'Mission & Ambition': `${CDN}/BannerCard-503x503/about-mission-ambition.jpg`,
  Services: `${CDN}/BannerCard-503x503/about-services.jpg`,
  Sectors: `${CDN}/BannerCard-503x503/about-sectors.jpg`,
  'Ethical principles': `${CDN}/BannerCard-503x503/about-ethical-principles.jpg`,
  Values: `${CDN}/BannerCard-503x503/about-values.jpg`,
  'Family owned': `${CDN}/BannerCard-503x503/about-family-owned.jpg`,
  'Global Executive Team:': `${CDN}/Banner-card-608x342/about-executive-team.jpg`,
  'Board of Directors:': `${CDN}/Banner-card-608x342/about-board-directors.jpg`,
  'History:': `${CDN}/Banner-card-608x342/about-history.jpg`,
  Awards: `${CDN}/Banner-card-608x342/about-awards.jpg`,
};

export function sodexoAboutCardImage(title?: string, src?: string): string {
  if (src) return src;
  if (!title) return '';
  return SODEXO_ABOUT_CARD_IMAGES[title] || '';
}
