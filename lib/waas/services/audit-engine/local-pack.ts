// lib/waas/services/audit-engine/local-pack.ts
//
// One Serper /places ("Local Pack") fetch per audit, shared by every consumer:
// the Local Pack report, competitor auto-discovery (A7) and GBP/NAP analysis
// (A3). The call is billed separately from /search, so it is made at most once
// per audit and only when it is available (mock mode, or WAAS_LOCAL_PACK_ENABLED).

import {
  auditDebug,
  getMockPlaces,
  LOCAL_PACK_ENABLED,
  serperPlacesSearch,
  type PlaceResult,
} from "../serper";

export type PlacesStatus = "ok" | "empty" | "error" | "disabled";

export interface PlacesFetch {
  places: PlaceResult[];
  status: PlacesStatus;
}

/** True when a /places lookup can run: offline mock mode, or the billed flag is on. */
export function isPlacesAvailable(
  provider: string,
  enabled: boolean = LOCAL_PACK_ENABLED,
): boolean {
  return provider === "mock" || enabled;
}

export interface PlacesFetcherDeps {
  /** Injected in tests; defaults to the real Serper client. */
  search?: (query: string, location: string) => Promise<PlaceResult[] | null>;
  /** Overrides LOCAL_PACK_ENABLED, for tests. */
  enabled?: boolean;
}

/**
 * Returns a function that performs the places lookup the first time it is
 * called and hands back the same promise afterwards (memoised). It never
 * throws: failures and timeouts resolve to `{ places: [], status: "error" }`.
 */
export function createPlacesFetcher(
  provider: string,
  targetUrl: string,
  typedCompetitorUrls: string[],
  keyword: string | undefined,
  location: string,
  deps: PlacesFetcherDeps = {},
): () => Promise<PlacesFetch> {
  let memo: Promise<PlacesFetch> | null = null;

  return () => {
    if (memo) return memo;
    memo = (async (): Promise<PlacesFetch> => {
      if (!isPlacesAvailable(provider, deps.enabled) || !keyword) {
        return { places: [], status: "disabled" };
      }
      if (provider === "mock") {
        return {
          places: getMockPlaces(
            targetUrl,
            typedCompetitorUrls,
            keyword,
            location,
          ),
          status: "ok",
        };
      }
      try {
        const search = deps.search ?? serperPlacesSearch;
        const places = await search(keyword, location);
        if (places === null) return { places: [], status: "error" };
        if (places.length === 0) return { places: [], status: "empty" };
        return { places, status: "ok" };
      } catch (err) {
        auditDebug("places:error", { error: String(err).slice(0, 200) });
        return { places: [], status: "error" };
      }
    })();
    return memo;
  };
}
