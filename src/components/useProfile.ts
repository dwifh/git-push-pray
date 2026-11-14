import { useSyncExternalStore } from 'react';
import { loadProfile, type Profile } from '@/shared/profile';

// The device profile (TEAM-PLAN §4.1) as React state, so the tabs and screens follow a change of setup.
let cached: Profile | null | undefined; // undefined = not read from storage yet
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => (listeners.add(fn), () => void listeners.delete(fn));
const read = () => (cached === undefined ? (cached = loadProfile()) : cached);

/** Call after saveProfile / clearProfile. */
export function refreshProfile() {
  cached = loadProfile();
  listeners.forEach((fn) => fn());
}

// The server has no profile: hydrate with none, then the phone fills it in.
export const useProfile = () => useSyncExternalStore(subscribe, read, () => null);
