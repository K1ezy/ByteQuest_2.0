"use client";

import { WorkspaceProvider, WorkspaceSuspense } from "@/components/workspace/workspace-provider";

export default function FacultyLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceSuspense label="instructor workspace">
      <WorkspaceProvider role="faculty">{children}</WorkspaceProvider>
    </WorkspaceSuspense>
  );
}
