import type { Profile } from "@/lib/types";

const PROFILE_UPDATED_EVENT = "bytequest:profile-updated";

/** Keep independently mounted headers and workspaces in sync after a profile edit. */
export function publishProfileUpdate(profile: Profile): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<Profile>(PROFILE_UPDATED_EVENT, { detail: profile }));
}

export function subscribeToProfileUpdates(listener: (profile: Profile) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handle = (event: Event) => listener((event as CustomEvent<Profile>).detail);
  window.addEventListener(PROFILE_UPDATED_EVENT, handle);
  return () => window.removeEventListener(PROFILE_UPDATED_EVENT, handle);
}
