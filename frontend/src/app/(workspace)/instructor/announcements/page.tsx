"use client";

import { CourseAnnouncements } from "@/components/instructor/course-announcements";
import { useWorkspace } from "@/components/workspace/workspace-provider";

export default function AnnouncementsPage() {
  const { courseId } = useWorkspace();
  return courseId ? <CourseAnnouncements key={courseId} courseId={courseId} /> : null;
}
