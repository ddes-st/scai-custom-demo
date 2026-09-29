import { buildLocalePath, isFrenchLocale } from '@/lib/sodexo-locale';

describe('sodexo-locale', () => {
  it('treats fr and fr-FR as French', () => {
    expect(isFrenchLocale('fr-FR')).toBe(true);
    expect(isFrenchLocale('fr')).toBe(true);
    expect(isFrenchLocale('en')).toBe(false);
  });

  it('replaces an existing locale segment', () => {
    expect(buildLocalePath('/sodexo/en/About', 'fr-FR')).toBe('/sodexo/fr-FR/About');
    expect(buildLocalePath('/sodexo/fr-FR/Search', 'en', '?q=food')).toBe('/sodexo/en/Search?q=food');
  });

  it('inserts a locale after the site segment when missing', () => {
    expect(buildLocalePath('/sodexo/About', 'fr-FR')).toBe('/sodexo/fr-FR/About');
  });
});
