import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Returns `serverValue` on the server and during hydration, then the string
 * produced by `getClientValue()` once running in the browser.
 *
 * Use it for values that can only be computed in the browser (URL query,
 * localStorage, hostname) instead of `useState(fallback)` + an effect that sets
 * it. `getClientValue` is re-evaluated on every render, so it must be cheap and
 * return the same string for the same browser state.
 */
export function useClientValue(
  getClientValue: () => string,
  serverValue: string,
): string {
  return useSyncExternalStore(subscribe, getClientValue, () => serverValue);
}
