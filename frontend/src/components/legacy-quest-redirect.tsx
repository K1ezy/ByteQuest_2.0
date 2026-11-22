"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function LegacyQuestRedirect({ target }: { target: string }) {
  const router = useRouter();
  useEffect(() => router.replace(target), [router, target]);
  return <main id="main-content" className="page-shell" role="status">Opening destination…</main>;
}
