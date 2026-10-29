"use client";

import { WorkspaceProvider, WorkspaceSuspense } from "@/components/workspace/workspace-provider";

export default function FacultyLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceSuspense label="faculty workspace">
      <WorkspaceProvider role="faculty">{children}</WorkspaceProvider>
    </WorkspaceSuspense>
  );
}
