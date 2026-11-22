"use client";

import { AdminSectionNav } from "@/components/admin/section-nav";
import { WorkspaceProvider, WorkspaceSuspense } from "@/components/workspace/workspace-provider";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceSuspense label="administration workspace">
      <WorkspaceProvider role="admin"><AdminSectionNav />{children}</WorkspaceProvider>
    </WorkspaceSuspense>
  );
}
