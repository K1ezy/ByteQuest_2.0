"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

export function HomeRedirect() {
  const router = useRouter();
  useEffect(() => { let active = true; void (async () => {
    try {
      const { data } = await getSupabase().auth.getSession();
      if (!active || !data.session) return;
      const profile = await apiRequest<Profile>("/profile/me");
      if (active) router.replace(profile.role === "student" ? "/dashboard" : "/instructor");
    } catch { /* Public home remains available if the session cannot be checked. */ }
  })(); return () => { active = false; }; }, [router]);
  return null;
}
