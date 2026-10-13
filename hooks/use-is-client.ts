import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * `false` on the server and during hydration, `true` on the client afterwards.
 * Use it instead of a `useState(false)` + `useEffect(() => set(true))` "mounted"
 * flag for output that must differ between server and browser.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
