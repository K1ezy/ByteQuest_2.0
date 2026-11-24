"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { consumeInviteCallback, getSupabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

export function destinationFor(profile: Profile): string {
  if (profile.role === "admin") return "/admin";
  if (profile.role === "instructor") return "/instructor";
  return "/dashboard";
}

export function HomeRedirect() {
  const router = useRouter();
  useEffect(() => { let active = true; void (async () => {
    try {
      const { data } = await getSupabase().auth.getSession();
      if (!active) return;
      if (consumeInviteCallback()) {
        router.replace("/onboarding?mode=invite");
        return;
      }
      if (!data.session) return;
      const profile = await apiRequest<Profile>("/profile/me");
      if (active) router.replace(destinationFor(profile));
    } catch { /* Public home remains available if the session cannot be checked. */ }
  })(); return () => { active = false; }; }, [router]);
  return null;
}
