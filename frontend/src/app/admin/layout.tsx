"use client";

import { WorkspaceProvider, WorkspaceSuspense } from "@/components/workspace/workspace-provider";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceSuspense label="administration workspace">
      <WorkspaceProvider role="admin">{children}</WorkspaceProvider>
    </WorkspaceSuspense>
  );
}
