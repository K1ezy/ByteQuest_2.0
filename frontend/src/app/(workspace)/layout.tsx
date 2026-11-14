import { Suspense } from "react";
import { AuthenticatedLayout } from "@/components/app-shell";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<main id="main-content" className="page-shell" role="status">Loading workspace…</main>}>
    <AuthenticatedLayout>{children}</AuthenticatedLayout>
  </Suspense>;
}
