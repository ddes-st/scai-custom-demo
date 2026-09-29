import { filterLocationMatches } from '@/lib/sodexo-locations';

describe('sodexo-locations', () => {
  it('returns no matches for an empty query', () => {
    expect(filterLocationMatches('')).toEqual([]);
    expect(filterLocationMatches('   ')).toEqual([]);
  });

  it('finds France from a partial query', () => {
    expect(filterLocationMatches('Fran')).toEqual(['France']);
  });

  it('is case-insensitive', () => {
    expect(filterLocationMatches('united')).toEqual(['United States', 'United Kingdom']);
  });
});
