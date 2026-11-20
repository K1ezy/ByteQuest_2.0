"use client";

import { usePathname } from "next/navigation";
import { InstructorCourseShell } from "@/components/instructor/course-shell";
import { WorkspaceProvider, WorkspaceSuspense } from "@/components/workspace/workspace-provider";
import { usesInstructorCourseShell } from "@/lib/navigation";
import "./instructor.css";

export default function FacultyLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <WorkspaceSuspense label="instructor workspace">
      <WorkspaceProvider role="faculty" shell={usesInstructorCourseShell(pathname) ? InstructorCourseShell : undefined}>{children}</WorkspaceProvider>
    </WorkspaceSuspense>
  );
}
