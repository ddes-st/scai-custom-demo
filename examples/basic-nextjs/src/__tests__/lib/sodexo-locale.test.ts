import { buildLocaleHref, buildLocalePath, isFrenchLocale } from '@/lib/sodexo-locale';

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

  it('keeps preview query params and sets sc_lang', () => {
    expect(
      buildLocaleHref('https://preview.example/sodexo/en/About?sc_itemid=abc&sc_lang=en&sc_mode=preview', 'fr-FR')
    ).toBe('/sodexo/fr-FR/About?sc_itemid=abc&sc_lang=fr-FR&sc_mode=preview&sc_site=sodexo');
  });

  it('does not rewrite the editing render path', () => {
    expect(
      buildLocaleHref('https://preview.example/api/editing/render?sc_itemid=abc&sc_lang=en', 'fr-FR')
    ).toBe('/api/editing/render?sc_itemid=abc&sc_lang=fr-FR&sc_site=sodexo');
  });
});
