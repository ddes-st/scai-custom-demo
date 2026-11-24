export type AffinityEntry = {
  name: string;
  score: number;
};

export type AffinityMap = Record<string, AffinityEntry>;

export const AFFINITY_CLICK_WEIGHT = 1;
export const AFFINITY_DETAIL_WEIGHT = 3;
export const AFFINITY_MAX_SCORE = 100;
export const AFFINITY_MAX_ENTRIES = 12;

export function bumpAffinity(
  current: AffinityMap,
  id: string,
  name: string,
  weight: number,
): AffinityMap {
  const key = id.trim();
  if (!key || weight <= 0) return current;
  const previous = current[key]?.score ?? 0;
  const nextScore = Math.min(AFFINITY_MAX_SCORE, previous + weight);
  const next: AffinityMap = {
    ...current,
    [key]: { name: name.trim() || current[key]?.name || key, score: nextScore },
  };
  return capAffinityMap(next);
}

export function capAffinityMap(map: AffinityMap): AffinityMap {
  const ranked = Object.entries(map).sort((a, b) => b[1].score - a[1].score || a[0].localeCompare(b[0]));
  const capped: AffinityMap = {};
  for (const [id, entry] of ranked.slice(0, AFFINITY_MAX_ENTRIES)) {
    capped[id] = entry;
  }
  return capped;
}

export function topAffinity(map: AffinityMap): { id: string; name: string; score: number } | null {
  let best: { id: string; name: string; score: number } | null = null;
  for (const [id, entry] of Object.entries(map)) {
    if (!best || entry.score > best.score) {
      best = { id, name: entry.name, score: entry.score };
    }
  }
  return best;
}
