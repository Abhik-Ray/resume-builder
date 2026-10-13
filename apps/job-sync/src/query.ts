import type { SearchQuery, UserSearch } from "./types";

// Identical (keywords, location) queries are sent once per run and shared across users
export interface PlannedQuery {
  key: string;
  query: SearchQuery;
  searches: UserSearch[];
}

const normalizeKeywords = (keywords: string[]) =>
  [...new Set(keywords.map((k) => k.trim().toLowerCase()).filter(Boolean))].sort();

const queryKey = (query: SearchQuery) =>
  JSON.stringify([
    query.keywords,
    query.country,
    query.remote ? null : query.city?.toLowerCase() ?? null,
    query.remote ? null : query.region?.toLowerCase() ?? null,
    query.remote ? null : query.radiusKm,
    query.remote,
  ]);

// A local search unless remote-only, plus a remote search (no location) when wanted.
// Excludes stay out of the query so queries can be shared; the matcher applies them.
export const planQueries = (searches: UserSearch[]): PlannedQuery[] => {
  const planned = new Map<string, PlannedQuery>();
  const add = (query: SearchQuery, search: UserSearch) => {
    const key = queryKey(query);
    const entry = planned.get(key) ?? { key, query, searches: [] };
    entry.searches.push(search);
    planned.set(key, entry);
  };
  for (const search of searches) {
    const keywords = normalizeKeywords(search.keywords);
    if (keywords.length === 0) continue;
    const base = { keywords, country: search.country.toUpperCase() };
    if (!search.remoteOnly) {
      add({ ...base, city: search.city, region: search.region, radiusKm: search.radiusKm, remote: false }, search);
    }
    if (search.remoteOnly || search.includeRemote) {
      add({ ...base, city: null, region: null, radiusKm: 0, remote: true }, search);
    }
  }
  return [...planned.values()];
};
