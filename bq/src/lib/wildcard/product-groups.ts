import { fieldText, type WildcardLinkedItem } from './normalize';

/** Prefer canonical PDP slugs when collapsing variant SKUs into one family card. */
const PREFERRED_FAMILY_SLUGS = new Set(['double-cylinder-1-sided-readability']);

function familyKey(item: WildcardLinkedItem): string {
  return (
    fieldText(item.fields, 'Family') ||
    fieldText(item.fields, 'Title') ||
    item.name ||
    item.id ||
    ''
  );
}

function pickFamilyRepresentative(members: WildcardLinkedItem[]): WildcardLinkedItem {
  const preferred = members.find((item) => PREFERRED_FAMILY_SLUGS.has(item.name || ''));
  if (preferred) return preferred;

  const allRounder = members.find(
    (item) => fieldText(item.fields, 'Tagline').toLowerCase() === 'technical all-rounder',
  );
  if (allRounder) return allRounder;

  return [...members].sort((a, b) => (a.name || '').localeCompare(b.name || ''))[0]!;
}

/**
 * Collapse variant SKUs that share a Family (e.g. DOM ELS Pro European/Swiss/types)
 * into one catalog card per family — matching the live products filter UI.
 */
export function groupCatalogByFamily(items: WildcardLinkedItem[]): WildcardLinkedItem[] {
  const groups = new Map<string, WildcardLinkedItem[]>();
  for (const item of items) {
    const key = familyKey(item);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return [...groups.values()].map(pickFamilyRepresentative);
}
