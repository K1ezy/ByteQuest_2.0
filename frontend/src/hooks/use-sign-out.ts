"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOutSharedComputer } from "@/lib/supabase";

/**
 * One sign-out path for every entry point (account menus and Journey view).
 * signOutSharedComputer clears provider + local/session state and replaces the
 * current history entry with the authentication menu.
 */
export function useSignOut() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState("");
  const inFlightRef = useRef(false);

  const signOut = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsSigningOut(true);
    setError("");

    try {
      await signOutSharedComputer(router);
    } catch {
      setError("Could not sign out cleanly. Please try again.");
    } finally {
      inFlightRef.current = false;
      setIsSigningOut(false);
    }
  }, [router]);

  return { isSigningOut, error, signOut };
}
