export type SodexoLocationRegion = {
  name: string;
  countries: string[];
};

export const SODEXO_LOCATION_REGIONS: SodexoLocationRegion[] = [
  {
    name: 'Americas',
    countries: [
      'Brazil',
      'Canada',
      'Chile',
      'Colombia',
      'Costa Rica',
      'Mexico',
      'Panama',
      'Peru',
      'United States',
      'Uruguay',
      'Venezuela',
    ],
  },
  {
    name: 'Asia',
    countries: [
      'Australia',
      'Greater China',
      'Hong Kong China',
      'India',
      'Indonesia',
      'Japan',
      'Malaysia',
      'Philippines',
      'Singapore',
      'South Korea',
      'Thailand',
    ],
  },
  {
    name: 'Europe',
    countries: [
      'Austria',
      'Belgium',
      'Bulgaria',
      'Czech Republic',
      'Denmark',
      'Finland',
      'France',
      'Germany',
      'Hungary',
      'Ireland',
      'Italy',
      'Luxembourg',
      'Netherlands',
      'Poland',
      'Romania',
      'Spain',
      'Sweden',
      'Switzerland',
      'Turkey',
      'United Kingdom',
      'Worldwide',
    ],
  },
  {
    name: 'Middle East',
    countries: ['Israel', 'Middle East'],
  },
];

export const SODEXO_ACTIVE_COUNTRY = 'France';

export function filterLocationMatches(query: string): string[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return SODEXO_LOCATION_REGIONS.flatMap((region) => region.countries).filter((country) =>
    country.toLowerCase().includes(needle)
  );
}
