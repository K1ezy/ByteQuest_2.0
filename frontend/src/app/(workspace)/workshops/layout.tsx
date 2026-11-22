"use client";

import { useShellProfile } from "@/components/app-shell";
import { InstructorShell } from "@/components/instructor/course-shell";
import "../instructor/instructor.css";
import "./workshops.css";

export default function WorkshopsLayout({ children }: { children: React.ReactNode }) {
  const profile = useShellProfile();
  if (profile.role !== "instructor") return children;

  return <InstructorShell profile={profile} scope={<span className="ic-scope-label">Workshops</span>}>
    {children}
  </InstructorShell>;
}
